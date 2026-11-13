import { describe, expect, it } from "vitest";
import { measureProblems, periodStartYear } from "./checks";

describe("figure checks", () => {
  it("reads the start year of a period", () => {
    expect(periodStartYear("2025-26")).toBe(2025);
    expect(periodStartYear("2026-10-01")).toBe(2026);
    expect(periodStartYear("Q3")).toBeNull();
  });
  it("passes figures inside their range", () => {
    expect(measureProblems("x", "percent", { cardiff: [{ period: "2025-26", value: 87.5 }] }, "2026-11-02")).toEqual([]);
    expect(measureProblems("x", "share", { cardiff: [{ period: "2025-26", value: 0.4 }] }, "2026-11-02")).toEqual([]);
    expect(measureProblems("x", "money", { cardiff: [{ period: "2025-26", value: -4000 }] }, "2026-11-02")).toEqual([]);
  });
  it("flags shares outside 0 to 100, negative counts and future periods", () => {
    expect(measureProblems("x", "percent", { cardiff: [{ period: "2025-26", value: 104 }] }, "2026-11-02")).toHaveLength(1);
    expect(measureProblems("x", "share", { cardiff: [{ period: "2025-26", value: 40 }] }, "2026-11-02")).toHaveLength(1);
    expect(measureProblems("x", "count", { cardiff: [{ period: "2025-26", value: -1 }] }, "2026-11-02")).toHaveLength(1);
    expect(measureProblems("x", "count", { cardiff: [{ period: "2027-28", value: 5 }] }, "2026-11-02")).toHaveLength(1);
    expect(measureProblems("x", "count", { cardiff: [{ period: "2026-12-01", value: 5 }] }, "2026-11-02")).toHaveLength(1);
  });
});
