/**
 * Matching for email alerts: words and street names in agendas, minutes,
 * reports and planning applications. Used by the instant alerts and the
 * weekly email.
 */
import { sql } from "drizzle-orm";
import type { JobContext } from "./job";

/** A Postgres regular expression that finds the phrase as whole words, any case, any spacing. */
export function pgPattern(phrase: string): string {
  const words = phrase
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"));
  return `(^|[^[:alnum:]_])${words.join("\\s+")}([^[:alnum:]_]|$)`;
}

/** The same match in JavaScript, for picking out the sentence around it. */
export function jsPattern(phrase: string): RegExp {
  const words = phrase
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&"));
  return new RegExp(`(?<![\\p{L}\\p{N}])${words.join("\\s+")}(?![\\p{L}\\p{N}])`, "iu");
}

/** About 200 characters around the first match, on word boundaries. */
export function snippet(text: string | null | undefined, re: RegExp, width = 100): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ");
  const m = re.exec(flat);
  if (!m) return null;
  let a = Math.max(0, m.index - width);
  let b = Math.min(flat.length, m.index + m[0].length + width);
  if (a > 0) a = flat.indexOf(" ", a) + 1 || a;
  if (b < flat.length) b = flat.lastIndexOf(" ", b) > m.index ? flat.lastIndexOf(" ", b) : b;
  return `${a > 0 ? "…" : ""}${flat.slice(a, b).trim()}${b < flat.length ? "…" : ""}`;
}

export type ItemHit = {
  councilId: string;
  meetingId: number;
  agendaItemId: number;
  date: string;
  upcoming: boolean;
  decided: boolean;
  title: string;
  committeeEn: string;
  committeeCy: string | null;
  headlineEn: string | null;
  headlineCy: string | null;
  snippet: string | null;
};

export type PlanHit = {
  id: number;
  councilId: string | null;
  address: string | null;
  reference: string | null;
  description: string | null;
  decision: string | null;
  isNew: boolean;
  decidedDate: string | null;
};

const scope = (column: string, councils: string[]) =>
  councils.length ? sql`and ${sql.raw(column)} in (${sql.join(councils.map((c) => sql`${c}`), sql`, `)})` : sql``;

type ItemRow = Omit<ItemHit, "snippet"> & { agendaText: string | null; minutes: string | null; report: string | null };

/** Agenda items mentioning the phrase, at meetings on or after `from` (a date). */
export async function itemsMatching(ctx: JobContext, phrase: string, councils: string[], from: string, limit = 12): Promise<ItemHit[]> {
  const re = pgPattern(phrase);
  const rows = await ctx.db.execute<ItemRow>(sql`
    select a.council_id as "councilId", a.meeting_id as "meetingId", a.id as "agendaItemId", m.date::text as date,
      (m.date >= (now() at time zone 'Europe/London')::date) as upcoming,
      exists (select 1 from decisions d where d.council_id = a.council_id and d.agenda_item_id = a.id) as decided,
      a.title, c.name_en as "committeeEn", c.name_cy as "committeeCy",
      si.headline_en as "headlineEn", si.headline_cy as "headlineCy",
      a.agenda_text as "agendaText", a.minutes,
      (select d.text from documents d where d.council_id = a.council_id and d.agenda_item_id = a.id and d.text ~* ${re} limit 1) as report
    from agenda_items a
    join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    left join search_items si on si.council_id = a.council_id and si.agenda_item_id = a.id
    where m.date >= ${from}::date and not m.cancelled and not a.is_restricted ${scope("a.council_id", councils)}
      and (a.title ~* ${re} or a.agenda_text ~* ${re} or a.minutes ~* ${re}
        or exists (select 1 from documents d where d.council_id = a.council_id and d.agenda_item_id = a.id and d.text ~* ${re}))
    order by m.date desc, a.seq limit ${limit}
  `);
  const js = jsPattern(phrase);
  return [...rows].map(({ agendaText, minutes, report, ...r }) => ({
    ...r,
    meetingId: Number(r.meetingId),
    agendaItemId: Number(r.agendaItemId),
    snippet: js.test(r.title) ? null : (snippet(minutes, js) ?? snippet(agendaText, js) ?? snippet(report, js)),
  }));
}

/** Planning applications whose address or description mentions the phrase, seen or decided since `since`. */
export async function plansMatching(ctx: JobContext, phrase: string, councils: string[], since: Date, limit = 10): Promise<PlanHit[]> {
  const re = pgPattern(phrase);
  return [
    ...(await ctx.db.execute<PlanHit>(sql`
      select id, council_id as "councilId", address, reference, description, decision,
        (first_seen_at >= ${since.toISOString()}::timestamptz) as "isNew", decided_date::text as "decidedDate"
      from planning_applications
      where (address ~* ${re} or description ~* ${re}) ${scope("council_id", councils)}
        and ((first_seen_at >= ${since.toISOString()}::timestamptz and (start_date is null or start_date >= (${since.toISOString()}::timestamptz - interval '60 days')::date))
          or decided_date >= ${since.toISOString()}::timestamptz::date)
      order by coalesce(decided_date, start_date) desc nulls last limit ${limit}
    `)),
  ];
}

/** Planning applications within a kilometre of a point, new or decided since `since`. */
export async function plansNear(ctx: JobContext, lat: number, lng: number, since: Date, limit = 12): Promise<PlanHit[]> {
  const dLat = 1 / 111;
  const dLng = 1 / (111 * Math.cos((lat * Math.PI) / 180));
  return [
    ...(await ctx.db.execute<PlanHit>(sql`
      select id, council_id as "councilId", address, reference, description, decision,
        (first_seen_at >= ${since.toISOString()}::timestamptz) as "isNew", decided_date::text as "decidedDate"
      from planning_applications
      where lat between ${lat - dLat} and ${lat + dLat} and lng between ${lng - dLng} and ${lng + dLng}
        and (6371000 * 2 * asin(sqrt(power(sin(radians(lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(lat)) * power(sin(radians(lng - ${lng}) / 2), 2)))) <= 1000
        and ((first_seen_at >= ${since.toISOString()}::timestamptz and (start_date is null or start_date >= (${since.toISOString()}::timestamptz - interval '60 days')::date))
          or decided_date >= ${since.toISOString()}::timestamptz::date)
      order by coalesce(decided_date, start_date) desc nulls last limit ${limit}
    `)),
  ];
}

/** The key that records an alert was sent, so the same news isn't sent twice. */
export const itemKey = (h: ItemHit) => `item:${h.councilId}:${h.agendaItemId}:${h.decided ? "decided" : "agenda"}`;
export const planKey = (h: PlanHit) => `plan:${h.id}:${h.decidedDate ? "decided" : "new"}`;
