import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { offsetFor, one, PAGE_SIZE, rows, sql } from "./db";

/** Issues: the same business followed across meetings (pipeline/jobs/issues.ts). */

export interface IssueRow {
  councilId: string;
  id: number;
  titleEn: string;
  titleCy: string | null;
  firstDate: string;
  lastDate: string;
  steps: number;
  kinds: string[];
  topics: string[];
  decided: boolean;
}

const COLUMNS = sql`i.council_id as "councilId", i.id, i.title_en as "titleEn", i.title_cy as "titleCy", i.first_date::text as "firstDate",
  i.last_date::text as "lastDate", i.steps, i.kinds, i.topics, i.decided`;

export async function listIssues(f: { council?: string; topic?: string; page?: number }): Promise<{ rows: IssueRow[]; total: number }> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const where = sql`true ${f.council ? sql`and i.council_id = ${f.council}` : sql``} ${f.topic ? sql`and ${f.topic} = any(i.topics)` : sql``}`;
  const [list, n] = await Promise.all([
    rows<IssueRow>(sql`select ${COLUMNS} from issues i where ${where} order by i.last_date desc, i.steps desc, i.id limit ${PAGE_SIZE} offset ${offsetFor(f.page ?? 1)}`),
    one<{ n: number }>(sql`select count(*)::int as n from issues i where ${where}`),
  ]);
  return { rows: list, total: n?.n ?? 0 };
}

export interface IssueStep {
  agendaItemId: number;
  meetingId: number;
  date: string;
  committeeEn: string;
  committeeCy: string | null;
  kind: string;
  title: string;
  headlineEn: string | null;
  headlineCy: string | null;
  decidedEn: string | null;
  decidedCy: string | null;
  decision: string | null;
  minutesPublished: boolean;
  /** The meeting hasn't happened yet. */
  upcoming: boolean;
}

export async function getIssue(councilId: string, id: number): Promise<(IssueRow & { stepsList: IssueStep[] }) | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const issue = await one<IssueRow>(sql`select ${COLUMNS} from issues i where i.council_id = ${councilId} and i.id = ${id}`);
  if (!issue) return null;
  const stepsList = await rows<IssueStep>(sql`
    select x.agenda_item_id as "agendaItemId", x.meeting_id as "meetingId", x.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
      c.kind, s.title, s.headline_en as "headlineEn", s.headline_cy as "headlineCy", s.decided_en as "decidedEn", s.decided_cy as "decidedCy",
      s.decision, m.minutes_published as "minutesPublished", (m.date > ${today}::date) as upcoming
    from issue_items x
    join meetings m on m.council_id = x.council_id and m.id = x.meeting_id
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    left join search_items s on s.council_id = x.council_id and s.agenda_item_id = x.agenda_item_id
    where x.council_id = ${councilId} and x.issue_id = ${id}
    order by x.date, x.agenda_item_id`);
  return { ...issue, stepsList };
}

/** The issues the items of one meeting belong to, keyed by agenda item. */
export async function issuesForMeeting(councilId: string, meetingId: number): Promise<Array<{ agendaItemId: number; issueId: number; steps: number }>> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings", `meeting:${councilId}:${meetingId}`);
  return rows(sql`
    select x.agenda_item_id as "agendaItemId", x.issue_id as "issueId", i.steps
    from issue_items x join issues i on i.council_id = x.council_id and i.id = x.issue_id
    where x.council_id = ${councilId} and x.meeting_id = ${meetingId}`);
}

export async function someIssueIds(limit = 3): Promise<Array<{ council: string; id: string }>> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const r = await rows<{ council: string; id: number }>(sql`select council_id as council, id from issues order by last_date desc limit ${limit}`);
  return r.map((x) => ({ council: x.council, id: String(x.id) }));
}
