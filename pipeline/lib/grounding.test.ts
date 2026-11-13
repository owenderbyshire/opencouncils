import { describe, expect, it } from "vitest";
import { grounded, groundedPair, prepareSource, sentences, withStandAloneOpening } from "./grounding";

const src = prepareSource("The Cabinet approved a budget of £2,523,285 and a 4.9 per cent rise. Councillor Jane Smith moved the motion. Three members voted against.");

describe("grounding", () => {
  it("keeps sentences whose numbers and names are in the papers", () => {
    expect(grounded("The Cabinet approved £2,523,285. Jane Smith moved it. Three voted against, or 3 in all.", src, true).removed).toBe(0);
  });
  it("removes sentences with numbers or names that aren't", () => {
    const r = grounded("The Cabinet approved the budget. It cost £3 million. James Gibson-Watt spoke.", src, true);
    expect(r.text).toBe("The Cabinet approved the budget.");
    expect(r.removed).toBe(2);
  });
  it("checks only numbers when names can't be checked", () => {
    expect(grounded("Cymeradwyodd y Cabinet Gyllideb Newydd o 4.9 y cant.", src, false).removed).toBe(0);
  });
});

/** The papers of a Cardiff Planning Committee meeting, cut down. */
const planning = prepareSource(`Meeting: Planning Committee, Cardiff Council, 2026-10-07

Item 4: 4 Applications
Minute:
RESOLVED - that applications 25/01234/FUL, 25/01300/FUL and 25/01455/HSE be approved subject to conditions.
Item 7: 7 Work Programme
Minute:
RESOLVED - that the work programme for 2026/27 be agreed.`);

describe("grounding: sentence openings", () => {
  it("keeps a first sentence that starts with a capitalised word before the committee's name", () => {
    const en = "The Planning Committee approved three planning applications, subject to conditions. It also agreed its work programme for 2026/27.";
    expect(grounded(en, planning, true)).toEqual({ text: en, removed: 0 });
  });
  it("treats the council's own bodies and posts as needing no support", () => {
    for (const s of ["Full Council agreed the budget.", "The Cabinet Member for Housing spoke.", "On Monday the Overview and Scrutiny Committee met."])
      expect(grounded(s, planning, true).removed, s).toBe(0);
  });
  it("checks each side of a possessive on its own", () => {
    expect(grounded("Cardiff Council's Planning Committee approved three applications.", planning, true).removed).toBe(0);
    expect(grounded("Newport Council's Planning Committee approved three applications.", planning, true).removed).toBe(1);
  });
  it("still removes names the papers don't have", () => {
    expect(grounded("The committee heard from Councillor Jane Smith.", planning, true).removed).toBe(1);
    expect(grounded("The Planning Committee met with Welsh Water.", planning, true).removed).toBe(1);
  });
});

describe("grounding: English and Welsh together", () => {
  it("keeps English and Welsh the same length", () => {
    const en = "The Planning Committee approved three applications. Councillor Jane Smith spoke against. It also agreed its work programme for 2026/27.";
    const cy = "Cymeradwyodd y Pwyllgor Cynllunio dri chais. Siaradodd y Cynghorydd Jane Smith yn erbyn. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.";
    const r = groundedPair(en, cy, planning);
    expect(r.paired).toBe(true);
    expect(r.removed).toBe(1);
    expect(sentences(r.en)).toHaveLength(2);
    expect(sentences(r.cy)).toHaveLength(2);
    expect(r.en).toBe("The Planning Committee approved three applications. It also agreed its work programme for 2026/27.");
    expect(r.cy).toBe("Cymeradwyodd y Pwyllgor Cynllunio dri chais. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.");
  });
  it("removes a sentence from both when only the Welsh number is unsupported", () => {
    const r = groundedPair("It approved the plans. It agreed the programme.", "Cymeradwyodd y cynlluniau. Cytunodd ar raglen 2031.", planning);
    expect(r).toMatchObject({ en: "It approved the plans.", cy: "Cymeradwyodd y cynlluniau.", paired: true });
  });
  it("checks each language alone when the sentences can't be paired", () => {
    const r = groundedPair("It approved the plans. It agreed the programme.", "Cymeradwyodd y cynlluniau a'r rhaglen.", planning);
    expect(r.paired).toBe(false);
    expect(r.removed).toBe(0);
  });
});

describe("grounding: an overview's opening", () => {
  const opening = { en: "The Public Protection Sub Committee met in October 2026.", cy: "Cyfarfu'r Is-bwyllgor Diogelu'r Cyhoedd ym mis Hydref 2026." };
  const original = {
    en: "The Sub Committee considered taxi licensing matters. It granted one driver's application. Three matters were deferred.",
    cy: "Ystyriodd yr Is-bwyllgor faterion trwyddedu tacsis. Caniataodd gais un gyrrwr. Gohiriwyd tri mater.",
  };
  it("leaves an overview alone when both openings were kept", () => {
    expect(withStandAloneOpening(original, original, opening)).toEqual({ ...original, replaced: false });
  });
  it("replaces the opening in both languages when only the English one was removed", () => {
    const kept = { en: "It granted one driver's application. Three matters were deferred.", cy: original.cy };
    expect(withStandAloneOpening(original, kept, opening)).toEqual({
      en: "The Public Protection Sub Committee met in October 2026. It granted one driver's application. Three matters were deferred.",
      cy: "Cyfarfu'r Is-bwyllgor Diogelu'r Cyhoedd ym mis Hydref 2026. Caniataodd gais un gyrrwr. Gohiriwyd tri mater.",
      replaced: true,
    });
  });
  it("replaces it when both openings were removed together, or only the Welsh one", () => {
    const both = { en: "It granted one driver's application. Three matters were deferred.", cy: "Caniataodd gais un gyrrwr. Gohiriwyd tri mater." };
    const out = withStandAloneOpening(original, both, opening);
    expect(out.replaced).toBe(true);
    expect(sentences(out.en)).toHaveLength(3);
    expect(sentences(out.cy)).toHaveLength(3);
    const welshOnly = withStandAloneOpening(original, { en: original.en, cy: both.cy }, opening);
    expect(welshOnly.en.startsWith(opening.en)).toBe(true);
    expect(sentences(welshOnly.en)).toHaveLength(3);
  });
  it("adds nothing when nothing else is left", () => {
    expect(withStandAloneOpening(original, { en: "", cy: "" }, opening)).toEqual({ en: "", cy: "", replaced: false });
  });
});
