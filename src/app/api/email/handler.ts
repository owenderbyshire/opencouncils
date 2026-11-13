/**
 * Links in emails. GET shows a page with one button, because mail scanners
 * open links and would otherwise confirm or stop on someone's behalf; the
 * button POSTs back here. Mail clients' one-click unsubscribe (RFC 8058)
 * POSTs directly. The signed token must match either way.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { subscribers } from "@/db/schema";
import { followMessages } from "@/i18n/messages/follow";
import { checkEmailToken } from "@/lib/email/token";

type Purpose = "confirm" | "digest";

function read(request: NextRequest, purpose: Purpose) {
  const p = request.nextUrl.searchParams;
  const id = p.get("u") ?? "";
  const lang = p.get("lang") === "cy" ? ("cy" as const) : ("en" as const);
  const ok = Boolean(id) && id.length <= 100 && checkEmailToken(purpose, id, p.get("t") ?? "");
  return { id, lang, ok };
}

export async function act(request: NextRequest, purpose: Purpose): Promise<Response> {
  const { id, lang, ok } = read(request, purpose);
  const base = lang === "cy" ? "/cy/follow" : "/follow";
  let outcome = "error=link";
  if (ok) {
    const db = getDb();
    if (purpose === "confirm") {
      const done = await db
        .update(subscribers)
        .set({
          status: "active",
          confirmedAt: new Date(),
          councils: sql`coalesce(${subscribers.pendingCouncils}, ${subscribers.councils})`,
          topics: sql`coalesce(${subscribers.pendingTopics}, ${subscribers.topics})`,
          postcode: sql`case when ${subscribers.pendingPostcode} is null then ${subscribers.postcode} else nullif(${subscribers.pendingPostcode}, '') end`,
          lat: sql`case when ${subscribers.pendingPostcode} is null then ${subscribers.lat} else ${subscribers.pendingLat} end`,
          lng: sql`case when ${subscribers.pendingPostcode} is null then ${subscribers.lng} else ${subscribers.pendingLng} end`,
          lang: sql`coalesce(${subscribers.pendingLang}, ${subscribers.lang})`,
          pendingLat: null,
          pendingLng: null,
          pendingLang: null,
          keywords: sql`coalesce(${subscribers.pendingKeywords}, ${subscribers.keywords})`,
          instant: sql`coalesce(${subscribers.pendingInstant}, ${subscribers.instant})`,
          pendingPostcode: null,
          pendingCouncils: null,
          pendingTopics: null,
          pendingKeywords: null,
          pendingInstant: null,
        })
        // Only while choices are waiting: an old link can't restart emails someone stopped.
        .where(and(eq(subscribers.id, id), isNotNull(subscribers.pendingCouncils)))
        .returning({ id: subscribers.id });
      if (done.length) outcome = "confirmed=1";
    } else {
      await db.update(subscribers).set({ status: "stopped" }).where(eq(subscribers.id, id));
      outcome = "stopped=1";
    }
  }
  return Response.redirect(new URL(`${base}?${outcome}`, request.nextUrl.origin), 303);
}

export function page(request: NextRequest, purpose: Purpose): Response {
  const { lang } = read(request, purpose);
  const t = followMessages[lang][purpose === "confirm" ? "confirmPage" : "stopPage"];
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const action = request.nextUrl.pathname + request.nextUrl.search;
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t.title)}</title>
<style>body{font-family:system-ui,sans-serif;color:#1c2630;background:#fff;max-width:32rem;margin:4rem auto;padding:0 16px}button{font:inherit;padding:.6rem 1rem;border:0;border-radius:4px;background:#1c2630;color:#fff;cursor:pointer}</style></head>
<body><h1>${esc(t.title)}</h1><p>${esc(t.body)}</p>
<form method="post" action="${esc(action)}"><button type="submit">${esc(t.button)}</button></form></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
