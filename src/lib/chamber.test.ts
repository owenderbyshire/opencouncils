import { describe, expect, it } from "vitest";
import { chamberSeats } from "./chamber";

describe("chamberSeats", () => {
  it("places one dot per seat, without overlaps, for every council size", () => {
    for (const n of [1, 5, 30, 33, 47, 51, 60, 69, 75, 79]) {
      const { seats, radius } = chamberSeats(n);
      expect(seats).toHaveLength(n);
      for (let i = 0; i < seats.length; i++)
        for (let j = i + 1; j < seats.length; j++)
          expect(Math.hypot(seats[i].x - seats[j].x, seats[i].y - seats[j].y)).toBeGreaterThanOrEqual(radius * 2);
    }
  });
  it("orders seats from left to right, so each group is one wedge", () => {
    const { seats } = chamberSeats(60);
    const angle = (s: { x: number; y: number }) => Math.atan2(1 - s.y, s.x - 1);
    for (let i = 1; i < seats.length; i++) expect(angle(seats[i])).toBeLessThanOrEqual(angle(seats[i - 1]) + 1e-9);
  });
  it("draws nothing for an empty chamber", () => {
    expect(chamberSeats(0).seats).toEqual([]);
  });
});
