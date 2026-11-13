import { describe, expect, it } from "vitest";
import { splitSentences, summaryMismatches, type MeetingSummaryContent } from "../../src/lib/summary";
import { buildContent, failedBefore, openingFor, recentWindow, RECENT_ONLY, skipFailed, startsMidThought, withOpeningIfMidThought, roomLeftPence, summaryBudgetPence, spendingNote, SPENT_BEFORE_LEDGER_PENCE, withWelshOpeningName } from "./summaries";
import { groundedPair, prepareSource } from "../lib/grounding";

const papers = `Meeting: Planning Committee, Cardiff Council, 2026-10-07

Item 4: 4 Applications
Minute:
RESOLVED - that applications 25/01234/FUL, 25/01300/FUL and 25/01455/HSE be approved subject to conditions.
Item 7: 7 Work Programme
Minute:
RESOLVED - that the work programme for 2026/27 be agreed.`;

/** A reply like the one behind Cardiff's English summary that read only "It also agreed its work programme for 2026/27." */
const reply = {
  overview_en: "The Planning Committee approved three planning applications, subject to conditions. It also agreed its work programme for 2026/27.",
  overview_cy: "Cymeradwyodd y Pwyllgor Cynllunio dair cais cynllunio, yn amodol ar amodau. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.",
  items: [
    {
      item: 4,
      headline_en: "Three applications approved",
      headline_cy: "Tri chais wedi'u cymeradwyo",
      decided_en: "The Planning Committee approved applications 25/01234/FUL, 25/01300/FUL and 25/01455/HSE, subject to conditions.",
      decided_cy: "Cymeradwyodd y Pwyllgor Cynllunio geisiadau 25/01234/FUL, 25/01300/FUL a 25/01455/HSE, yn amodol ar amodau.",
      proposed_en: "",
      proposed_cy: "",
      why_en: "The minute gives no reasons.",
      why_cy: "Nid yw'r cofnod yn rhoi rhesymau.",
      sources: [],
    },
    {
      item: 7,
      headline_en: "Work programme agreed",
      headline_cy: "Cytuno ar y rhaglen waith",
      decided_en: "The Planning Committee agreed its work programme for 2026/27.",
      decided_cy: "Cytunodd y Pwyllgor Cynllunio ar ei raglen waith ar gyfer 2026/27.",
      proposed_en: "",
      proposed_cy: "",
      why_en: "",
      why_cy: "",
      sources: [],
    },
  ],
  declarations: [],
};

const items = new Map([
  [4, { id: 104, minutes: "RESOLVED - approved" }],
  [7, { id: 107, minutes: "RESOLVED - agreed" }],
]);

describe("summary content", () => {
  it("keeps every English sentence the Welsh has, and the reverse", () => {
    const c = buildContent(reply, papers, items, new Set(), true);
    expect(summaryMismatches(c)).toEqual([]);
    expect(splitSentences(c.overviewEn)).toHaveLength(2);
    expect(c.overviewEn.startsWith("The Planning Committee approved three planning applications")).toBe(true);
    expect(c.items.map((i) => i.decidedEn)).toEqual([reply.items[0].decided_en, reply.items[1].decided_en]);
  });
  it("corrects known Welsh slips", () => {
    const c = buildContent(reply, papers, items, new Set(), true);
    expect(c.overviewCy).toContain("dri chais cynllunio");
    const slip = buildContent({ ...reply, overview_cy: "Cymeradwyodd tair cais. Cytunodd ar raglen 2026/27." }, papers, items, new Set(), true);
    expect(slip.overviewCy).toBe("Cymeradwyodd tri chais. Cytunodd ar raglen 2026/27.");
  });
  it("reports a summary whose English has lost a sentence", () => {
    const stored: MeetingSummaryContent = {
      overviewEn: "It also agreed its work programme for 2026/27.",
      overviewCy: "Cymeradwyodd y Pwyllgor Cynllunio dri chais. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.",
      items: [
        { agendaItemId: 104, headlineEn: "", headlineCy: "Tri chais", decidedEn: "", decidedCy: "Cymeradwyodd dri chais.", whyEn: "", whyCy: "", sources: [] },
      ],
    };
    expect(summaryMismatches(stored).map((m) => m.field)).toEqual(["overview", "headline:104", "decided:104"]);
  });
});

describe("failedBefore", () => {
  it("skips a meeting only while its input is the one it failed on", () => {
    const failed = { "4189": "abc" };
    expect(failedBefore(failed, 4189, "abc")).toBe(true);
    expect(failedBefore(failed, 4189, "changed")).toBe(false);
    expect(failedBefore(failed, 4298, "abc")).toBe(false);
  });
  it("is skipped by every run, a repair included, unless it asks for that meeting or for retries", () => {
    const failed = { "4189": "abc" };
    expect(skipFailed(failed, 4189, "abc", { retryFailed: false })).toBe(true);
    expect(skipFailed(failed, 4189, "changed", { retryFailed: false })).toBe(false);
    expect(skipFailed(failed, 4189, "abc", { only: 4189, retryFailed: false })).toBe(false);
    expect(skipFailed(failed, 4189, "abc", { retryFailed: true })).toBe(false);
  });
});

describe("an overview whose opening the check removes", () => {
  // As behind Cardiff's "It granted one driver's application…": the English opening names
  // something the papers don't, so it goes; the Welsh opening has no figure and stays.
  const opening = openingFor("Planning Committee", "Pwyllgor Cynllunio", "2026-10-07");
  const unsupported = {
    ...reply,
    overview_en: "Councillor Jane Doe chaired the Planning Committee. It approved three planning applications, subject to conditions. It also agreed its work programme for 2026/27.",
    overview_cy: "Cadeiriwyd y Pwyllgor Cynllunio gan gynghorydd. Cymeradwyodd dri chais cynllunio, yn amodol ar amodau. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.",
  };
  it("starts both languages with a plain opening and keeps them in step", () => {
    const c = buildContent(unsupported, papers, items, new Set(), true, () => {}, () => {}, opening);
    expect(c.overviewEn).toBe("The Planning Committee met in October 2026. It approved three planning applications, subject to conditions. It also agreed its work programme for 2026/27.");
    expect(c.overviewCy).toBe("Cyfarfu'r Pwyllgor Cynllunio ym mis Hydref 2026. Cymeradwyodd dri chais cynllunio, yn amodol ar amodau. Cytunodd hefyd ar ei raglen waith ar gyfer 2026/27.");
    expect(summaryMismatches(c).filter((m) => m.field === "overview")).toEqual([]);
  });
  it("leaves an overview whose opening was kept as it was written", () => {
    const c = buildContent(reply, papers, items, new Set(), true, () => {}, () => {}, opening);
    expect(c.overviewEn.startsWith("The Planning Committee approved three planning applications")).toBe(true);
  });
  it("words the opening for any committee name, in both languages", () => {
    expect(openingFor("The Cabinet", "Y Cabinet", "2026-11-10")).toEqual({ en: "The Cabinet met in November 2026.", cy: "Cyfarfu'r Cabinet ym mis Tachwedd 2026." });
    expect(openingFor("Public Protection Sub Committee", null, "2026-10-07")).toEqual({
      en: "The Public Protection Sub Committee met in October 2026.",
      cy: "Cyfarfu'r Public Protection Sub Committee ym mis Hydref 2026.",
    });
  });
  it("words an opening that the check itself would keep", () => {
    const src = prepareSource(`Meeting: Public Protection Sub Committee, Cardiff Council, 2026-10-07`);
    const o = openingFor("Public Protection Sub Committee", null, "2026-10-07");
    expect(groundedPair(o.en, o.cy, src)).toMatchObject({ en: o.en, cy: o.cy, removed: 0 });
  });
});

describe("a stored overview that starts mid-thought", () => {
  const opening = openingFor("Council", "Cyngor", "2026-10-22");
  it("is recognised only when its opening plainly leans on an earlier sentence", () => {
    for (const s of [
      "It also let a Borth beach dog order expire.",
      "They then examined the draft strategy.",
      "It granted one driver's application.",
      "The other two objectives are a Safe and Prosperous Merthyr Tydfil.",
      "However, the minute records no decision.",
    ])
      expect(startsMidThought(s)).toBe(true);
    for (const s of [
      "It was agreed to defer the item.",
      "It seemed the report was late.",
      "Its annual report was noted.",
      "The committee approved three applications.",
      "Cabinet met on 15 October 2026.",
      "",
    ])
      expect(startsMidThought(s)).toBe(false);
  });
  it("gets the plain opening in both languages, as Ceredigion's Council meeting of 22 October needs", () => {
    const stored = {
      en: "It also let a Borth beach dog order expire, merged two licensing committees and made three appointments.",
      cy: "Gadawodd i Orchymyn cŵn traeth Borth ddod i ben, unodd y ddau bwyllgor trwyddedu a gwnaeth dri phenodiad.",
    };
    expect(withOpeningIfMidThought(stored, opening)).toEqual({
      en: `${opening.en} ${stored.en}`,
      cy: `${opening.cy} ${stored.cy}`,
      added: true,
    });
  });
  it("drops a Welsh first sentence the English had lost, so the two stay in step", () => {
    const stored = {
      en: "It granted one driver's application. Three matters were deferred.",
      cy: "Ystyriodd yr Is-bwyllgor faterion trwyddedu. Caniataodd gais un gyrrwr. Gohiriwyd tri mater.",
    };
    const out = withOpeningIfMidThought(stored, opening);
    expect(out.cy).toBe(`${opening.cy} Caniataodd gais un gyrrwr. Gohiriwyd tri mater.`);
    expect(splitSentences(out.en)).toHaveLength(splitSentences(out.cy).length);
  });
  it("leaves an overview that stands on its own, and changes nothing the second time", () => {
    const fine = { en: "The Council approved the budget.", cy: "Cymeradwyodd y Cyngor y gyllideb." };
    expect(withOpeningIfMidThought(fine, opening)).toEqual({ ...fine, added: false });
    const once = withOpeningIfMidThought({ en: "It also agreed its work programme.", cy: "Cytunodd hefyd ar ei raglen waith." }, opening);
    expect(withOpeningIfMidThought(once, opening).added).toBe(false);
  });
});

describe("the summaries' cap", () => {
  it("is £60 a month for OpenCouncils (Owen, 13 November 2026)", () => {
    expect(summaryBudgetPence("2026-11")).toBe(6000);
    expect(summaryBudgetPence("2026-12")).toBe(6000);
    expect(summaryBudgetPence("2027-01")).toBe(6000);
  });
  it("counts real spending: the ledger and what came before it, or the summaries held if that is more", () => {
    // £40 before the ledger, £3 on it, £30 recorded on summaries held: £12 left, less the reserve.
    expect(roomLeftPence(5500, 300, 4000, 3000, 0)).toBe(1200);
    expect(roomLeftPence(5500, 300, 4000, 3000)).toBe(1176);
    // The summaries held never count for less than they record.
    expect(roomLeftPence(3000, 500, 0, 800, 0)).toBe(2200);
    expect(roomLeftPence(3000, 2995, 0, 0)).toBeLessThan(0);
  });
  it("counts November 2026's spending from before the ledger, and nothing for later months", () => {
    expect(SPENT_BEFORE_LEDGER_PENCE["2026-11"]).toBeUndefined();
    expect(SPENT_BEFORE_LEDGER_PENCE["2026-12"]).toBeUndefined();
  });
  it("says in the log how spending stands", () => {
    expect(spendingNote("2026-11", { ledger: 250, before: 4470, held: 2900 })).toBe(
      "2026-11: cap £60.00, about £12.80 left (£44.70 spent before the ledger, £2.50 on it; the summaries held record £29.00)",
    );
    expect(spendingNote("2026-12", { ledger: 6100, before: 0, held: 2900 })).toContain("about £0.00 left");
  });
});

describe("the Welsh plain opening", () => {
  it("uses the standard Welsh name when the council publishes none", () => {
    expect(openingFor("Council", null, "2026-09-24").cy).toBe("Cyfarfu'r Cyngor llawn ym mis Medi 2026.");
    expect(openingFor("Thriving Communities Overview and Scrutiny Committee", null, "2026-09-24").cy).toBe(
      "Cyfarfu'r Thriving Communities Overview and Scrutiny Committee ym mis Medi 2026.",
    );
  });
  it("mends an opening already written with the English name, and leaves others alone", () => {
    const opening = openingFor("Council", null, "2026-09-24");
    expect(withWelshOpeningName("Cyfarfu'r Council ym mis Medi 2026. Gadawodd i'r gorchymyn ddod i ben.", "Council", opening)).toBe(
      "Cyfarfu'r Cyngor llawn ym mis Medi 2026. Gadawodd i'r gorchymyn ddod i ben.",
    );
    expect(withWelshOpeningName("Cymeradwyodd y Cyngor y gyllideb.", "Council", opening)).toBe("Cymeradwyodd y Cyngor y gyllideb.");
    const named = openingFor("Planning Committee", "Pwyllgor Cynllunio", "2026-10-07");
    expect(withWelshOpeningName("Cyfarfu'r Pwyllgor Cynllunio ym mis Hydref 2026. Caniataodd dri chais.", "Planning Committee", named)).toBe(
      "Cyfarfu'r Pwyllgor Cynllunio ym mis Hydref 2026. Caniataodd dri chais.",
    );
  });
});

describe("the recent-only window", () => {
  it("covers the last 120 days until 1 December 2026, then lapses", () => {
    expect(RECENT_ONLY).toEqual({ days: 120, until: "2026-12-01" });
    expect(recentWindow("2026-11-09")?.days).toBe(120);
    expect(recentWindow("2026-11-30")?.days).toBe(120);
    expect(recentWindow("2026-12-01")).toBeNull();
    expect(recentWindow("2027-01-15")).toBeNull();
  });
  it("is off without a setting", () => {
    expect(recentWindow("2026-11-09", null)).toBeNull();
  });
});
