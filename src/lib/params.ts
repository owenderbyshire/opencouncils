/** Reading query-string filters safely: unknown values fall back to the default. */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length <= 200 ? withoutControls(s) || undefined : undefined;
}

/**
 * Text with control characters (NUL, tabs, line breaks and the like) turned
 * into spaces. Postgres rejects a NUL byte in a query parameter, so "?q=%00"
 * made the search page fail.
 */
export function withoutControls(s: string): string {
  return s.replace(/\p{Cc}/gu, " ");
}

/**
 * Text typed into a search, ready to search with: control characters become
 * spaces, runs of spaces become one, and it is trimmed and cut to `max`
 * characters. An empty result means there is nothing to search for.
 */
export function searchText(raw: string | null | undefined, max = 120): string {
  return withoutControls((raw ?? "").normalize("NFC"))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * True for a YYYY-MM-DD date that exists and Postgres can read: "2026-02-31",
 * "2026-13-45" and "0000-01-01" (Postgres has no year 0) are false.
 */
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || s < "0001-01-01") return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function oneOf<T extends string>(sp: SearchParams, key: string, allowed: readonly T[]): T | undefined {
  const v = param(sp, key);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

export function pageParam(sp: SearchParams): number {
  const n = Number.parseInt(param(sp, "page") ?? "1", 10);
  return Number.isFinite(n) && n >= 1 && n <= 10_000 ? n : 1;
}

/**
 * Cache Components needs at least one value from `generateStaticParams` to
 * validate a dynamic route at build time, so a build against an empty
 * database (CI, a fresh deployment) would fail. The placeholder renders the
 * route's 404 page.
 */
export function atLeastOne<T extends Record<string, string>>(params: T[], placeholder: T): T[] {
  return params.length ? params : [placeholder];
}
