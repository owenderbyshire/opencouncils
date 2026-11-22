/** Who has the most seats on a council, from its seat counts. Pure, so it can be tested. */

export interface SeatCounts {
  seats: number;
  parties: { label: string; partyId: string | null; seats: number }[];
}

const NATIONAL = new Set(["lab", "con", "ld", "reform", "green", "snp", "pc", "alba", "sf", "dup", "alliance", "uup", "sdlp", "tuv", "pbp"]);

/**
 * Who has the most seats, worked out from the seat counts: national parties by name, and independents and local
 * groups together as "other". A majority is more than half the seats. Null when two groups tie for most seats.
 */
export function leadOf(c: SeatCounts): { partyId: string; seats: number; majority: boolean } | null {
  const by = new Map<string, number>();
  for (const p of c.parties) {
    if (p.label.toLowerCase() === "vacant") continue;
    const key = p.partyId && NATIONAL.has(p.partyId) ? p.partyId : "other";
    by.set(key, (by.get(key) ?? 0) + p.seats);
  }
  const sorted = [...by].sort((a, b) => b[1] - a[1]);
  if (!sorted.length || (sorted[1] && sorted[1][1] === sorted[0][1])) return null;
  return { partyId: sorted[0][0], seats: sorted[0][1], majority: sorted[0][1] * 2 > c.seats };
}

