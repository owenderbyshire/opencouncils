import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNCIL_READERS, ukDate } from "./council-consultations";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/consultations", `${name}.html`), "utf8");

describe("council consultation readers", () => {
  it("reads Pembrokeshire's table", () => {
    const list = COUNCIL_READERS.pembrokeshire(fixture("pembrokeshire"), "https://www.pembrokeshire.gov.uk/have-your-say/consultations");
    expect(list).toHaveLength(4);
    expect(list[0]).toMatchObject({
      url: "https://www.pembrokeshire.gov.uk/have-your-say/establishment-of-a-new-3-11-welsh-medium-primary-school-in-the-milford-haven-area",
      opens: "2026-10-13",
      closes: "2026-11-24",
    });
  });

  it("reads Rhondda Cynon Taf's table with ordinal dates", () => {
    const list = COUNCIL_READERS["rhondda-cynon-taf"](fixture("rhondda-cynon-taf"), "https://www.rctcbc.gov.uk/EN/x.aspx");
    expect(list).toHaveLength(3);
    expect(list[0].closes).toBe("2026-10-31");
    expect(list[2]).toMatchObject({
      title: "Air Quality Progress Report 2026",
      url: "https://www.rctcbc.gov.uk/EN/GetInvolved/Consultations/CurrentConsultations/AirQualityProgressReport2026.aspx",
      closes: "2026-11-25",
    });
    expect(list[1].summary).toContain("recreational cycling routes");
  });

  it("reads Flintshire's list", () => {
    const list = COUNCIL_READERS.flintshire(fixture("flintshire"), "https://www.flintshire.gov.uk/en/Resident/Consultation-and-Engagement/Open/Home.aspx");
    expect(list.length).toBeGreaterThanOrEqual(4);
    const weeds = list.find((c) => c.title === "Weed Control")!;
    expect(weeds).toMatchObject({ opens: "2026-10-12", closes: "2026-11-08" });
    expect(weeds.url).toBe("https://www.flintshire.gov.uk/en/Resident/Consultation-and-Engagement/Open/Weed-Control.aspx");
  });

  it("reads UK dates", () => {
    expect(ukDate("3/11/2026")).toBe("2026-11-03");
    expect(ukDate("nothing")).toBeNull();
  });
});
