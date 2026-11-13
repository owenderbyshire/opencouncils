import { describe, expect, it } from "vitest";
import { durationDays, leagueExclusion, leagueWindow, median, planningStatus } from "./planning-status";

describe("planning status", () => {
  it("calls an approval a decision only when the register shows one", () => {
    expect(planningStatus({ appState: "Permitted", decidedDate: "2026-09-01", decision: null })).toBe("approved");
    expect(planningStatus({ appState: "Conditions", decidedDate: null, decision: "Granted" })).toBe("approved");
    // Eryri: "Permitted" with no date and no decision text.
    expect(planningStatus({ appState: "Permitted", decidedDate: null, decision: null })).toBe("unknown");
    expect(planningStatus({ appState: "Rejected", decidedDate: "2026-09-01", decision: null })).toBe("refused");
  });
  it("keeps waiting, withdrawn, referred and unclear apart", () => {
    expect(planningStatus({ appState: "Undecided", decidedDate: null, decision: null })).toBe("waiting");
    expect(planningStatus({ appState: "Unresolved", decidedDate: null, decision: null })).toBe("unknown");
    expect(planningStatus({ appState: null, decidedDate: null, decision: null })).toBe("unknown");
    expect(planningStatus({ appState: "Withdrawn", decidedDate: "2026-09-01", decision: null })).toBe("withdrawn");
    expect(planningStatus({ appState: "Referred", decidedDate: null, decision: null })).toBe("referred");
    expect(planningStatus({ appState: "Undecided", decidedDate: "2026-09-01", decision: null })).toBe("decided");
  });
});

describe("league measures", () => {
  it("drops negative durations", () => {
    expect(durationDays("2026-05-01", "2026-04-30")).toBeNull();
    expect(durationDays("2026-05-01", "2026-06-26")).toBe(56);
  });
  it("takes a median of decided applications only", () => {
    expect(median([])).toBeNull();
    expect(median([10, 30, 20])).toBe(20);
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it("starts the window at collection and ends it three months ago", () => {
    expect(leagueWindow("2026-04-20", "2026-10-27")).toEqual({ from: "2026-04-20", to: "2026-07-28", days: 100 });
    expect(leagueWindow(null, "2026-10-27")).toBeNull();
  });
  it("says why an authority's figures aren't shown", () => {
    const ok = { received: 200, stale: false, windowDays: 100, decided: 140, settled: 150 };
    expect(leagueExclusion(ok)).toBeNull();
    expect(leagueExclusion({ ...ok, received: null })).toBe("noData");
    expect(leagueExclusion({ ...ok, stale: true })).toBe("stale");
    expect(leagueExclusion({ ...ok, windowDays: 40 })).toBe("short");
    expect(leagueExclusion({ ...ok, decided: 20 })).toBe("fewDecided");
    expect(leagueExclusion({ ...ok, decided: 60, settled: 150 })).toBe("datesMissing");
    expect(leagueExclusion({ ...ok, decided: 41, settled: 60 })).toBe("datesMissing");
    expect(leagueExclusion({ ...ok, decided: 175, settled: 198 })).toBeNull();
  });
});
