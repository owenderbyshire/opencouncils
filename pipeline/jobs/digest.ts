/**
 * The weekly email, sent on Saturday morning by the daily run. For each
 * council a reader follows: the meetings summarised that week, with what
 * they decided, and the main meetings coming up. Then any subjects they
 * follow, across their councils (or every council if they chose none).
 * Adapted from OpenSenedd's pipeline/jobs/digest.ts. Each reader gets it at
 * most once a week.
 *
 *   pnpm pipeline digest              # sends only on Saturday (UK)
 *   pnpm pipeline digest --now        # send now, whatever the day
 *   pnpm pipeline digest --dry-run    # log what would be sent
 *   pnpm pipeline digest --now --force   # send again, even if sent this week
 *
 * Needs RESEND_API_KEY and ALERTS_FROM.
 */
import { and, eq, sql } from "drizzle-orm";
import { committeeName } from "../../src/lib/committees";
import { COUNCILS } from "../../data/curated/councils";
import { TOPIC_BY_SLUG } from "../../data/curated/topics";
import { subscribers } from "../../src/db/schema";
import { canSend, sendEmail } from "../../src/lib/email/send";
import { emailToken } from "../../src/lib/email/token";
import { absUrl } from "../../src/i18n/config";
import { SITE } from "../../src/lib/site";
import { itemsMatching, plansMatching, type ItemHit, type PlanHit } from "../lib/alerts";
import type { Job, JobContext } from "../lib/job";

type Lang = "en" | "cy";

type Decided = {
  id: number;
  date: string;
  committeeEn: string;
  committeeCy: string | null;
  overviewEn: string | null;
  overviewCy: string | null;
  items: number;
};
type Coming = {
  id: number;
  date: string;
  time: string | null;
  committeeEn: string;
  committeeCy: string | null;
  kind: string;
};
type TopicHit = {
  councilId: string;
  meetingId: number;
  agendaItemId: number;
  date: string;
  title: string;
  headlineEn: string | null;
  headlineCy: string | null;
};

type PlanningHit = {
  id: number;
  address: string | null;
  reference: string | null;
  description: string | null;
  appState: string | null;
  startDate: string | null;
  decidedDate: string | null;
  isNew: boolean;
};

/** Applications within a kilometre that arrived this week, and decisions made this week. */
async function planningNear(ctx: JobContext, lat: number, lng: number, since: Date, from: string): Promise<PlanningHit[]> {
  const dLat = 1 / 111;
  const dLng = 1 / (111 * Math.cos((lat * Math.PI) / 180));
  return [
    ...(await ctx.db.execute<PlanningHit>(sql`
      select id, address, reference, description, app_state as "appState", start_date::text as "startDate", decided_date::text as "decidedDate",
        (first_seen_at >= ${since.toISOString()}) as "isNew"
      from planning_applications
      where lat between ${lat - dLat} and ${lat + dLat} and lng between ${lng - dLng} and ${lng + dLng}
        and (6371000 * 2 * asin(sqrt(power(sin(radians(lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(lat)) * power(sin(radians(lng - ${lng}) / 2), 2)))) <= 1000
        and ((first_seen_at >= ${since.toISOString()} and start_date >= ${addDays(from, -30)}::date) or decided_date >= ${from}::date)
      order by "isNew" desc, start_date desc nulls last limit 12
    `)),
  ];
}

function ukNow(): { date: string; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
  };
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function dayMonth(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(lang === "cy" ? "cy-GB" : "en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

async function decided(ctx: JobContext, council: string, since: Date, to: string): Promise<Decided[]> {
  return [
    ...(await ctx.db.execute<Decided>(sql`
      select distinct on (m.date, m.id) m.id, m.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
        s.content->>'overviewEn' as "overviewEn", s.content->>'overviewCy' as "overviewCy",
        jsonb_array_length(coalesce(s.content->'items', '[]'::jsonb))::int as items
      from summaries s
      join meetings m on m.council_id = s.council_id and m.id = s.meeting_id
      join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where s.council_id = ${council} and s.created_at >= ${since.toISOString()}
        and coalesce(s.content->>'mode', 'minutes') = 'minutes'
        and m.date between ${addDays(to, -60)}::date and ${to}::date
      order by m.date desc, m.id, s.created_at desc limit 6
    `)),
  ];
}

async function coming(ctx: JobContext, council: string, to: string): Promise<Coming[]> {
  return [
    ...(await ctx.db.execute<Coming>(sql`
      select m.id, m.date::text as date, m.start_time as time, c.name_en as "committeeEn", c.name_cy as "committeeCy", c.kind
      from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where m.council_id = ${council} and not m.cancelled
        and m.date between ${addDays(to, 1)}::date and ${addDays(to, 14)}::date
        and c.kind in ('council', 'cabinet', 'scrutiny', 'planning')
      order by m.date, m.start_time nulls last limit 6
    `)),
  ];
}

async function topicHits(ctx: JobContext, topic: string, councils: string[], since: Date, to: string): Promise<TopicHit[]> {
  const scope = councils.length ? sql`and i.council_id in (${sql.join(councils.map((c) => sql`${c}`), sql`, `)})` : sql``;
  return [
    ...(await ctx.db.execute<TopicHit>(sql`
      select i.council_id as "councilId", i.meeting_id as "meetingId", i.agenda_item_id as "agendaItemId", i.date::text as date,
        i.title, i.headline_en as "headlineEn", i.headline_cy as "headlineCy"
      from search_items i
      where ${topic} = any(i.topics) ${scope}
        and exists (select 1 from summaries s where s.council_id = i.council_id and s.meeting_id = i.meeting_id and s.created_at >= ${since.toISOString()})
        and i.date between ${addDays(to, -60)}::date and ${to}::date
      order by i.date desc limit 6
    `)),
  ];
}

export const C = { ink: "#1c2630", ink2: "#475563", ink3: "#5f6c79", rule: "#dde3e8", surface: "#f3f5f7", bg: "#e9edf1", accent: "#355d91" };
export const SANS = "'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";

const L = {
  en: {
    site: "OpenCouncil",
    title: "This week in your council",
    titleMany: "This week in your councils",
    decided: "Decided",
    decidedNote: "Summaries written by AI from the council's minutes. Each links to the minutes and reports.",
    none: "No new meeting summaries this week.",
    coming: "Coming up",
    comingNone: "No main meetings in the next fortnight.",
    read: "Read what was decided",
    items: (n: number) => `${n} ${n === 1 ? "item" : "items"}`,
    topics: "Your subjects",
    planning: (pc: string) => `Planning near ${pc}`,
    planningNew: "New application",
    planningDecided: "Decided",
    planningNone: "No new applications or decisions within a kilometre this week.",
    topicNone: "Nothing new on this subject this week.",
    words: "Words you're watching for",
    wordsNote: "Mentions in agendas, minutes, reports and planning applications this week.",
    wordsNone: "No mentions this week.",
    consult: "New consultations",
    consultNote: "Opened this week. Anyone can respond.",
    closes: (d: string) => `Closes ${d}`,
    foot: "OpenCouncil is independent and free. It isn't run by any council.",
    why: "You get this because you asked for it on OpenCouncil.",
    change: "Change what you get",
    stop: "Stop this email",
    range: (a: string, b: string) => `${a} to ${b}`,
  },
  cy: {
    site: "OpenCouncil",
    title: "Yr wythnos hon yn eich cyngor",
    titleMany: "Yr wythnos hon yn eich cynghorau",
    decided: "Penderfynwyd",
    decidedNote: "Crynodebau a ysgrifennwyd gan AI o gofnodion y cyngor. Mae pob un yn cysylltu â'r cofnodion a'r adroddiadau.",
    none: "Dim crynodebau cyfarfod newydd yr wythnos hon.",
    coming: "I ddod",
    comingNone: "Dim prif gyfarfodydd yn ystod y pythefnos nesaf.",
    read: "Darllen beth a benderfynwyd",
    items: (n: number) => `${n} ${n === 1 ? "eitem" : "eitem"}`,
    topics: "Eich pynciau",
    planning: (pc: string) => `Cynllunio ger ${pc}`,
    planningNew: "Cais newydd",
    planningDecided: "Penderfynwyd",
    planningNone: "Dim ceisiadau na phenderfyniadau newydd o fewn cilometr yr wythnos hon.",
    topicNone: "Dim byd newydd ar y pwnc hwn yr wythnos hon.",
    words: "Geiriau rydych chi'n cadw llygad amdanyn nhw",
    wordsNote: "Wedi'u crybwyll mewn agendâu, cofnodion, adroddiadau a cheisiadau cynllunio yr wythnos hon.",
    wordsNone: "Dim sôn amdano yr wythnos hon.",
    consult: "Ymgynghoriadau newydd",
    consultNote: "Wedi agor yr wythnos hon. Gall unrhyw un ymateb.",
    closes: (d: string) => `Yn cau ${d}`,
    foot: "Mae OpenCouncil yn annibynnol ac am ddim. Nid yw'n cael ei redeg gan unrhyw gyngor.",
    why: "Rydych chi'n cael hwn am i chi ofyn amdano ar OpenCouncil.",
    change: "Newid beth rydych chi'n ei gael",
    stop: "Stopio'r e-bost hwn",
    range: (a: string, b: string) => `${a} i ${b}`,
  },
} as const;

export function sectionHead(title: string, note?: string): string {
  return `<tr><td style="padding:28px 32px 4px"><h2 style="margin:0;font-family:${SERIF};font-size:22px;line-height:1.25;color:${C.ink};font-weight:600">${esc(title)}</h2>${note ? `<p style="margin:4px 0 0;font-size:13px;color:${C.ink3}">${esc(note)}</p>` : ""}</td></tr>`;
}

type Consult = { url: string; urlCy: string | null; titleEn: string; titleCy: string | null; closes: string | null; councilId: string | null };

/** Consultations first seen this week: councils' own, and the Welsh Government's that concern councils. */
async function newConsultations(ctx: JobContext, since: Date): Promise<Consult[]> {
  return [...(await ctx.db.execute<Consult>(sql`
    select url, url_cy as "urlCy", title_en as "titleEn", title_cy as "titleCy", closes::text as closes, council_id as "councilId"
    from consultations
    where open and first_seen >= ${since.toISOString()}::timestamptz
      and (source <> 'gov' or area ilike '%local government%'
        or title_en ~* '\\m(council|councils|councillors?|local authorit|local government|local tax|non-domestic rates|business rates|planning|social care|schools?|waste|recycling|homelessness|social housing|highways|licensing|libraries)'
        or summary_en ~* '\\m(council|councils|councillors?|local authorit|local government|local tax|non-domestic rates|business rates|planning|social care|schools?|waste|recycling|homelessness|social housing|highways|licensing|libraries)')
    order by closes nulls last`))];
}

export interface DigestCouncil {
  id: string;
  name: string;
  decided: Decided[];
  coming: Coming[];
}

export function compose(
  lang: Lang,
  id: string,
  from: string,
  to: string,
  councils: DigestCouncil[],
  topics: Array<{ slug: string; name: string; hits: TopicHit[] }>,
  planning: { postcode: string; hits: PlanningHit[] } | null = null,
  consults: Consult[] = [],
  words: Array<{ word: string; items: ItemHit[]; plans: PlanHit[] }> = [],
) {
  const l = L[lang];
  const cy = lang === "cy";
  const root = absUrl(lang, "/").replace(/\/$/, "");
  const title = councils.length > 1 ? l.titleMany : l.title;
  const range = l.range(dayMonth(lang, from).replace(/^\S+\s/, ""), dayMonth(lang, to).replace(/^\S+\s/, ""));
  const subject = councils.length === 1 ? `${councils[0].name}: ${range}` : `${title}: ${range}`;
  const unsubscribe = `${SITE.url}/api/email/stop?u=${encodeURIComponent(id)}&t=${emailToken("digest", id) ?? ""}&lang=${lang}`;
  const manage = `${root}/follow?u=${encodeURIComponent(id)}&t=${emailToken("manage", id) ?? ""}`;
  const committee = (x: { committeeEn: string; committeeCy: string | null }) => committeeName(cy ? "cy" : "en", x.committeeEn, x.committeeCy).text;
  const rows: string[] = [];
  const t: string[] = [subject, ""];

  rows.push(`<tr><td style="background:${C.ink};padding:26px 32px 24px">
<p style="margin:0;font-family:${SERIF};font-size:17px;color:#ffffff;font-weight:600">${esc(l.site)}</p>
<h1 style="margin:16px 0 0;font-family:${SERIF};font-size:28px;line-height:1.15;color:#ffffff;font-weight:600">${esc(councils.length === 1 ? councils[0].name : title)}</h1>
<p style="margin:6px 0 0;font-size:15px;color:#c9d3dc">${esc(range)}</p>
</td></tr>`);

  for (const c of councils) {
    if (councils.length > 1) {
      rows.push(`<tr><td style="padding:30px 32px 0"><p style="margin:0;font-family:${SERIF};font-size:24px;font-weight:600;color:${C.ink}"><a href="${esc(`${root}/${c.id}`)}" style="color:${C.ink};text-decoration:none">${esc(c.name)}</a></p></td></tr>`);
      t.push(c.name.toUpperCase(), "");
    }
    rows.push(sectionHead(l.decided, c.decided.length ? l.decidedNote : undefined));
    t.push(l.decided, "");
    if (!c.decided.length) {
      rows.push(`<tr><td style="padding:10px 32px 0;font-size:15px;color:${C.ink2}">${esc(l.none)}</td></tr>`);
      t.push(l.none, "");
    }
    for (const m of c.decided) {
      const url = `${root}/${c.id}/meetings/${m.id}`;
      const overview = (cy ? m.overviewCy : m.overviewEn) || "";
      t.push(`${committee(m)}, ${dayMonth(lang, m.date)}`, overview, url, "");
      rows.push(`<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${C.rule}"><tr><td style="padding:14px 0 16px">
<p style="margin:0;font-size:13px;color:${C.ink3}">${esc(dayMonth(lang, m.date))}</p>
<p style="margin:2px 0 0"><a href="${esc(url)}" style="font-size:17px;font-weight:600;color:${C.ink};text-decoration:none">${esc(committee(m))}</a></p>
${overview ? `<p style="margin:6px 0 0;font-size:15px;line-height:1.55;color:${C.ink}">${esc(overview)}</p>` : ""}
<p style="margin:8px 0 0;font-size:14px"><a href="${esc(url)}" style="color:${C.accent};font-weight:600">${esc(l.read)}</a> <span style="color:${C.ink3}">${esc(l.items(m.items))}</span></p>
</td></tr></table></td></tr>`);
    }
    rows.push(sectionHead(l.coming));
    t.push(l.coming, "");
    if (!c.coming.length) {
      rows.push(`<tr><td style="padding:10px 32px 0;font-size:15px;color:${C.ink2}">${esc(l.comingNone)}</td></tr>`);
      t.push(l.comingNone, "");
    }
    for (const m of c.coming) {
      const url = `${root}/${c.id}/meetings/${m.id}`;
      const when = `${dayMonth(lang, m.date)}${m.time ? `, ${m.time.slice(0, 5)}` : ""}`;
      t.push(`${when}: ${committee(m)} ${url}`);
      rows.push(`<tr><td style="padding:8px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td valign="top" width="190" style="font-size:14px;color:${C.ink2};padding:2px 12px 2px 0">${esc(when)}</td>
<td valign="top" style="font-size:15px;padding:2px 0"><a href="${esc(url)}" style="color:${C.ink};font-weight:600;text-decoration:none">${esc(committee(m))}</a></td>
</tr></table></td></tr>`);
    }
    t.push("");
  }

  if (topics.length) {
    rows.push(sectionHead(l.topics));
    t.push(l.topics.toUpperCase(), "");
    for (const tp of topics) {
      t.push(tp.name);
      const list = tp.hits.length
        ? tp.hits
            .map((h) => {
              const url = `${root}/${h.councilId}/meetings/${h.meetingId}#item-${h.agendaItemId}`;
              const head = (cy ? h.headlineCy : h.headlineEn) || h.title;
              const council = COUNCILS.find((c) => c.id === h.councilId);
              const where = council ? (cy ? council.shortCy : council.shortEn) : "";
              t.push(`  ${head} (${where}, ${h.date}) ${url}`);
              return `<p style="margin:6px 0 0;font-size:15px;line-height:1.45"><a href="${esc(url)}" style="color:${C.ink}">${esc(head)}</a> <span style="color:${C.ink3};font-size:13px">${esc(where)}</span></p>`;
            })
            .join("")
        : `<p style="margin:4px 0 0;font-size:14px;color:${C.ink2}">${esc(l.topicNone)}</p>`;
      if (!tp.hits.length) t.push(`  ${l.topicNone}`);
      rows.push(`<tr><td style="padding:14px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.rule};border-radius:8px"><tr><td style="padding:14px 18px 16px">
<a href="${esc(`${root}/topics/${tp.slug}`)}" style="font-family:${SERIF};font-size:18px;font-weight:600;color:${C.ink};text-decoration:none">${esc(tp.name)}</a>${list}
</td></tr></table></td></tr>`);
      t.push("");
    }
  }

  if (words.length) {
    rows.push(sectionHead(l.words, l.wordsNote));
    t.push(l.words.toUpperCase(), "");
    for (const w of words) {
      t.push(`“${w.word}”`);
      const lines = [
        ...w.items.map((h) => {
          const url = `${root}/${h.councilId}/meetings/${h.meetingId}#item-${h.agendaItemId}`;
          const head = (cy ? h.headlineCy : h.headlineEn) || h.title;
          const council = COUNCILS.find((c) => c.id === h.councilId);
          const where = `${council ? (cy ? council.shortCy : council.shortEn) : ""}, ${dayMonth(lang, h.date)}`;
          t.push(`  ${head} (${where}) ${url}`);
          return `<p style="margin:6px 0 0;font-size:15px;line-height:1.45"><a href="${esc(url)}" style="color:${C.ink}">${esc(head)}</a> <span style="color:${C.ink3};font-size:13px">${esc(where)}</span></p>${h.snippet ? `<p style="margin:2px 0 0;font-size:13px;line-height:1.45;color:${C.ink2}">${esc(h.snippet)}</p>` : ""}`;
        }),
        ...w.plans.map((h) => {
          const url = `${root}/planning/application/${h.id}`;
          const head = h.address || h.reference || "";
          t.push(`  ${head} ${url}`);
          return `<p style="margin:6px 0 0;font-size:15px;line-height:1.45"><a href="${esc(url)}" style="color:${C.ink}">${esc(head)}</a> <span style="color:${C.ink3};font-size:13px">${esc(h.decidedDate ? l.planningDecided : l.planningNew)}</span></p>`;
        }),
      ];
      if (!lines.length) t.push(`  ${l.wordsNone}`);
      rows.push(`<tr><td style="padding:14px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.rule};border-radius:8px"><tr><td style="padding:14px 18px 16px">
<p style="margin:0;font-family:${SERIF};font-size:18px;font-weight:600;color:${C.ink}">“${esc(w.word)}”</p>${lines.join("") || `<p style="margin:4px 0 0;font-size:14px;color:${C.ink2}">${esc(l.wordsNone)}</p>`}
</td></tr></table></td></tr>`);
      t.push("");
    }
  }

  if (planning) {
    rows.push(sectionHead(l.planning(planning.postcode)));
    t.push(l.planning(planning.postcode).toUpperCase(), "");
    if (!planning.hits.length) {
      rows.push(`<tr><td style="padding:10px 32px 0;font-size:15px;color:${C.ink2}">${esc(l.planningNone)}</td></tr>`);
      t.push(l.planningNone, "");
    }
    for (const h of planning.hits) {
      const url = `${root}/planning/application/${h.id}`;
      const label = h.isNew ? l.planningNew : l.planningDecided;
      const head = h.address || h.reference || "";
      t.push(`${label}: ${head}`, h.description ?? "", url, "");
      rows.push(`<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${C.rule}"><tr><td style="padding:12px 0 14px">
<p style="margin:0;font-size:13px;color:${C.ink3}">${esc(label)}${h.reference ? ` &nbsp;&nbsp;${esc(h.reference)}` : ""}</p>
<p style="margin:2px 0 0"><a href="${esc(url)}" style="font-size:16px;font-weight:600;color:${C.ink};text-decoration:none">${esc(head)}</a></p>
${h.description ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${C.ink}">${esc(h.description.slice(0, 220))}</p>` : ""}
</td></tr></table></td></tr>`);
    }
  }

  if (consults.length) {
    rows.push(sectionHead(l.consult, l.consultNote));
    t.push(l.consult.toUpperCase(), "");
    for (const c of consults) {
      const title = (cy && c.titleCy) || c.titleEn;
      const url = (cy && c.titleCy && c.urlCy) || c.url;
      const when = c.closes ? l.closes(dayMonth(lang, c.closes)) : "";
      t.push(title, when, url, "");
      rows.push(`<tr><td style="padding:0 32px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${C.rule}"><tr><td style="padding:12px 0 14px">
<p style="margin:0"><a href="${esc(url)}" style="font-size:16px;font-weight:600;color:${C.ink};text-decoration:none">${esc(title)}</a></p>
${when ? `<p style="margin:2px 0 0;font-size:13px;color:${C.ink3}">${esc(when)}</p>` : ""}
</td></tr></table></td></tr>`);
    }
  }

  rows.push(`<tr><td style="padding:30px 32px 28px"><p style="margin:0;font-size:13px;line-height:1.55;color:${C.ink3}">${esc(l.foot)}</p>
<p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:${C.ink3}">${esc(l.why)} <a href="${esc(manage)}" style="color:${C.ink2}">${esc(l.change)}</a>. <a href="${esc(unsubscribe)}" style="color:${C.ink2}">${esc(l.stop)}</a>.</p></td></tr>`);
  t.push(l.foot, `${l.change}: ${manage}`, `${l.stop}: ${unsubscribe}`);

  const preview = councils.flatMap((c) => c.decided).map((m) => (cy ? m.overviewCy : m.overviewEn) || "")[0] ?? "";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden">${esc(preview.slice(0, 140))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:${SANS};color:${C.ink}">
${rows.join("\n")}
</table></td></tr></table></body></html>`;
  return { subject, html, text: t.join("\n"), unsubscribe };
}

export const digestJob: Job = {
  name: "digest",
  description: "The weekly email, to readers who confirmed they want it",
  async run(ctx) {
    const now = ukNow();
    if (ctx.args.now !== true && now.weekday !== 6) {
      ctx.log("not Saturday (UK); nothing to send");
      return;
    }
    const dryRun = ctx.args["dry-run"] === true || !canSend();
    if (dryRun) ctx.log("dry run: no emails will be sent (needs RESEND_API_KEY and ALERTS_FROM)");
    const to = typeof ctx.args.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ctx.args.to) ? ctx.args.to : now.date;
    const from = addDays(to, -6);
    const since = new Date(Date.now() - 7 * 86_400_000);
    const readers = await ctx.db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.status, "active"),
          ctx.args.force === true
            ? sql`true`
            : sql`(${subscribers.digestSentAt} is null or ${subscribers.digestSentAt} < now() - interval '6 days')`,
        ),
      );
    if (!readers.length) return;
    const consults = await newConsultations(ctx, since);
    const councilCache = new Map<string, DigestCouncil>();
    const topicCache = new Map<string, TopicHit[]>();
    for (const r of readers) {
      const lang: Lang = r.lang === "cy" ? "cy" : "en";
      const councils: DigestCouncil[] = [];
      for (const id of r.councils) {
        const def = COUNCILS.find((c) => c.id === id);
        if (!def) continue;
        if (!councilCache.has(id))
          councilCache.set(id, { id, name: "", decided: await decided(ctx, id, since, to), coming: await coming(ctx, id, to) });
        councils.push({ ...councilCache.get(id)!, name: lang === "cy" ? def.nameCy : def.nameEn });
      }
      const topics = [];
      for (const slug of r.topics) {
        const def = TOPIC_BY_SLUG.get(slug);
        if (!def) continue;
        const key = `${slug}|${[...r.councils].sort().join(",")}`;
        if (!topicCache.has(key)) topicCache.set(key, await topicHits(ctx, slug, r.councils, since, to));
        topics.push({ slug, name: lang === "cy" ? def.cy : def.en, hits: topicCache.get(key)! });
      }
      const planning =
        r.postcode && r.lat !== null && r.lng !== null
          ? { postcode: r.postcode, hits: await planningNear(ctx, r.lat, r.lng, since, from) }
          : null;
      const words = [];
      for (const word of r.keywords)
        words.push({ word, items: await itemsMatching(ctx, word, r.councils, from, 8), plans: await plansMatching(ctx, word, r.councils, since, 6) });
      const message = compose(lang, r.id, from, to, councils, topics, planning,
        consults.filter((c) => !c.councilId || r.councils.includes(c.councilId)), words);
      if (dryRun) {
        ctx.log(`would email ${r.id}: ${message.subject}`);
        ctx.count("wouldSend");
        continue;
      }
      const sent = await sendEmail({ to: r.email, subject: message.subject, html: message.html, text: message.text, unsubscribe: message.unsubscribe });
      if (sent.ok) {
        await ctx.db.update(subscribers).set({ digestSentAt: new Date() }).where(eq(subscribers.id, r.id));
        ctx.count("sent");
      } else {
        ctx.warn(`digest for ${r.id}: ${sent.error}`);
        ctx.count("failed");
      }
    }
  },
};
