import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lastResultsPage, registerApplication, registerDate, resultReferences } from "./planning-register";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/planning-register", name), "utf8");

describe("planning-register system (Bridgend, Vale of Glamorgan)", () => {
  it("reads dates", () => {
    expect(registerDate("18/09/2026")).toBe("2026-09-18");
    expect(registerDate("1/2/2026")).toBe("2026-02-01");
    expect(registerDate("N/A")).toBeNull();
  });

  it("lists the references on a results page and the pages there are", () => {
    const vale = fixture("vale-results.html");
    expect(resultReferences(vale)).toHaveLength(10);
    expect(resultReferences(vale)[0]).toBe("2025/01276/FUL");
    expect(resultReferences(vale)).toContain("2022/00294/23/CD");
    expect(lastResultsPage(vale)).toBe(3);
    const bridgend = fixture("bridgend-results.html");
    expect(resultReferences(bridgend)[0]).toBe("P/26/433/LAP");
    expect(lastResultsPage(bridgend)).toBe(2);
  });

  it("reads a Vale application", () => {
    expect(registerApplication("2026/00715/FUL", fixture("vale-detail.html"))).toEqual({
      reference: "2026/00715/FUL",
      address: "1 St Davids Avenue, Dinas Powys",
      proposal: "Demolition of garage and garden wall, erection of a single storey mono pitch side extension.",
      status: "Awaiting Consultation Responses",
      decision: null,
      appType: "Full Planning Application",
      received: "2026-09-18",
      valid: "2026-10-30",
      target: "2026-12-25",
      decided: null,
      lastComment: "2026-11-24",
      level: "Delegated",
      ward: "Dinas Powys",
    });
  });

  it("reads a Bridgend application", () => {
    expect(registerApplication("P/26/548/FUL", fixture("bridgend-detail.html"))).toMatchObject({
      reference: "P/26/548/FUL",
      address: "7 Caerau Road Caerau Maesteg CF34 0PB",
      status: "Under consideration",
      decision: null,
      appType: "Full Planning Application",
      received: "2026-10-02",
      valid: "2026-10-29",
      target: "2026-12-24",
      decided: null,
    });
  });
});
