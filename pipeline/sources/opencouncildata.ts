/**
 * Open Council Data UK (opencouncildata.co.uk, Lawson Data Services Ltd): free CSVs of every UK councillor's party
 * and every GB council's composition, taken shortly after each May's elections. Credited wherever shown.
 *
 * - csv2.php?y=<year>: one row per councillor (council name, ward, name, next election, party, Electoral Commission code).
 * - history2016-26.csv: one row per GB council and year, with seats by main party and a description of control.
 *   Its "council id" is the id the council register carries as open-council-data-id.
 */
import type { RegisterEntry } from "../../data/curated/councils";
import { partyIdFor } from "./moderngov";
import { csvRecords } from "./statswales";

export const OCD_BASE = "https://opencouncildata.co.uk";
export const councillorsCsvUrl = (year: number) => `${OCD_BASE}/csv2.php?y=${year}`;
export const HISTORY_CSV_URL = `${OCD_BASE}/history2016-26.csv`;

export interface OcdHistoryRow {
  ocdId: string;
  authority: string;
  year: number;
  total: number;
  control: string | null;
}

export function parseHistory(text: string): OcdHistoryRow[] {
  return csvRecords(text)
    .map((r) => ({
      ocdId: (r["council id"] ?? "").trim(),
      authority: (r.authority ?? "").trim(),
      year: Number(r.year),
      total: Number(r.total),
      control: (r.majority ?? "").trim() || null,
    }))
    .filter((r) => r.ocdId && r.authority && Number.isFinite(r.year));
}

export interface OcdCouncillor {
  council: string;
  ward: string;
  name: string;
  party: string;
}

export function parseCouncillors(text: string): OcdCouncillor[] {
  return csvRecords(text)
    .map((r) => ({
      council: (r.Council ?? "").trim(),
      ward: (r["Ward Name"] ?? "").trim(),
      name: (r["Councillor Name"] ?? "").trim(),
      party: (r["Party Name"] ?? "").trim(),
    }))
    .filter((r) => r.council && r.name);
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(the|council|county|city|borough|district|metropolitan|of|royal)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Matches Open Council Data's council names to register ids: first through the history file's ids (which the register
 * carries), then by name for the councils that file leaves out (Northern Ireland). A name that matches more than one
 * current council is left unmatched.
 */
export function councilMatcher(register: RegisterEntry[], history: OcdHistoryRow[]): (name: string) => string | null {
  // Shadow councils (East and West Surrey until April 2027) have councillors already.
  const current = register.filter((c) => (c.current || c.shadow) && c.kind !== "combined");
  const byOcd = new Map(current.filter((c) => c.ocdId).map((c) => [String(Number(c.ocdId)), c.id]));
  const byHistoryName = new Map<string, string>();
  for (const h of history) {
    const id = byOcd.get(String(Number(h.ocdId)));
    if (id) byHistoryName.set(fold(h.authority), id);
  }
  return (name: string) => {
    const key = fold(name);
    const viaHistory = byHistoryName.get(key);
    if (viaHistory) return viaHistory;
    const hits = current.filter((c) => fold(c.short) === key || fold(c.name) === key);
    return hits.length === 1 ? hits[0].id : null;
  };
}

/** Our party id for their party name: their wording differs from councils' ("Conservative and Unionist"). */
export function ocdPartyId(party: string): string | null {
  const t = party.toLowerCase();
  if (!t || t === "vacant") return null;
  if (t.startsWith("independent")) return "ind";
  return partyIdFor(party);
}

export interface Composition {
  councilId: string;
  seats: number;
  parties: { label: string; partyId: string | null; seats: number }[];
}

/** Seats by party for each council, largest first. Vacant seats count towards the total under "Vacant". */
export function compositions(rows: OcdCouncillor[], match: (name: string) => string | null): { found: Composition[]; unmatched: string[] } {
  const by = new Map<string, Map<string, number>>();
  const unmatched = new Set<string>();
  for (const r of rows) {
    const id = match(r.council);
    if (!id) {
      unmatched.add(r.council);
      continue;
    }
    const m = by.get(id) ?? new Map<string, number>();
    const label = r.party || "Vacant";
    m.set(label, (m.get(label) ?? 0) + 1);
    by.set(id, m);
  }
  const found = [...by].map(([councilId, m]) => {
    const parties = [...m]
      .map(([label, seats]) => ({ label, partyId: ocdPartyId(label), seats }))
      .sort((a, b) => b.seats - a.seats || a.label.localeCompare(b.label));
    return { councilId, seats: parties.reduce((n, p) => n + p.seats, 0), parties };
  });
  return { found, unmatched: [...unmatched].sort() };
}
