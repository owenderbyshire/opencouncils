/**
 * Council by-elections in Wales, from Open Council Data's yearly archive
 * (opencouncildata.co.uk/changesC.php?y=2025). Each row gives the date, the
 * council, the ward, and the party that held the seat before and after. The
 * archive says it may not be complete.
 */
import { parse } from "node-html-parser";
import { COUNCILS } from "../../data/curated/councils";
import { partyIdFor } from "./moderngov";

export const BY_ELECTION_SOURCE = (year: number) => `https://opencouncildata.co.uk/changesC.php?y=${year}`;

export interface ByElection {
  date: string;
  councilId: string;
  ward: string;
  /** The party labels as the archive gives them ("Plaid Cymru - The Party of Wales"). */
  from: string;
  to: string;
  /** Party IDs (src/lib/parties.ts) when the label names one party; null for "Independent / Other" and the unrecognised. */
  fromParty: string | null;
  toParty: string | null;
  source: string;
}

/** "Independent / Other" covers independents and small parties alike, so it isn't one party. */
export function archiveParty(label: string): string | null {
  if (/independent\s*\/\s*other/i.test(label)) return null;
  return partyIdFor(label);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "18 Mar 26" to "2026-03-18". */
export function archiveDate(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{2})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return `20${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

const fold = (s: string) => s.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z]+/g, " ").trim();

/** The archive's council names, matched to ours ("Isle of Anglesey", "Rhondda Cynon Taff"). */
const BY_NAME = new Map<string, string>();
// Welsh councils only: this archive reader came from opencouncil.wales and is not in the UK nightly run.
for (const c of COUNCILS.filter((x) => x.nation === "Wales")) {
  BY_NAME.set(fold(c.shortEn), c.id);
  BY_NAME.set(fold(c.nameEn), c.id);
}
BY_NAME.set("isle of anglesey", "anglesey");
BY_NAME.set("rhondda cynon taff", "rhondda-cynon-taf");
BY_NAME.set("the vale of glamorgan", "vale-of-glamorgan");
BY_NAME.set("merthyr", "merthyr-tydfil");

export function councilIdForArchive(name: string): string | null {
  return BY_NAME.get(fold(name)) ?? null;
}

/** The Welsh rows of one year's archive page. */
export function parseByElections(html: string, source: string): ByElection[] {
  const out: ByElection[] = [];
  for (const tr of parse(html).querySelectorAll("tr")) {
    const cells = tr.querySelectorAll("td").map((td) => td.text.replace(/\s+/g, " ").trim());
    if (cells.length < 5) continue;
    const date = archiveDate(cells[0]);
    const councilId = councilIdForArchive(cells[1]);
    if (!date || !councilId || !cells[2]) continue;
    out.push({ date, councilId, ward: cells[2], from: cells[3], to: cells[4], fromParty: archiveParty(cells[3]), toParty: archiveParty(cells[4]), source });
  }
  return out;
}
