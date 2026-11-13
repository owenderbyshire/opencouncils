/**
 * StatsWales (api.stats.gov.wales, v2). Copied from OpenSenedd.
 *
 * StatsWales filtered data is a two-step call: POST /v2/{dataset}/data with
 * the filters returns a filter ID (always the same for the same filters),
 * then GET /v2/{dataset}/data/{filterId}?format=csv returns the rows. The
 * "raw_extended" view adds each column's reference code ("<column>_reference")
 * and a sort key, which is what we match series on. Dataset metadata comes
 * from GET /v2/{dataset}.
 */
import { fetchJson, fetchText } from "../lib/http";

export const STATSWALES_API = "https://api.stats.gov.wales/v2";

/** The request body for a filtered query. Built the same way every time so the response can be cached. */
export function statsWalesBody(filters: Record<string, string[]>): string {
  return JSON.stringify({
    filters: Object.entries(filters).map(([column, refs]) => ({
      [column]: refs,
    })),
    options: {
      use_raw_column_names: true,
      use_reference_values: true,
      data_value_type: "raw_extended",
    },
  });
}

/** Parses RFC 4180 CSV (quoted fields, doubled quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

/** One row as column name → value. */
export type CsvRecord = Record<string, string>;

export function csvRecords(text: string): CsvRecord[] {
  const [header, ...body] = parseCsv(text);
  if (!header) return [];
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])),
  );
}

export interface StatsWalesMeta {
  titleEn: string | null;
  titleCy: string | null;
  designation: string | null;
  coverageEnd: string | null;
  nextUpdate: string | null;
  archived: boolean;
  replacedBy: string | null;
}

interface RawMeta {
  archived_at?: string | null;
  replaced_by?: { dataset_id?: string; auto_redirect?: boolean } | null;
  published_revision?: {
    coverage_end_date?: string | null;
    designation?: string | null;
    update_frequency?: {
      date?: { day?: string; month?: string; year?: string } | null;
      update_type?: string;
    } | null;
    metadata?: Array<{ language: string; title?: string }>;
  } | null;
}

/** The publisher's next update as "YYYY-MM-DD", "YYYY-MM" or "YYYY", whichever it states. */
export function nextUpdateFrom(
  d: { day?: string; month?: string; year?: string } | null | undefined,
): string | null {
  const year = d?.year?.trim() ?? "";
  if (!/^\d{4}$/.test(year)) return null;
  const month = d?.month?.trim() ?? "";
  if (!/^\d{1,2}$/.test(month) || Number(month) < 1 || Number(month) > 12)
    return year;
  const ym = `${year}-${month.padStart(2, "0")}`;
  const day = d?.day?.trim() ?? "";
  if (!/^\d{1,2}$/.test(day) || Number(day) < 1 || Number(day) > 31) return ym;
  return `${ym}-${day.padStart(2, "0")}`;
}

export async function statsWalesMeta(
  dataset: string,
): Promise<{ ok: true; meta: StatsWalesMeta } | { ok: false; error: string }> {
  const r = await fetchJson<RawMeta>(`${STATSWALES_API}/${dataset}`);
  if (!r.ok) return { ok: false, error: r.error };
  const rev = r.data.published_revision ?? {};
  const title = (lang: string) =>
    rev.metadata?.find((m) => m.language.startsWith(lang))?.title ?? null;
  const d =
    rev.update_frequency?.update_type === "update"
      ? rev.update_frequency.date
      : null;
  // Kept at the precision the publisher gives: "2026-10-22", "2026-12" or "2027".
  const nextUpdate = nextUpdateFrom(d);
  return {
    ok: true,
    meta: {
      titleEn: title("en"),
      titleCy: title("cy"),
      designation: rev.designation ?? null,
      coverageEnd: rev.coverage_end_date
        ? rev.coverage_end_date.slice(0, 10)
        : null,
      nextUpdate,
      archived: Boolean(r.data.archived_at),
      replacedBy: r.data.replaced_by?.dataset_id ?? null,
    },
  };
}

export async function statsWalesRows(
  dataset: string,
  filters: Record<string, string[]>,
): Promise<{ ok: true; rows: CsvRecord[] } | { ok: false; error: string }> {
  const post = await fetchText(`${STATSWALES_API}/${dataset}/data`, {
    method: "POST",
    body: statsWalesBody(filters),
    accept: "application/json",
    headers: { "Content-Type": "application/json" },
  });
  if (!post.ok) return { ok: false, error: `filter: ${post.error}` };
  let filterId: string | undefined;
  try {
    filterId = (JSON.parse(post.text) as { filterId?: string }).filterId;
  } catch {
    return { ok: false, error: "filter: response was not JSON" };
  }
  if (!filterId || !/^[a-z0-9]{6,32}$/i.test(filterId))
    return { ok: false, error: "filter: no filter ID in the response" };
  const csv = await fetchText(
    `${STATSWALES_API}/${dataset}/data/${filterId}?format=csv`,
    { accept: "text/csv" },
  );
  if (!csv.ok) return { ok: false, error: `data: ${csv.error}` };
  return { ok: true, rows: csvRecords(csv.text) };
}


/** One column of a dataset as GET /v2/{dataset}/filters describes it: its names and each value's reference code and label. */
export interface FilterColumn {
  names: string[];
  key: string | null;
  values: Map<string, string>; // reference code -> label
}

const NAME_KEYS = ["factTableColumn", "fact_table_column", "columnName", "column_name", "name", "dimension", "title"];
const REF_KEYS = ["reference", "ref", "code", "value", "id"];
const LABEL_KEYS = ["description", "label", "name", "title", "value_description"];

/** Reads the filters reply whatever its exact shape: columns holding values, which may nest children. */
export function readFilters(json: unknown): FilterColumn[] {
  const columns: FilterColumn[] = [];
  const list = Array.isArray(json) ? json : json && typeof json === "object" ? (Object.values(json).find(Array.isArray) ?? []) : [];
  for (const col of list as Array<Record<string, unknown>>) {
    if (!col || typeof col !== "object") continue;
    const names = NAME_KEYS.map((k) => col[k]).filter((v): v is string => typeof v === "string");
    const key = (["factTableColumn", "fact_table_column", "columnName", "column_name"].map((k) => col[k]).find((v) => typeof v === "string") as string) ?? names[0] ?? null;
    const values = new Map<string, string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      const ref = REF_KEYS.map((k) => o[k]).find((v) => typeof v === "string" || typeof v === "number");
      const label = LABEL_KEYS.map((k) => o[k]).find((v) => typeof v === "string");
      if (ref !== undefined && typeof label === "string" && String(ref) !== label) values.set(String(ref), label);
      for (const v of Object.values(o)) if (Array.isArray(v) || (v && typeof v === "object")) walk(v);
    };
    for (const [k, v] of Object.entries(col)) if (!NAME_KEYS.includes(k)) walk(v);
    if (names.length || values.size) columns.push({ names, key, values });
  }
  return columns;
}

export async function statsWalesFilters(dataset: string): Promise<{ ok: true; raw: unknown; columns: FilterColumn[] } | { ok: false; error: string }> {
  const r = await fetchJson<unknown>(`${STATSWALES_API}/${dataset}/filters`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, raw: r.data, columns: readFilters(r.data) };
}

/**
 * Columns the "raw_extended" view adds beside the labels: each column's
 * reference code ("Area_reference"), sort key ("Period_sort", "Data
 * values_sort") and hierarchy. They are not labels. Left in, tidy() took a
 * sort key such as "2081" in "Data values_sort" for the year.
 */
export const EXTRA_COLUMN = /_reference$|_sort|_hierarchy/i;

/** A row with only its label columns and the value, the shape Edau's rows are turned into as well. */
export function labelsOnly(row: CsvRecord): CsvRecord {
  return Object.fromEntries(Object.entries(row).filter(([h]) => !EXTRA_COLUMN.test(h)));
}

async function rowsFor(dataset: string, body: string): Promise<{ ok: true; rows: CsvRecord[] } | { ok: false; error: string }> {
  const post = await fetchText(`${STATSWALES_API}/${dataset}/data`, {
    method: "POST",
    body,
    accept: "application/json",
    headers: { "Content-Type": "application/json" },
  });
  if (!post.ok) return { ok: false, error: `filter: ${post.error}` };
  let filterId: string | undefined;
  try {
    filterId = (JSON.parse(post.text) as { filterId?: string }).filterId;
  } catch {
    return { ok: false, error: `filter: response was not JSON: ${post.text.slice(0, 200)}` };
  }
  if (!filterId || !/^[a-z0-9]{6,32}$/i.test(filterId)) return { ok: false, error: `filter: no filter ID in ${post.text.slice(0, 200)}` };
  const csv = await fetchText(`${STATSWALES_API}/${dataset}/data/${filterId}?format=csv`, { accept: "text/csv" });
  if (!csv.ok) return { ok: false, error: `data: ${csv.error}` };
  return { ok: true, rows: csvRecords(csv.text) };
}

/**
 * Every row of a dataset, with each value given as its label ("Cardiff",
 * "2026-27", "£ per band D") as the StatsWales site shows it. Tries the
 * simplest request first, then one that names every value of every column
 * (from the filters endpoint), and turns any reference codes back into
 * labels. Records what it tried, for checking.
 */
export async function statsWalesAll(dataset: string): Promise<
  { ok: true; rows: CsvRecord[]; tried: string[]; filters: unknown } | { ok: false; error: string; tried: string[]; filters: unknown }
> {
  const tried: string[] = [];
  const f = await statsWalesFilters(dataset);
  if (!f.ok) tried.push(`filters: ${f.error}`);
  const columns = f.ok ? f.columns : [];
  const attempts: Array<[string, string]> = [
    ["labels, no filters", JSON.stringify({ filters: [], options: { use_raw_column_names: false, use_reference_values: false, data_value_type: "raw" } })],
    ["references, no filters", JSON.stringify({ filters: [], options: { use_raw_column_names: true, use_reference_values: true, data_value_type: "raw_extended" } })],
  ];
  if (columns.length)
    attempts.push([
      "references, every value named",
      JSON.stringify({
        filters: columns.filter((c) => c.key && c.values.size).map((c) => ({ [c.key!]: [...c.values.keys()] })),
        options: { use_raw_column_names: true, use_reference_values: true, data_value_type: "raw_extended" },
      }),
    ]);
  for (const [name, body] of attempts) {
    const r = await rowsFor(dataset, body);
    if (!r.ok) {
      tried.push(`${name}: ${r.error}`);
      continue;
    }
    tried.push(`${name}: ${r.rows.length} rows`);
    if (!r.rows.length) continue;
    // Turn reference codes into labels, column by column.
    const byName = new Map<string, Map<string, string>>();
    for (const c of columns) for (const n of c.names) byName.set(n.toLowerCase(), c.values);
    const all = new Map<string, string>();
    for (const c of columns) for (const [k, v] of c.values) if (!all.has(k)) all.set(k, v);
    const rows = r.rows.map((row) =>
      labelsOnly(
        Object.fromEntries(
          Object.entries(row).map(([h, v]) => {
            if (EXTRA_COLUMN.test(h)) return [h, v];
            const map = byName.get(h.toLowerCase());
            return [h, map?.get(v) ?? v];
          }),
        ),
      ),
    );
    return { ok: true, rows, tried, filters: f.ok ? f.raw : null };
  }
  return { ok: false, error: tried.join("; "), tried, filters: f.ok ? f.raw : null };
}

const foldLabel = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/**
 * Only the rows a measure needs: any column with values matching the wanted
 * labels is narrowed to them; other columns (area, period) are left whole.
 * Keeps large datasets, such as population by single year of age, small.
 */
export async function statsWalesSome(
  dataset: string,
  wanted: string[],
): Promise<{ ok: true; rows: CsvRecord[]; tried: string[] } | { ok: false; error: string; tried: string[] }> {
  const tried: string[] = [];
  const f = await statsWalesFilters(dataset);
  if (!f.ok) return { ok: false, error: `filters: ${f.error}`, tried };
  const want = new Set(wanted.map(foldLabel));
  const filters: Array<Record<string, string[]>> = [];
  for (const c of f.columns) {
    if (!c.key) continue;
    const refs = [...c.values].filter(([, label]) => want.has(foldLabel(label))).map(([ref]) => ref);
    if (refs.length) filters.push({ [c.key]: refs });
  }
  const byName = new Map<string, Map<string, string>>();
  for (const c of f.columns) for (const n of c.names) byName.set(n.toLowerCase(), c.values);
  for (const [name, options] of [
    ["labels, narrowed", { use_raw_column_names: false, use_reference_values: false, data_value_type: "raw" }],
    ["references, narrowed", { use_raw_column_names: true, use_reference_values: true, data_value_type: "raw_extended" }],
  ] as const) {
    const r = await rowsFor(dataset, JSON.stringify({ filters, options }));
    if (!r.ok) {
      tried.push(`${name}: ${r.error}`);
      continue;
    }
    tried.push(`${name}: ${r.rows.length} rows`);
    // Labels only, as Edau's rows are: the reference, sort and hierarchy columns go.
    const rows = r.rows.map((row) =>
      labelsOnly(Object.fromEntries(Object.entries(row).map(([h, v]) => [h, byName.get(h.toLowerCase())?.get(v) ?? v]))),
    );
    return { ok: true, rows, tried };
  }
  return { ok: false, error: tried.join("; "), tried };
}
