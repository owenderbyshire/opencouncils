import { describe, expect, it } from "vitest";
import { fixWelsh } from "./welsh-fixes";

describe("Welsh fixes", () => {
  it("corrects the slips seen in summaries", () => {
    expect(fixWelsh("Cymeradwyodd tair cais a estyniad i'r sefsefyllfa.")).toEqual({
      text: "Cymeradwyodd tri chais ac estyniad i'r sefyllfa.",
      fixed: 3,
    });
    expect(fixWelsh("Tair cais. Dwy gais. Cymeradwyodd dair cais a ddwy gais.").text).toBe("Tri chais. Dau gais. Cymeradwyodd dri chais a ddau gais.");
  });
  it("leaves correct Welsh alone", () => {
    const ok = "Cymeradwyodd y pwyllgor dri chais ac estyniad. Mae'r sefyllfa'n glir. Roedd tair ysgol a dwy apêl.";
    expect(fixWelsh(ok)).toEqual({ text: ok, fixed: 0 });
  });
});
