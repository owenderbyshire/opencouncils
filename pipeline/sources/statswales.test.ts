import { describe, expect, it } from "vitest";
import { labelsOnly, readFilters } from "./statswales";

describe("readFilters", () => {
  it("collects each column's codes and labels, including nested values", () => {
    const cols = readFilters([
      {
        factTableColumn: "AreaCode",
        columnName: "Area",
        values: [{ reference: "W92000004", description: "Wales", children: [{ reference: "W06000015", description: "Cardiff" }] }],
      },
    ]);
    expect(cols[0].key).toBe("AreaCode");
    expect(cols[0].names).toContain("Area");
    expect(cols[0].values.get("W06000015")).toBe("Cardiff");
    expect(cols[0].values.get("W92000004")).toBe("Wales");
  });
});

describe("labelsOnly", () => {
  it("keeps the labels and the value, and drops reference codes, sort keys and hierarchy", () => {
    expect(
      labelsOnly({
        Area: "Wales",
        Area_reference: "596",
        Area_hierarchy: "",
        Year: "2025-26",
        Year_sort: "1774915199000",
        "Data values": "2040",
        "Data values_sort": "2040",
        Notes: "",
      }),
    ).toEqual({ Area: "Wales", Year: "2025-26", "Data values": "2040", Notes: "" });
  });
});
