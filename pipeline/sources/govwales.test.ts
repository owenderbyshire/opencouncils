import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { longDate, parseConsultationList, parseConsultationPage } from "./govwales";

const fx = (dir: string, f: string) => readFileSync(path.join(__dirname, "..", "fixtures", dir, f), "utf8");

describe("gov.wales consultations", () => {
  it("reads the list of open consultations", () => {
    const { items, total } = parseConsultationList(
      fx("govwales", "consultations.html"),
    );
    expect(total).toBe(20);
    expect(items.length).toBe(10);
    expect(items[0]).toEqual({
      url: "https://www.gov.wales/draft-nature-finance-strategy-wales",
      title: "Draft Nature Finance Strategy Wales",
      type: "Open consultation",
      area: "Environment and climate change",
      published: "2026-10-26",
    });
    const page2 = parseConsultationList(fx("govwales", "consultations-2.html"));
    expect(page2.items.length).toBe(10);
    expect(page2.items[0].url).not.toBe(items[0].url);
  });

  it("reads a consultation's dates, summary and Welsh page", () => {
    const en = parseConsultationPage(fx("govwales", "consultation-en.html"));
    expect(en).toEqual({
      title: "Draft Nature Finance Strategy Wales",
      summary: "We are seeking your views on Wales’s first Nature Finance Strategy.",
      opens: "2026-10-26",
      closes: "2027-01-29",
      urlCy: "https://www.llyw.cymru/strategaeth-cyllid-natur-cymru-ddrafft",
    });
    const cy = parseConsultationPage(fx("govwales", "consultation-cy.html"));
    expect(cy.title).toBe("Strategaeth Cyllid Natur Cymru ddrafft");
    expect(cy.closes).toBe("2027-01-29");
  });

  it("reads dates in both languages", () => {
    expect(longDate("21 December 2026")).toBe("2026-12-21");
    expect(longDate("5 Chwefror 2027")).toBe("2027-02-05");
    expect(longDate("29 Ionawr 2027")).toBe("2027-01-29");
  });
});

