import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { portfolioTopics } from "@data/curated/portfolio-topics";
import { ukToday } from "@/i18n/format";
import { buildCabinet, namesPortfolio, officeHolderName, pickCabinet, type ExecutiveRole, type PostSource } from "@/lib/cabinet";
import { councilConfig, LIVE_COUNCILS } from "@/lib/councils";
import { committeeUrl, councillorUrl } from "@/lib/official-urls";
import { rows, sql } from "./db";

/**
 * Who holds what at each council: its leader, deputy leaders and Cabinet
 * members with their portfolios, and the chairs of its scrutiny and planning
 * committees. Everything comes from the council's own records: its committee
 * membership, the "key posts" on its list of councillors, and its executive
 * posts pages (src/lib/cabinet.ts has the rules).
 */

export interface OfficeHolder {
  councillorId: number;
  /** The councillor's name, without a role some councils write after it. */
  name: string;
  partyId: string | null;
  partyLabel: string | null;
}

export interface CabinetMember extends OfficeHolder {
  role: ExecutiveRole;
  /** The portfolio or post in the council's own words. Empty when its records give none. */
  posts: string[];
  /** Whether any of that wording names a portfolio, and not just the seat. */
  portfolio: boolean;
  source: PostSource | null;
  /** The council's own page the wording comes from. */
  sourceUrl: string | null;
  /** The site's topics the portfolio's name mentions. */
  topics: string[];
  /** No wording is shown because the council's executive posts pages have not been readable lately, not because its records give none. */
  unread: boolean;
}

export interface CommitteeChair extends OfficeHolder {
  committeeId: number;
  committeeEn: string;
  committeeCy: string | null;
  kind: "scrutiny" | "planning";
}

export interface CouncilCabinet {
  councilId: string;
  /** The council's Cabinet among its committees, or null when its records don't single one out. */
  cabinet: { id: number; nameEn: string; nameCy: string | null } | null;
  /** The council's own page for its Cabinet. */
  officialUrl: string | null;
  members: CabinetMember[];
  leaderKnown: boolean;
  chairs: CommitteeChair[];
  /** The day the council's list of councillors and committees was last read. */
  readOn: string | null;
  /** The day its executive posts pages were last read, when any of the wording shown comes from them. */
  postsReadOn: string | null;
  /** Set when those pages were read before but not in the last fortnight: the day of the last read. What they said is then left out. */
  postsStaleSince: string | null;
}

/**
 * How old the last full read of a council's executive posts pages may be
 * before the wording from them is left out. After a reshuffle an old reading
 * would put the wrong portfolio against a name.
 */
export const POSTS_FRESH_DAYS = 14;

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

export async function allCabinets(): Promise<CouncilCabinet[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors", "committees", "meetings");
  const today = ukToday();
  const [candidates, seats, posts, holders, chairs, read, postReads] = await Promise.all([
    rows<{ councilId: string; id: number; nameEn: string; nameCy: string | null; members: number; lastMeeting: string | null }>(sql`
      select c.council_id as "councilId", c.id, c.name_en as "nameEn", c.name_cy as "nameCy",
        (select count(*)::int from committee_members x
           join councillors p on p.council_id = x.council_id and p.id = x.councillor_id and p.current
           where x.council_id = c.council_id and x.committee_id = c.id and x.role not in ('substitute', 'observer')) as members,
        (select max(m.date)::text from meetings m
           where m.council_id = c.council_id and m.committee_id = c.id and not m.cancelled and m.date <= ${today}::date + 60) as "lastMeeting"
      from committees c where c.kind = 'cabinet' and c.active
    `),
    rows<{ councilId: string; committeeId: number; councillorId: number; name: string; partyId: string | null; partyLabel: string | null; role: string; roleRaw: string | null; keyPosts: string[]; sourceUrl: string | null }>(sql`
      select x.council_id as "councilId", x.committee_id as "committeeId", p.id as "councillorId", p.name, p.party_id as "partyId",
        p.party_label as "partyLabel", x.role, x.role_raw as "roleRaw", p.key_posts as "keyPosts", p.source_url as "sourceUrl"
      from committee_members x
      join committees c on c.council_id = x.council_id and c.id = x.committee_id and c.kind = 'cabinet' and c.active
      join councillors p on p.council_id = x.council_id and p.id = x.councillor_id and p.current
      order by p.name
    `),
    rowsIfTable<{ councilId: string; postId: number; councillorId: number; title: string; url: string }>(sql`
      select council_id as "councilId", post_id as "postId", councillor_id as "councillorId", title, url from executive_posts order by title
    `),
    // Councillors who hold an executive post, for a council whose Cabinet is read from its own Cabinet page (the Vale of Glamorgan).
    rowsIfTable<{ councilId: string; councillorId: number; name: string; partyId: string | null; partyLabel: string | null; sourceUrl: string | null }>(sql`
      select p.council_id as "councilId", p.id as "councillorId", p.name, p.party_id as "partyId", p.party_label as "partyLabel", p.source_url as "sourceUrl"
      from councillors p
      where p.current and exists (select 1 from executive_posts e where e.council_id = p.council_id and e.councillor_id = p.id)
      order by p.name
    `),
    rows<CommitteeChair & { councilId: string }>(sql`
      select x.council_id as "councilId", c.id as "committeeId", c.name_en as "committeeEn", c.name_cy as "committeeCy", c.kind,
        p.id as "councillorId", p.name, p.party_id as "partyId", p.party_label as "partyLabel"
      from committee_members x
      join committees c on c.council_id = x.council_id and c.id = x.committee_id and c.active and c.kind in ('scrutiny', 'planning')
      join councillors p on p.council_id = x.council_id and p.id = x.councillor_id and p.current
      where x.role = 'chair'
        -- The council's own committees: joint and regional bodies it shares with other councils are not.
        and c.name_en !~* '\\m(joint|regional|city region|corporate joint)\\M'
        -- Only committees that have met in the last year: councils keep old ones on their lists.
        and exists (select 1 from meetings m where m.council_id = c.council_id and m.committee_id = c.id and not m.cancelled
          and m.date > ${today}::date - 365 and m.date <= ${today}::date + 60)
      order by c.kind desc, c.name_en, p.name
    `),
    rows<{ councilId: string; readOn: string | null }>(sql`
      select council_id as "councilId", (max(updated_at) at time zone 'Europe/London')::date::text as "readOn"
      from councillors where current group by 1
    `),
    rowsIfTable<{ councilId: string; readOn: string | null; fresh: boolean }>(sql`
      select council_id as "councilId", (read_at at time zone 'Europe/London')::date::text as "readOn",
        coalesce((read_at at time zone 'Europe/London')::date >= ${today}::date - ${POSTS_FRESH_DAYS}::int, false) as fresh
      from source_reads where source = 'executive-posts'
    `),
  ]);

  return LIVE_COUNCILS.map((council) => {
    const mine = candidates.filter((c) => c.councilId === council.id);
    const picked = pickCabinet(mine);
    const postRead = postReads.find((r) => r.councilId === council.id);
    const stored = posts.filter((p) => p.councilId === council.id);
    // Posts read more than a fortnight ago are not used: see POSTS_FRESH_DAYS.
    const held = postRead?.fresh ? stored : [];
    const postsStaleSince = stored.length && !postRead?.fresh ? (postRead?.readOn ?? null) : null;
    // The Vale of Glamorgan's committee membership is pieced together from each councillor's own page and has gaps,
    // so its Cabinet is taken from the table on its Cabinet page instead: everyone that table names, and nobody else.
    const fromPage = council.system === "vale";
    const onIt = fromPage
      ? holders.filter((h) => h.councilId === council.id && held.some((p) => p.councillorId === h.councillorId)).map((h) => ({ ...h, committeeId: 0, role: "member", roleRaw: null, keyPosts: [] as string[] }))
      : picked
        ? seats.filter((s) => s.councilId === council.id && s.committeeId === picked.id)
        : [];
    const built = buildCabinet({
      members: onIt.map((s) => ({ councillorId: s.councillorId, name: s.name, role: s.role, roleRaw: s.roleRaw, keyPosts: s.keyPosts ?? [] })),
      posts: held,
    });
    const members: CabinetMember[] = built.seats.map((seat) => {
      const p = onIt.find((s) => s.councillorId === seat.councillorId)!;
      const postUrl = seat.postIds.length ? (held.find((h) => h.postId === seat.postIds[0])?.url ?? null) : null;
      return {
        councillorId: seat.councillorId,
        name: officeHolderName(p.name),
        partyId: p.partyId,
        partyLabel: p.partyLabel,
        role: seat.role,
        posts: seat.posts,
        portfolio: seat.posts.some(namesPortfolio),
        source: seat.source,
        sourceUrl: seat.source === "executive-posts" ? postUrl : seat.source === "key-posts" ? (councillorUrl(council, seat.councillorId) ?? p.sourceUrl) : null,
        topics: portfolioTopics(...seat.posts),
        unread: postsStaleSince !== null && !seat.posts.some(namesPortfolio),
      };
    });
    return {
      councilId: council.id,
      cabinet: picked ? { id: picked.id, nameEn: picked.nameEn, nameCy: mine.find((c) => c.id === picked.id)?.nameCy ?? null } : null,
      officialUrl: fromPage ? (held[0]?.url ?? null) : picked ? committeeUrl(council, picked.id) : null,
      members,
      leaderKnown: built.leaderKnown,
      chairs: chairs
        .filter((c) => c.councilId === council.id)
        .map((c) => ({ committeeId: c.committeeId, committeeEn: c.committeeEn, committeeCy: c.committeeCy, kind: c.kind, councillorId: c.councillorId, name: officeHolderName(c.name), partyId: c.partyId, partyLabel: c.partyLabel })),
      readOn: read.find((r) => r.councilId === council.id)?.readOn ?? null,
      postsReadOn: members.some((m) => m.source === "executive-posts") ? (postRead?.readOn ?? null) : null,
      postsStaleSince,
    };
  });
}

export async function councilCabinet(councilId: string): Promise<CouncilCabinet | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors", "committees", "meetings");
  if (!councilConfig(councilId)) return null;
  return (await allCabinets()).find((c) => c.councilId === councilId) ?? null;
}

/** One line for each office held, for the open data download: public roles only, no contact details. */
export interface RoleRow {
  council: string;
  role: "leader" | "deputy leader" | "cabinet member" | "scrutiny chair" | "planning chair";
  councillorId: number;
  name: string;
  party: string | null;
  partyId: string | null;
  /** The portfolio in the council's words (Cabinet), or the committee chaired. */
  post: string | null;
  topics: string[];
  /** The council's own page the line rests on. */
  source: string | null;
  /** The day the council's records were last read. */
  read: string | null;
}

export async function roleRows(): Promise<RoleRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors", "committees", "meetings");
  const out: RoleRow[] = [];
  const label: Record<ExecutiveRole, RoleRow["role"]> = { leader: "leader", deputy: "deputy leader", member: "cabinet member" };
  for (const c of await allCabinets()) {
    const council = councilConfig(c.councilId)!;
    for (const m of c.members)
      out.push({
        council: c.councilId,
        role: label[m.role],
        councillorId: m.councillorId,
        name: m.name,
        party: m.partyLabel,
        partyId: m.partyId,
        post: m.posts.join("; ") || null,
        topics: m.topics,
        source: m.sourceUrl,
        read: m.source === "executive-posts" ? (c.postsReadOn ?? c.readOn) : c.readOn,
      });
    for (const ch of c.chairs)
      out.push({
        council: c.councilId,
        role: ch.kind === "scrutiny" ? "scrutiny chair" : "planning chair",
        councillorId: ch.councillorId,
        name: ch.name,
        party: ch.partyLabel,
        partyId: ch.partyId,
        post: ch.committeeEn,
        topics: [],
        source: committeeUrl(council, ch.committeeId),
        read: c.readOn,
      });
  }
  return out;
}
