/**
 * Election results from a council's ModernGov web service
 * (GetElectionResults?lElectionId=N): every candidate, the ward ("area") they
 * stood in, their party as the council published it, their votes and
 * whether they were elected.
 *
 * The service has no list of elections, so the job tries ids in turn and
 * keeps the May 2022 council election by rule (pickElection). A council's
 * results are used only when the number of councillors elected matches the
 * number of seats filled in 2022 (checkResults): anything else is left out
 * and the page says which councils are covered. Nothing here is estimated.
 */
import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "../lib/text";
import { partyIdFor } from "./moderngov";

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true, processEntities: true, htmlEntities: false });

const arr = <T>(v: T | T[] | undefined | null): T[] => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);
const str = (v: unknown): string => (typeof v === "string" ? decodeEntities(v).trim() : typeof v === "number" ? String(v) : "");

export interface Candidate {
  ward: string;
  /** The ward's id in the council's results, for its own page (mgElectionAreaResults.aspx?ID=). */
  areaId: number | null;
  name: string;
  /** The party as the council published it; empty where it published none. */
  partyLabel: string;
  partyId: string | null;
  votes: number | null;
  elected: boolean;
  /** When the result was entered: "2022-05-06". */
  declared: string | null;
}

export interface ElectionReply {
  title: string;
  candidates: Candidate[];
}

/** "06/05/2022, 13:39" → "2022-05-06" */
function ukDate(v: string): string | null {
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function parseElectionResults(xml: string): ElectionReply | null {
  let doc: { election?: { title?: unknown; candidates?: { candidate?: unknown } } };
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  const e = doc.election;
  if (!e) return null;
  const candidates = arr(e.candidates?.candidate as Record<string, unknown> | Record<string, unknown>[]).map((c) => {
    const partyLabel = str(c.politicalpartytitle);
    const votes = Number.parseInt(str(c.numvotes), 10);
    const areaId = Number.parseInt(str(c.electionareaid), 10);
    return {
      ward: str(c.areatitle),
      areaId: Number.isFinite(areaId) && areaId > 0 ? areaId : null,
      name: str(c.candidatename),
      partyLabel,
      partyId: partyIdFor(partyLabel),
      votes: Number.isFinite(votes) ? votes : null,
      elected: str(c.iselected) === "True",
      declared: ukDate(str(c.votedatetime)),
    } satisfies Candidate;
  });
  return { title: str(e.title), candidates: candidates.filter((c) => c.ward && c.name) };
}

/** Town and community council elections and by-elections are never the council election. */
const NOT_THE_COUNCIL = /community|town|tref|cymuned|by[- ]?election|isetholiad|parliament|senedd|assembly|police|crime|seneddol/i;

/** True when the reply looks like the May 2022 election of the whole council: in a title, or in the dates results were entered. */
export function isMay2022CouncilElection(reply: ElectionReply): boolean {
  if (NOT_THE_COUNCIL.test(reply.title) || reply.candidates.length < 20) return false;
  if (/\b2022\b/.test(reply.title)) return true;
  if (/\b(19|20)\d{2}\b/.test(reply.title)) return false;
  const dates = reply.candidates.map((c) => c.declared).filter((d): d is string => Boolean(d));
  if (!dates.length) return false;
  const inMay2022 = dates.filter((d) => d >= "2022-05-05" && d <= "2022-05-31").length;
  return inMay2022 / dates.length >= 0.9;
}

/** Of several replies that pass, the one with most wards (a council can hold a test copy with a few). */
export function pickElection<T extends { reply: ElectionReply }>(found: T[]): T | null {
  const ok = found.filter((f) => isMay2022CouncilElection(f.reply));
  if (!ok.length) return null;
  const wards = (r: ElectionReply) => new Set(r.candidates.map((c) => c.ward)).size;
  return ok.sort((a, b) => wards(b.reply) - wards(a.reply))[0];
}

export interface WardResult {
  ward: string;
  candidates: Candidate[];
  seats: number;
  /** True when every candidate was elected: no contest, so no votes to compare. */
  uncontested: boolean;
}

export function wardsOf(candidates: Candidate[]): WardResult[] {
  const by = new Map<string, Candidate[]>();
  for (const c of candidates) by.set(c.ward, [...(by.get(c.ward) ?? []), c]);
  return [...by.entries()]
    .map(([ward, list]) => {
      const sorted = [...list].sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1) || Number(b.elected) - Number(a.elected) || a.name.localeCompare(b.name));
      const seats = list.filter((c) => c.elected).length;
      return { ward, candidates: sorted, seats, uncontested: seats === list.length };
    })
    .sort((a, b) => a.ward.localeCompare(b.ward));
}

/**
 * The checks a council's results must pass before any ward detail is shown:
 * the councillors elected add up to the seats filled in 2022, every ward
 * elected someone, and every contested ward's votes are published and put
 * the elected candidates ahead of the rest.
 */
export function checkResults(wards: WardResult[], seats2022: number): string[] {
  const problems: string[] = [];
  const elected = wards.reduce((n, w) => n + w.seats, 0);
  if (elected !== seats2022) problems.push(`${elected} elected, but ${seats2022} seats were filled in 2022`);
  for (const w of wards) {
    if (!w.seats) problems.push(`${w.ward}: nobody elected`);
    if (w.uncontested) continue;
    if (w.candidates.some((c) => c.votes === null) || w.candidates.every((c) => !c.votes)) {
      problems.push(`${w.ward}: no votes published`);
      continue;
    }
    const lowestElected = Math.min(...w.candidates.filter((c) => c.elected).map((c) => c.votes ?? 0));
    const highestNot = Math.max(...w.candidates.filter((c) => !c.elected).map((c) => c.votes ?? 0));
    // A tie can be settled by lot, so equal votes are allowed.
    if (highestNot > lowestElected) problems.push(`${w.ward}: a candidate not elected has more votes than one elected`);
  }
  return problems;
}

export interface Margin {
  ward: string;
  seats: number;
  lastElected: Candidate;
  firstNotElected: Candidate;
  /** Votes between the last candidate elected and the first not elected. */
  votes: number;
}

/** In each contested ward, the votes between the last candidate elected and the first not elected. Closest first. */
export function margins(wards: WardResult[]): Margin[] {
  const out: Margin[] = [];
  for (const w of wards) {
    if (w.uncontested) continue;
    const electedList = w.candidates.filter((c) => c.elected);
    const notList = w.candidates.filter((c) => !c.elected);
    const lastElected = electedList.at(-1);
    const firstNotElected = notList[0];
    if (!lastElected || !firstNotElected || lastElected.votes == null || firstNotElected.votes == null) continue;
    out.push({ ward: w.ward, seats: w.seats, lastElected, firstNotElected, votes: lastElected.votes - firstNotElected.votes });
  }
  return out.sort((a, b) => a.votes - b.votes || a.ward.localeCompare(b.ward));
}

/** "Cllr Dr Jane M. Jones, MBE" → "jane m jones"; used only to match a councillor to a 2022 candidate. */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .replace(/\b(cllr|councillor|cynghorydd|dr|mr|mrs|ms|miss|prof|rev|sir|dame)\b\.?/g, " ")
    .replace(/[^a-z' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** First and last names only: "jane m jones" → "jane jones". */
export function shortKey(name: string): string {
  const parts = nameKey(name).split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)}` : parts.join(" ");
}

export interface PartyChange {
  name: string;
  councillorId: number;
  ward2022: string;
  party2022: { id: string; label: string };
  partyNow: { id: string; label: string };
}

/**
 * Councillors sitting now for a different party from the one they were
 * elected for in 2022. Only where both parties are recorded and both are
 * national parties or "Independent" (partyIdFor): a local group's own label
 * can't be compared with a 2022 ballot description, so it is never counted.
 * A councillor is matched to a 2022 winner by full name, or by first and last
 * name when that is unique on both sides.
 */
export function partyChanges(
  winners: Candidate[],
  now: Array<{ id: number; name: string; partyId: string | null; partyLabel: string | null }>,
): PartyChange[] {
  const full = new Map<string, Candidate[]>();
  const short = new Map<string, Candidate[]>();
  for (const w of winners) {
    full.set(nameKey(w.name), [...(full.get(nameKey(w.name)) ?? []), w]);
    short.set(shortKey(w.name), [...(short.get(shortKey(w.name)) ?? []), w]);
  }
  const nowShort = new Map<string, number>();
  for (const p of now) nowShort.set(shortKey(p.name), (nowShort.get(shortKey(p.name)) ?? 0) + 1);
  const out: PartyChange[] = [];
  for (const p of now) {
    const exact = full.get(nameKey(p.name));
    const loose = short.get(shortKey(p.name));
    const match = exact?.length === 1 ? exact[0] : !exact && loose?.length === 1 && nowShort.get(shortKey(p.name)) === 1 ? loose[0] : null;
    if (!match || !match.partyId || !p.partyId) continue;
    if (match.partyId !== p.partyId)
      out.push({
        name: p.name,
        councillorId: p.id,
        ward2022: match.ward,
        party2022: { id: match.partyId, label: match.partyLabel },
        partyNow: { id: p.partyId, label: p.partyLabel ?? "" },
      });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}
