import { describe, expect, it } from "vitest";
import { jsPattern, pgPattern, snippet } from "./alerts";

describe("alert matching", () => {
  it("matches whole words, any case and spacing", () => {
    const re = jsPattern("Heol y Coed");
    expect(re.test("works on heol  y coed, Rhiwbina")).toBe(true);
    expect(re.test("Heol y Coedwig")).toBe(false);
    expect(jsPattern("20mph").test("the 20mph limit")).toBe(true);
  });
  it("escapes regular expression characters", () => {
    expect(pgPattern("A48(M)")).toBe("(^|[^[:alnum:]_])A48\\(M\\)([^[:alnum:]_]|$)");
    expect(jsPattern("a+b").test("a+b")).toBe(true);
  });
  it("picks out the text around a match", () => {
    const text = `${"word ".repeat(60)}the closure of Ysgol Gymraeg Bro Eirwg was approved ${"word ".repeat(60)}`;
    const s = snippet(text, jsPattern("Bro Eirwg"))!;
    expect(s).toContain("Ysgol Gymraeg Bro Eirwg");
    expect(s.startsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(240);
  });
});
