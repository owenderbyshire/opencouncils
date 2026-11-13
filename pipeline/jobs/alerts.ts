/**
 * Instant alerts: a short email the same day something new matches what a
 * reader asked for. Runs after each morning's meetings run and after each
 * planning run. Each piece of news is sent once: the keys of what was sent
 * are kept in alert_log.
 *
 * What counts as news, for readers who chose instant alerts:
 *   - an agenda item mentioning one of their words (on the agenda, then again once decided);
 *   - a planning application mentioning one of their words, or within a kilometre of their postcode;
 *   - a new meeting summary from a council they follow;
 *   - a decision on a subject they follow.
 *
 *   pnpm pipeline alerts [--dry-run]
 *
 * Needs RESEND_API_KEY and ALERTS_FROM.
 */
import { and, eq, sql } from "drizzle-orm";
import { committeeName } from "../../src/lib/committees";
import { COUNCILS } from "../../data/curated/councils";
import { TOPIC_BY_SLUG } from "../../data/curated/topics";
import { alertLog, subscribers } from "../../src/db/schema";
import { canSend, sendEmail } from "../../src/lib/email/send";
import { emailToken } from "../../src/lib/email/token";
import { absUrl } from "../../src/i18n/config";
import { SITE } from "../../src/lib/site";
import { itemKey, itemsMatching, planKey, plansMatching, plansNear, type ItemHit, type PlanHit } from "../lib/alerts";
import type { Job, JobContext } from "../lib/job";
import { C, dayMonth, esc, SANS, SERIF, sectionHead } from "./digest";

type Lang = "en" | "cy";

/** Most entries in one alert; the rest wait for the next run. */
const MAX_ENTRIES = 25;

const L = {
  en: {
    site: "OpenCouncil",
    subjectOne: (what: string) => `New on OpenCouncil: ${what}`,
    subjectMany: (n: number) => `${n} new matches on OpenCouncil`,
    title: "New for you",
    words: (w: string) => `“${w}”`,
    onAgenda: "On the agenda",
    decided: "Decided",
    planning: (pc: string) => `Planning near ${pc}`,
    planNew: "New application",
    planDecided: "Decided",
    councils: "Your councils",
    councilRead: "Read what was decided",
    topics: "Your subjects",
    why: "You get these alerts because you asked for them on OpenCouncil. Agendas and minutes are checked every morning, planning applications three times a day.",
    change: "Change what you get",
    stop: "Stop all emails",
  },
  cy: {
    site: "OpenCouncil",
    subjectOne: (what: string) => `Newydd ar OpenCouncil: ${what}`,
    subjectMany: (n: number) => `${n} o bethau newydd ar OpenCouncil`,
    title: "Newydd i chi",
    words: (w: string) => `“${w}”`,
    onAgenda: "Ar yr agenda",
    decided: "Penderfynwyd",
    planning: (pc: string) => `Cynllunio ger ${pc}`,
    planNew: "Cais newydd",
    planDecided: "Penderfynwyd",
    councils: "Eich cynghorau",
    councilRead: "Darllen beth a benderfynwyd",
    topics: "Eich pynciau",
    why: "Rydych chi'n cael y rhybuddion hyn am i chi ofyn amdanyn nhw ar OpenCouncil. Mae agendâu a chofnodion yn cael eu gwirio bob bore, a cheisiadau cynllunio dair gwaith y dydd.",
    change: "Newid beth rydych chi'n ei gael",
    stop: "Stopio pob e-bost",
  },
} as const;

type Summary = { councilId: string; meetingId: number; date: string; committeeEn: string; committeeCy: string | null; overviewEn: string | null; overviewCy: string | null };

async function newSummaries(ctx: JobContext, councils: string[], since: Date): Promise<Summary[]> {
  if (!councils.length) return [];
  return [
    ...(await ctx.db.execute<Summary>(sql`
      select distinct on (s.council_id, s.meeting_id) s.council_id as "councilId", s.meeting_id as "meetingId", m.date::text as date,
        c.name_en as "committeeEn", c.name_cy as "committeeCy", s.content->>'overviewEn' as "overviewEn", s.content->>'overviewCy' as "overviewCy"
      from summaries s
      join meetings m on m.council_id = s.council_id and m.id = s.meeting_id
      join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where s.council_id in (${sql.join(councils.map((c) => sql`${c}`), sql`, `)})
        and s.created_at >= ${since.toISOString()}::timestamptz
        and coalesce(s.content->>'mode', 'minutes') = 'minutes'
        and m.date >= (${since.toISOString()}::timestamptz - interval '60 days')::date
      order by s.council_id, s.meeting_id, s.created_at desc
    `)),
  ].map((r) => ({ ...r, meetingId: Number(r.meetingId) }));
}

type TopicRow = Omit<ItemHit, "snippet" | "upcoming" | "decided">;

async function topicDecisions(ctx: JobContext, topic: string, councils: string[], since: Date): Promise<ItemHit[]> {
  const scope = councils.length ? sql`and i.council_id in (${sql.join(councils.map((c) => sql`${c}`), sql`, `)})` : sql``;
  const rows = await ctx.db.execute<TopicRow>(sql`
    select i.council_id as "councilId", i.meeting_id as "meetingId", i.agenda_item_id as "agendaItemId", i.date::text as date,
      i.title, c.name_en as "committeeEn", c.name_cy as "committeeCy", i.headline_en as "headlineEn", i.headline_cy as "headlineCy"
    from search_items i
    join committees c on c.council_id = i.council_id and c.id = i.committee_id
    where ${topic} = any(i.topics) and i.decision is not null ${scope}
      and exists (select 1 from summaries s where s.council_id = i.council_id and s.meeting_id = i.meeting_id and s.created_at >= ${since.toISOString()}::timestamptz)
      and i.date >= (${since.toISOString()}::timestamptz - interval '60 days')::date
    order by i.date desc limit 8
  `);
  return [...rows].map((r) => ({ ...r, meetingId: Number(r.meetingId), agendaItemId: Number(r.agendaItemId), upcoming: false, decided: true, snippet: null }));
}

type Section =
  | { kind: "word"; word: string; items: ItemHit[]; plans: PlanHit[] }
  | { kind: "near"; postcode: string; plans: PlanHit[] }
  | { kind: "councils"; summaries: Summary[] }
  | { kind: "topic"; slug: string; items: ItemHit[] };

export function composeAlert(lang: Lang, id: string, sections: Section[]) {
  const l = L[lang];
  const cy = lang === "cy";
  const root = absUrl(lang, "/").replace(/\/$/, "");
  const unsubscribe = `${SITE.url}/api/email/stop?u=${encodeURIComponent(id)}&t=${emailToken("digest", id) ?? ""}&lang=${lang}`;
  const manage = `${root}/follow?u=${encodeURIComponent(id)}&t=${emailToken("manage", id) ?? ""}`;
  const councilShort = (cid: string | null) => {
    const c = COUNCILS.find((x) => x.id === cid);
    return c ? (cy ? c.shortCy : c.shortEn) : "";
  };
  const committee = (x: { committeeEn: string; committeeCy: string | null }) => committeeName(cy ? "cy" : "en", x.committeeEn, x.committeeCy).text;
  const rows: string[] = [];
  const text: string[] = [];
  const heads: string[] = [];

  const entry = (url: string, label: string, head: string, body: string | null) => {
    heads.push(head);
    text.push(`${label}: ${head}`, ...(body ? [body] : []), url, "");
    rows.push(`<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${C.rule}"><tr><td style="padding:12px 0 14px">
<p style="margin:0;font-size:13px;color:${C.ink3}">${esc(label)}</p>
<p style="margin:2px 0 0"><a href="${esc(url)}" style="font-size:16px;font-weight:600;color:${C.ink};text-decoration:none">${esc(head)}</a></p>
${body ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${C.ink}">${esc(body)}</p>` : ""}
</td></tr></table></td></tr>`);
  };
  const item = (h: ItemHit) =>
    entry(
      `${root}/${h.councilId}/meetings/${h.meetingId}#item-${h.agendaItemId}`,
      `${h.decided ? l.decided : l.onAgenda}: ${councilShort(h.councilId)}, ${committee(h)}, ${dayMonth(lang, h.date)}`,
      (cy ? h.headlineCy : h.headlineEn) || h.title,
      h.snippet,
    );
  const plan = (h: PlanHit) =>
    entry(
      `${root}/planning/application/${h.id}`,
      [h.decidedDate ? l.planDecided : l.planNew, councilShort(h.councilId), h.reference].filter(Boolean).join(", "),
      h.address || h.reference || "",
      [h.decidedDate && h.decision ? h.decision : null, h.description ? h.description.slice(0, 220) : null].filter(Boolean).join(". ") || null,
    );

  rows.push(`<tr><td style="background:${C.ink};padding:22px 32px 20px">
<p style="margin:0;font-family:${SERIF};font-size:17px;color:#ffffff;font-weight:600">${esc(l.site)}</p>
<h1 style="margin:12px 0 0;font-family:${SERIF};font-size:26px;line-height:1.15;color:#ffffff;font-weight:600">${esc(l.title)}</h1>
</td></tr>`);
  for (const s of sections) {
    if (s.kind === "word") {
      rows.push(sectionHead(l.words(s.word)));
      text.push(l.words(s.word), "");
      s.items.forEach(item);
      s.plans.forEach(plan);
    } else if (s.kind === "near") {
      rows.push(sectionHead(l.planning(s.postcode)));
      text.push(l.planning(s.postcode), "");
      s.plans.forEach(plan);
    } else if (s.kind === "councils") {
      rows.push(sectionHead(l.councils));
      text.push(l.councils, "");
      for (const m of s.summaries)
        entry(
          `${root}/${m.councilId}/meetings/${m.meetingId}`,
          `${councilShort(m.councilId)}, ${dayMonth(lang, m.date)}`,
          committee(m),
          (cy ? m.overviewCy : m.overviewEn) || null,
        );
    } else {
      const def = TOPIC_BY_SLUG.get(s.slug);
      const name = def ? (cy ? def.cy : def.en) : s.slug;
      rows.push(sectionHead(`${l.topics}: ${name}`));
      text.push(`${l.topics}: ${name}`, "");
      s.items.forEach(item);
    }
  }
  rows.push(`<tr><td style="padding:26px 32px 26px"><p style="margin:0;font-size:13px;line-height:1.55;color:${C.ink3}">${esc(l.why)} <a href="${esc(manage)}" style="color:${C.ink2}">${esc(l.change)}</a>. <a href="${esc(unsubscribe)}" style="color:${C.ink2}">${esc(l.stop)}</a>.</p></td></tr>`);
  text.push(l.why, `${l.change}: ${manage}`, `${l.stop}: ${unsubscribe}`);

  const subject = heads.length === 1 ? l.subjectOne(heads[0].slice(0, 90)) : l.subjectMany(heads.length);
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:${SANS};color:${C.ink}">
${rows.join("\n")}
</table></td></tr></table></body></html>`;
  return { subject, html, text: [subject, "", ...text].join("\n"), unsubscribe };
}

const ukDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);

export const alertsJob: Job = {
  name: "alerts",
  description: "Same-day email alerts for words, places, planning, councils and subjects",
  async run(ctx) {
    const dryRun = ctx.args["dry-run"] === true || !canSend();
    if (dryRun) ctx.log("dry run: no emails will be sent (needs RESEND_API_KEY and ALERTS_FROM)");
    const readers = await ctx.db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.status, "active"), eq(subscribers.instant, true)));
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    // Readers often share words and councils: match each combination once per run.
    const cache = new Map<string, Promise<unknown>>();
    const once = <T>(key: string, f: () => Promise<T>): Promise<T> => {
      if (!cache.has(key)) cache.set(key, f());
      return cache.get(key) as Promise<T>;
    };
    for (const r of readers) {
      const lang: Lang = r.lang === "cy" ? "cy" : "en";
      // Only news that arrived after they signed up (with a week's grace for agendas already out).
      const confirmed = r.confirmedAt ?? r.createdAt;
      const since = confirmed > monthAgo ? confirmed : monthAgo;
      const itemsFrom = ukDate(new Date(Math.max(since.getTime() - 7 * 86_400_000, monthAgo.getTime())));
      const councils = r.councils.filter((c) => COUNCILS.some((x) => x.id === c));
      const sent = new Set(
        (await ctx.db.select({ key: alertLog.key }).from(alertLog).where(eq(alertLog.subscriberId, r.id))).map((x) => x.key),
      );
      const keys: string[] = [];
      let room = MAX_ENTRIES;
      const take = <T>(list: T[], key: (x: T) => string): T[] => {
        const out: T[] = [];
        for (const x of list) {
          const k = key(x);
          if (room <= 0 || sent.has(k) || keys.includes(k)) continue;
          out.push(x);
          keys.push(k);
          room--;
        }
        return out;
      };
      const sections: Section[] = [];
      for (const word of r.keywords) {
        const scope = [...councils].sort().join(",");
        const sinceKey = since.toISOString().slice(0, 13);
        const items = take(await once(`i|${word.toLowerCase()}|${scope}|${itemsFrom}`, () => itemsMatching(ctx, word, councils, itemsFrom)), itemKey);
        const plans = take(await once(`p|${word.toLowerCase()}|${scope}|${sinceKey}`, () => plansMatching(ctx, word, councils, since)), planKey);
        if (items.length || plans.length) sections.push({ kind: "word", word, items, plans });
      }
      if (r.postcode && r.lat !== null && r.lng !== null) {
        const plans = take(await plansNear(ctx, r.lat, r.lng, since), planKey);
        if (plans.length) sections.push({ kind: "near", postcode: r.postcode, plans });
      }
      const summaries = take(await newSummaries(ctx, councils, since), (m) => `summary:${m.councilId}:${m.meetingId}`);
      if (summaries.length) sections.push({ kind: "councils", summaries });
      for (const slug of r.topics) {
        if (!TOPIC_BY_SLUG.has(slug)) continue;
        const items = take(await topicDecisions(ctx, slug, councils, since), itemKey);
        if (items.length) sections.push({ kind: "topic", slug, items });
      }
      if (!keys.length) continue;
      const message = composeAlert(lang, r.id, sections);
      if (dryRun) {
        ctx.log(`would alert ${r.id}: ${message.subject}`);
        // --preview <dir>: write each email to a file to look at.
        if (typeof ctx.args.preview === "string") {
          const { writeFile } = await import("node:fs/promises");
          await writeFile(`${ctx.args.preview}/alert-${r.id}.html`, message.html);
        }
        ctx.count("wouldSend");
        continue;
      }
      const result = await sendEmail({ to: r.email, subject: message.subject, html: message.html, text: message.text, unsubscribe: message.unsubscribe });
      if (result.ok) {
        await ctx.db
          .insert(alertLog)
          .values(keys.map((key) => ({ subscriberId: r.id, key })))
          .onConflictDoNothing();
        ctx.count("sent");
        ctx.count("entries", keys.length);
      } else {
        ctx.warn(`alert for ${r.id}: ${result.error}`);
        ctx.count("failed");
      }
    }
    // Forget what was sent long ago; nothing that old is matched again.
    await ctx.db.delete(alertLog).where(sql`${alertLog.sentAt} < now() - interval '120 days'`);
  },
};
