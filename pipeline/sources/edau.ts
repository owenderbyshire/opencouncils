/**
 * StatsWales through Edau, Datblygu Cymru's data store, which owns the
 * StatsWales datasets for every product and serves them free through its
 * feed. Copied from OpenSenedd's copy and adapted, never imported.
 *
 * Edau reads each dataset the way this pipeline did (data/curated/statistics.ts
 * in Edau lists them): the same labels narrowing as statsWalesSome(), or the
 * whole dataset as statsWalesAll() read it. It keeps every row as StatsWales
 * published it, columns in the publisher's order. Here each row is turned
 * back into the labels-only row statsWalesSome() returned (the
 * "<column>_reference" codes and sort keys are dropped), so tidy() and the
 * matching that follows work exactly as before.
 *
 * Used only when EDAU_FEED_URL and EDAU_FEED_KEY are both set; otherwise the
 * pipeline reads StatsWales itself.
 */
import { fetchJson } from "../lib/http";
import { EXTRA_COLUMN, statsWalesMeta, statsWalesSome, type CsvRecord, type StatsWalesMeta } from "./statswales";

export interface EdauFeed {
  /** The feed's base: "<Edau's address>/api/v1/feed". */
  base: string;
  key: string;
}

/** The feed to read from, or null when either variable is missing. */
export function edauFeed(env: Record<string, string | undefined> = process.env): EdauFeed | null {
  const url = env.EDAU_FEED_URL?.trim();
  const key = env.EDAU_FEED_KEY?.trim();
  if (!url || !key) return null;
  const root = url.replace(/\/+$/, "");
  return { base: /\/api\/v1\/feed$/.test(root) ? root : `${root}/api/v1/feed`, key };
}

/** Lower case, accents and curly quotes folded, single spaces: how labels are compared here and in Edau. */
export const foldLabel = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/**
 * The key Edau stores a read's rows under, worked out the same way as in
 * Edau (sliceKey in its data/curated/statistics.ts). Labels a dataset is
 * narrowed to, or the whole dataset. A list changed here and not in Edau
 * finds no rows rather than the wrong ones.
 */
export function sliceKey(labels: string[] | "whole"): string {
  if (labels === "whole") return "whole";
  return `labels:${JSON.stringify([...new Set(labels.map(foldLabel))].sort())}`;
}

/** One row of Edau's dataset feed (only the fields read here). */
export interface EdauRow {
  row: Record<string, string | number | null> | null;
  slices: string[];
}

/** What Edau's first page says about the dataset, from the publisher's metadata. */
export interface EdauAbout {
  titleEn: string | null;
  titleCy: string | null;
  designation: string | null;
  coverageEnd: string | null;
  nextUpdate: string | null;
  archived: boolean;
  replacedBy: string | null;
}

interface EdauPage {
  rows?: EdauRow[];
  next_page?: number | null;
  about?: EdauAbout | null;
}

/** A published row as statsWalesSome() returned it: labels and the value, as text, in the publisher's column order. */
export function labelRowFromEdau(row: Record<string, string | number | null>): CsvRecord {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([k]) => !EXTRA_COLUMN.test(k))
      .map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)]),
  );
}

/** The rows of a page read for this slice, as labels-only rows. */
export function rowsForSlice(rows: EdauRow[], key: string): CsvRecord[] {
  return rows.filter((r) => r.row && Array.isArray(r.slices) && r.slices.includes(key)).map((r) => labelRowFromEdau(r.row!));
}

export function metaFromEdau(about: EdauAbout): StatsWalesMeta {
  return {
    titleEn: about.titleEn ?? null,
    titleCy: about.titleCy ?? null,
    designation: about.designation ?? null,
    coverageEnd: about.coverageEnd ?? null,
    nextUpdate: about.nextUpdate ?? null,
    archived: Boolean(about.archived),
    replacedBy: about.replacedBy ?? null,
  };
}

const MAX_PAGES = 100;

/** Every row Edau holds for one dataset and slice, with the dataset's metadata. Fails when Edau holds none. */
export async function edauSlice(
  feed: EdauFeed,
  dataset: string,
  labels: string[] | "whole",
): Promise<{ ok: true; rows: CsvRecord[]; meta: StatsWalesMeta | null } | { ok: false; error: string }> {
  const key = sliceKey(labels);
  const rows: CsvRecord[] = [];
  let meta: StatsWalesMeta | null = null;
  let page = 1;
  for (; page <= MAX_PAGES; page++) {
    const url = `${feed.base}/dataset?id=${encodeURIComponent(dataset)}&slice=${encodeURIComponent(key)}&page=${page}`;
    const r = await fetchJson<EdauPage>(url, { headers: { Authorization: `Bearer ${feed.key}` }, fresh: true });
    if (!r.ok) return { ok: false, error: `Edau: ${r.error}` };
    if (page === 1 && r.data.about) meta = metaFromEdau(r.data.about);
    rows.push(...rowsForSlice(r.data.rows ?? [], key));
    if (!r.data.next_page) break;
  }
  if (page > MAX_PAGES) return { ok: false, error: `Edau: more than ${MAX_PAGES} pages` };
  if (!rows.length) return { ok: false, error: "Edau holds no rows for this read yet" };
  return { ok: true, rows, meta };
}

/**
 * A dataset's rows narrowed to some labels, with its titles: from Edau's feed
 * when it is set up, otherwise from StatsWales itself (statsWalesSome). The
 * rows are the same labels-only rows either way.
 */
export async function readSome(
  feed: EdauFeed | null,
  dataset: string,
  wanted: string[],
): Promise<{ ok: true; rows: CsvRecord[]; titleEn: string | null; titleCy: string | null; via: "edau" | null } | { ok: false; error: string }> {
  if (feed) {
    const r = await edauSlice(feed, dataset, wanted);
    if (!r.ok) return r;
    return { ok: true, rows: r.rows, titleEn: r.meta?.titleEn ?? null, titleCy: r.meta?.titleCy ?? null, via: "edau" };
  }
  const r = await statsWalesSome(dataset, wanted);
  if (!r.ok) return r;
  const meta = await statsWalesMeta(dataset);
  return { ok: true, rows: r.rows, titleEn: meta.ok ? meta.meta.titleEn : null, titleCy: meta.ok ? meta.meta.titleCy : null, via: null };
}
