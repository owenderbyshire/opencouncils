import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { AttendanceStatus, CommitteeKind } from "@/db/schema";
import type { MeetingSummaryContent } from "@/lib/summary";
import { ukToday } from "@/i18n/format";
import { isNotAMeeting } from "@/lib/agenda";
import { addDays } from "@/lib/forward-plan";
import { offsetFor, one, PAGE_SIZE, rows, sql } from "./db";

/**
 * Attendance rates count meetings a councillor was expected at as a full
 * member: attending as someone else's substitute doesn't raise the rate, and
 * observers, co-opted and advisory roles are left out.
 */
const MEMBER_ROLE = sql`coalesce(a.role, '') !~* '(observer|co-?opted|advis|in attendance)'`;

/**
 * A council's meetings, committees, councillors and wards. Every function
 * takes the council's ID ("cardiff"); IDs below it are the council's own
 * ModernGov IDs.
 */

/* -------------------------------------------------------------------------- */
/* Meetings                                                                    */
/* -------------------------------------------------------------------------- */

export interface MeetingRow {
  councilId: string;
  id: number;
  date: string;
  startTime: string | null;
  cancelled: boolean;
  minutesPublished: boolean;
  committeeId: number;
  committeeEn: string;
  committeeCy: string | null;
  kind: CommitteeKind;
  overviewEn: string | null;
  overviewCy: string | null;
  /** "preview" when the summary was written from the agenda before the minutes were out. */
  summaryMode: "minutes" | "preview" | null;
  /**
   * Where a meeting without a summary stands: "upcoming"; "awaiting" (it has
   * happened, the minutes aren't out, and a summary will be written when they
   * are); "minuted" (minutes out, no summary yet); "none" (no minutes and no
   * summary planned: older meetings of minor committees).
   */
  status: "upcoming" | "awaiting" | "minuted" | "none";
}

/** Columns for a meeting row; `today` is the UK date, for whether a meeting has happened. */
const meetingColumns = (today: string) => sql`
  ${MEETING_COLUMNS},
  case when m.date >= ${today}::date then 'upcoming'
    when m.minutes_published or m.decisions_published then 'minuted'
    when c.kind in ('council', 'cabinet', 'scrutiny', 'planning') or m.date > ${today}::date - 365 then 'awaiting'
    else 'none' end as status
`;

const MEETING_COLUMNS = sql`
  m.council_id as "councilId", m.id, m.date::text as date, m.start_time as "startTime", m.cancelled,
  m.minutes_published as "minutesPublished", c.id as "committeeId", c.name_en as "committeeEn",
  c.name_cy as "committeeCy", c.kind,
  s.content->>'overviewEn' as "overviewEn", s.content->>'overviewCy' as "overviewCy",
  case when s.content is null then null else coalesce(s.content->>'mode', 'minutes') end as "summaryMode"
`;

const MEETING_JOINS = sql`
  join committees c on c.council_id = m.council_id and c.id = m.committee_id
  left join lateral (
    select content from summaries x where x.council_id = m.council_id and x.meeting_id = m.id
    order by x.created_at desc limit 1
  ) s on true
`;

export async function upcomingMeetings(councilId: string, limit = 8): Promise<MeetingRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const list = await rows<MeetingRow>(sql`
    select ${meetingColumns(today)} from meetings m ${MEETING_JOINS}
    where m.council_id = ${councilId} and m.date >= ${today} and m.cancelled = false
    order by m.date, m.start_time nulls last, m.id
    limit ${limit + 10}
  `);
  // Weekly lists of applications and the like are in the calendar but aren't meetings.
  return list.filter((m) => !isNotAMeeting(m.committeeEn)).slice(0, limit);
}

/** The latest summarised meetings, for one council or (with null) all of them. */
export async function recentlySummarised(councilId: string | null, limit = 6): Promise<MeetingRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  return rows<MeetingRow>(sql`
    select ${meetingColumns(today)} from meetings m ${MEETING_JOINS}
    where s.content is not null and coalesce(s.content->>'mode', 'minutes') = 'minutes' ${councilId ? sql`and m.council_id = ${councilId}` : sql``}
    order by m.date desc, m.id desc
    limit ${limit}
  `);
}

export type MeetingWhen = "upcoming" | "past";

export async function listMeetings(
  councilId: string,
  opts: { kind?: CommitteeKind; when: MeetingWhen; page: number; committeeId?: number; hideCancelled?: boolean },
): Promise<{ rows: MeetingRow[]; total: number }> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const where = sql`
    m.council_id = ${councilId}
    ${opts.kind ? sql`and c.kind = ${opts.kind}` : sql``}
    ${opts.committeeId ? sql`and m.committee_id = ${opts.committeeId}` : sql``}
    ${opts.hideCancelled ? sql`and not m.cancelled` : sql``}
    ${opts.when === "upcoming" ? sql`and m.date >= ${today}` : sql`and m.date < ${today}`}
  `;
  const order = opts.when === "upcoming" ? sql`m.date asc, m.start_time asc nulls last` : sql`m.date desc, m.start_time desc nulls last`;
  const [list, count] = await Promise.all([
    rows<MeetingRow>(sql`
      select ${meetingColumns(today)} from meetings m ${MEETING_JOINS}
      where ${where} order by ${order}, m.id limit ${PAGE_SIZE} offset ${offsetFor(opts.page)}
    `),
    one<{ n: number }>(sql`
      select count(*)::int as n from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where ${where}
    `),
  ]);
  return { rows: list, total: count?.n ?? 0 };
}

export interface MeetingDetail extends MeetingRow {
  location: string | null;
  agendaPublished: boolean;
  /** The meeting's own page, for councils not on ModernGov. */
  sourceUrl: string | null;
  recordingUrl: string | null;
  /** Papers for the whole meeting rather than one item, such as the minutes. */
  papers: Array<{ id: number; title: string; url: string }>;
  summary: MeetingSummaryContent | null;
  summaryModel: string | null;
  items: Array<{
    id: number;
    number: string | null;
    title: string;
    agendaText: string | null;
    minutes: string | null;
    decision: string | null;
    documents: Array<{ id: number; title: string; url: string }>;
  }>;
  attendance: Array<{
    councillorId: number;
    name: string;
    status: AttendanceStatus;
    role: string | null;
    partyId: string | null;
    partyLabel: string | null;
  }>;
  declarations: Array<{
    councillorId: number | null;
    name: string;
    kind: string;
    natureEn: string | null;
    natureCy: string | null;
    agendaItemId: number | null;
    item: string | null;
  }>;
  hasDeclarationsMinute: boolean;
}

export async function getMeeting(councilId: string, id: number): Promise<MeetingDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings", `meeting:${councilId}:${id}`);
  const today = ukToday();
  const m = await one<MeetingRow & { location: string | null; agendaPublished: boolean; sourceUrl: string | null; recordingUrl: string | null }>(sql`
    select ${meetingColumns(today)}, m.location, m.agenda_published as "agendaPublished", m.source_url as "sourceUrl", m.recording_url as "recordingUrl"
    from meetings m ${MEETING_JOINS}
    where m.council_id = ${councilId} and m.id = ${id}
  `);
  if (!m) return null;
  const [summary, items, attendance, declarations, papers] = await Promise.all([
    one<{ content: MeetingSummaryContent; model: string }>(sql`
      select content, model from summaries where council_id = ${councilId} and meeting_id = ${id}
      order by created_at desc limit 1
    `),
    rows<MeetingDetail["items"][number]>(sql`
      select a.id, a.number, a.title, a.agenda_text as "agendaText", a.minutes, d.text as decision,
        coalesce((
          select json_agg(json_build_object('id', x.id, 'title', x.title, 'url', x.url) order by x.id)
          from documents x where x.council_id = a.council_id and x.agenda_item_id = a.id
        ), '[]'::json) as documents
      from agenda_items a
      left join decisions d on d.council_id = a.council_id and d.agenda_item_id = a.id
      where a.council_id = ${councilId} and a.meeting_id = ${id}
      order by a.seq
    `),
    rows<MeetingDetail["attendance"][number]>(sql`
      select a.councillor_id as "councillorId", p.name, a.status, a.role, p.party_id as "partyId", p.party_label as "partyLabel"
      from attendance a join councillors p on p.council_id = a.council_id and p.id = a.councillor_id
      where a.council_id = ${councilId} and a.meeting_id = ${id}
      order by case when a.role ilike '%chair%' then 0 else 1 end, p.name
    `),
    rows<MeetingDetail["declarations"][number]>(sql`
      select d.councillor_id as "councillorId", coalesce(p.name, d.name_as_recorded) as name, d.kind,
        d.nature_en as "natureEn", d.nature_cy as "natureCy", d.agenda_item_id as "agendaItemId", d.item_as_recorded as item
      from declarations d left join councillors p on p.council_id = d.council_id and p.id = d.councillor_id
      where d.council_id = ${councilId} and d.meeting_id = ${id}
      order by d.id
    `),
    rows<MeetingDetail["papers"][number]>(sql`
      select id, title, url from documents
      where council_id = ${councilId} and meeting_id = ${id} and agenda_item_id is null
      order by title
    `),
  ]);
  const hasDeclarationsMinute = items.some(
    (i) => i.minutes && /declarations? of interest|datganiadau o fuddiant/i.test(i.title),
  );
  return {
    ...m,
    summary: summary?.content ?? null,
    summaryModel: summary?.model ?? null,
    items,
    attendance,
    declarations,
    papers,
    hasDeclarationsMinute,
  };
}

/** A few recent meeting IDs, for generateStaticParams. */
export async function recentMeetingIds(councilId: string, limit = 3): Promise<number[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const r = await rows<{ id: number }>(sql`
    select id from meetings where council_id = ${councilId} order by date desc limit ${limit}
  `);
  return r.map((x) => x.id);
}

/* -------------------------------------------------------------------------- */
/* Committees                                                                  */
/* -------------------------------------------------------------------------- */

export interface CommitteeRow {
  id: number;
  nameEn: string;
  nameCy: string | null;
  kind: CommitteeKind;
  members: number;
  nextMeeting: string | null;
  lastMeeting: string | null;
}

export async function listCommittees(councilId: string): Promise<CommitteeRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("committees", "meetings");
  const today = ukToday();
  return rows<CommitteeRow>(sql`
    select c.id, c.name_en as "nameEn", c.name_cy as "nameCy", c.kind,
      (select count(*)::int from committee_members x where x.council_id = c.council_id and x.committee_id = c.id and x.role not in ('substitute', 'observer')) as members,
      (select min(date)::text from meetings m where m.council_id = c.council_id and m.committee_id = c.id and m.date >= ${today} and not m.cancelled) as "nextMeeting",
      (select max(date)::text from meetings m where m.council_id = c.council_id and m.committee_id = c.id and m.date < ${today} and not m.cancelled) as "lastMeeting"
    from committees c
    where c.council_id = ${councilId} and c.active
      and exists (select 1 from meetings m where m.council_id = c.council_id and m.committee_id = c.id)
    order by c.name_en
  `);
}

export interface CommitteeDetail {
  id: number;
  nameEn: string;
  nameCy: string | null;
  kind: CommitteeKind;
  sourceUrl: string | null;
  members: Array<{ id: number; name: string; role: string; partyId: string | null; partyLabel: string | null }>;
}

export async function getCommittee(councilId: string, id: number): Promise<CommitteeDetail | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("committees", "councillors");
  const c = await one<Omit<CommitteeDetail, "members">>(sql`
    select id, name_en as "nameEn", name_cy as "nameCy", kind, source_url as "sourceUrl" from committees where council_id = ${councilId} and id = ${id}
  `);
  if (!c) return null;
  const members = await rows<CommitteeDetail["members"][number]>(sql`
    select p.id, p.name, x.role, p.party_id as "partyId", p.party_label as "partyLabel"
    from committee_members x join councillors p on p.council_id = x.council_id and p.id = x.councillor_id
    where x.council_id = ${councilId} and x.committee_id = ${id}
    order by case x.role when 'chair' then 0 when 'vice-chair' then 1 when 'member' then 2 else 3 end, p.name
  `);
  return { ...c, members };
}

export async function busiestCommitteeIds(councilId: string, limit = 3): Promise<number[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("committees");
  const r = await rows<{ id: number }>(sql`
    select committee_id as id from meetings where council_id = ${councilId}
    group by committee_id order by count(*) desc limit ${limit}
  `);
  return r.map((x) => x.id);
}

/* -------------------------------------------------------------------------- */
/* Councillors and wards                                                       */
/* -------------------------------------------------------------------------- */

export interface CouncillorRow {
  id: number;
  name: string;
  honorific: string | null;
  partyId: string | null;
  partyLabel: string | null;
  wardSlug: string | null;
  wardEn: string | null;
  wardCy: string | null;
  current: boolean;
  keyPosts: string[];
}

const COUNCILLOR_COLUMNS = sql`
  p.id, p.name, p.honorific, p.party_id as "partyId", p.party_label as "partyLabel", p.ward_slug as "wardSlug",
  w.name_en as "wardEn", w.name_cy as "wardCy", p.current, p.key_posts as "keyPosts"
`;

export async function listCouncillors(councilId: string): Promise<CouncillorRow[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  return rows<CouncillorRow>(sql`
    select ${COUNCILLOR_COLUMNS}
    from councillors p left join wards w on w.council_id = p.council_id and w.slug = p.ward_slug
    where p.council_id = ${councilId}
    order by w.name_en, p.name
  `);
}

export interface CouncillorDetail extends CouncillorRow {
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  termStart: string | null;
  /** Their own page on the council's site, where it isn't a ModernGov page. */
  sourceUrl: string | null;
  /** The council's own attendance record for the current year, where it publishes one (the Vale of Glamorgan). */
  officialAttendance: {
    period: string | null;
    rows: Array<{ name: string; committeeId: number | null; held: number | null; attended: number | null; apologies: number | null }>;
  } | null;
  committees: Array<{ id: number; nameEn: string; nameCy: string | null; role: string }>;
  attendance: { expected: number; attended: number };
  /**
   * The first date the attendance figures cover: twelve months ago, or the
   * earliest meeting OpenCouncil holds for the council if that is later.
   */
  attendanceFrom: string | null;
  /** Whether attendance covers the full twelve months. */
  attendanceFull: boolean;
  /** Whether this council's attendance can be ranked at all (some councils don't publish who was absent). */
  attendanceComparable: boolean;
  /** Where their attendance rate places them among the council's current councillors (1 = best), and the council's median rate. Only with at least six months of meetings. */
  attendanceRank: { rank: number; of: number; median: number; tied: boolean } | null;
  /** Agenda items that name them. */
  mentions: Array<{
    meetingId: number;
    date: string;
    committeeEn: string;
    committeeCy: string | null;
    title: string;
    /** The line of the agenda that names them, when it isn't the title. */
    detail: string | null;
    kind: "question" | "motion" | "other";
  }>;
  /** No mentions are shown because another current councillor has the same surname and first initial. */
  mentionsAmbiguous: boolean;
  /** Declarations come from summarised meetings only; the list shows the latest 50. */
  declarationsCapped: boolean;
  declarations: Array<{
    meetingId: number;
    date: string;
    committeeEn: string;
    committeeCy: string | null;
    kind: string;
    natureEn: string | null;
    natureCy: string | null;
    item: string | null;
  }>;
}

export async function getCouncillor(councilId: string, id: number): Promise<CouncillorDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors", "meetings");
  const today = ukToday();
  // How far back this council's meetings go in OpenCouncil: attendance can't cover more than that.
  const loaded = await one<{ first: string | null }>(sql`
    select min(m.date)::text as first from meetings m
    where m.council_id = ${councilId} and exists (select 1 from attendance a where a.council_id = m.council_id and a.meeting_id = m.id)
  `);
  const yearAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 365 * 86_400_000).toISOString().slice(0, 10);
  const attendanceFrom = loaded?.first ? (loaded.first > yearAgo ? loaded.first : yearAgo) : null;
  const attendanceFull = Boolean(loaded?.first && loaded.first <= yearAgo);
  const sixMonthsAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 182 * 86_400_000).toISOString().slice(0, 10);
  // The Vale of Glamorgan's minutes list who was present and who sent apologies, but not who was absent, and not every
  // name can be matched: its rates aren't comparable.
  const attendanceComparable = councilId !== "vale-of-glamorgan";
  const canRank = attendanceComparable && Boolean(loaded?.first && loaded.first <= sixMonthsAgo);
  const p = await one<CouncillorRow & Pick<CouncillorDetail, "photoUrl" | "email" | "phone" | "termStart" | "sourceUrl" | "officialAttendance">>(sql`
    select ${COUNCILLOR_COLUMNS}, p.photo_url as "photoUrl", p.email, p.phone, p.term_start::text as "termStart",
      p.source_url as "sourceUrl", p.official_attendance as "officialAttendance"
    from councillors p left join wards w on w.council_id = p.council_id and w.slug = p.ward_slug
    where p.council_id = ${councilId} and p.id = ${id}
  `);
  if (!p) return null;
  const [committees, att, declarations] = await Promise.all([
    rows<CouncillorDetail["committees"][number]>(sql`
      select c.id, c.name_en as "nameEn", c.name_cy as "nameCy", x.role
      from committee_members x join committees c on c.council_id = x.council_id and c.id = x.committee_id
      where x.council_id = ${councilId} and x.councillor_id = ${id}
      order by case x.role when 'chair' then 0 when 'vice-chair' then 1 else 2 end, c.name_en
    `),
    // Meetings where they were expected: attended (present, substitute for someone else) or not (apologies, sent a substitute, absent).
    one<{ expected: number; attended: number }>(sql`
      select count(*) filter (where a.status in ('present', 'apologies', 'sent_substitute', 'absent') and ${MEMBER_ROLE})::int as expected,
        count(*) filter (where a.status = 'present' and ${MEMBER_ROLE})::int as attended
      from attendance a join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
      where a.council_id = ${councilId} and a.councillor_id = ${id}
        and m.date > (${today}::date - interval '12 months') and m.date <= ${today}
    `),
    rows<CouncillorDetail["declarations"][number]>(sql`
      select d.meeting_id as "meetingId", m.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
        d.kind, d.nature_en as "natureEn", d.nature_cy as "natureCy", d.item_as_recorded as item
      from declarations d
      join meetings m on m.council_id = d.council_id and m.id = d.meeting_id
      join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where d.council_id = ${councilId} and d.councillor_id = ${id}
      order by m.date desc limit 51
    `),
  ]);
  const [rankRow, mentions] = await Promise.all([
    // Each current councillor's attendance rate over the same 12 months, for those expected at five or more meetings.
    !canRank ? Promise.resolve(null) : one<{ rank: number; of: number; median: number; tied: boolean }>(sql`
      with rates as (
        select a.councillor_id as id,
          count(*) filter (where a.status = 'present' and ${MEMBER_ROLE})::float8
            / nullif(count(*) filter (where a.status in ('present', 'apologies', 'sent_substitute', 'absent') and ${MEMBER_ROLE}), 0) as rate,
          count(*) filter (where a.status in ('present', 'apologies', 'sent_substitute', 'absent') and ${MEMBER_ROLE}) as expected
        from attendance a
        join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
        join councillors p on p.council_id = a.council_id and p.id = a.councillor_id and p.current
        where a.council_id = ${councilId} and m.date > (${today}::date - interval '12 months') and m.date <= ${today}
        group by a.councillor_id
      ), eligible as (select * from rates where expected >= 5 and rate is not null)
      select (select count(*) from eligible e where e.rate > me.rate)::int + 1 as rank,
        (select count(*) from eligible)::int as of,
        (select percentile_cont(0.5) within group (order by rate) from eligible)::float8 as median,
        ((select count(*) from eligible e where e.rate = me.rate) > 1) as tied
      from eligible me where me.id = ${id}
    `),
    mentionsOf(councilId, p.name, id),
  ]);
  return {
    ...p,
    committees,
    attendance: att ?? { expected: 0, attended: 0 },
    attendanceFrom,
    attendanceFull,
    attendanceComparable,
    attendanceRank: rankRow ?? null,
    mentions: mentions ?? [],
    mentionsAmbiguous: mentions === null,
    declarations: declarations.slice(0, 50),
    declarationsCapped: declarations.length > 50,
  };
}

/** Honours and titles that follow or precede a councillor's name and aren't part of it. */
const NAME_EXTRAS = /^(cbe|obe|mbe|bem|jp|dl|ms|am|mp|kc|qc|dr|cllr|councillor|cynghorydd|mr|mrs|ms|miss|mx|prof|professor|rev|sir|dame)\.?$/i;

/** First name and surname from a stored name: "Peter Black CBE", "Baynham, Beverley", "Gareth D Jones". */
export function nameParts(name: string): { first: string; surname: string } | null {
  const clean = name.replace(/\([^)]*\)/g, " ").trim();
  let words: string[];
  if (clean.includes(",")) {
    const [last, rest] = clean.split(",", 2);
    words = [...rest.split(/\s+/), ...last.split(/\s+/)];
  } else words = clean.split(/\s+/);
  words = words.map((w) => w.replace(/[^\p{L}\p{M}'-]/gu, "")).filter((w) => w && !NAME_EXTRAS.test(w));
  if (words.length < 2) return null;
  return { first: words[0], surname: words[words.length - 1] };
}

/**
 * Agenda items that name a councillor as "Councillor Surname" (with their
 * first name or initial when another current councillor shares the surname),
 * in item titles and agenda text, newest first. Null when another current
 * councillor has the same surname and first initial, so a match could be either.
 * "Question" and "motion" are used only when the text says they asked or moved it.
 */
async function mentionsOf(councilId: string, name: string, id: number): Promise<CouncillorDetail["mentions"] | null> {
  const parts = nameParts(name);
  if (!parts) return [];
  const { first, surname } = parts;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const others = await rows<{ name: string }>(sql`
    select name from councillors where council_id = ${councilId} and current and id <> ${id}
  `);
  const same = others.map((o) => nameParts(o.name)).filter((o) => o && o.surname.toLowerCase() === surname.toLowerCase());
  if (same.some((o) => o!.first[0].toLowerCase() === first[0].toLowerCase())) return null;
  const title = "(councillor|councillors|cllr\\.?|cynghorydd|y cynghorydd)\\s+(dr\\.?\\s+)?";
  const pattern = same.length
    ? `${title}(${esc(first)}|${esc(first[0])}\\.?(\\s*[a-z]\\.)*)\\s*${esc(surname)}\\M`
    : `${title}(${esc(first)}\\s+|([a-z]\\.\\s*)+)?${esc(surname)}\\M`;
  const asked = `(question|cwestiwn)[^\n]{0,60}(from|by|gan)\\s+${pattern}`;
  const moved = `(motion|cynnig)[^\n]{0,80}(proposed|moved|submitted|cyflwynwyd|gan)[^\n]{0,20}${pattern}`;
  return rows<CouncillorDetail["mentions"][number]>(sql`
    select a.meeting_id as "meetingId", m.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
      a.title,
      case when a.title ~* ${pattern} then null
        else left((regexp_match(coalesce(a.agenda_text, ''), ${`([^\n]*(?:${pattern})[^\n]*)`}, 'i'))[1], 300) end as detail,
      case when (a.title || ' ' || left(coalesce(a.agenda_text, ''), 4000)) ~* ${asked} then 'question'
        when (a.title || ' ' || left(coalesce(a.agenda_text, ''), 4000)) ~* ${moved} then 'motion'
        else 'other' end as kind
    from agenda_items a
    join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where a.council_id = ${councilId}
      and (a.title ~* ${pattern} or left(coalesce(a.agenda_text, ''), 4000) ~* ${pattern})
    order by m.date desc, a.seq
    limit 40
  `);
}

export async function someCouncillorIds(councilId: string, limit = 3): Promise<number[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  const r = await rows<{ id: number }>(sql`
    select id from councillors where council_id = ${councilId} and current order by id limit ${limit}
  `);
  return r.map((x) => x.id);
}

export interface WardDetail {
  slug: string;
  nameEn: string;
  nameCy: string | null;
  seats: number | null;
  councillors: CouncillorRow[];
}

export async function getWard(councilId: string, slug: string): Promise<WardDetail | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  const w = await one<Omit<WardDetail, "councillors">>(sql`
    select slug, name_en as "nameEn", name_cy as "nameCy", seats from wards where council_id = ${councilId} and slug = ${slug}
  `);
  if (!w) return null;
  const councillors = await rows<CouncillorRow>(sql`
    select ${COUNCILLOR_COLUMNS}
    from councillors p left join wards w on w.council_id = p.council_id and w.slug = p.ward_slug
    where p.council_id = ${councilId} and p.ward_slug = ${slug} and p.current
    order by p.name
  `);
  return { ...w, councillors };
}

export async function someWardSlugs(councilId: string, limit = 3): Promise<string[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  const r = await rows<{ slug: string }>(sql`select slug from wards where council_id = ${councilId} order by slug limit ${limit}`);
  return r.map((x) => x.slug);
}

export async function councilFacts(councilId: string): Promise<{ councillors: number; wards: number }> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  const r = await one<{ councillors: number; wards: number }>(sql`
    select (select count(*)::int from councillors where council_id = ${councilId} and current) as councillors,
      (select count(*)::int from wards w where w.council_id = ${councilId}
         and exists (select 1 from councillors p where p.council_id = w.council_id and p.ward_slug = w.slug and p.current)) as wards
  `);
  return r ?? { councillors: 0, wards: 0 };
}

/* -------------------------------------------------------------------------- */
/* Pipeline status                                                             */
/* -------------------------------------------------------------------------- */

export interface JobStatus {
  job: string;
  finishedAt: string | null;
  status: string;
}

export async function pipelineStatus(): Promise<JobStatus[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("reference", "meetings");
  return rows<JobStatus>(sql`
    select distinct on (job) job, coalesce(finished_at, started_at)::text as "finishedAt", status
    from pipeline_runs order by job, started_at desc
  `);
}

/** Councils whose councillors have been loaded: the ones the site lists as covered. */
/** Whether OpenCouncil holds any meetings for a council. */
export async function hasMeetings(councilId: string): Promise<boolean> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const r = await one<{ n: number }>(sql`select count(*)::int as n from (select 1 from meetings where council_id = ${councilId} limit 1) x`);
  return (r?.n ?? 0) > 0;
}

export async function councilsWithData(): Promise<string[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors", "meetings");
  // Covered means we hold the council's meetings: councillors alone aren't enough.
  const r = await rows<{ id: string }>(sql`select distinct council_id as id from meetings`);
  return r.map((x) => x.id);
}

export interface SiteStats {
  councils: number;
  meetings: number;
  decisions: number;
  councillors: number;
}

/** Headline counts for the home page. */
export async function siteStats(): Promise<SiteStats> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings", "councillors");
  // Councils are counted the way councilsWithData() counts them, so the figure matches the list of covered councils.
  const r = await one<SiteStats>(sql`
    select
      (select count(distinct council_id)::int from meetings) as councils,
      (select count(*)::int from meetings where not cancelled and date <= current_date) as meetings,
      (select count(*)::int from decisions) as decisions,
      (select count(*)::int from councillors where current) as councillors
  `);
  return r ?? { councils: 0, meetings: 0, decisions: 0, councillors: 0 };
}

export interface CouncilActivity {
  councilId: string;
  councillors: number;
  meetings: number;
  decisions: number;
  summarised: number;
  /** Share of expected attendances where the councillor attended, last 12 months. */
  attendance: number | null;
  /** Whether OpenCouncil holds the council's meetings for the whole of the last 12 months. */
  fullYear: boolean;
}

/** For each council, its activity over the last 12 months. */
export async function councilActivity(): Promise<CouncilActivity[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings", "councillors");
  return rows<CouncilActivity>(sql`
    select c.id as "councilId",
      coalesce((select min(m.date) <= current_date - 365 from meetings m where m.council_id = c.id), false) as "fullYear",
      (select count(*)::int from councillors p where p.council_id = c.id and p.current and p.name !~* '^vacan(cy|t)\\b') as councillors,
      (select count(*)::int from meetings m where m.council_id = c.id and not m.cancelled
         and m.date > current_date - 365 and m.date <= current_date) as meetings,
      (select count(*)::int from decisions d join meetings m on m.council_id = d.council_id and m.id = d.meeting_id
         where d.council_id = c.id and m.date > current_date - 365) as decisions,
      (select count(*)::int from summaries s join meetings m on m.council_id = s.council_id and m.id = s.meeting_id
         where s.council_id = c.id and m.date > current_date - 365 and coalesce(s.content->>'mode', 'minutes') = 'minutes') as summarised,
      (select (count(*) filter (where a.status = 'present' and ${MEMBER_ROLE})::float8
               / nullif(count(*) filter (where a.status in ('present', 'apologies', 'sent_substitute', 'absent') and ${MEMBER_ROLE}), 0))
         from attendance a join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
         where a.council_id = c.id and m.date > current_date - 365 and m.date <= current_date) as attendance
    from councils c
    where c.active
  `);
}

export interface BudgetPaper {
  meetingId: number;
  date: string;
  committeeEn: string;
  committeeCy: string | null;
  itemId: number;
  title: string;
  documents: number;
}

/**
 * Budget papers: items about the budget or council tax at full Council and
 * Cabinet meetings, newest first, with how many documents each has.
 */
export async function budgetPapers(councilId: string, limit = 24): Promise<BudgetPaper[]> {
  "use cache";
  cacheLife("days");
  cacheTag("meetings");
  return rows<BudgetPaper>(sql`
    select m.id as "meetingId", m.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
      a.id as "itemId", a.title,
      (select count(*)::int from documents d where d.council_id = a.council_id and d.agenda_item_id = a.id) as documents
    from agenda_items a
    join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where a.council_id = ${councilId} and c.kind in ('council', 'cabinet') and not m.cancelled
      and (a.title ~* '\\m(budget|council tax|medium[- ]term financial|revenue support|capital programme|treasury management)')
      and a.title !~* '\\m(monitoring|outturn)\\M'
    order by m.date desc, a.seq
    limit ${limit}
  `);
}

/**
 * The next seven days, today first: for each day, how many meetings of each
 * kind of committee are due, leaving out cancelled meetings.
 */
export async function weekAhead(councilId: string): Promise<Array<{ date: string; kinds: Array<{ kind: CommitteeKind; n: number }> }>> {
  "use cache";
  cacheLife("hours");
  cacheTag("meetings");
  const today = ukToday();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const found = (
    await rows<{ date: string; kind: CommitteeKind; committee: string }>(sql`
    select m.date::text as date, c.kind, c.name_en as committee
    from meetings m join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where m.council_id = ${councilId} and not m.cancelled and m.date between ${days[0]} and ${days[6]}`)
  ).filter((m) => !isNotAMeeting(m.committee));
  // In the order the meetings page lists kinds.
  const order: CommitteeKind[] = ["council", "cabinet", "scrutiny", "planning", "regulatory", "other"];
  return days.map((date) => {
    const counts = new Map<CommitteeKind, number>();
    for (const m of found) if (m.date === date) counts.set(m.kind, (counts.get(m.kind) ?? 0) + 1);
    return { date, kinds: [...counts].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([kind, n]) => ({ kind, n })) };
  });
}
