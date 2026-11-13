import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { valeId } from "../jobs/vale";
import { parseValeCabinet } from "./vale-cabinet";

/* The Vale of Glamorgan's Cabinet page as it was on 11 November 2026. */
const page = readFileSync(path.join(import.meta.dirname, "../fixtures/vale/cabinet.html"), "utf8");

describe("the Vale of Glamorgan's Cabinet page", () => {
  const rows = parseValeCabinet(page)!;

  it("reads each portfolio and its holder", () => {
    expect(rows.map((r) => [r.title, r.holderName])).toEqual([
      ["Executive Leader and Cabinet Member for Performance and Resources", "Lis Burnett"],
      ["Deputy Leader and Cabinet Member for Sustainable Places", "Bronwen Brooks"],
      ["Education, Arts and the Welsh Language", "Rhiannon Birch"],
      ["Neighbourhood and Building Services", "Mark Wilson"],
      ["Public Sector Housing and Tenant Engagement", "Sandra Perkes"],
      ["Social Care and Health", "Edward Williams"],
      ["Community Engagement, Equalities and Regulatory Services", "Ruba Sivagnanam"],
      ["Leisure, Sport and Wellbeing", "Gwyn John"],
    ]);
  });

  it("ignores the empty links to earlier holders that the page still carries", () => {
    // The first row has an empty link titled "Moore, Neil" pointing at another councillor's page.
    expect(rows.map((r) => r.holderUrl).join(" ")).not.toMatch(/Champion-Charles|Wilkinson-Margaret/);
    expect(rows[0].holderUrl).toBe("https://www.valeofglamorgan.gov.uk/en/our_council/Council-Structure/councillors/Burnett-Lis.aspx");
  });

  it("gives each holder the address the councillors list knows them by", () => {
    // The Vale's councillors are numbered from the address of their own page (pipeline/jobs/vale.ts).
    for (const r of rows) expect(valeId(r.holderUrl)).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.postId)).size).toBe(8);
  });

  it("takes nothing from a page without the table, or with a row it can't read", () => {
    expect(parseValeCabinet("<html><body><table><tr><th>Name</th></tr></table></body></html>")).toBeNull();
    expect(parseValeCabinet(page.replace(/Councillor Lis Burnett/, "&nbsp;"))).toBeNull();
  });
});
