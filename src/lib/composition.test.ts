import { describe, expect, it } from "vitest";
import { leadOf } from "./composition";

describe("leadOf", () => {
  it("finds a majority, a largest party without one, and ties", () => {
    const p = (partyId: string | null, seats: number, label = partyId ?? "Local group") => ({ label, partyId, seats });
    expect(leadOf({ seats: 10, parties: [p("lab", 6), p("con", 4)] })).toEqual({ partyId: "lab", seats: 6, majority: true });
    expect(leadOf({ seats: 10, parties: [p("lab", 5), p("con", 4), p(null, 1)] })).toEqual({ partyId: "lab", seats: 5, majority: false });
    // Independents and local groups count together.
    expect(leadOf({ seats: 10, parties: [p("ind", 3), p(null, 3), p("con", 4)] })).toEqual({ partyId: "other", seats: 6, majority: true });
    expect(leadOf({ seats: 10, parties: [p("lab", 5), p("con", 5)] })).toBeNull();
  });
});
