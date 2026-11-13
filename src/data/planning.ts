import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import {
  committeeDecidedSql,
  dnsSql,
  FIRST_FETCH_DAYS,
  LEAGUE_EXCLUDED_TYPES,
  LEAGUE_MAX_DAYS,
  planningStatusSql,
  SETTLE_DAYS,
  type PlanningStatus,
} from "@/lib/planning-status";
import { offsetFor, one, rows, sql } from "./db";
import { timelineMonths } from "@/lib/timeline";

/**
 * Planning applications for Wales's 25 planning authorities
 * (pipeline/jobs/planning.ts). Authorities are ids from
 * data/curated/planning-authorities.ts. Every status comes from
 * planningStatusSql (src/lib/planning-status.ts).
 */

export const PLANNING_PAGE = 40;

const STATUS = planningStatusSql("p");
const DECIDED = sql`${STATUS} in ('approved', 'refused', 'decided')`;
const BY_COMMITTEE = committeeDecidedSql("p");
const DNS = dnsSql("p");

export interface ApplicationRow {
  id: number;
  authority: string;
  reference: string | null;
  address: string | null;
  description: string | null;
  appType: string | null;
  appState: string | null;
  status: PlanningStatus;
  startDate: string | null;
  decidedDate: string | null;
  meetingId: number | null;
  councilId: string | null;
  /** The register says a planning committee decided it. */
  decidedByCommittee: boolean;
  /** Its reference appears on a planning committee agenda. */
  onAgenda: boolean;
  /** A Development of National Significance, decided by the Welsh Ministers. */
  dns: boolean;
}

const ROW = sql`p.id, p.authority, p.reference, p.address, p.description, p.app_type as "appType", p.app_state as "appState",
  ${STATUS} as status,
  p.start_date::text as "startDate", p.decided_date::text as "decidedDate", p.meeting_id as "meetingId", p.council_id as "councilId",
  ${BY_COMMITTEE} as "decidedByCommittee", (p.meeting_id is not null) as "onAgenda", ${DNS} as dns`;

/**
 * Each authority with any applications: when its collection began (the day
 * its first fetch went back to, recorded by the pipeline in
 * planning-coverage; failing that, its first applications' arrival in the
 * database less the first fetch's 183 days), and its newest application.
 */
const AUTH = sql`
  select authority, count(*)::int as total, max(start_date) as latest,
    coalesce(
      (select (s.value->>authority)::date from pipeline_state s where s.key = 'planning-coverage'),
      min(first_seen_at)::date - ${FIRST_FETCH_DAYS}::int
    ) as start
  from planning_applications group by authority`;

export interface AuthorityStats {
  authority: string;
  /** Every application held, of any date. */
  total: number;
  recent: number;
  /** Received in the last year and waiting for a decision, by the register. */
  waiting: number;
  latest: string | null;
  /** Nothing received for a month: collection has probably stopped. */
  stale: boolean;
  /** The first day from which OpenCouncil has every application. */
  collectionStart: string | null;
}

/** For each authority with data: applications received in the last six months, how many await a decision, and the newest. */
export async function authorityStats(): Promise<AuthorityStats[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  return rows<AuthorityStats>(sql`
    with a as (${AUTH})
    select a.authority, a.total,
      count(p.id) filter (where p.start_date > ${today}::date - 183)::int as recent,
      count(p.id) filter (where p.start_date > ${today}::date - 365 and ${STATUS} = 'waiting')::int as waiting,
      a.latest::text as latest,
      (a.latest is null or a.latest < ${today}::date - 30) as stale,
      a.start::text as "collectionStart"
    from a join planning_applications p on p.authority = a.authority
    group by a.authority, a.total, a.latest, a.start
  `).catch(() => []);
}

export type PlanningFilter = "open" | "decided" | "committee" | undefined;

export async function listApplications(
  authority: string,
  filter: PlanningFilter,
  page: number,
): Promise<{ rows: ApplicationRow[]; total: number }> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  const where =
    filter === "open"
      ? sql`and ${STATUS} = 'waiting'`
      : filter === "decided"
        ? sql`and ${DECIDED}`
        : filter === "committee"
          ? sql`and (p.meeting_id is not null or ${BY_COMMITTEE})`
          : sql``;
  const [list, count] = await Promise.all([
    rows<ApplicationRow>(sql`
      select ${ROW} from planning_applications p where p.authority = ${authority} ${where}
      order by p.start_date desc nulls last, p.id desc
      limit ${PLANNING_PAGE} offset ${offsetFor(page, PLANNING_PAGE)}
    `),
    one<{ n: number }>(sql`select count(*)::int as n from planning_applications p where p.authority = ${authority} ${where}`),
  ]);
  return { rows: list, total: count?.n ?? 0 };
}

/** Applications within about a kilometre of a point, received in the last six months, nearest first within each day. */
export const NEAR_DISTANCES = [0.5, 1, 2, 5, 10] as const;
export const NEAR_SHOW = ["all", "waiting", "decided"] as const;
export const NEAR_PERIODS = [3, 6, 12, 24] as const;
export const NEAR_TYPES = ["all", "new", "trees", "other"] as const;

export interface NearOptions {
  km?: (typeof NEAR_DISTANCES)[number];
  show?: (typeof NEAR_SHOW)[number];
  /** Months back, by date received. Ignored when showing applications still waiting: every one is listed however old. */
  months?: (typeof NEAR_PERIODS)[number];
  type?: (typeof NEAR_TYPES)[number];
  sort?: "newest" | "nearest";
}

/** Applications within `km` of a point, filtered. Up to 500. */
export async function applicationsNear(lat: number, lng: number, opts: NearOptions = {}): Promise<Array<ApplicationRow & { metres: number }>> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const km = opts.km ?? 1;
  const show = opts.show ?? "all";
  const months = opts.months ?? 6;
  const type = opts.type ?? "all";
  const dLat = km / 111;
  const dLng = km / (111 * Math.cos((lat * Math.PI) / 180));
  const today = ukToday();
  const typeSql =
    type === "new"
      ? sql`and p.app_type in ('Full', 'Outline')`
      : type === "trees"
        ? sql`and p.app_type = 'Trees'`
        : type === "other"
          ? sql`and coalesce(p.app_type, '') not in ('Full', 'Outline', 'Trees')`
          : sql``;
  const statusSql =
    show === "waiting" ? sql`and status = 'waiting'` : show === "decided" ? sql`and status in ('approved', 'refused', 'decided', 'withdrawn')` : sql``;
  const dateSql = show === "waiting" ? sql`` : sql`and p.start_date > ${today}::date - ${months * 30}::int`;
  return rows<ApplicationRow & { metres: number }>(sql`
    select * from (
      select ${ROW},
        (6371000 * 2 * asin(sqrt(power(sin(radians(p.lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(p.lat)) * power(sin(radians(p.lng - ${lng}) / 2), 2))))::int as metres
      from planning_applications p
      where p.lat between ${lat - dLat} and ${lat + dLat} and p.lng between ${lng - dLng} and ${lng + dLng}
        ${dateSql} ${typeSql}
    ) x where metres <= ${km * 1000} ${statusSql}
    order by ${opts.sort === "nearest" ? sql`metres, "startDate" desc nulls last` : sql`"startDate" desc nulls last, metres`} limit 500
  `);
}

/** The most recent applications named on a planning committee's agenda. Developments of National Significance are left out: the council only comments on them. */
export async function recentAtCommittee(limit = 8): Promise<Array<ApplicationRow & { meetingDate: string }>> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return rows<ApplicationRow & { meetingDate: string }>(sql`
    select ${ROW}, m.date::text as "meetingDate"
    from planning_applications p join meetings m on m.council_id = p.council_id and m.id = p.meeting_id
    where not ${DNS}
    order by m.date desc, p.id desc limit ${limit}
  `).catch(() => []);
}

export interface ApplicationDetail extends ApplicationRow {
  name: string;
  postcode: string | null;
  appSize: string | null;
  /** PlanIt's consultation date, which is often the end of consultation. Hidden when it's in the future or after the decision. */
  consultedDate: string | null;
  targetDate: string | null;
  decision: string | null;
  ward: string | null;
  homes: number | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  docsUrl: string | null;
  commentUrl: string | null;
  agendaItemId: number | null;
  meetingDate: string | null;
  committeeEn: string | null;
  committeeCy: string | null;
  itemTitle: string | null;
  /** What the committee decided, from the meeting's summary, when there is one. */
  decidedEn: string | null;
  decidedCy: string | null;
  /** The decision as the minutes record it. */
  minuteDecision: string | null;
}

export async function getApplication(id: number): Promise<ApplicationDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  return one<ApplicationDetail>(sql`
    select ${ROW}, p.name, p.postcode, p.app_size as "appSize",
      (case when p.consulted_date > ${today}::date or p.consulted_date > p.decided_date then null else p.consulted_date end)::text as "consultedDate", p.target_date::text as "targetDate",
      p.decision, p.ward, p.homes, p.lat, p.lng, p.url, p.docs_url as "docsUrl", p.comment_url as "commentUrl", p.agenda_item_id as "agendaItemId",
      m.date::text as "meetingDate", c.name_en as "committeeEn", c.name_cy as "committeeCy", i.title as "itemTitle",
      (select x->>'decidedEn' from summaries s, jsonb_array_elements(s.content->'items') x
        where s.council_id = p.council_id and s.meeting_id = p.meeting_id and (x->>'agendaItemId')::int = p.agenda_item_id
        order by s.created_at desc limit 1) as "decidedEn",
      (select x->>'decidedCy' from summaries s, jsonb_array_elements(s.content->'items') x
        where s.council_id = p.council_id and s.meeting_id = p.meeting_id and (x->>'agendaItemId')::int = p.agenda_item_id
        order by s.created_at desc limit 1) as "decidedCy",
      (select d.text from decisions d where d.council_id = p.council_id and d.agenda_item_id = p.agenda_item_id limit 1) as "minuteDecision"
    from planning_applications p
    left join meetings m on m.council_id = p.council_id and m.id = p.meeting_id
    left join committees c on c.council_id = m.council_id and c.id = m.committee_id
    left join agenda_items i on i.council_id = p.council_id and i.id = p.agenda_item_id
    where p.id = ${id}
  `);
}

/** A few recent application ids, for static params. */
export async function someApplicationIds(): Promise<number[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return (await rows<{ id: number }>(sql`select id from planning_applications order by start_date desc nulls last limit 3`).catch(() => [])).map((r) => r.id);
}

export interface LeagueRow {
  authority: string;
  /** Applications counted: received in the window, less discharge of conditions, tree works, amendments, other types and DNS. */
  received: number;
  /** Decided (approved, refused or otherwise decided) with a decision date on or after the date received. */
  decided: number;
  /** Of those, decided within 56 days of being received. */
  within8: number;
  /** Median days from received to decided, of those decided. Null when none. */
  medianDays: number | null;
  waiting: number;
  /** Withdrawn or referred elsewhere. */
  closedOther: number;
  /** Neither waiting, withdrawn, referred, nor decided with a date. */
  noRecord: number;
  /** received less waiting, withdrawn and referred: the applications that should have an outcome. */
  settled: number;
  approved: number;
  refused: number;
  /** Full and outline applications approved or refused: the base for the approval rate. */
  outcomes: number;
  committee: number;
  /** Decided applications whose register says who decided them: the base for the committee rate. */
  routeKnown: number;
  /** Decided applications of any kind: the yardstick for routeKnown. */
  decidedAny: number;
  /** Nothing received for a month: collection has probably stopped. */
  stale: boolean;
  latest: string | null;
  /** The window of dates received that the figures cover. */
  from: string;
  to: string;
  windowDays: number;
}

/**
 * The planning league. For each authority, applications received from the
 * day OpenCouncil's collection of it began (so none are missing) to 91 days
 * ago (so each has had time to be decided), and at most a year. Applications
 * that arrived before collection began, picked up only because they changed
 * later, are left out. So are discharge of conditions, tree works,
 * amendments, other types and Developments of National Significance.
 * Every authority with any data is returned; leagueExclusion says which to rank.
 */
export async function planningLeague(): Promise<LeagueRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  return rows<LeagueRow>(sql`
    with a as (
      select x.*, ${today}::date - ${SETTLE_DAYS}::int as "to",
        greatest(x.start, ${today}::date - ${SETTLE_DAYS + LEAGUE_MAX_DAYS}::int) as "from"
      from (${AUTH}) x
    ), c as (
      select p.authority, p.app_type, p.decided_by, ${STATUS} as status,
        case when p.decided_date >= p.start_date then p.decided_date - p.start_date end as days
      from planning_applications p join a on a.authority = p.authority
      where p.start_date between a."from" and a."to"
        and coalesce(p.app_type, '') not in (${sql.join(LEAGUE_EXCLUDED_TYPES.map((x) => sql`${x}`), sql`, `)})
        and not ${DNS}
    )
    select a.authority,
      count(c.authority)::int as received,
      count(*) filter (where c.status in ('approved', 'refused', 'decided') and c.days is not null)::int as decided,
      count(*) filter (where c.status in ('approved', 'refused', 'decided') and c.days <= 56)::int as within8,
      (percentile_cont(0.5) within group (order by c.days) filter (where c.status in ('approved', 'refused', 'decided') and c.days is not null))::float8 as "medianDays",
      count(*) filter (where c.status = 'waiting')::int as waiting,
      count(*) filter (where c.status in ('withdrawn', 'referred'))::int as "closedOther",
      count(*) filter (where c.status not in ('waiting', 'withdrawn', 'referred')
        and not (c.status in ('approved', 'refused', 'decided') and c.days is not null))::int as "noRecord",
      count(*) filter (where c.status not in ('waiting', 'withdrawn', 'referred'))::int as settled,
      -- Approval rate: new proposals only (full and outline applications).
      count(*) filter (where c.status = 'approved' and c.app_type in ('Full', 'Outline'))::int as approved,
      count(*) filter (where c.status = 'refused' and c.app_type in ('Full', 'Outline'))::int as refused,
      count(*) filter (where c.status in ('approved', 'refused') and c.app_type in ('Full', 'Outline'))::int as outcomes,
      count(*) filter (where c.status in ('approved', 'refused', 'decided')
        and coalesce(c.decided_by, '') ~* '(committee|pwyllgor)' and coalesce(c.decided_by, '') !~* 'decision to be made by officer')::int as committee,
      count(*) filter (where c.status in ('approved', 'refused', 'decided')
        and c.decided_by is not null and c.decided_by !~* '(withdraw|none|not applicable|fringe|scr?e+ning)')::int as "routeKnown",
      count(*) filter (where c.status in ('approved', 'refused', 'decided'))::int as "decidedAny",
      (a.latest is null or a.latest < ${today}::date - 30) as stale,
      a.latest::text as latest,
      a."from"::text as "from", a."to"::text as "to",
      greatest(0, a."to" - a."from" + 1)::int as "windowDays"
    from a left join c on c.authority = a.authority
    group by a.authority, a.latest, a."from", a."to"
  `).catch(() => []);
}

export interface Completeness {
  authority: string;
  /** The quarter compared: the latest the Welsh Government has published that falls wholly within what we hold. */
  start: string;
  end: string;
  official: number;
  ours: number;
}

/**
 * How many applications we hold for each authority against the Welsh
 * Government's count of applications received (pipeline/jobs/planning-official.ts),
 * for the latest quarter we hold in full.
 */
export async function planningCompleteness(): Promise<Completeness[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return rows<Completeness>(sql`
    with official as (
      select c->>'authority' as a, (c->>'start')::date as s, (c->>'end')::date as e, (c->>'received')::int as n
      from pipeline_state, jsonb_array_elements(value->'counts') c where key = 'planning-official'),
    cov as (
      select k as a, v::date as d from pipeline_state, jsonb_each_text(value) as x(k, v) where key = 'planning-coverage'),
    latest as (
      select distinct on (o.a) o.* from official o join cov on cov.a = o.a
      where cov.d <= o.s and o.n > 0 order by o.a, o.s desc)
    select l.a as authority, l.s::text as start, l.e::text as "end", l.n as official,
      (select count(*) from planning_applications p where p.authority = l.a and p.start_date between l.s and l.e)::int as ours
    from latest l`);
}

/** Kinds of application on the planning map, in the order the map's points give them. */
export const MAP_KINDS = ["new", "trees", "other"] as const;
export type MapKind = (typeof MAP_KINDS)[number];

export interface LiveMap {
  /** [id, longitude, latitude, kind (index into MAP_KINDS)]. */
  points: Array<[number, number, number, number]>;
  /** Applications waiting for a decision from the authorities shown, with or without a location. */
  total: number;
  /** Of those, how many have no location, so aren't on the map. */
  unlocated: number;
  /** Received on or after this day. */
  from: string;
  /** Authorities left out because nothing new has been collected from them for a month. */
  leftOut: string[];
}

/**
 * Every application received in the past year that its register still shows
 * as waiting for a decision, for the planning map. Authorities whose
 * collection has stopped are left out, because their waiting applications may
 * well have been decided since.
 */
export async function liveApplicationMap(): Promise<LiveMap> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const stale = await rows<{ authority: string }>(sql`
    select authority from planning_applications group by authority having max(start_date) < ${today}::date - 30`);
  const leftOut = stale.map((s) => s.authority);
  const list = (
    await rows<{ id: number; a: string; lng: number | null; lat: number | null; t: string | null }>(sql`
      select p.id, p.authority as a, p.lng::float8 as lng, p.lat::float8 as lat, p.app_type as t
      from planning_applications p
      where p.start_date >= ${from}::date and ${STATUS} = 'waiting'
      order by p.id`)
  ).filter((r) => !leftOut.includes(r.a));
  const kind = (t: string | null) => (t === "Full" || t === "Outline" ? 0 : t === "Trees" ? 1 : 2);
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  const points = list.filter((r) => r.lat !== null && r.lng !== null).map((r): [number, number, number, number] => [r.id, round(r.lng!), round(r.lat!), kind(r.t)]);
  return { points, total: list.length, unlocated: list.length - points.length, from, leftOut };
}

export interface DecisionMonths {
  /** Complete months, oldest first, all after collection of the register began. */
  months: Array<{ month: string; approved: number; refused: number; other: number }>;
  from: string;
  to: string;
}

/**
 * Decisions on an authority's register by the month they were made, for up to
 * the last twelve complete months, split by outcome: approved, refused, and
 * decided with no outcome given. Withdrawn applications are not decisions and
 * are left out. Only months wholly after collection of the register began are
 * counted, so no month is short of decisions we never collected; an
 * authority whose collection has stopped (nothing new for a month) gets null.
 */
export async function decisionMonths(authority: string): Promise<DecisionMonths | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  const auth = await one<{ start: string | null; stale: boolean }>(sql`
    select x.start::text as start, (x.latest is null or x.latest < ${today}::date - 30) as stale
    from (${AUTH}) x where x.authority = ${authority}`).catch(() => null);
  if (!auth?.start || auth.stale) return null;
  // Months wholly after collection began: a month that began before it may be short.
  const months = lastTwelveMonths(today).filter((m) => m > auth.start!.slice(0, 7));
  if (months.length < 3) return null;
  const found = await rows<{ month: string; approved: number; refused: number; other: number }>(sql`
    select to_char(p.decided_date, 'YYYY-MM') as month,
      count(*) filter (where ${STATUS} = 'approved')::int as approved,
      count(*) filter (where ${STATUS} = 'refused')::int as refused,
      count(*) filter (where ${STATUS} = 'decided')::int as other
    from planning_applications p
    where p.authority = ${authority} and ${DECIDED}
      and p.decided_date >= ${`${months[0]}-01`}::date
      and p.decided_date < (${`${months[months.length - 1]}-01`}::date + interval '1 month')
    group by 1`).catch(() => []);
  const total = found.reduce((n, f) => n + f.approved + f.refused + f.other, 0);
  if (!total) return null;
  return {
    months: months.map((m) => {
      const f = found.find((x) => x.month === m);
      return { month: m, approved: f?.approved ?? 0, refused: f?.refused ?? 0, other: f?.other ?? 0 };
    }),
    from: months[0],
    to: months[months.length - 1],
  };
}

/** The twelve complete months before today's, oldest first. */
function lastTwelveMonths(today: string): string[] {
  return timelineMonths(today, 13).slice(0, 12);
}
