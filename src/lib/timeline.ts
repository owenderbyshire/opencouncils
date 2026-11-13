/** Helpers for the small time charts: months and the shade steps of a count. */

/** The twelve months ending with today's, as "YYYY-MM", oldest first. */
export function timelineMonths(today: string, n = 12): string[] {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * The shade step for a count of meetings: 0 for none, 1 for one, 2 for two
 * or three, 3 for four or more. Fixed steps, so a shade means the same on
 * every council's page. Three shades are as many as a reader can tell apart
 * (checked with the palette validator in both themes).
 */
export function countStep(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  return 3;
}

/**
 * Which month columns carry a year under their initial: January, and the
 * first column unless January follows within two columns (the labels would
 * run into each other on a phone; the months before January are plainly the
 * year before).
 */
export function yearLabelled(months: string[]): boolean[] {
  const jan = months.findIndex((m) => m.endsWith("-01"));
  return months.map((m, i) => m.endsWith("-01") || (i === 0 && (jan === -1 || jan > 2)));
}
