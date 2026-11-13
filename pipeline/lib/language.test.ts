import { describe, expect, it } from "vitest";
import { languageOf, rightWayRound } from "./language";

describe("language check", () => {
  it("tells Welsh from English", () => {
    expect(languageOf("Prynu Medallion House, Heol Crwys, Cathays, ar gyfer tai cymdeithasol")).toBe("cy");
    expect(languageOf("Buying Medallion House, Crwys Road, Cathays, for social housing")).toBe("en");
    expect(languageOf("Annual Property Plan 2026/27")).not.toBe("cy");
    expect(languageOf("Cabinet approved the 2026/27 Annual Property Plan.")).toBe("en");
    expect(languageOf("Cymeradwyodd y Cabinet Gynllun Eiddo Blynyddol 2026/27.")).toBe("cy");
  });
  it("swaps fields written the wrong way round", () => {
    const r = rightWayRound("Prynu Medallion House, Heol Crwys, Cathays, ar gyfer tai cymdeithasol", "Buying Medallion House, Crwys Road, Cathays, for social housing");
    expect(r.swapped).toBe(true);
    expect(r.en).toMatch(/^Buying/);
    expect(rightWayRound("Annual Property Plan 2026/27", "Cynllun Eiddo Blynyddol 2026/27").swapped).toBe(false);
  });
});
