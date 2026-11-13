/**
 * Rules the site's figures must keep, for the nightly `checks` job. Each rule
 * is a pure function so it can be tested without a database.
 */
import type { Measure } from "../../data/curated/performance";
import type { Point } from "../jobs/performance";

/** The first calendar year a period label covers: "2025-26" and "2025" give 2025, "2026-10-01" gives 2026. */
export function periodStartYear(period: string): number | null {
  const m = period.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * Problems with one measure's figures: a percentage outside 0 to 100, a share
 * outside 0 to 1, a negative count or rate, or a period that hasn't started.
 */
export function measureProblems(
  key: string,
  unit: Measure["unit"],
  series: Record<string, Point[]>,
  today: string,
): string[] {
  const out: string[] = [];
  const year = Number(today.slice(0, 4));
  for (const [area, points] of Object.entries(series)) {
    for (const p of points) {
      if (!Number.isFinite(p.value)) out.push(`${key} ${area} ${p.period}: not a number`);
      else if (unit === "percent" && (p.value < 0 || p.value > 100)) out.push(`${key} ${area} ${p.period}: ${p.value}% is outside 0 to 100`);
      else if (unit === "share" && (p.value < 0 || p.value > 1)) out.push(`${key} ${area} ${p.period}: share ${p.value} is outside 0 to 1`);
      else if ((unit === "count" || unit === "rate") && p.value < 0) out.push(`${key} ${area} ${p.period}: ${p.value} is below zero`);
      const starts = periodStartYear(p.period);
      if (/^\d{4}-\d{2}-\d{2}$/.test(p.period) ? p.period > today : starts !== null && starts > year)
        out.push(`${key} ${area} ${p.period}: the period is in the future`);
    }
  }
  return out;
}
