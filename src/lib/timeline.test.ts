import { describe, expect, it } from "vitest";
import { countStep, timelineMonths, yearLabelled } from "./timeline";

describe("timelineMonths", () => {
  it("ends with this month and crosses the year", () => {
    const m = timelineMonths("2026-02-10");
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-03");
    expect(m[11]).toBe("2026-02");
  });
});

describe("countStep", () => {
  it("maps counts to fixed steps", () => {
    expect([0, 1, 2, 3, 4, 5, 40].map(countStep)).toEqual([0, 1, 2, 2, 3, 3, 3]);
  });
});

describe("yearLabelled", () => {
  it("labels January, and the first month only when January is not close", () => {
    expect(yearLabelled(["2025-12", "2026-01", "2026-02"])).toEqual([false, true, false]);
    expect(yearLabelled(["2025-08", "2025-09", "2025-10", "2025-11", "2025-12", "2026-01"])).toEqual([true, false, false, false, false, true]);
    expect(yearLabelled(["2026-02", "2026-03", "2026-04"])).toEqual([true, false, false]);
  });
});
