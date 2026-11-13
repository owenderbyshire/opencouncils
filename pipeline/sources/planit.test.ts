import { describe, expect, it } from "vitest";
import { matchAreas, toApplication } from "./planit";
import { planningAuthority } from "../../data/curated/planning-authorities";

describe("planit", () => {
  it("matches authorities by PlanIt's number, whatever the name", () => {
    const m = matchAreas([
      { area_id: 408, area_name: "Neath", long_name: "Neath & Port Talbot County Borough Council", area_type: "Welsh Principal Area" },
      { area_id: 417, area_name: "Newport", long_name: "Newport City Council", area_type: "Welsh Principal Area" },
    ]);
    expect(m.get("neath-port-talbot")?.area_id).toBe(408);
    expect(m.get("newport")?.area_id).toBe(417);
    expect(m.has("cardiff")).toBe(false);
  });
  it("reads a record, keeping only places in Wales", () => {
    const a = toApplication(planningAuthority("cardiff")!, {
      name: "Cardiff/26/01234/FUL",
      uid: "26/01234/FUL",
      start_date: "2026-10-20",
      app_state: "Undecided",
      location_x: -3.17,
      location_y: 51.48,
      other_fields: { n_dwellings: 3, comment_url: "https://example.org/c" },
    });
    expect(a).toMatchObject({ reference: "26/01234/FUL", startDate: "2026-10-20", homes: 3, lat: 51.48, commentUrl: "https://example.org/c" });
    expect(toApplication(planningAuthority("cardiff")!, { name: "x", location_x: 0.1, location_y: 51.5 })?.lng).toBeNull();
  });
});
