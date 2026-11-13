import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { isCalendarDate } from "@/lib/params";
import { SITE } from "@/lib/site";
import { roleRows } from "./cabinets";
import { forwardPlanCoverage, FRESH_DAYS, RECENT_DAYS } from "./forward-plans";
import { offsetFor, one, rows, sql } from "./db";

/**
 * The open data API's queries (src/app/api/v1). Plain rows with stable field
 * names; every row links back to its page on OpenCouncil and, where there is
 * one, the council's own page.
 */

export const API_PAGE = 100;

type Row = Record<string, string | number | boolean | null | string[]>;
export interface ApiList {
  total: number;
  page: number;
  pageSize: number;
  rows: Row[];
}

// A date Postgres can't read ("2026-02-31", "0000-01-01") would fail the whole query, so it falls back too.
const dateOr = (s: string | null | undefined, fallback: string) => (s && isCalendarDate(s) ? s : fallback);

export async function apiMeetings(council: string, from: string | null, to: string | null, page: number, size = API_PAGE): Promise<ApiList> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const f = dateOr(from, "2000-01-01");
  const t = dateOr(to, "2100-01-01");
  const where = sql`m.council_id = ${council} and m.date between ${f}::date and ${t}::date`;
  const [list, n] = await Promise.all([
    rows<Row>(sql`
      select m.id, m.date::text as date, m.start_time as "startTime", c.id as "committeeId", c.name_en as "committee", c.name_cy as "committeeCy",
        c.kind as "committeeKind", m.location, m.cancelled, m.agenda_published as "agendaPublished", m.minutes_published as "minutesPublished",
        m.source_url as "sourceUrl", m.recording_url as "recordingUrl"
      from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where ${where} order by m.date desc, m.id limit ${size} offset ${offsetFor(page, size)}`),
    one<{ n: number }>(sql`select count(*)::int as n from meetings m where ${where}`),
  ]);
  return { total: n?.n ?? 0, page, pageSize: size, rows: list };
}

export async function apiMeeting(council: string, id: number): Promise<Row | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings", `meeting:${council}:${id}`);
  const m = await one<Row>(sql`
    select m.id, m.date::text as date, m.start_time as "startTime", c.id as "committeeId", c.name_en as "committee", c.kind as "committeeKind",
      m.location, m.cancelled, m.source_url as "sourceUrl", m.recording_url as "recordingUrl",
      coalesce((select json_agg(json_build_object(
        'id', a.id, 'number', a.number, 'title', a.title, 'minute', a.minutes,
        'decision', (select d.text from decisions d where d.council_id = a.council_id and d.agenda_item_id = a.id),
        'documents', coalesce((select json_agg(json_build_object('title', x.title, 'url', x.url) order by x.id)
          from documents x where x.council_id = a.council_id and x.agenda_item_id = a.id), '[]'::json)
      ) order by a.seq) from agenda_items a where a.council_id = m.council_id and a.meeting_id = m.id), '[]'::json) as items,
      (select s.content from summaries s where s.council_id = m.council_id and s.meeting_id = m.id order by s.created_at desc limit 1) as summary,
      coalesce((select json_agg(json_build_object('councillorId', a.councillor_id, 'status', a.status, 'role', a.role))
        from attendance a where a.council_id = m.council_id and a.meeting_id = m.id), '[]'::json) as attendance
    from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where m.council_id = ${council} and m.id = ${id}`);
  return m;
}

export async function apiCouncillors(council: string): Promise<ApiList> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  const list = await rows<Row>(sql`
    select p.id, p.name, p.party_label as party, p.party_id as "partyId", p.ward_slug as "wardSlug", w.name_en as ward, w.name_cy as "wardCy",
      p.current, case when p.current then p.email end as email, p.term_start::text as "termStart"
    from councillors p left join wards w on w.council_id = p.council_id and w.slug = p.ward_slug
    where p.council_id = ${council} order by p.current desc, p.name`);
  return { total: list.length, page: 1, pageSize: list.length, rows: list };
}

export async function apiCommittees(council: string): Promise<ApiList> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("committees");
  const list = await rows<Row>(sql`
    select id, name_en as name, name_cy as "nameCy", kind, active, source_url as "sourceUrl"
    from committees where council_id = ${council} order by name_en`);
  return { total: list.length, page: 1, pageSize: list.length, rows: list };
}

export async function apiDecisions(council: string | null, topic: string | null, from: string | null, page: number, size = API_PAGE): Promise<ApiList> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const where = sql`(i.decision is not null or coalesce(i.decided_en, '') <> '')
    and i.date >= ${dateOr(from, "2000-01-01")}::date
    ${council ? sql`and i.council_id = ${council}` : sql``}
    ${topic ? sql`and ${topic} = any(i.topics)` : sql``}`;
  const [list, n] = await Promise.all([
    rows<Row>(sql`
      select i.council_id as council, i.meeting_id as "meetingId", i.agenda_item_id as "agendaItemId", i.date::text as date,
        i.committee_kind as "committeeKind", i.title, i.decision as "recordedDecision", i.decided_en as "summaryEn", i.decided_cy as "summaryCy", i.topics
      from search_items i where ${where}
      order by i.date desc, i.meeting_id, i.agenda_item_id limit ${size} offset ${offsetFor(page, size)}`),
    one<{ n: number }>(sql`select count(*)::int as n from search_items i where ${where}`),
  ]);
  return { total: n?.n ?? 0, page, pageSize: size, rows: list };
}

export async function apiPlanning(authority: string | null, from: string | null, page: number, size = API_PAGE): Promise<ApiList> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  const where = sql`coalesce(p.start_date, '2000-01-01') >= ${dateOr(from, "2000-01-01")}::date ${authority ? sql`and p.authority = ${authority}` : sql``}`;
  const [list, n] = await Promise.all([
    rows<Row>(sql`
      select p.id, p.authority, p.reference, p.address, p.postcode, p.description, p.app_type as "type", p.app_state as "state",
        p.start_date::text as received, p.decided_date::text as decided, p.decision, p.ward, p.lat::float8 as lat, p.lng::float8 as lng,
        p.url as "councilUrl", p.meeting_id as "committeeMeetingId"
      from planning_applications p where ${where}
      order by p.start_date desc nulls last, p.id limit ${size} offset ${offsetFor(page, size)}`),
    one<{ n: number }>(sql`select count(*)::int as n from planning_applications p where ${where}`),
  ]);
  return { total: n?.n ?? 0, page, pageSize: size, rows: list };
}

export async function apiConsultations(): Promise<ApiList> {
  "use cache";
  cacheLife("hours");
  cacheTag("consultations");
  const today = ukToday();
  const list = await rows<Row>(sql`
    select url, url_cy as "urlCy", source, council_id as council, title_en as title, title_cy as "titleCy",
      opens::text as opens, closes::text as closes,
      -- Open means still taking responses today, whatever the last check of the source said.
      (open and (closes is null or closes >= ${today}::date)) as open, topics
    from consultations order by 9 desc, consultations.closes nulls last`);
  return { total: list.length, page: 1, pageSize: list.length, rows: list };
}

/**
 * Who holds what: each council's leader, deputy leaders and Cabinet members with their portfolios in the
 * council's own words, and the chairs of its scrutiny and planning committees. Public roles only: no contact details.
 */
export async function apiCabinets(council: string | null, topic: string | null): Promise<ApiList> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors", "committees", "meetings");
  const list = (await roleRows())
    .filter((r) => (!council || r.council === council) && (!topic || r.topics.includes(topic)))
    .map((r) => ({ ...r, page: `${SITE.url}/${r.council}/councillors/${r.councillorId}` }));
  return { total: list.length, page: 1, pageSize: list.length, rows: list };
}

/**
 * Decisions councils have said they plan to take, from each council's own published list of forthcoming decisions:
 * those on a council's list now (listed: true), and those that left it in the last 45 days (listed: false), each with
 * the meeting the council linked it to where there is one. Only councils whose list was read in full in the last week
 * are included. Titles and decision makers are the council's own words. Officers' names are not held.
 */
export async function apiPlannedDecisions(council: string | null, topic: string | null, from: string | null, executiveOnly: boolean, page: number, size = API_PAGE): Promise<ApiList> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  // The same rows the site shows: councils whose list was read in full in the last week.
  const where = sql`exists (select 1 from source_reads r where r.council_id = p.council_id and r.source = 'forward-plan'
      and (r.read_at at time zone 'Europe/London')::date >= ${today}::date - ${FRESH_DAYS}::int)
    and (p.listed or p.last_seen >= now() - make_interval(days => ${RECENT_DAYS}::int))
    and (coalesce(p.executive_due, p.due) is null or coalesce(p.executive_due, p.due) >= ${dateOr(from, "2000-01-01")}::date)
    ${council ? sql`and p.council_id = ${council}` : sql``}
    ${topic ? sql`and ${topic} = any(p.topics)` : sql``}
    ${executiveOnly ? sql`and p.executive` : sql``}`;
  try {
    const [list, n] = await Promise.all([
      rows<Row>(sql`
        select p.council_id as council, p.issue_id as "issueId", p.title, p.purpose, p.makers as "decisionMakers", p.executive as "cabinet",
          p.due::text as due, p.due_month_only as "dueMonthOnly", p.executive_due::text as "cabinetDue", p.is_key as "keyDecision",
          p.status, p.lead_member as "leadMember", p.lead_director as "leadDirector", p.restriction, p.notice_published::text as "noticePublished",
          p.topics, p.listed, (p.first_seen at time zone 'Europe/London')::date::text as "firstSeen", (p.last_seen at time zone 'Europe/London')::date::text as "lastSeen",
          p.url as "councilUrl", p.taken_meeting_id as "meetingId", p.taken_item_id as "agendaItemId"
        from planned_decisions p where ${where}
        order by coalesce(p.executive_due, p.due) nulls last, p.council_id, p.issue_id limit ${size} offset ${offsetFor(page, size)}`),
      one<{ n: number }>(sql`select count(*)::int as n from planned_decisions p where ${where}`),
    ]);
    return { total: n?.n ?? 0, page, pageSize: size, rows: list };
  } catch (e) {
    // A preview deployment reads the live database before its branch's new tables exist there.
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "42P01") return { total: 0, page, pageSize: size, rows: [] };
    throw e;
  }
}

/** For each council, whether its list of forthcoming decisions can be read, and when it last was. */
export async function apiPlannedCoverage(): Promise<ApiList> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const list = (await forwardPlanCoverage()).map((c) => ({ council: c.councilId, shown: c.shown, reason: c.gap, read: c.readOn, listed: c.listed }));
  return { total: list.length, page: 1, pageSize: list.length, rows: list };
}
