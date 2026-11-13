import { describe, expect, it } from "vitest";
import { parseFigure } from "@/lib/council-papers";

describe("parseFigure", () => {
  it("reads pounds as councils write them", () => {
    expect(parseFigure("£12.3m")).toEqual({ value: 12_300_000, unit: "gbp" });
    expect(parseFigure("£12.3 million")).toEqual({ value: 12_300_000, unit: "gbp" });
    expect(parseFigure("£1,234,567")).toEqual({ value: 1_234_567, unit: "gbp" });
    expect(parseFigure("£45k")).toEqual({ value: 45_000, unit: "gbp" });
    expect(parseFigure("£0.85bn")).toEqual({ value: 850_000_000, unit: "gbp" });
    expect(parseFigure("(£2.1m)")).toEqual({ value: 2_100_000, unit: "gbp" });
    expect(parseFigure("£ 750,000")).toEqual({ value: 750_000, unit: "gbp" });
  });

  it("reads percentages", () => {
    expect(parseFigure("4.5%")).toEqual({ value: 4.5, unit: "pct" });
    expect(parseFigure("9.5 per cent")).toEqual({ value: 9.5, unit: "pct" });
  });

  it("refuses anything else", () => {
    expect(parseFigure("about twelve million")).toBeNull();
    expect(parseFigure("12.3m")).toBeNull();
    expect(parseFigure("£12.3 squillion")).toBeNull();
    expect(parseFigure("£1,23,456")).toBeNull();
  });
});

describe("parseScaled", async () => {
  const { parseScaled } = await import("../pipeline/jobs/council-papers");
  it("scales bare figures from £000 and £m tables", () => {
    expect(parseScaled("462,817", "thousands")).toEqual({ value: 462_817_000, unit: "gbp" });
    expect(parseScaled("(1,204)", "thousands")).toEqual({ value: 1_204_000, unit: "gbp" });
    expect(parseScaled("12.3", "millions")).toEqual({ value: 12_300_000, unit: "gbp" });
    expect(parseScaled("£12.3", "millions")).toBeNull();
    expect(parseScaled("about 12", "millions")).toBeNull();
  });
});

describe("labelBefore", async () => {
  const { labelBefore } = await import("../pipeline/jobs/council-papers");
  it("ties a bare table figure to its row", () => {
    expect(labelBefore("Council Tax 127.769 SSA / Budget Requirement 421.860 Use of Reserves", "421.860", "budget|requirement")).toBe(true);
    expect(labelBefore("Social Services 115.918 120.987 5.070 Out of County", "5.070", "Social Services")).toBe(true);
    expect(labelBefore("2026/27 budget savings DRAFT BASE BUDGET 2026/27 4,253 400 (5,319) 462,817", "(5,319)", "saving|savings")).toBe(false);
  });
});
