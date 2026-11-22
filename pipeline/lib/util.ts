import { createHash } from "node:crypto";

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function today(): string {
  return isoDate(new Date());
}

/** Splits [from, to] into consecutive windows of at most `days` days. */
export function dateWindows(
  from: string,
  to: string,
  days: number,
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  let start = from;
  while (start <= to) {
    const end = addDays(start, days - 1);
    out.push([start, end < to ? end : to]);
    start = addDays(end, 1);
  }
  return out;
}

/** Runs async work over items with bounded concurrency. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export function argString(
  args: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const v = args[key];
  return typeof v === "string" ? v : undefined;
}

export function argNumber(
  args: Record<string, string | boolean>,
  key: string,
): number | undefined {
  const v = argString(args, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Councils read at the same time by the jobs that go through every council. Each council is a different site,
 * and each job still asks any one site at most two things at once, so this speeds the run without leaning on anyone.
 */
export const COUNCILS_AT_ONCE = 6;
