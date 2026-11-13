/**
 * Council figures from StatsWales: council tax, and what councils budget to
 * spend on each service. Rows are matched on the labels
 * the StatsWales site shows ("Cardiff", "2026-27", "£ per band D"), so a
 * change of wording upstream makes a figure go missing, never wrong. Every
 * figure is the publisher's own; the only arithmetic is shares of a total,
 * done on the website.
 */
import { COUNCILS } from "../../data/curated/councils";
import { EXTRA_COLUMN, type CsvRecord } from "./statswales";

export const DATASETS = {
  bandD: "3ca971eb-7d9b-4b79-89fa-6d7f77431aad",
  budget: "88384d5e-1a50-4496-849c-7195ddd4185f",
} as const;
export type DatasetKey = keyof typeof DATASETS;

/** Service groups in the budget figures, in the order StatsWales lists them. */
export const SERVICE_GROUPS = [
  "education",
  "social-services",
  "housing",
  "environment",
  "roads",
  "culture",
  "planning",
  "tax-collection",
  "law",
  "administration",
  "debt",
  "other",
] as const;
export type ServiceGroup = (typeof SERVICE_GROUPS)[number];

const GROUP_LABELS: Record<ServiceGroup, string> = {
  education: "education",
  "social-services": "social services",
  housing: "council fund housing",
  environment: "local environmental services",
  roads: "roads and transport",
  culture: "libraries, culture, heritage, sport and recreation",
  planning: "planning, economic and community development",
  "tax-collection": "local tax collection",
  law: "law, order and protective services",
  administration: "central administration",
  debt: "debt financing costs",
  other: "other revenue expenditure",
};

export interface BandDYear {
  year: string;
  total: number | null;
  county: number | null;
  community: number | null;
  police: number | null;
}
/** StatsWales nests "Other central services to the public" inside local environmental services, so it isn't a group of its own here. */
export interface SpendGroup {
  key: ServiceGroup;
  perHead: number | null;
  thousands: number | null;
}
export interface AreaFigures {
  bandD: BandDYear[];
  spend: { year: string; groups: SpendGroup[]; total?: { perHead: number | null; thousands: number | null } } | null;
  /** Support from the Welsh Government, year by year. */
  support?: SupportYear[];
  /** What the council actually spent on each service, year by year (revenue outturn). */
  outturn?: Array<{ year: string; groups: SpendGroup[]; total?: { perHead: number | null; thousands: number | null } }>;
}
export interface CouncilData {
  councils: Record<string, AreaFigures>;
  wales: AreaFigures;
}

/** A row reduced to what matching needs: its area, year, value and the other labels, lower-cased. */
export interface Tidy {
  area: string; // council id or "wales"
  year: string; // "2026-27"
  value: number;
  labels: Set<string>;
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Every name or code an area appears under. "Total Unitary Authorities" is the Wales figure for councils. */
const AREAS = (() => {
  const m = new Map<string, string>();
  for (const c of COUNCILS) {
    m.set(fold(c.shortEn), c.id);
    m.set(fold(c.nameEn), c.id);
  }
  m.set("isle of anglesey", "anglesey");
  m.set("anglesey", "anglesey");
  m.set("the vale of glamorgan", "vale-of-glamorgan");
  m.set("rhondda cynon taff", "rhondda-cynon-taf");
  // ONS codes, in case a dataset gives codes rather than names.
  const ons: Record<string, string> = {
    w06000001: "anglesey", w06000002: "gwynedd", w06000003: "conwy", w06000004: "denbighshire",
    w06000005: "flintshire", w06000006: "wrexham", w06000008: "ceredigion", w06000009: "pembrokeshire",
    w06000010: "carmarthenshire", w06000011: "swansea", w06000012: "neath-port-talbot", w06000013: "bridgend",
    w06000014: "vale-of-glamorgan", w06000015: "cardiff", w06000016: "rhondda-cynon-taf", w06000018: "caerphilly",
    w06000019: "blaenau-gwent", w06000020: "torfaen", w06000021: "monmouthshire", w06000022: "newport",
    w06000023: "powys", w06000024: "merthyr-tydfil",
  };
  for (const [k, v] of Object.entries(ons)) m.set(k, v);
  for (const w of ["wales", "total wales", "w92000004"]) m.set(w, "wales");
  // The councils together, without police, fire and national parks. Preferred to "wales" where both exist.
  m.set("total unitary authorities", "wales-councils");
  m.set("total welsh local authorities", "wales-councils");
  return m;
})();

/** "2026-27", "2026/27", "202627" or "2026-2027" as "2026-27". */
export function financialYear(s: string): string | null {
  const m = /^(\d{4})\s*[-/]?\s*(\d{2}|\d{4})$/.exec(s.trim());
  if (!m) return null;
  const end = m[2].slice(-2);
  if ((Number(m[1].slice(-2)) + 1) % 100 !== Number(end)) return null;
  return `${m[1]}-${end}`;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** Other periods StatsWales uses, as sortable strings: "2026-06-30", "June 2026" as "2026-06", "31 March 2025" as "2025-03-31". */
export function period(s: string): string | null {
  const v = s.trim().toLowerCase();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = /^(\d{1,2}) ([a-z]+) (\d{4})$/.exec(v);
  if (m && MONTHS.includes(m[2])) return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^([a-z]+) (\d{4})$/.exec(v);
  if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}`;
  m = /^mid-year (\d{4})$/.exec(v);
  if (m) return m[1];
  m = /^(\d{4})m(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}`;
  m = /^(\d{4})$/.exec(v);
  if (m && Number(m[1]) > 1990 && Number(m[1]) < 2100) return m[1];
  return null;
}

const VALUE_HEADER = /^(data[ _]?values?|value|values|data)$/i;

export function tidy(records: CsvRecord[]): Tidy[] {
  if (!records.length) return [];
  const headers = Object.keys(records[0]);
  const valueKey = headers.find((h) => VALUE_HEADER.test(h.trim()));
  const out: Tidy[] = [];
  for (const r of records) {
    let area: string | null = null;
    let year: string | null = null;
    const labels = new Set<string>();
    for (const [h, raw] of Object.entries(r)) {
      // Reference codes, sort keys and hierarchy are not labels, and a sort key such as "2081" would pass for a year.
      if (h === valueKey || EXTRA_COLUMN.test(h)) continue;
      const v = fold(raw);
      if (!v) continue;
      if (!area && AREAS.has(v)) {
        area = AREAS.get(v)!;
        continue;
      }
      if (!year) {
        const y = financialYear(v) ?? period(v);
        if (y) {
          year = y;
          continue;
        }
      }
      labels.add(v);
    }
    const value = valueKey ? Number(r[valueKey].replace(/,/g, "")) : NaN;
    if (area && year && Number.isFinite(value) && r[valueKey!].trim() !== "") out.push({ area, year, value, labels });
  }
  return out;
}

const has = (t: Tidy, ...labels: string[]) => labels.every((l) => t.labels.has(l));

function byArea(rows: Tidy[]): Map<string, Tidy[]> {
  const m = new Map<string, Tidy[]>();
  for (const r of rows) {
    const list = m.get(r.area) ?? [];
    list.push(r);
    m.set(r.area, list);
  }
  return m;
}

/** Average band D council tax and its parts, every year. */
export function bandD(rows: Tidy[]): Map<string, BandDYear[]> {
  const out = new Map<string, BandDYear[]>();
  for (const [area, list] of byArea(rows.filter((r) => has(r, "£ per band d")))) {
    const years = new Map<string, BandDYear>();
    for (const r of list) {
      const y = years.get(r.year) ?? { year: r.year, total: null, county: null, community: null, police: null };
      if (r.labels.has("total ct for billing authority area")) y.total = r.value;
      else if (r.labels.has("county council ct (exc. community councils)")) y.county = r.value;
      else if (r.labels.has("community council ct")) y.community = r.value;
      else if (r.labels.has("police council tax within county area")) y.police = r.value;
      years.set(r.year, y);
    }
    out.set(
      area,
      [...years.values()].filter((y) => y.total !== null).sort((a, b) => a.year.localeCompare(b.year)),
    );
  }
  return out;
}

/** The latest year's budget by service group, per head and in thousands of pounds. */
/** The labels a spending dataset is narrowed to. */
/** Names the actual-spending (outturn) dataset uses for the same groups. */
const ALT_LABELS: Record<string, ServiceGroup> = {
  "council fund housing and housing benefit": "housing",
  "planning and economic development": "planning",
  "law and order and protective services": "law",
};
export const SPEND_LABELS = [...Object.values(GROUP_LABELS), ...Object.keys(ALT_LABELS), "£ per head", "£ thousand", "revenue expenditure"];

export interface SupportYear {
  year: string;
  /** Total central government support, and its two parts. £ per head and £ thousand. */
  total: { perHead: number | null; thousands: number | null };
  rsg: number | null;
  ndr: number | null;
}
export const SUPPORT_LABELS = ["total central government support", "revenue support grant", "share of re-distributed non-domestic rates", "£ per head", "£ thousand"];

/** What the Welsh Government gives each council each year: revenue support grant and its share of business rates. */
export function support(rows: Tidy[]): Map<string, SupportYear[]> {
  const out = new Map<string, Map<string, SupportYear>>();
  for (const r of rows) {
    const years = out.get(r.area) ?? new Map<string, SupportYear>();
    const y = years.get(r.year) ?? { year: r.year, total: { perHead: null, thousands: null }, rsg: null, ndr: null };
    const perHead = r.labels.has("£ per head");
    const thousands = r.labels.has("£ thousand");
    if (r.labels.has("total central government support")) {
      if (perHead) y.total.perHead = r.value;
      if (thousands) y.total.thousands = r.value;
    } else if (r.labels.has("revenue support grant") && thousands) y.rsg = r.value;
    else if (r.labels.has("share of re-distributed non-domestic rates") && thousands) y.ndr = r.value;
    years.set(r.year, y);
    out.set(r.area, years);
  }
  return new Map(
    [...out].map(([area, years]) => [area, [...years.values()].filter((y) => y.total.thousands !== null).sort((a, b) => a.year.localeCompare(b.year))]),
  );
}

/** Spending by service for every year in the rows, oldest first. */
export function spendHistory(rows: Tidy[]): Map<string, Array<NonNullable<AreaFigures["spend"]>>> {
  const out = new Map<string, Array<NonNullable<AreaFigures["spend"]>>>();
  for (const year of [...new Set(rows.map((r) => r.year))].sort()) {
    for (const [area, v] of spend(rows, year)) out.set(area, [...(out.get(area) ?? []), v]);
  }
  return out;
}

export function spend(rows: Tidy[], year?: string): Map<string, NonNullable<AreaFigures["spend"]>> {
  const out = new Map<string, NonNullable<AreaFigures["spend"]>>();
  const latest = year ?? rows.reduce((y, r) => (r.year > y ? r.year : y), "");
  const want = new Map<string, ServiceGroup>();
  for (const k of SERVICE_GROUPS) {
    want.set(GROUP_LABELS[k], k);
    want.set(`total ${GROUP_LABELS[k]}`, k);
  }
  for (const [label, k] of Object.entries(ALT_LABELS)) want.set(label, k);
  for (const [area, list] of byArea(rows.filter((r) => r.year === latest))) {
    const groups = new Map<ServiceGroup, SpendGroup>();
    const total = { perHead: null as number | null, thousands: null as number | null };
    for (const r of list) {
      // "Revenue expenditure" is the total of every service.
      if (r.labels.has("revenue expenditure")) {
        if (r.labels.has("£ per head")) total.perHead = r.value;
        else if (r.labels.has("£ thousand")) total.thousands = r.value;
        continue;
      }
      const key = [...r.labels].map((l) => want.get(l)).find(Boolean);
      if (!key) continue;
      const g = groups.get(key) ?? { key, perHead: null, thousands: null };
      if (r.labels.has("£ per head")) g.perHead = r.value;
      else if (r.labels.has("£ thousand")) g.thousands = r.value;
      groups.set(key, g);
    }
    if (groups.size)
      out.set(area, {
        year: latest,
        groups: SERVICE_GROUPS.flatMap((k) => (groups.has(k) ? [groups.get(k)!] : [])),
        ...(total.perHead !== null || total.thousands !== null ? { total } : {}),
      });
  }
  return out;
}

export function emptyFigures(): AreaFigures {
  return { bandD: [], spend: null };
}

/** A sample of a dataset for checking the matching by eye: headers, a few rows, and each column's distinct values. */
export function sample(records: CsvRecord[]) {
  const headers = records.length ? Object.keys(records[0]) : [];
  const distinct: Record<string, string[]> = {};
  for (const h of headers) {
    const s = new Set<string>();
    for (const r of records) {
      if (s.size >= 80) break;
      s.add(r[h]);
    }
    distinct[h] = [...s];
  }
  return { count: records.length, headers, rows: records.slice(0, 8), distinct };
}
