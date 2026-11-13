/**
 * Who holds what at a council: the leader, deputy leaders and Cabinet members
 * with their portfolios, worked out from the council's own records.
 *
 * Three records are read, all the council's own:
 * - who sits on its Cabinet (its committee membership);
 * - each councillor's "key posts", a line of text the council keeps on its
 *   list of councillors ("Deputy Leader & Cabinet Member for Education");
 * - its executive posts pages, where it lists each post and who holds it.
 *
 * Nothing here guesses. A councillor is listed only if the council's
 * membership puts them on the Cabinet. A portfolio is shown only in the
 * council's own words, and only when one of those records gives it. The
 * leader is named only when exactly one Cabinet member's wording says so.
 *
 * No imports: the pipeline's tests and the website both use this file.
 */

/* -------------------------------------------------------------------------- */
/* The council's wording                                                       */
/* -------------------------------------------------------------------------- */

/** What can stand before or after a role inside a longer line: "Leader / Cabinet Member", "(Leader)", "X and Deputy Leader". */
const BEFORE = String.raw`(?:^|[\/,;&(–—-]|\band|\bwith)\s*`;
const AFTER = String.raw`\s*(?=$|[\/,;&)–—-]|and\b|with\b|cabinet\b|executive\b)`;
/** "of the Council", "of Council", "of the County Council", "of Powys County Council": never a group, party or the opposition. */
const OF_COUNCIL = String.raw`(?:\s+of\s+(?:the\s+)?(?:(?!group\b|opposition\b|party\b|alliance\b|on\b|in\b|at\b|within\b)[\p{L}'’-]+\s+){0,4}council\b)?`;

const LEADER = new RegExp(`${BEFORE}(?:the\\s+)?(?:executive\\s+)?(?:council\\s+)?leader${OF_COUNCIL}${AFTER}`, "iu");
const DEPUTY = new RegExp(`${BEFORE}(?:the\\s+)?(?:joint\\s+|statutory\\s+|executive\\s+)?deputy\\s+(?:council\\s+)?leader${OF_COUNCIL}${AFTER}`, "iu");
/** "Arweinydd y Cyngor", "Dirprwy Arweinydd": the same in Welsh. */
const LEADER_CY = new RegExp(`${BEFORE}arweinydd(?:\\s+y\\s+cyngor)?${AFTER}`, "iu");
const DEPUTY_CY = new RegExp(`${BEFORE}dirprwy\\s+arweinydd(?:\\s+y\\s+cyngor)?${AFTER}`, "iu");

/** A Cabinet or executive seat: "Cabinet Member for…", "Executive Member…", "Portfolio Holder…", "Aelod Cabinet…". */
const SEAT = /\b(?:cabinet|executive)\s+(?:board\s+)?(?:member|portfolio)|\bportfolio\s+holder\b|\bwith\s+portfolio\b|\baelod\s+(?:o'r\s+)?(?:cabinet|gweithredol)|\baelod\s+o'r\s+(?:bwrdd|pwyllgor)\s+gw(?:eithredol|aith)/iu;
/** Posts that sound like Cabinet seats and are not: assistants and deputies to a Cabinet member, and an opposition's shadow cabinet. */
const NOT_A_SEAT = /\b(?:assistant|deputy|support|shadow|junior|associate)\s+(?:to\s+(?:the\s+)?)?(?:cabinet|executive)\s+(?:board\s+)?member|\bshadow\s+(?:cabinet|executive)\b|\bcabinet\s+(?:support|assistant|advis[eo]r)\b/iu;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * A political group's or the opposition's own posts, which are not the council's:
 * "Leader of the Labour Group", "Deputy Leader of the Opposition", "Leader of Plaid Cymru".
 * A party's name counts only where the post ends with it, so "…for Independent Living" is left alone.
 */
const GROUP_ROLE =
  /(?:deputy\s+)?leader\s+(?:of|for)\s+(?:the\s+)?(?:(?!\band\b)[^,/;&])*?(?:\b(?:group|opposition|party)\b(?:\s+group)?(?:\s*\([^)]*\))?|\b(?:plaid cymru|labour|conservatives?|liberal democrats?|independents?|reform(?: uk)?|greens?)\s*(?=$|[,/;&)]))/giu;

/** A line of wording without any political group's own posts in it. */
export function withoutGroupRoles(text: string): string {
  return clean(text.replace(GROUP_ROLE, " "));
}

/**
 * An executive post as the site shows it: the council's wording without any
 * political group's post written into the same line ("Leader of the Council /
 * Leader of the Labour Group" shows as "Leader of the Council").
 */
export function shownPost(text: string): string {
  return withoutGroupRoles(text)
    .replace(/^(?:[\s\/,;&–—-]|and\b)+/iu, "")
    .replace(/(?:[\s\/,;&–—-]|\band)+$/iu, "")
    .trim();
}

/** Whether a line of the council's wording names its leader ("Leader of the Council", "Council Leader", "(Leader)"): never a group's or the opposition's leader. */
export function saysLeader(text: string): boolean {
  const t = clean(text);
  return LEADER.test(t) || LEADER_CY.test(t);
}

/** Whether a line names a deputy leader of the council. */
export function saysDeputyLeader(text: string): boolean {
  const t = clean(text);
  return DEPUTY.test(t) || DEPUTY_CY.test(t);
}

/** Whether a line names an executive post at all: the leader, a deputy leader or a Cabinet seat. */
export function isExecutivePost(text: string): boolean {
  const t = clean(text);
  if (!t) return false;
  if (saysLeader(t) || saysDeputyLeader(t)) return true;
  return SEAT.test(t) && !NOT_A_SEAT.test(t);
}

/**
 * Whether an executive post's wording names a portfolio, not just the seat:
 * "Cabinet Member for Education" does, "Cabinet Member" and "Deputy Leader"
 * do not. What is left after the role words are taken away decides it.
 */
export function namesPortfolio(text: string): boolean {
  const rest = withoutGroupRoles(text)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:the|joint|statutory|executive|council|county|borough|city|deputy|leader|of|cabinet|board|member|portfolio|holder|with|for|and|job|share|aelod|arweinydd|dirprwy|dros|y|a|ac)\b/giu, " ")
    .replace(/[^\p{L}]+/gu, " ")
    .trim();
  return rest.length >= 3;
}

/** "(Leader)" or "(Deputy Leader)" after a councillor's name, where a council writes it there. */
export function roleInName(name: string): string | null {
  const m = name.match(/\(([^)]*)\)\s*$/);
  return m && (saysLeader(m[1]) || saysDeputyLeader(m[1])) ? clean(m[1]) : null;
}

/**
 * A councillor's name as a directory shows it: without a role written after
 * it ("Anthony Hunt (Leader)"), without a form of address in front ("County
 * Councillor Mary Ann Brocklesby") and first name first ("Berriman, Jake").
 */
export function officeHolderName(name: string): string {
  let s = roleInName(name) ? name.replace(/\([^)]*\)\s*$/, "") : name;
  s = clean(s).replace(/^(?:County Borough Councillor|County Councillor|Councillor|Cllr\.?|Y Cynghorydd|Cynghorydd)\s+/i, "");
  const m = s.match(/^([^,]+),\s*([^,]+)$/);
  return clean(m ? `${m[2]} ${m[1]}` : s);
}

/* -------------------------------------------------------------------------- */
/* The Cabinet                                                                 */
/* -------------------------------------------------------------------------- */

/** The names councils give the body itself. Sub-committees, briefings, joint cabinets and single-member decision meetings are not it. */
const MAIN_CABINET = /^(?:the )?(?:cabinet|executive|executive board|executive committee)$/i;

export function isMainCabinet(nameEn: string): boolean {
  return MAIN_CABINET.test(clean(nameEn));
}

/** People listed with the Cabinet who do not sit on it: invited scrutiny chairs, officers, advisers. */
const NOT_A_MEMBER = /invite|in attendance|attendee|officer|advis|observer|non[- ]?voting|co-?opt|substitute|reserve|deputy for/i;

export function sitsOnCabinet(role: string, roleRaw: string | null | undefined): boolean {
  if (role === "substitute" || role === "observer") return false;
  return !NOT_A_MEMBER.test(roleRaw ?? "");
}

export interface CabinetCandidate {
  id: number;
  nameEn: string;
  /** How many councillors the council lists as sitting on it. */
  members: number;
  /** Its latest meeting on record, or null. */
  lastMeeting: string | null;
}

/**
 * The council's Cabinet among its committees: the one named as the body
 * itself. Where two are (an old "Executive" beside the Cabinet), the one that
 * has met most recently and has members. Null when none can be told apart.
 */
export function pickCabinet(candidates: CabinetCandidate[]): CabinetCandidate | null {
  const named = candidates.filter((c) => isMainCabinet(c.nameEn) && c.members > 0);
  if (!named.length) return null;
  const sorted = [...named].sort((a, b) => (b.lastMeeting ?? "").localeCompare(a.lastMeeting ?? "") || b.members - a.members);
  if (sorted.length > 1 && (sorted[0].lastMeeting ?? "") === (sorted[1].lastMeeting ?? "") && sorted[0].members === sorted[1].members) return null;
  return sorted[0];
}

export type ExecutiveRole = "leader" | "deputy" | "member";
export type PostSource = "key-posts" | "executive-posts";

export interface CabinetSeat {
  councillorId: number;
  role: ExecutiveRole;
  /** The portfolio or post in the council's own words; empty when its records give none. */
  posts: string[];
  /** Which of the council's records the wording comes from. */
  source: PostSource | null;
  /** The executive post pages the wording comes from, where it does. */
  postIds: number[];
}

export interface CabinetInput {
  /** Councillors the council lists on its Cabinet, with their role there. */
  members: Array<{ councillorId: number; name: string; role: string; roleRaw: string | null; keyPosts: string[] }>;
  /** The council's executive posts and who holds each: only posts its pages list as executive (pipeline/jobs/executive-posts.ts). */
  posts: Array<{ postId: number; title: string; councillorId: number }>;
}

export interface CabinetResult {
  seats: CabinetSeat[];
  /** Whether exactly one Cabinet member is named as leader. */
  leaderKnown: boolean;
  /** More than one Cabinet member's wording says "leader": none is shown as leader. */
  leaderAmbiguous: boolean;
}

const dedupe = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((s) => {
    const k = s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

/**
 * The Cabinet as the council's records give it. For each member, the wording
 * shown is their key posts where those name a portfolio; otherwise the
 * executive posts they hold; otherwise a key post that names only the seat.
 */
export function buildCabinet(input: CabinetInput): CabinetResult {
  const seats: Array<CabinetSeat & { leaderSaid: boolean; deputySaid: boolean }> = [];
  for (const m of input.members) {
    if (!sitsOnCabinet(m.role, m.roleRaw)) continue;
    const key = m.keyPosts.map(clean).filter(isExecutivePost);
    // Posts held are executive posts already (the pipeline keeps no others); a political group's own post is still left out.
    const held = input.posts.filter((p) => p.councillorId === m.councillorId && withoutGroupRoles(p.title) !== "" && !NOT_A_SEAT.test(p.title));
    const heldTitles = held.map((p) => clean(p.title));
    const inName = roleInName(m.name);
    // Everything the council says about this councillor's executive role, for telling who the leader is.
    const said = [...key, ...heldTitles, ...(inName ? [inName] : []), m.roleRaw ?? ""];
    const leaderSaid = said.some(saysLeader);
    const deputySaid = !leaderSaid && said.some(saysDeputyLeader);

    let posts: string[] = [];
    let source: PostSource | null = null;
    let postIds: number[] = [];
    if (key.some(namesPortfolio)) {
      posts = key;
      source = "key-posts";
    } else if (heldTitles.length) {
      // A bare "Leader" or "Deputy Leader" post adds nothing beside a post that names the portfolio as well.
      const withPortfolio = held.filter((p) => namesPortfolio(p.title));
      const use = withPortfolio.length ? withPortfolio : held;
      posts = use.map((p) => clean(p.title));
      postIds = use.map((p) => p.postId);
      source = "executive-posts";
    } else if (key.length) {
      posts = key;
      source = "key-posts";
    }
    seats.push({ councillorId: m.councillorId, role: "member", posts: dedupe(posts.map(shownPost).filter(Boolean)), source, postIds: [...new Set(postIds)], leaderSaid, deputySaid });
  }
  const leaders = seats.filter((s) => s.leaderSaid);
  const leaderKnown = leaders.length === 1;
  for (const s of seats) {
    if (leaderKnown && s.leaderSaid) s.role = "leader";
    else if (s.deputySaid) s.role = "deputy";
  }
  const order: Record<ExecutiveRole, number> = { leader: 0, deputy: 1, member: 2 };
  return {
    seats: seats.sort((a, b) => order[a.role] - order[b.role]).map((s) => ({ councillorId: s.councillorId, role: s.role, posts: s.posts, source: s.source, postIds: s.postIds })),
    leaderKnown,
    leaderAmbiguous: leaders.length > 1,
  };
}
