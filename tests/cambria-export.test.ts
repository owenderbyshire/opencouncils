import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../drizzle/0011_cambria_export_v1.sql", import.meta.url), "utf8");
const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));

describe("the OpenEconomy export (cambria_v1)", () => {
  it("publishes planning applications as a view, not the table", () => {
    expect(sql).toMatch(/CREATE (OR REPLACE )?VIEW cambria_v1\.planning_applications AS/);
    expect(sql).not.toMatch(/GRANT[^;]*public\./);
  });
  it("grants only the export schema, and only to OpenEconomy's login", () => {
    const grants = sql.match(/GRANT [^;]+;/g) ?? [];
    expect(grants.length).toBeGreaterThan(0);
    for (const g of grants) expect(g).toMatch(/cambria_v1 TO cambria_reader/);
  });
  it("leaves out alert subscribers and their email addresses", () => {
    expect(sql).not.toMatch(/subscribers|alert_log|email/i);
  });
  it("is in the migration journal", () => {
    expect(journal.entries.map((e: { tag: string }) => e.tag)).toContain("0011_cambria_export_v1");
  });
});
