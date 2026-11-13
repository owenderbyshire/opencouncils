/**
 * The Welsh Government's development management quarterly survey: how many
 * planning applications each authority received each quarter. Published as
 * one spreadsheet per quarter, each with a "Data" sheet covering the latest
 * five quarters. Used to check how complete our own collection is.
 */
import type { Sheet } from "./ods";

export const SURVEY_SERIES = "https://www.gov.wales/development-management-quarterly-surveys";

export interface QuarterCount {
  /** Our planning authority id. */
  authority: string;
  /** "2025-26 Q4". */
  quarter: string;
  /** First and last day of the quarter. */
  start: string;
  end: string;
  /** Applications received, leaving out statutory pre-application cases. */
  received: number;
}

/** The survey's names for authorities, to ours. */
const NAMES: Array<[RegExp, string]> = [
  [/anglesey|ynys m/i, "anglesey"],
  [/gwynedd/i, "gwynedd"],
  [/conwy/i, "conwy"],
  [/denbigh/i, "denbighshire"],
  [/flint/i, "flintshire"],
  [/wrexham/i, "wrexham"],
  [/powys/i, "powys"],
  [/ceredigion/i, "ceredigion"],
  [/pembrokeshire coast/i, "pembrokeshire-coast"],
  [/pembrokeshire/i, "pembrokeshire"],
  [/carmarthen/i, "carmarthenshire"],
  [/swansea/i, "swansea"],
  [/neath/i, "neath-port-talbot"],
  [/bridgend/i, "bridgend"],
  [/vale of glamorgan/i, "vale-of-glamorgan"],
  [/rhondda/i, "rhondda-cynon-taf"],
  [/merthyr/i, "merthyr-tydfil"],
  [/caerphilly/i, "caerphilly"],
  [/blaenau/i, "blaenau-gwent"],
  [/torfaen/i, "torfaen"],
  [/monmouth/i, "monmouthshire"],
  [/newport/i, "newport"],
  [/cardiff/i, "cardiff"],
  [/brecon|bannau/i, "bannau-brycheiniog"],
  [/snowdonia|eryri/i, "eryri"],
];

export function surveyAuthority(name: string): string | null {
  return NAMES.find(([re]) => re.test(name))?.[1] ?? null;
}

/** The Welsh Government's financial-year quarters: Q1 is April to June of the year's first part. */
export function quarterRange(year: string, q: string): { start: string; end: string } | null {
  const y = Number(year.slice(0, 4));
  const n = Number(q.replace(/\D/g, ""));
  if (!y || n < 1 || n > 4) return null;
  const [sy, sm] = n === 4 ? [y + 1, 1] : [y, 1 + n * 3];
  const start = `${sy}-${String(sm).padStart(2, "0")}-01`;
  const endMonth = sm + 2;
  const last = new Date(Date.UTC(sy, endMonth, 0)).getUTCDate();
  return { start, end: `${sy}-${String(endMonth).padStart(2, "0")}-${last}` };
}

/** Every authority's applications received each quarter, from a release's "Data" sheet. */
export function parseSurvey(sheets: Sheet[]): QuarterCount[] {
  const data = sheets.find((s) => s.name.toLowerCase() === "data");
  if (!data) return [];
  const [head, ...rows] = data.rows;
  const col = (name: string) => head.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  const [ia, iq, iy, itot, ipre] = ["Authority", "Quarter", "Year", "RecdTot", "RecdPreapp"].map(col);
  if ([ia, iq, iy, itot].some((i) => i < 0)) return [];
  const out: QuarterCount[] = [];
  for (const r of rows) {
    const authority = surveyAuthority(r[ia] ?? "");
    const range = quarterRange(r[iy] ?? "", r[iq] ?? "");
    const total = Number(r[itot]);
    // A dash or blank means the authority didn't send figures for that quarter.
    if (!authority || !range || !r[itot] || !Number.isFinite(total)) continue;
    const pre = ipre >= 0 && Number.isFinite(Number(r[ipre])) ? Number(r[ipre]) : 0;
    out.push({ authority, quarter: `${r[iy]} ${r[iq]}`, ...range, received: total - pre });
  }
  return out;
}

/** Release pages listed on the series page, newest first. */
export function releaseLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href="((?:https:\/\/www\.gov\.wales)?\/development-management-quarterly-survey-[a-z0-9-]+)"/g)) {
    const u = m[1].startsWith("http") ? m[1] : `https://www.gov.wales${m[1]}`;
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/** The spreadsheet on a release page. */
export function odsLink(html: string): string | null {
  const m = html.match(/href="([^"]+\.ods)"/i);
  if (!m) return null;
  return m[1].startsWith("http") ? m[1] : `https://www.gov.wales${m[1]}`;
}
