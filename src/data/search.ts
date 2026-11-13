import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CommitteeKind } from "@/db/schema";
import { ukToday } from "@/i18n/format";
import { isNotAMeeting, isRoutineItem, tidyTitle } from "@/lib/agenda";
import { searchText } from "@/lib/params";
import { timelineMonths } from "@/lib/timeline";
import { offsetFor, one, PAGE_SIZE, rows, sql } from "./db";

/**
 * Search, topics and feeds across every council, from `search_items` (one row
 * per agenda item, rebuilt by the pipeline's `index` job).
 */

export interface ItemRow {
  councilId: string;
  agendaItemId: number;
  meetingId: number;
  date: string;
  committeeEn: string;
  committeeCy: string | null;
  committeeKind: CommitteeKind;
  title: string;
  headlineEn: string | null;
  headlineCy: string | null;
  decidedEn: string | null;
  decidedCy: string | null;
  decision: string | null;
  topics: string[];
  /** Matching words from the item, with matches between [[ and ]]. Search only. */
  snippet?: string | null;
}

const ITEM_COLUMNS = sql`
  i.council_id as "councilId", i.agenda_item_id as "agendaItemId", i.meeting_id as "meetingId", i.date::text as date,
  c.name_en as "committeeEn", c.name_cy as "committeeCy", i.committee_kind as "committeeKind", i.title,
  i.headline_en as "headlineEn", i.headline_cy as "headlineCy", i.decided_en as "decidedEn", i.decided_cy as "decidedCy",
  i.decision, i.topics
`;
const ITEM_JOINS = sql`join committees c on c.council_id = i.council_id and c.id = i.committee_id`;

export interface ItemFilter {
  council?: string;
  topic?: string;
  committee?: number;
  /** Only items with a recorded decision or a summarised decision. */
  decidedOnly?: boolean;
  /** Only items with a plain-language headline and decision in both languages' source (English), so no raw minutes. */
  plainOnly?: boolean;
  /** Without the routine items every meeting has (apologies, declarations, minutes). */
  noRoutine?: boolean;
}

/**
 * The commonest routine items (see isRoutineItem in lib/agenda.ts), as a
 * Postgres regular expression on the title, so lists that page and count in
 * the database can leave them out.
 */
export const ROUTINE_TITLE_SQL =
  "^\\s*(item\\s+)?(\\d{1,3}[a-z]?(\\.\\d+)?[.):]?\\s*[-–:]?\\s*)?(apolog|ymddiheur|attendance and apologies|accept declarations|declarations? of|disclosures? of|datgan|minutes?\\y|cofnod|urgent (items|business|matters)|any other business|exclusion of|gwahardd|date of (the )?next|matters arising|welcome|croeso|to (approve|confirm|receive|sign)\\y.*\\y(minutes|record)\\y)";

function filterSql(f: ItemFilter) {
  return sql`
    ${f.council ? sql`and i.council_id = ${f.council}` : sql``}
    ${f.topic ? sql`and ${f.topic} = any(i.topics)` : sql``}
    ${f.committee ? sql`and i.committee_id = ${f.committee}` : sql``}
    ${f.decidedOnly ? sql`and (i.decision is not null or coalesce(i.decided_en, '') <> '')` : sql``}
    ${f.plainOnly ? sql`and coalesce(i.headline_en, '') <> '' and coalesce(i.decided_en, '') <> ''` : sql``}
    ${f.noRoutine ? sql`and i.title !~* ${ROUTINE_TITLE_SQL}` : sql``}
  `;
}

/** Websearch syntax ("quoted phrases", -exclude, or) in English and, word for word, Welsh. */
function matchSql(q: string) {
  return sql`(i.tsv @@ websearch_to_tsquery('english', ${q}) or i.tsv @@ websearch_to_tsquery('simple', ${q}))`;
}

export async function search(
  typed: string,
  f: ItemFilter & { page: number },
): Promise<{ rows: ItemRow[]; total: number; byCouncil: Array<{ councilId: string; n: number }> }> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  // The page cleans the query as well; cleaning it here too means no caller
  // can send Postgres a NUL byte, which it refuses. Nothing left is no query.
  const q = searchText(typed);
  if (!q) return { rows: [], total: 0, byCouncil: [] };
  const where = sql`${matchSql(q)} ${filterSql(f)} and i.date <= ${ukToday()}::date + 60`;
  const [list, count, byCouncil] = await Promise.all([
    rows<ItemRow>(sql`
      select ${ITEM_COLUMNS},
        ts_headline('english', coalesce(nullif(i.decided_en, ''), i.decision, i.body, i.title), websearch_to_tsquery('english', ${q}),
          'StartSel=[[, StopSel=]], MaxWords=32, MinWords=14, ShortWord=2, MaxFragments=1, FragmentDelimiter=" … "') as snippet
      from search_items i ${ITEM_JOINS}
      where ${where}
      order by ts_rank(i.tsv, websearch_to_tsquery('english', ${q})) * (1.0 / (1 + (current_date - i.date) / 365.0)) desc, i.date desc
      limit ${PAGE_SIZE} offset ${offsetFor(f.page)}
    `),
    one<{ n: number }>(sql`select count(*)::int as n from search_items i where ${where}`),
    rows<{ councilId: string; n: number }>(sql`
      select i.council_id as "councilId", count(*)::int as n from search_items i
      where ${matchSql(q)} ${filterSql({ ...f, council: undefined })} group by 1 order by 2 desc
    `),
  ]);
  return { rows: list, total: count?.n ?? 0, byCouncil };
}

/** The latest business matching a filter, newest first: topic pages and feeds. */
export async function latestItems(f: ItemFilter & { page?: number; limit?: number; q?: string }): Promise<{ rows: ItemRow[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  // As in search(): no NUL byte reaches Postgres, and an empty query is no query.
  const q = f.q ? searchText(f.q) : "";
  const where = sql`i.date <= ${ukToday()} ${q ? sql`and ${matchSql(q)}` : sql``} ${filterSql(f)}`;
  const limit = f.limit ?? PAGE_SIZE;
  const [list, count] = await Promise.all([
    rows<ItemRow>(sql`
      select ${ITEM_COLUMNS} from search_items i ${ITEM_JOINS}
      where ${where}
      order by i.date desc, i.meeting_id desc, i.agenda_item_id
      limit ${limit} offset ${offsetFor(f.page ?? 1, limit)}
    `),
    one<{ n: number }>(sql`select count(*)::int as n from search_items i where ${where}`),
  ]);
  return { rows: list, total: count?.n ?? 0 };
}

export interface TopicStat {
  topic: string;
  items: number;
  councils: number;
  latest: string | null;
}

/** For each topic, how much business it covered in the last 12 months and across how many councils. */
export async function topicStats(council?: string): Promise<TopicStat[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  return rows<TopicStat>(sql`
    select t as topic, count(*)::int as items, count(distinct i.council_id)::int as councils, max(i.date)::text as latest
    from search_items i, unnest(i.topics) t
    where i.date > current_date - 365 and i.date <= current_date ${council ? sql`and i.council_id = ${council}` : sql``}
    group by t
  `);
}

/** How much business on a topic each council had in the last 12 months. */
export async function topicByCouncil(topic: string): Promise<Array<{ councilId: string; items: number; decided: number }>> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  return rows(sql`
    select i.council_id as "councilId", count(*)::int as items,
      count(*) filter (where i.decision is not null or coalesce(i.decided_en, '') <> '')::int as decided
    from search_items i
    where ${topic} = any(i.topics) and i.date > current_date - 365 and i.date <= current_date
    group by 1 order by 2 desc
  `);
}

export interface UpcomingRow {
  councilId: string;
  meetingId: number;
  date: string;
  startTime: string | null;
  committeeEn: string;
  committeeCy: string | null;
  kind: CommitteeKind;
  location: string | null;
  agenda: string[];
}

/** Meetings across every council in the next `days` days, with their first few agenda items. */
export async function upcomingAcrossWales(days = 7, council?: string, committee?: number): Promise<UpcomingRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  return rows<UpcomingRow>(sql`
    select m.council_id as "councilId", m.id as "meetingId", m.date::text as date, m.start_time as "startTime",
      c.name_en as "committeeEn", c.name_cy as "committeeCy", c.kind, m.location,
      coalesce((select array_agg(a.title order by a.seq) from (
        select title, seq from agenda_items a where a.council_id = m.council_id and a.meeting_id = m.id
          and a.title !~* '^(apologies|declarations? of interest|minutes|approval of)' order by seq limit 4) a), '{}') as agenda
    from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where m.date >= ${today} and m.date < ${today}::date + ${days}::int and not m.cancelled
      ${council ? sql`and m.council_id = ${council}` : sql``}
      ${committee ? sql`and m.committee_id = ${committee}` : sql``}
    order by m.date, m.start_time nulls last, m.council_id, c.name_en
    limit 400
  `).then((list) => list.filter((m) => !isNotAMeeting(m.committeeEn)));
}

/** The meetings people follow: full Council, Cabinet, scrutiny and planning. */
export const MAIN_KINDS = ["council", "cabinet", "scrutiny", "planning"] as const;
export type MainKind = (typeof MAIN_KINDS)[number];

export interface AheadRow extends Omit<UpcomingRow, "agenda"> {
  /** The meeting's real business, in agenda order, without routine items. */
  items: string[];
  /** Whether the agenda has been published at all. */
  agendaPublished: boolean;
}

/**
 * Full Council, Cabinet, scrutiny and planning meetings in the next `days`
 * days, with every item of business except the routine ones.
 */
export async function mainMeetingsAhead(days: number, council?: string, kind?: MainKind): Promise<AheadRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const kinds = kind ? [kind] : [...MAIN_KINDS];
  const list = await rows<UpcomingRow>(sql`
    select m.council_id as "councilId", m.id as "meetingId", m.date::text as date, m.start_time as "startTime",
      c.name_en as "committeeEn", c.name_cy as "committeeCy", c.kind, m.location,
      coalesce((select array_agg(a.title order by a.seq) from agenda_items a
        where a.council_id = m.council_id and a.meeting_id = m.id), '{}') as agenda
    from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where m.date >= ${today} and m.date < ${today}::date + ${days}::int and not m.cancelled
      and c.kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
      ${council ? sql`and m.council_id = ${council}` : sql``}
    order by m.date, m.start_time nulls last, m.council_id, c.name_en
    limit 400
  `);
  return list.filter((m) => !isNotAMeeting(m.committeeEn)).map(({ agenda, ...m }) => ({
    ...m,
    agendaPublished: agenda.length > 0,
    items: agenda.filter((t) => !isRoutineItem(t)).map(tidyTitle),
  }));
}

export const TIMELINE_KINDS = ["council", "cabinet", "scrutiny", "planning"] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

/**
 * For one council and topic: in each of the last twelve months (this month
 * included), how many meetings of full Council, Cabinet, scrutiny and planning
 * committees had business on the topic. Months run oldest first.
 */
export async function topicTimeline(
  topic: string,
  council: string,
): Promise<{ months: string[]; rows: Array<{ kind: TimelineKind; counts: number[] }> }> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const months = timelineMonths(today);
  const found = await rows<{ kind: TimelineKind; month: string; n: number }>(sql`
    select i.committee_kind as kind, to_char(i.date, 'YYYY-MM') as month, count(distinct i.meeting_id)::int as n
    from search_items i
    where i.council_id = ${council} and ${topic} = any(i.topics)
      and i.committee_kind in (${sql.join(TIMELINE_KINDS.map((k) => sql`${k}`), sql`, `)})
      and i.date >= ${`${months[0]}-01`} and i.date <= ${today}
    group by 1, 2`);
  return {
    months,
    rows: TIMELINE_KINDS.map((kind) => ({
      kind,
      counts: months.map((m) => found.find((f) => f.kind === kind && f.month === m)?.n ?? 0),
    })),
  };
}
