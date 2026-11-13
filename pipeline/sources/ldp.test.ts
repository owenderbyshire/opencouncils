import { describe, expect, it } from "vitest";
import { chunkPages, dedupeSites, documentLinks, numbersSupported, quoteHasWords, SUMMARY_TOPICS, topicPages, numberInQuote, pagesWorthReading, pickFacts, quoteOnPage, splitPages, type SiteCandidate } from "./ldp";

const page = `Policy SP1
The Plan makes provision for 26,350 new dwellings over the plan period
   H1.1      Land north of the railway        Llanfair        250        10.4
`;

describe("ldp pages", () => {
  it("splits on form feeds", () => {
    expect(splitPages("a\fb\f")).toEqual(["a", "b"]);
  });
  it("finds quotes despite layout spaces and separators", () => {
    expect(quoteOnPage("provision for 26350 new dwellings", page)).toBe(true);
    expect(quoteOnPage("H1.1 Land north of the railway Llanfair 250 10.4", page)).toBe(true);
    expect(quoteOnPage("provision for … over the plan period", page)).toBe(true);
    expect(quoteOnPage("provision for 30,000 new dwellings", page)).toBe(false);
    expect(quoteOnPage("short", page)).toBe(false);
  });
  it("checks the figure is in the quote", () => {
    expect(numberInQuote(26350, "provision for 26,350 new dwellings")).toBe(true);
    expect(numberInQuote(10.4, "Llanfair 250 10.4")).toBe(true);
    expect(numberInQuote(250, "2500 homes")).toBe(false);
  });
  it("picks pages and chunks them", () => {
    const pages = ["Contents", page, "Glossary of terms"];
    expect(pagesWorthReading(pages)).toEqual([2]);
    expect(chunkPages(pages, [2])[0]).toContain("=== Page 2 ===");
  });
});

describe("choosing figures and sites", () => {
  it("prefers the value quoted most often", () => {
    const f = pickFacts([
      { key: "housing-requirement", value: 26350, page: 40, quote: "a" },
      { key: "housing-requirement", value: 26350, page: 12, quote: "b" },
      { key: "housing-requirement", value: 1757, page: 5, quote: "c" },
    ]);
    expect(f).toEqual([{ key: "housing-requirement", value: 26350, page: 12, quote: "b", mentions: 2 }]);
  });
  it("keeps one row per site, the fullest", () => {
    const s = (over: Partial<SiteCandidate>): SiteCandidate => ({ ref: "H1.1", name: "Land north", settlement: "Llanfair", use: "housing", homes: null, hectares: null, page: 10, quote: "", ...over });
    const out = dedupeSites([s({}), s({ ref: "H 1.1", homes: 250, page: 90 })]);
    expect(out).toHaveLength(1);
    expect(out[0].homes).toBe(250);
  });
  it("merges a bare mention into the fuller entry", () => {
    const s = (over: Partial<SiteCandidate>): SiteCandidate => ({ ref: "", name: "", settlement: "Barry", use: "mixed", homes: null, hectares: null, page: 10, quote: "", ...over });
    const out = dedupeSites([s({ name: "Barry Waterfront" }), s({ ref: "MG2 (1)", name: "Phase 2, Barry Waterfront", homes: 1700 }), s({ ref: "D1", name: "Dolgellau", homes: 15 })]);
    expect(out.map((x) => x.ref)).toEqual(["MG2 (1)", "D1"]);
  });
  it("wants words in a figure's quote", () => {
    expect(quoteHasWords("Tenth 6 15")).toBe(false);
    expect(quoteHasWords("49 affordable dwellings were built in 2025-26")).toBe(true);
  });
});

describe("summary checks", () => {
  it("wants every number in the quote", () => {
    expect(numbersSupported("The plan aims for 2,000 affordable homes.", "a minimum of 2000 new affordable dwellings")).toBe(true);
    expect(numbersSupported("The plan aims for 2,500 affordable homes.", "a minimum of 2000 new affordable dwellings")).toBe(false);
    expect(numbersSupported("Policy H2 protects open space.", "Policy H2 open space")).toBe(true);
  });
  it("picks pages about a topic", () => {
    const pages = ["Contents", "Welsh language: development must protect the Welsh language and linguistic character", "Transport"];
    expect(topicPages(pages, SUMMARY_TOPICS["welsh-language"])).toContain("=== Page 2 ===");
  });
});

describe("documentLinks", () => {
  it("finds document links and makes them absolute", () => {
    const html = `<a href="/media/123/amr.pdf">AMR</a> <a href="page.html">x</a> <a href="objview.asp?object_id=1&amp;language=">LDP</a>`;
    expect(documentLinks(html, "https://www.example.gov.uk/ldp/")).toEqual([
      "https://www.example.gov.uk/ldp/objview.asp?object_id=1&language=",
      "https://www.example.gov.uk/media/123/amr.pdf",
    ]);
  });
});
