import { describe, expect, it } from "vitest";
import { seatGroups } from "./seats";

describe("seatGroups", () => {
  it("orders groups as the chamber sits and counts empty seats up to the council's size", () => {
    const { groups, listed, vacant } = seatGroups(
      [
        { partyId: "con", label: null, seats: 2 },
        { partyId: "lab", label: null, seats: 55 },
        { partyId: null, label: "Llynfi Independents", seats: 3 },
        { partyId: "pc", label: null, seats: 8 },
        { partyId: "ind", label: null, seats: 6 },
      ],
      75,
    );
    expect(groups.map((g) => [g.kind, g.seats])).toEqual([
      ["lab", 55],
      ["pc", 8],
      ["ind", 6],
      ["local", 3],
      ["con", 2],
    ]);
    expect(listed).toBe(74);
    expect(vacant).toBe(1);
  });
  it("keeps councillors with no party recorded as their own group", () => {
    const { groups } = seatGroups(
      [
        { partyId: "ld", label: null, seats: 23 },
        { partyId: null, label: "No party recorded", seats: 1 },
      ],
      null,
    );
    expect(groups.map((g) => [g.kind, g.label, g.seats])).toEqual([
      ["ld", null, 23],
      ["none", null, 1],
    ]);
  });
  it("gives no groups when the list records no party for anyone", () => {
    expect(seatGroups([{ partyId: null, label: "No party recorded", seats: 56 }], 56)).toEqual({ groups: [], listed: 56, vacant: 0 });
  });
});
