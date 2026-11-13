"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { subscribers } from "@/db/schema";
import { href, isLocale, type Locale } from "@/i18n/config";
import { followMessages } from "@/i18n/messages/follow";
import { lookupPostcode, normalisePostcode } from "@/data/postcode";
import { LIVE_COUNCILS, councilShort } from "@/lib/councils";
import { canSend, sendEmail } from "@/lib/email/send";
import { checkEmailToken, emailToken } from "@/lib/email/token";
import { SITE } from "@/lib/site";
import { TOPICS, topicName } from "@/lib/topics";

const COUNCIL_IDS = new Set(LIVE_COUNCILS.map((c) => c.id));
const TOPIC_IDS = new Set(TOPICS.map((t) => t.slug));
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

function localeOf(form: FormData): Locale {
  const l = String(form.get("lang") ?? "en");
  return isLocale(l) ? l : "en";
}

/** The postcode asked for, with its location; null for none, false for one we can't find in Wales. */
async function postcodeOf(form: FormData): Promise<{ postcode: string; lat: number; lng: number } | null | false> {
  const raw = String(form.get("postcode") ?? "").trim();
  if (!raw) return null;
  const pc = normalisePostcode(raw);
  if (!pc) return false;
  const r = await lookupPostcode(pc);
  return r.ok && r.lat !== null && r.lng !== null ? { postcode: pc, lat: r.lat, lng: r.lng } : false;
}

function choices(form: FormData) {
  const councils = form.getAll("council").map(String).filter((c) => COUNCIL_IDS.has(c));
  const topics = form.getAll("topic").map(String).filter((t) => TOPIC_IDS.has(t));
  const words = String(form.get("keywords") ?? "")
    .split(/[\n,;]+/)
    .map((w) => w.replace(/\s+/g, " ").trim().slice(0, 60))
    .filter(Boolean);
  const seen = new Set<string>();
  const keywords = words.filter((w) => !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase())).slice(0, 10);
  return {
    councils: [...new Set(councils)].slice(0, 22),
    topics: [...new Set(topics)].slice(0, 12),
    keywords,
    // Fewer than three letters would match far too much.
    badKeyword: keywords.some((w) => (w.match(/\p{L}/gu)?.length ?? 0) < 3 && !/\d{2,}/.test(w)),
    instant: form.get("instant") === "on",
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function confirmEmail(
  locale: Locale,
  id: string,
  { councils, topics, keywords, instant }: ReturnType<typeof choices>,
  postcode: string | null,
) {
  const t = followMessages[locale].confirmEmail;
  const token = emailToken("confirm", id) ?? "";
  const link = `${SITE.url}/api/email/confirm?u=${encodeURIComponent(id)}&t=${token}&lang=${locale}`;
  const names = [
    ...councils.map((c) => councilShort(locale, LIVE_COUNCILS.find((x) => x.id === c)!)),
    ...topics.map((s) => topicName(locale, s)),
    ...(postcode ? [`${followMessages[locale].postcode}: ${postcode}`] : []),
    // The words themselves aren't repeated, so the form can't carry someone else's text into an inbox.
    ...(keywords.length ? [t.keywordCount.replace("{n}", String(keywords.length))] : []),
    ...(instant ? [t.instant] : []),
  ];
  const text = [t.intro, "", ...names.map((n) => `- ${n}`), "", `${t.button}: ${link}`, "", t.ignore].join("\n");
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;padding:24px 12px;background:#e9edf1;font-family:'IBM Plex Sans',-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c2630">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#fff;border-radius:10px"><tr><td style="padding:28px 28px 24px">
<p style="margin:0;font-family:Georgia,serif;font-size:17px;font-weight:600">OpenCouncil</p>
<p style="margin:18px 0 8px;font-size:15px;line-height:1.5">${esc(t.intro)}</p>
<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.6">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;background:#1c2630;color:#fff;text-decoration:none;padding:10px 16px;border-radius:4px;font-weight:600">${esc(t.button)}</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#5f6c79">${esc(t.ignore)}</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: t.subject, html, text };
}

/** Sign up: stores the address as pending and sends the confirmation link. */
export async function subscribeAction(form: FormData) {
  const locale = localeOf(form);
  const back = (q: string) => redirect(`${href(locale, "/follow")}?${q}`);
  // A field people can't see; bots fill it in.
  if (String(form.get("website") ?? "")) back("sent=1");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) back("error=email");
  const chosen = choices(form);
  const { councils, topics, keywords, instant } = chosen;
  const place = await postcodeOf(form);
  if (place === false) back("error=postcode");
  if (chosen.badKeyword) back("error=keywords");
  if (!councils.length && !topics.length && !keywords.length && !place) back("error=choose");
  if (!canSend()) back("error=send");

  const db = getDb();
  // A ceiling on confirmation emails across the site, so the form can't be used to send mail in bulk.
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(sql`${subscribers.confirmSentAt} > now() - interval '1 hour'`);
  if ((recent?.n ?? 0) >= 40) back("error=busy");
  const [existing] = await db.select().from(subscribers).where(eq(subscribers.email, email));
  // One confirmation email per address every ten minutes, whatever is asked.
  if (existing?.confirmSentAt && Date.now() - existing.confirmSentAt.getTime() < 10 * 60_000) back("sent=1");
  const id = existing?.id ?? randomUUID();
  if (existing)
    await db
      .update(subscribers)
      .set({
        pendingCouncils: councils,
        pendingTopics: topics,
        pendingKeywords: keywords,
        pendingInstant: instant,
        pendingPostcode: place ? place.postcode : "",
        // Nothing changes on the live row until the link is followed.
        pendingLat: place ? place.lat : null,
        pendingLng: place ? place.lng : null,
        pendingLang: locale,
        confirmSentAt: new Date(),
      })
      .where(eq(subscribers.id, id));
  else
    await db.insert(subscribers).values({
      id,
      email,
      lang: locale,
      status: "pending",
      pendingCouncils: councils,
      pendingTopics: topics,
      pendingKeywords: keywords,
      pendingInstant: instant,
      pendingPostcode: place ? place.postcode : "",
      pendingLat: place ? place.lat : null,
      pendingLng: place ? place.lng : null,
      pendingLang: locale,
      confirmSentAt: new Date(),
    });
  const sent = await sendEmail({ to: email, ...confirmEmail(locale, id, chosen, place ? place.postcode : null) });
  if (!sent.ok) {
    console.error(`confirmation email: ${sent.error}`);
    back("error=send");
  }
  back("sent=1");
}

/** Changes choices from the link in a weekly email (signed, so no confirmation needed). */
export async function saveChoicesAction(form: FormData) {
  const locale = localeOf(form);
  const id = String(form.get("u") ?? "");
  const token = String(form.get("t") ?? "");
  if (!id || id.length > 100 || !checkEmailToken("manage", id, token)) redirect(`${href(locale, "/follow")}?error=link`);
  const { councils, topics, keywords, instant, badKeyword } = choices(form);
  const place = await postcodeOf(form);
  const again = (e: string) => redirect(`${href(locale, "/follow")}?u=${encodeURIComponent(id)}&t=${token}&error=${e}`);
  if (place === false) again("postcode");
  if (badKeyword) again("keywords");
  if (!councils.length && !topics.length && !keywords.length && !place) again("choose");
  await getDb()
    .update(subscribers)
    .set({
      councils,
      topics,
      keywords,
      instant,
      postcode: place ? place.postcode : null,
      lat: place ? place.lat : null,
      lng: place ? place.lng : null,
      lang: locale,
      status: "active",
    })
    .where(eq(subscribers.id, id));
  redirect(`${href(locale, "/follow")}?u=${encodeURIComponent(id)}&t=${token}&saved=1`);
}
