import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOds } from "./ods";

describe("parseOds", () => {
  it("reads sheets, rows and repeated cells", () => {
    const sheets = parseOds(new Uint8Array(readFileSync(new URL("../fixtures/ods/tiny.ods", import.meta.url))));
    expect(sheets[0].name).toBe("Table 1");
    expect(sheets[0].rows).toEqual([["Authority", "", "", "42"], ["Cardiff", "1,234"]]);
  });
});
