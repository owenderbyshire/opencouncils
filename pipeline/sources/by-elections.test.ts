import { describe, expect, it } from "vitest";
import { archiveDate, councilIdForArchive, parseByElections } from "./by-elections";

describe("by-elections archive", () => {
  it("reads dates and council names", () => {
    expect(archiveDate("18 Mar 26")).toBe("2026-03-18");
    expect(archiveDate("6 Feb 26")).toBe("2026-02-06");
    expect(archiveDate("Date")).toBeNull();
    expect(councilIdForArchive("Isle of Anglesey")).toBe("anglesey");
    expect(councilIdForArchive("Vale of Glamorgan")).toBe("vale-of-glamorgan");
    expect(councilIdForArchive("Rhondda Cynon Taf")).toBe("rhondda-cynon-taf");
    expect(councilIdForArchive("Neath Port Talbot")).toBe("neath-port-talbot");
    expect(councilIdForArchive("Kent")).toBeNull();
  });

  it("keeps the Welsh rows of a table", () => {
    const html = `<table><tr><th>Date</th><th>Council</th><th>Ward</th><th>From</th><th>To</th></tr>
      <tr><td>18 Mar 26</td><td>Pembrokeshire</td><td>Milford: Hakin</td><td>Independent / Other</td><td>Reform UK</td></tr>
      <tr><td>17 Mar 26</td><td>Kent</td><td>Somewhere</td><td>Labour Party</td><td>Reform UK</td></tr>
      <tr><td>26 Jul 25</td><td>Cardiff</td><td>Llanrumney</td><td>Labour Party</td><td>Labour Party</td></tr></table>`;
    expect(parseByElections(html, "src")).toEqual([
      { date: "2026-03-18", councilId: "pembrokeshire", ward: "Milford: Hakin", from: "Independent / Other", to: "Reform UK", fromParty: null, toParty: "reform", source: "src" },
      { date: "2025-07-26", councilId: "cardiff", ward: "Llanrumney", from: "Labour Party", to: "Labour Party", fromParty: "lab", toParty: "lab", source: "src" },
    ]);
  });
});
