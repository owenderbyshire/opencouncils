/**
 * Reading Local Development Plan documents: splitting a PDF's text into
 * pages, choosing the pages worth reading, and checking that what the model
 * reports is printed on the page it names. Used by pipeline/jobs/ldp.ts.
 */

import { mergeSameSites } from "../../src/lib/ldp";

/** pdftotext separates pages with form feeds. Page 1 is the first. */
export function splitPages(text: string): string[] {
  const pages = text.split("\f");
  if (pages.length > 1 && !pages[pages.length - 1].trim()) pages.pop();
  return pages;
}

/** Lower case, one space between words, no thousands separators, plain quotes and dashes. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The quote is printed on the page. Table rows from pdftotext keep their
 * columns apart with runs of spaces, which normalising removes, so a row
 * quoted with single spaces still matches.
 */
export function quoteOnPage(quote: string, page: string): boolean {
  const q = normalise(quote);
  if (q.length < 8) return false;
  const p = normalise(page);
  // A quote shortened with an ellipsis: every part must be on the page, in order.
  let from = 0;
  for (const part of q.split(/\s*(?:\.\.\.|…)\s*/).filter(Boolean)) {
    const at = p.indexOf(part, from);
    if (at < 0) return false;
    from = at + part.length;
  }
  return true;
}

/** The number is written in the quote, as a figure. */
export function numberInQuote(n: number, quote: string): boolean {
  const q = normalise(quote);
  const forms = new Set([String(n), n.toFixed(1), n.toFixed(2)].map((x) => x.replace(/\.0+$/, "")));
  for (const f of forms) {
    if (new RegExp(`(?<![\\d.])${f.replace(".", "\\.")}(?![\\d])`).test(q)) return true;
  }
  return false;
}

const WORTH_READING = /dwelling|homes|housing|units|hectare|\bha\b|affordable|allocat|employment land|completions|anheddau|cartrefi|tai fforddiadwy|hectar|dyrann/i;

/** Pages that could hold a headline figure or an allocated site. */
export function pagesWorthReading(pages: string[]): number[] {
  const out: number[] = [];
  pages.forEach((p, i) => {
    if (/\d/.test(p) && WORTH_READING.test(p)) out.push(i + 1);
  });
  return out;
}

/** Groups pages into chunks of at most `maxChars`, marked "=== Page N ===". */
export function chunkPages(pages: string[], numbers: number[], maxChars = 60_000): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const n of numbers) {
    const text = pages[n - 1].replace(/[ \t]{3,}/g, "  ").trim();
    const block = `=== Page ${n} ===\n${text.slice(0, maxChars - 40)}\n`;
    if (cur && cur.length + block.length > maxChars) {
      chunks.push(cur);
      cur = "";
    }
    cur += block;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export const FACT_KEYS = {
  plan: ["housing-requirement", "housing-provision", "affordable-target", "employment-land"],
  amr: ["completions-year", "completions-total", "affordable-completions-year"],
} as const;
export type FactKey = (typeof FACT_KEYS)[keyof typeof FACT_KEYS][number];

export interface FactCandidate {
  key: FactKey;
  value: number;
  page: number;
  quote: string;
}

/**
 * The figure to show for each key: the value quoted most often, earliest page
 * first. A plan repeats its headline figures, so agreement across pages is a
 * good sign the right one was found.
 */
export function pickFacts(found: FactCandidate[]): Array<FactCandidate & { mentions: number }> {
  const byKey = new Map<string, Map<number, FactCandidate[]>>();
  for (const f of found) {
    const values = byKey.get(f.key) ?? new Map<number, FactCandidate[]>();
    values.set(f.value, [...(values.get(f.value) ?? []), f]);
    byKey.set(f.key, values);
  }
  const out: Array<FactCandidate & { mentions: number }> = [];
  for (const values of byKey.values()) {
    const best = [...values.values()].sort((a, b) => b.length - a.length || Math.min(...a.map((x) => x.page)) - Math.min(...b.map((x) => x.page)))[0];
    const first = [...best].sort((a, b) => a.page - b.page)[0];
    out.push({ ...first, mentions: best.length });
  }
  return out;
}

export interface SiteCandidate {
  ref: string;
  name: string;
  settlement: string;
  use: "housing" | "employment" | "mixed" | "gypsy-traveller" | "other";
  homes: number | null;
  hectares: number | null;
  page: number;
  quote: string;
}

/**
 * The quote has words a reader can check it against, not only a row of
 * figures from a table ("Tenth 6 15").
 */
export function quoteHasWords(quote: string): boolean {
  return (quote.match(/\p{L}{3,}/gu) ?? []).length >= 3;
}

/** One row per site: the same site is often listed in a policy and again in an appendix. */
export function dedupeSites(sites: SiteCandidate[]): SiteCandidate[] {
  return mergeSameSites(mergeMentions(dedupeByRef(sites)).map((s) => ({ ...s, kind: "plan" })));
}

/**
 * A bare mention of a site, with no figures, whose name is part of a fuller
 * entry's name ("Barry Waterfront" and "Phase 2, Barry Waterfront") is the
 * same site.
 */
function mergeMentions(sites: SiteCandidate[]): SiteCandidate[] {
  const bare = (s: SiteCandidate) => s.homes === null && s.hectares === null;
  return sites.filter((s) => {
    if (!bare(s)) return true;
    const n = normalise(s.name);
    return !sites.some((o) => o !== s && !bare(o) && normalise(o.name).includes(n));
  });
}

function dedupeByRef(sites: SiteCandidate[]): SiteCandidate[] {
  const key = (s: SiteCandidate) => (s.ref.trim() ? normalise(s.ref).replace(/[^a-z0-9]/g, "") : normalise(s.name));
  const out = new Map<string, SiteCandidate>();
  for (const s of sites) {
    const k = key(s);
    const had = out.get(k);
    // Keep the entry that gives the most, then the earliest.
    const score = (x: SiteCandidate) => (x.homes !== null ? 2 : 0) + (x.hectares !== null ? 1 : 0);
    if (!had || score(s) > score(had) || (score(s) === score(had) && s.page < had.page)) out.set(k, s);
  }
  return [...out.values()];
}

/** Topics a plan's summary covers, and the words that mark pages about each. */
export const SUMMARY_TOPICS = {
  strategy: /\bvision\b|objective|spatial strategy|growth strategy|settlement hierarch|strategic policy|key diagram/gi,
  housing: /housing|dwellings|affordable|homes|gypsy|traveller/gi,
  economy: /employment|jobs|economic|business|industrial|tourism/gi,
  "town-centres": /town centre|retail|shopping|high street|city centre/gi,
  environment: /countryside|landscape|green wedge|biodiversity|green infrastructure|open space|heritage|conservation area|special landscape|\bAONB\b|national landscape/gi,
  climate: /climate|renewable|flood|carbon|energy|solar|wind turbine|sustainable drainage/gi,
  transport: /transport|active travel|\bbus\b|railway|cycle|walking|parking|highway|metro/gi,
  "welsh-language": /welsh language|iaith gymraeg|linguistic|language impact/gi,
} as const;
export type SummaryTopic = keyof typeof SUMMARY_TOPICS;

/** The pages most about a topic, in page order, as one marked text of at most `maxChars`. */
export function topicPages(pages: string[], re: RegExp, maxPages = 18, maxChars = 70_000): string | null {
  const scored = pages
    .map((p, i) => ({ n: i + 1, score: (p.match(re) ?? []).length, len: p.length }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.n - b.n)
    .slice(0, maxPages)
    .sort((a, b) => a.n - b.n);
  if (!scored.length) return null;
  const text = chunkPages(pages, scored.map((x) => x.n), maxChars)[0];
  return text ?? null;
}

/** Every number in the sentence is in the quote, as a figure ("2,000" matches "2000"). */
export function numbersSupported(sentence: string, quote: string): boolean {
  const q = normalise(quote);
  for (const m of normalise(sentence).matchAll(/\d[\d.]*/g)) {
    const n = m[0].replace(/\.$/, "");
    if (!new RegExp(`(?<![\\d.])${n.replace(/\./g, "\\.")}(?![\\d])`).test(q)) return false;
  }
  return true;
}

/** Links to documents (PDFs and council document handlers) on a page, as absolute URLs. */
export function documentLinks(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    const raw = m[1].replace(/&amp;/g, "&").trim();
    if (!/\.pdf($|\?)|objview\.asp|mgConvert2PDF|\/media\/\d+\/|Docs\/|docfiles\//i.test(raw)) continue;
    try {
      out.add(new URL(raw, base).toString());
    } catch {
      /* not a URL */
    }
  }
  return [...out].sort();
}
