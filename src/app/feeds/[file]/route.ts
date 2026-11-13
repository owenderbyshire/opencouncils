/**
 * Public feeds: follow any council, committee, topic or search without an
 * account.
 *
 *   /feeds/cardiff.xml                     decisions at Cardiff
 *   /feeds/cardiff-committee-123.xml       decisions of one committee
 *   /feeds/topic-housing.xml               decisions on a topic, every council
 *   /feeds/search.xml?q=...&council=...    new matches for a search
 *   /feeds/cardiff.ics                     Cardiff's meetings, as a calendar
 *   /feeds/cardiff-committee-123.ics       one committee's meetings
 *   /feeds/planned-decisions.ics           decisions councils plan to take, on the day each is due (?topic=, ?makers=all)
 *   /feeds/cardiff-planned-decisions.ics   the same for one council
 *
 * Add ?lang=cy for Welsh. Paths with a file extension skip the locale proxy.
 */
import type { NextRequest } from "next/server";
import { plannedDecisions } from "@/data/forward-plans";
import { latestItems, upcomingAcrossWales, type ItemRow } from "@/data/search";
import { absUrl, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { forwardPlanMessages } from "@/i18n/messages/forward-plans";
import { pickText } from "@/i18n/pick";
import { committeeName } from "@/lib/committees";
import { councilConfig, councilName, councilShort, liveCouncil } from "@/lib/councils";
import { meetingUrl } from "@/lib/official-urls";
import { searchText } from "@/lib/params";
import { isId } from "@/lib/route";
import { TOPIC_BY_SLUG } from "@/lib/topics";

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

function rss(locale: Locale, title: string, link: string, items: ItemRow[]): Response {
  const body = items
    .map((r) => {
      const c = councilConfig(r.councilId);
      const committee = committeeName(locale, r.committeeEn, r.committeeCy).text;
      const headline = pickText(locale, r.headlineEn, r.headlineCy).text || r.title;
      const decided = pickText(locale, r.decidedEn, r.decidedCy).text || r.decision || "";
      const url = `${absUrl(locale, `/${r.councilId}/meetings/${r.meetingId}`)}#item-${r.agendaItemId}`;
      const where = [c ? councilName(locale, c) : r.councilId, committee].join(", ");
      return `<item>
<title>${xml(headline)}</title>
<link>${xml(url)}</link>
<guid isPermaLink="false">${xml(`${r.councilId}-${r.agendaItemId}`)}</guid>
<pubDate>${new Date(`${r.date}T12:00:00Z`).toUTCString()}</pubDate>
<category>${xml(where)}</category>
<description>${xml(`${where}. ${decided}`.trim())}</description>
</item>`;
    })
    .join("\n");
  const doc = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${xml(`${title} | ${common[locale].siteName}`)}</title>
<link>${xml(link)}</link>
<description>${xml(common[locale].description)}</description>
<language>${locale === "cy" ? "cy" : "en-gb"}</language>
${body}
</channel>
</rss>`;
  return new Response(doc, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}

/** Folds long lines as the iCalendar format requires. */
function fold(line: string): string {
  // Lines may be at most 75 bytes; Welsh accented letters take two.
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = out.length ? 74 : 75;
    if (Buffer.byteLength(cur + ch) > limit) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const ics = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

async function calendar(locale: Locale, councilId: string, committee?: number): Promise<Response> {
  const c = councilConfig(councilId)!;
  const meetings = await upcomingAcrossWales(180, councilId, committee);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenCouncils//Council meetings//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${ics(councilName(locale, c))}`,
    "X-WR-TIMEZONE:Europe/London",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "DTSTART:19700329T010000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "DTSTART:19701025T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  for (const m of meetings) {
    const day = m.date.replace(/-/g, "");
    const name = committeeName(locale, m.committeeEn, m.committeeCy).text;
    const page = absUrl(locale, `/${m.councilId}/meetings/${m.meetingId}`);
    const official = meetingUrl(c, m.meetingId, locale);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${m.councilId}-${m.meetingId}@localrecord`,
      `DTSTAMP:${stamp}`,
      // Councils publish a start time only, so no end time is given.
      m.startTime ? `DTSTART;TZID=Europe/London:${day}T${m.startTime.replace(":", "")}00` : `DTSTART;VALUE=DATE:${day}`,
      `SUMMARY:${ics(name)}`,
      ...(m.location ? [`LOCATION:${ics(m.location)}`] : []),
      `DESCRIPTION:${ics([...m.agenda, "", page, official ?? ""].join("\n").trim())}`,
      `URL:${page}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}

/**
 * Planned decisions as all-day events on the day each is due: the Cabinet's by default, every decision maker's with
 * makers=all. A decision with only a month, or no date, has no day to sit on and is left out.
 */
async function plannedCalendar(locale: Locale, councilId: string | undefined, topic: string | undefined, everyMaker: boolean): Promise<Response> {
  const t = forwardPlanMessages[locale];
  const c = councilId ? councilConfig(councilId) : undefined;
  const { ahead } = await plannedDecisions();
  const list = ahead.filter((d) => !d.monthOnly && d.when && (!councilId || d.councilId === councilId) && (!topic || d.topics.includes(topic)) && (everyMaker || d.executive));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//OpenCouncils//Planned decisions//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${ics(c ? t.feed.nameCouncil.replace("{name}", councilName(locale, c)) : `${t.feed.name}, ${common[locale].siteName}`)}`,
  ];
  for (const d of list) {
    const council = councilConfig(d.councilId);
    const day = d.when!.replace(/-/g, "");
    // An all-day event ends on the next day.
    const next = new Date(Date.parse(`${d.when}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
    const page = `${absUrl(locale, "/forward-plans")}?council=${d.councilId}`;
    const about = [
      `${council ? councilShort(locale, council) : d.councilId}: ${d.makers}`,
      ...(d.isKey ? [t.key] : []),
      ...(d.leadMember ? [`${t.leadMember}: ${d.leadMember}`] : []),
      "",
      d.url,
      page,
    ];
    lines.push(
      "BEGIN:VEVENT",
      `UID:planned-${d.councilId}-${d.issueId}@localrecord`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${ics(c ? d.title : `${council ? councilShort(locale, council) : d.councilId}: ${d.title}`)}`,
      `DESCRIPTION:${ics(about.join("\n"))}`,
      `URL:${d.url}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=1800" },
  });
}

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: NextRequest, { params }: RouteContext<"/feeds/[file]">) {
  const { file } = await params;
  const url = new URL(request.url);
  const locale: Locale = url.searchParams.get("lang") === "cy" ? "cy" : "en";
  const m = file.match(/^([a-z-]+?)(?:-committee-(\d{1,10}))?\.(xml|ics)$/);
  if (!m) return notFound();
  const [, name, committeeRaw, ext] = m;
  if (committeeRaw && !isId(committeeRaw)) return notFound();
  const committee = committeeRaw ? Number(committeeRaw) : undefined;

  if (ext === "xml" && name === "search") {
    const q = searchText(url.searchParams.get("q"));
    if (!q) return notFound();
    const councilRaw = url.searchParams.get("council") ?? undefined;
    const topicRaw = url.searchParams.get("topic") ?? undefined;
    const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
    const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
    const { rows } = await latestItems({ q, council, topic, limit: 50 });
    return rss(locale, `“${q}”`, `${absUrl(locale, "/search")}?q=${encodeURIComponent(q)}`, rows);
  }
  if (ext === "xml" && name.startsWith("topic-")) {
    const topic = TOPIC_BY_SLUG.get(name.slice(6));
    if (!topic) return notFound();
    const { rows } = await latestItems({ topic: topic.slug, decidedOnly: true, limit: 50 });
    return rss(locale, topic[locale], absUrl(locale, `/topics/${topic.slug}`), rows);
  }
  if (ext === "ics" && !committeeRaw && (name === "planned-decisions" || name.endsWith("-planned-decisions"))) {
    const councilId = name === "planned-decisions" ? undefined : name.slice(0, -"-planned-decisions".length);
    if (councilId && !liveCouncil(councilId)) return notFound();
    const topicRaw = url.searchParams.get("topic") ?? undefined;
    const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
    return plannedCalendar(locale, councilId, topic, url.searchParams.get("makers") === "all");
  }
  const c = liveCouncil(name);
  if (!c) return notFound();
  if (ext === "ics") return calendar(locale, c.id, committee);
  const { rows } = await latestItems({ council: c.id, committee, decidedOnly: true, limit: 50 });
  const page = committee ? `/${c.id}/committees/${committee}` : `/${c.id}`;
  const title = committee && rows[0] ? committeeName(locale, rows[0].committeeEn, rows[0].committeeCy).text : councilName(locale, c);
  return rss(locale, title, `${absUrl(locale, page)}`, rows);
}
