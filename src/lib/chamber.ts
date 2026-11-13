/**
 * Seat positions for a chamber diagram: a half circle of rows, one dot per
 * seat, filled left to right so each group forms one wedge. Coordinates are
 * in a 2 by 1 box: x from 0 to 2, y from 0 (top) to 1 (the floor of the
 * chamber, through its centre).
 */
export interface Seat {
  x: number;
  y: number;
}

const INNER = 0.38; // the empty floor in the middle, as a share of the outer radius

/** Seats per row for `rows` rows, the inner row first, if seats sit one row-gap apart. */
function capacity(rows: number): number[] {
  const gap = (1 - INNER) / Math.max(rows - 0.5, 0.5);
  return Array.from({ length: rows }, (_, i) => Math.max(1, Math.floor((Math.PI * (INNER + gap * (i + 0.5))) / gap)));
}

/** The seats of a chamber of `n`, in order from the far left to the far right. Also returns the dot radius. */
export function chamberSeats(n: number): { seats: Seat[]; radius: number } {
  if (n <= 0) return { seats: [], radius: 0 };
  let rows = 1;
  while (capacity(rows).reduce((a, b) => a + b, 0) < n) rows++;
  const gap = (1 - INNER) / Math.max(rows - 0.5, 0.5);
  const radii = Array.from({ length: rows }, (_, i) => INNER + gap * (i + 0.5));
  // Share the seats between rows by their length, largest remainders first.
  const total = radii.reduce((a, b) => a + b, 0);
  const exact = radii.map((r) => (r / total) * n);
  const per = exact.map(Math.floor);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; per.reduce((a, b) => a + b, 0) < n; k++) per[order[k % rows][1]]++;
  const all: Array<Seat & { angle: number; r: number }> = [];
  radii.forEach((r, i) => {
    const m = per[i];
    for (let j = 0; j < m; j++) {
      const angle = m === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (m - 1);
      all.push({ x: 1 + r * Math.cos(angle), y: 1 - r * Math.sin(angle), angle, r });
    }
  });
  all.sort((a, b) => b.angle - a.angle || a.r - b.r);
  return { seats: all.map(({ x, y }) => ({ x, y })), radius: Math.min(gap * 0.4, 0.06) };
}
