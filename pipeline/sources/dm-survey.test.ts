import { describe, expect, it } from "vitest";
import { odsLink, parseSurvey, quarterRange, releaseLinks, surveyAuthority } from "./dm-survey";

describe("development management survey", () => {
  it("knows the financial-year quarters", () => {
    expect(quarterRange("2025-26", "Q1")).toEqual({ start: "2025-04-01", end: "2025-06-30" });
    expect(quarterRange("2025-26", "Q3")).toEqual({ start: "2025-10-01", end: "2025-12-31" });
    expect(quarterRange("2025-26", "Q4")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });
  it("maps the survey's names", () => {
    expect(surveyAuthority("Pembrokeshire Coast NPA")).toBe("pembrokeshire-coast");
    expect(surveyAuthority("Pembrokeshire CC")).toBe("pembrokeshire");
    expect(surveyAuthority("Brecon Beacons NPA")).toBe("bannau-brycheiniog");
    expect(surveyAuthority("Rhondda Cynon Taff CBC")).toBe("rhondda-cynon-taf");
  });
  it("reads the Data sheet, leaving out pre-application cases and missing figures", () => {
    const rows = [
      ["Authority", "Quarter", "Year", "RecdMajDw", "RecdPreapp", "RecdTot"],
      ["Cardiff CC", "Q4", "2025-26", "6", "10", "800"],
      ["Denbighshire CC", "Q4", "2025-26", "-", "-", "-"],
    ];
    expect(parseSurvey([{ name: "Data", rows }])).toEqual([
      { authority: "cardiff", quarter: "2025-26 Q4", start: "2026-01-01", end: "2026-03-31", received: 790 },
    ]);
  });
  it("finds release pages and the spreadsheet", () => {
    expect(releaseLinks('<a href="/development-management-quarterly-survey-january-march-2026">x</a>')).toEqual([
      "https://www.gov.wales/development-management-quarterly-survey-january-march-2026",
    ]);
    expect(odsLink('<a href="/sites/default/files/publications/2026-07/dm.ods">ODS</a>')).toBe("https://www.gov.wales/sites/default/files/publications/2026-07/dm.ods");
  });
});
