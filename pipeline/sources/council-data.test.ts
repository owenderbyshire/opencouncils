import { describe, expect, it } from "vitest";
import { bandD, financialYear, spend, tidy } from "./council-data";

const row = (value: string, ...cols: string[]) =>
  Object.fromEntries([["Data values", value], ...cols.map((c, i) => [`c${i}`, c])]);

describe("financialYear", () => {
  it("reads the forms StatsWales uses", () => {
    expect(financialYear("2026-27")).toBe("2026-27");
    expect(financialYear("202627")).toBe("2026-27");
    expect(financialYear("2026/2027")).toBe("2026-27");
    expect(financialYear("1999-00")).toBe("1999-00");
    expect(financialYear("2026-28")).toBeNull();
    expect(financialYear("Cardiff")).toBeNull();
  });
});

describe("tidy", () => {
  it("finds the area, year and value whatever the column order", () => {
    const [t] = tidy([row("2,013.5", "£ per band D", "Total CT for billing authority area", "2026-27", "Cardiff")]);
    expect(t.area).toBe("cardiff");
    expect(t.year).toBe("2026-27");
    expect(t.value).toBe(2013.5);
    expect(t.labels.has("total ct for billing authority area")).toBe(true);
  });
  it("ignores the reference, sort and hierarchy columns of StatsWales's raw_extended view", () => {
    // A row as the direct StatsWales read kept it: the value's sort key, before the year, looks like a year.
    const raw = {
      "Data values_sort": "2081",
      Area_hierarchy: "Wales",
      Area: "Conwy",
      Area_reference: "1994",
      Year: "2025-26",
      Year_reference: "202526",
      Year_sort: "2060",
      Measure: "Arrears of council tax",
      "Data values": "2081",
    };
    const [t] = tidy([raw]);
    expect(t.area).toBe("conwy");
    expect(t.year).toBe("2025-26");
    expect(t.value).toBe(2081);
    expect([...t.labels]).toEqual(["arrears of council tax"]);
  });
  it("keeps the councils' total apart from Wales, and skips rows without a value or a known area", () => {
    const rows = tidy([
      row("1800", "£ per band D", "Total CT for billing authority area", "2026-27", "Total Unitary Authorities"),
      row("", "£ per band D", "Total CT for billing authority area", "2026-27", "Cardiff"),
      row("400", "£ per band D", "Total CT for billing authority area", "2026-27", "Gwent Police"),
    ]);
    expect(rows.map((r) => r.area)).toEqual(["wales-councils"]);
  });
});

describe("figures", () => {
  it("builds band D by year from its parts", () => {
    const rows = tidy([
      row("2013", "£ per band D", "Total CT for billing authority area", "2026-27", "Cardiff"),
      row("1600", "£ per band D", "County council CT (exc. community councils)", "2026-27", "Cardiff"),
      row("5.1", "Percentage change", "Total CT for billing authority area", "2026-27", "Cardiff"),
      row("1900", "£ per band D", "Total CT for billing authority area", "2025-26", "Cardiff"),
    ]);
    expect(bandD(rows).get("cardiff")).toEqual([
      { year: "2025-26", total: 1900, county: null, community: null, police: null },
      { year: "2026-27", total: 2013, county: 1600, community: null, police: null },
    ]);
  });
  it("takes the latest year's service groups only", () => {
    const rows = tidy([
      row("900", "£ per head", "2026-27", "Cardiff", "Education"),
      row("300000", "£ thousand", "2026-27", "Cardiff", "Education"),
      row("50", "£ per head", "2026-27", "Cardiff", "Home to school transport"),
      row("800", "£ per head", "2025-26", "Cardiff", "Education"),
    ]);
    expect(spend(rows).get("cardiff")).toEqual({
      year: "2026-27",
      groups: [{ key: "education", perHead: 900, thousands: 300000 }],
    });
  });
});

import { period } from "./council-data";
describe("period", () => {
  it("reads dates and months", () => {
    expect(period("2026-06-30")).toBe("2026-06-30");
    expect(period("June 2026")).toBe("2026-06");
    expect(period("31 March 2025")).toBe("2025-03-31");
    expect(period("2024")).toBe("2024");
    expect(period("31/07/2026")).toBe("2026-07-31");
    expect(period("Cardiff")).toBeNull();
  });
});
