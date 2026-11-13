import { describe, expect, it } from "vitest";
import { tidy } from "../sources/council-data";
import { series } from "./performance";

const row = (value: string, ...cols: string[]) => Object.fromEntries([["Data values", value], ...cols.map((c, i) => [`c${i}`, c])]);

describe("performance series", () => {
  it("takes the total when a count is broken down", () => {
    const rows = tidy([
      row("84", "Isle of Anglesey", "31/07/2026", "Total number of homeless people temporarily accommodated", "Total"),
      row("30", "Isle of Anglesey", "31/07/2026", "Total number of homeless people temporarily accommodated", "Hostels"),
      row("80", "Isle of Anglesey", "30/06/2026", "Total number of homeless people temporarily accommodated", "Total"),
    ]);
    expect(series(rows, ["total number of homeless people temporarily accommodated", "total"], "count", 25).get("anglesey")).toEqual([
      { period: "2026-06-30", value: 80 },
      { period: "2026-07-31", value: 84 },
    ]);
  });
  it("reads a percentage for one outcome", () => {
    const rows = tidy([
      row("61", "Percentage (%)", "Wales", "2025-26", "Successful prevention - X (Section 66)"),
      row("7662", "Number", "Wales", "2025-26", "Successful prevention - X (Section 66)"),
    ]);
    expect(series(rows, ["percentage (%)", "successful prevention - x (section 66)"], "percent", 12).get("wales")).toEqual([
      { period: "2025-26", value: 61 },
    ]);
  });
});
