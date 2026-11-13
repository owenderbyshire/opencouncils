import { describe, expect, it } from "vitest";
import { seatsFact } from "./council-briefs";

describe("seatsFact", () => {
  it("counts by party, as the chamber diagram does, and names empty seats", () => {
    expect(
      seatsFact(
        "Rhondda Cynon Taf",
        [
          { partyId: "lab", label: null, seats: 55 },
          { partyId: "pc", label: null, seats: 8 },
          { partyId: "ind", label: null, seats: 8 },
          { partyId: "con", label: null, seats: 2 },
          { partyId: "green", label: null, seats: 1 },
        ],
        75,
      ),
    ).toBe("Rhondda Cynon Taf Council has 75 seats. By party or group: Labour 55, Plaid Cymru 8, Green 1, Independent 8, Conservative 2. 1 seat has no councillor listed.");
  });
  it("keeps a local group's own name", () => {
    expect(
      seatsFact(
        "Merthyr Tydfil",
        [
          { partyId: "lab", label: null, seats: 15 },
          { partyId: "ind", label: null, seats: 13 },
          { partyId: null, label: "Dowlais and Pant Community Independents", seats: 2 },
        ],
        30,
      ),
    ).toBe("Merthyr Tydfil Council has 30 seats. By party or group: Labour 15, Independent 13, Dowlais and Pant Community Independents 2.");
  });
  it("says so when the council's list gives no parties", () => {
    expect(seatsFact("Wrexham", [{ partyId: null, label: "No party recorded", seats: 56 }], 56)).toBe(
      "Wrexham Council lists 56 councillors. Its list gives no party for them.",
    );
  });
});
