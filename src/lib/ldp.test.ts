import { describe, expect, it } from "vitest";
import { mergeSameSites, shownFact } from "./ldp";

describe("shownFact", () => {
  const f = (value: number, mentions: number) => ({ kind: "adopted", key: "employment-land", value, mentions });
  it("prefers the better-supported figure", () => {
    expect(shownFact([f(23, 1), f(134, 2)], "adopted", "employment-land")?.value).toBe(134);
  });
  it("shows nothing when documents disagree equally", () => {
    expect(shownFact([f(23, 1), f(134, 1)], "adopted", "employment-land")).toBeUndefined();
  });
});

describe("mergeSameSites", () => {
  const s = (ref: string | null, name: string, hectares: number | null, page = 10) => ({ kind: "adopted", ref, name, homes: null, hectares, page });
  it("merges by first reference or name, keeping different sites apart", () => {
    const out = mergeSameSites([
      s("MG9 (2)", "Land adjacent to Cardiff Airport and Port Road", 77.4),
      s("MG9 (2), MG10, SP2 (3)", "Land adjacent to Cardiff Airport and Port Road, Rhoose", 77.4, 20),
      s("MG9 (1)", "Land to the South of Junction 34 M4 Hensol", 55.2),
      s("MG9(1), MG11", "Land to the South of Junction 34 M4 Hensol", 55.2),
      s("MG10", "Land surrounding Cardiff Airport", 77.4),
      s("MG9 (3)", "Aerospace Business Park, St Athan", 305),
    ]);
    expect(out.map((x) => x.ref)).toEqual(["MG9 (2)", "MG9 (1)", "MG10", "MG9 (3)"]);
  });
});
