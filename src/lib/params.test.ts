import { describe, expect, it } from "vitest";
import { isCalendarDate, pageParam, param, searchText, withoutControls } from "./params";

describe("param", () => {
  it("turns control characters into spaces, so a NUL byte never reaches Postgres", () => {
    expect(param({ q: "school\u0000closure" }, "q")).toBe("school closure");
    expect(withoutControls("a\tb\nc\u007f")).toBe("a b c ");
    expect(withoutControls("a\u0085b\u009fc")).toBe("a b c");
    expect(withoutControls("Ynys Môn, ‘tai’, 20mph")).toBe("Ynys Môn, ‘tai’, 20mph");
  });
  it("drops missing, empty and over-long values", () => {
    expect(param({}, "q")).toBeUndefined();
    expect(param({ q: "" }, "q")).toBeUndefined();
    expect(param({ q: "x".repeat(201) }, "q")).toBeUndefined();
    expect(param({ q: ["first", "second"] }, "q")).toBe("first");
  });
  it("falls back to page 1 for odd page numbers", () => {
    expect(pageParam({ page: "-3" })).toBe(1);
    expect(pageParam({ page: "abc" })).toBe(1);
    expect(pageParam({ page: "4" })).toBe(4);
  });
});

describe("searchText", () => {
  it("cleans what was typed into something safe to search with", () => {
    expect(searchText(`'"<script>%\u0000`)).toBe(`'"<script>%`);
    expect(searchText("  school\tclosure \n")).toBe("school closure");
    expect(searchText("Môn")).toBe("Môn");
  });
  it("leaves nothing to search for when only control characters and spaces were typed", () => {
    expect(searchText("\u0000")).toBe("");
    expect(searchText("\u0000 \t\u0000")).toBe("");
    expect(searchText(undefined)).toBe("");
    expect(searchText(null)).toBe("");
  });
  it("cuts to 120 characters, or the length given", () => {
    expect(searchText("a".repeat(300))).toHaveLength(120);
    expect(searchText("ab cd", 3)).toBe("ab");
  });
});

describe("isCalendarDate", () => {
  it("accepts real dates", () => {
    expect(isCalendarDate("2026-11-09")).toBe(true);
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("0001-01-01")).toBe(true);
  });
  it("refuses dates that don't exist or aren't YYYY-MM-DD", () => {
    expect(isCalendarDate("2026-02-31")).toBe(false);
    expect(isCalendarDate("2026-13-45")).toBe(false);
    expect(isCalendarDate("2025-02-29")).toBe(false);
    expect(isCalendarDate("2026-2-3")).toBe(false);
    expect(isCalendarDate("abc")).toBe(false);
    expect(isCalendarDate("")).toBe(false);
  });
  it("refuses year 0, which JavaScript accepts and Postgres doesn't", () => {
    expect(isCalendarDate("0000-01-01")).toBe(false);
    expect(isCalendarDate("0000-12-31")).toBe(false);
  });
});
