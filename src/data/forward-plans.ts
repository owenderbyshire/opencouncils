import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { LIVE_COUNCILS } from "@/lib/councils";
import { rows, sql } from "./db";

/**
 * Decisions councils have said they plan to take, from each council's own
 * published list of forthcoming decisions (pipeline/jobs/forward-plans.ts),
 * and which councils publish such a list in a form OpenCouncil can read.
 */

export interface PlannedDecision {
  councilId: string;
  issueId: number;
  /** The council's wording. */
  title: string;
  purpose: string | null;
  /** Who decides, as published. */
  makers: string;
  /** Whether the Cabinet, or a Cabinet member, is among them. */
  executive: boolean;
  /** The day to file it under: the day it goes to the Cabinet where the council gives one, otherwise the day it is due. */
  when: string | null;
  /** Only a month is given: `when` is its first day. */
  monthOnly: boolean;
  /** The day the last body named is due to decide, when that is later than `when`. */
  finalDue: string | null;
  isKey: boolean | null;
  leadMember: string | null;
  leadDirector: string | null;
  restriction: string | null;
  noticePublished: string | null;
  topics: string[];
  /** The council's own page for the matter. */
  url: string;
  /** Still on the council's list at the last read. */
  listed: boolean;
  /** The meeting and agenda item the council links for the day it was due, once OpenCouncil holds it. */
  takenMeetingId: number | null;
  takenItemId: number | null;
}

/** A preview deployment reads the live database before its branch's new tables exist there: a table that is not there yet reads as no rows. */
async function rowsIfTable<T>(query: Parameters<typeof rows>[0]): Promise<T[]> {
  try {
    return await rows<T>(query);
  } catch (e) {
    const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
    if (code === "42P01") return [];
    throw e;
  }
}

const COLUMNS = sql`
  p.council_id as "councilId", p.issue_id as "issueId", p.title, p.purpose, p.makers, p.executive,
  coalesce(p.executive_due, p.due)::text as "when",
  (p.executive_due is null and p.due_month_only) as "monthOnly",
  case when p.executive_due is not null and p.due > p.executive_due and not p.due_month_only then p.due::text end as "finalDue",
  p.is_key as "isKey", p.lead_member as "leadMember", p.lead_director as "leadDirector", p.restriction,
  p.notice_published::text as "noticePublished", p.topics, p.url, p.listed,
  p.taken_meeting_id as "takenMeetingId", p.taken_item_id as "takenItemId"
`;

/** How long after its day a decision stays on the page, so a reader can follow it to the meeting. */
export const RECENT_DAYS = 45;

/**
 * How old a council's last full read may be before its planned decisions stop
 * being shown. Councils move and drop decisions, so a list that has not been
 * readable for a week is no longer what the council plans.
 */
export const FRESH_DAYS = 7;

export interface PlannedLists {
  today: string;
  /** On the council's list with a day today or later (or a month not yet over), soonest first; a month alone sorts at its end. */
  ahead: PlannedDecision[];
  /** On the council's list with no date that could be read. */
  undated: PlannedDecision[];
  /** Still on the council's list though its day has passed. */
  overdue: PlannedDecision[];
  /** Linked to the meeting it went to, in the last 45 days, newest first. */
  taken: PlannedDecision[];
}

/** Every planned decision held, for all councils. Pages filter this by council, topic and decision maker. */
export async function plannedDecisions(): Promise<PlannedLists> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const all = await rowsIfTable<PlannedDecision>(sql`
    select ${COLUMNS} from planned_decisions p
    join source_reads r on r.council_id = p.council_id and r.source = 'forward-plan'
      and (r.read_at at time zone 'Europe/London')::date >= ${today}::date - ${FRESH_DAYS}::int
    where p.listed or (p.taken_meeting_id is not null and coalesce(p.executive_due, p.due) >= ${today}::date - ${RECENT_DAYS}::int)
    -- A decision with only a month could fall on any day of it, so it sorts after the month's dated ones.
    order by coalesce(p.executive_due, case when p.due_month_only then (date_trunc('month', p.due) + interval '1 month - 1 day')::date else p.due end) nulls last,
      p.council_id, p.title
  `);
  const monthStart = `${today.slice(0, 7)}-01`;
  const isAhead = (d: PlannedDecision) => d.when !== null && (d.monthOnly ? d.when >= monthStart : d.when >= today);
  const taken = all.filter((d) => d.takenMeetingId !== null && d.when !== null && d.when < today).reverse();
  const takenKeys = new Set(taken.map((d) => `${d.councilId}:${d.issueId}`));
  const open = all.filter((d) => d.listed && !takenKeys.has(`${d.councilId}:${d.issueId}`));
  return {
    today,
    ahead: open.filter(isAhead),
    undated: open.filter((d) => d.when === null),
    overdue: open.filter((d) => d.when !== null && !isAhead(d)),
    taken,
  };
}

/**
 * Why a council's planned decisions are not shown.
 * - empty: its list was read and names nothing
 * - robots, challenge, missing, failed: what the last look at its list met (pipeline/lib/reads.ts)
 * - stale: read before, but not in full in the last week
 * - unread: the pipeline has not looked yet
 * - none: the council does not use ModernGov, where these lists are read from
 */
export type ForwardPlanGap = "empty" | "robots" | "challenge" | "missing" | "failed" | "stale" | "unread" | "none";

export interface ForwardPlanCoverage {
  councilId: string;
  /** Whether the council's planned decisions are shown: its list was read in full in the last week and names at least one. */
  shown: boolean;
  /** Why not, when they are not. */
  gap: ForwardPlanGap | null;
  /** The day its list was last read in full. */
  readOn: string | null;
  /** How many decisions that read listed. */
  listed: number;
  /** The latest Cabinet agenda item that carries the council's forward work programme as a paper, where there is one. */
  paper: { meetingId: number; itemId: number; date: string; title: string } | null;
}

type Outcome = "ok" | "empty" | "robots" | "challenge" | "missing" | "failed";

/** For each council, whether its planned decisions can be read, and where its own forward plan is when they can't. */
export async function forwardPlanCoverage(): Promise<ForwardPlanCoverage[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const [reads, papers] = await Promise.all([
    rowsIfTable<{ councilId: string; outcome: Outcome; readOn: string | null; fresh: boolean; listed: number }>(sql`
      select council_id as "councilId", outcome, (read_at at time zone 'Europe/London')::date::text as "readOn",
        coalesce((read_at at time zone 'Europe/London')::date >= ${today}::date - ${FRESH_DAYS}::int, false) as fresh, rows as listed
      from source_reads where source = 'forward-plan'
    `),
    // Many councils publish the Cabinet's forward work programme as a paper to each Cabinet meeting: the latest such item, to point to.
    rows<{ councilId: string; meetingId: number; itemId: number; date: string; title: string }>(sql`
      select distinct on (a.council_id) a.council_id as "councilId", a.meeting_id as "meetingId", a.id as "itemId", m.date::text as date, a.title
      from agenda_items a
      join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
      join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where c.kind = 'cabinet' and not m.cancelled and not a.is_restricted
        and m.date > ${today}::date - 240 and m.date <= ${today}::date + 30
        and a.title ~* '\\m(forward (work )?(plan|programme|planner)|forward work program|work programme)\\M'
        and a.title !~* '\\m(scrutiny|audit|standards|democratic services)\\M'
      order by a.council_id, m.date desc, a.seq
    `),
  ]);
  return LIVE_COUNCILS.map((c) => {
    const r = reads.find((x) => x.councilId === c.id);
    const p = papers.find((x) => x.councilId === c.id);
    // What the last full read found stands for a week, even if a later look failed.
    const shown = Boolean(r && r.fresh && r.listed > 0);
    const gap: ForwardPlanGap | null = shown
      ? null
      : !r
        ? c.system === "moderngov"
          ? "unread"
          : "none"
        : r.fresh
          ? "empty"
          : // Read in full before, but not lately: whatever the last look met, the list held is too old to show.
            r.readOn || r.outcome === "ok" || r.outcome === "empty"
            ? "stale"
            : r.outcome;
    return {
      councilId: c.id,
      shown,
      gap,
      readOn: r?.readOn ?? null,
      listed: shown ? r!.listed : 0,
      paper: p ? { meetingId: p.meetingId, itemId: p.itemId, date: p.date, title: p.title } : null,
    };
  });
}
