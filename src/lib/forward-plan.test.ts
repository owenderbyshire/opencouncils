import { describe, expect, it } from "vitest";
import { isExecutiveMaker } from "./forward-plan";

/* Decision makers as Swansea, Carmarthenshire, Conwy and Gwynedd publish them. */
describe("whether a decision is the Cabinet's", () => {
  it.each([
    "Cabinet",
    "The Cabinet",
    "Executive",
    "Executive Board",
    "Council, Economy and Place Overview and Scrutiny Committee, Cabinet",
    "Finance and Resources Overview and Scrutiny Committee, Cabinet, Council",
    "Cabinet, Social Care and Health Overview and Scrutiny Committee",
    "Cabinet Member for Education",
    "Individual Cabinet Member Decisions",
    "Cabinet Member - Leader",
    "Leader",
    "Deputy Leader",
    "Portfolio Holder for Finance",
  ])("%s", (makers) => expect(isExecutiveMaker(makers)).toBe(true));

  it.each([
    "Council",
    "Governance and Audit Committee",
    "Education and Skills Overview and Scrutiny Committee",
    "Members' Brief",
    "Welsh Language Cabinet Sub Committee",
    "Cabinet Trust Committee",
    "Joint Meeting of the Education and Skills and Social Care and Health Overview and Scrutiny Committee",
    "Shadow Cabinet Member for Finance",
    "Democratic Services Committee",
    "",
  ])("not the Cabinet's: %s", (makers) => expect(isExecutiveMaker(makers)).toBe(false));

  it("copes with nothing", () => {
    expect(isExecutiveMaker(null)).toBe(false);
    expect(isExecutiveMaker(undefined)).toBe(false);
  });
});
