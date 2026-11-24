import { describe, expect, it } from "vitest";
import { findSystems, guesses, moderngovBaseOf, pickWebsite } from "./census";

describe("census", () => {
  it("takes the ModernGov base from a page link", () => {
    expect(moderngovBaseOf("https://democracy.woking.gov.uk/mgListCommittees.aspx?bcr=1")).toBe("https://democracy.woking.gov.uk");
    expect(moderngovBaseOf("https://www.example.gov.uk/moderngov/ieListMeetings.aspx?CId=1")).toBe("https://www.example.gov.uk/moderngov");
    expect(moderngovBaseOf("https://www.example.gov.uk/council/meetings")).toBeNull();
  });

  it("finds committee systems among a home page's links", () => {
    const html = `<a href="https://democracy.example.gov.uk/mgCalendarMonthView.aspx">Meetings</a>
      <a href="/cmis5/Meetings.aspx">Old meetings</a> <a href="https://committees.other.gov.uk/">Committees</a>`;
    const s = findSystems(html, "https://www.example.gov.uk/");
    expect(s.moderngov).toContain("https://democracy.example.gov.uk");
    expect(s.cmis).toEqual(["https://www.example.gov.uk/cmis5"]);
    expect(s.democracy).toContain("https://committees.other.gov.uk");
  });

  it("guesses the usual ModernGov addresses", () => {
    const g = guesses("https://www.woking.gov.uk", { short: "Woking" } as never);
    expect(g).toContain("https://democracy.woking.gov.uk");
    expect(g).toContain("https://woking.moderngov.co.uk");
  });

  it("picks the district's own website when GOV.UK lists the county first", () => {
    const html = `<a href="https://www.kent.gov.uk/">Go to Kent County Council website</a>
      <a href="https://www.maidstone.gov.uk/">Go to Maidstone Borough Council website</a>`;
    expect(pickWebsite(html, { short: "Maidstone", name: "Maidstone Borough Council" })).toBe("https://www.maidstone.gov.uk");
    expect(pickWebsite(html, { short: "Kent", name: "Kent County Council" })).toBe("https://www.kent.gov.uk");
  });
});

describe("pickWebsite whole words", () => {
  it("doesn't give Stafford the county's link", () => {
    const html = `<a href="https://www.staffordshire.gov.uk">Go to Staffordshire County Council website</a>
      <a href="https://www.staffordbc.gov.uk">Go to Stafford Borough Council website</a>`;
    expect(pickWebsite(html, { short: "Stafford", name: "Stafford Borough Council" })).toBe("https://www.staffordbc.gov.uk");
    expect(pickWebsite(html, { short: "Staffordshire", name: "Staffordshire County Council" })).toBe("https://www.staffordshire.gov.uk");
  });
});

describe("censusOne keeps a working address", () => {
  it("keeps a ModernGov base that worked before when nothing else is found", async () => {
    const { censusOne } = await import("./census");
    const known = { platform: "moderngov" as const, base: "https://example.invalid", website: null, feedOk: true, via: "homepage", note: null, checked: "2026-11-13" };
    // No GOV.UK slug, and the address can't answer: nothing is found, so the old base is kept, marked as not answering.
    const r = await censusOne({ id: "x", name: "X Council", short: "X", govUkSlug: null } as never, known);
    expect(r.base).toBe("https://example.invalid");
    expect(r.platform).toBe("moderngov");
    expect(r.feedOk).toBe(false);
  }, 60_000);
});

describe("homepageFromApi", () => {
  it("reads GOV.UK's local authority data", async () => {
    const { homepageFromApi } = await import("./census");
    expect(homepageFromApi('{"local_authority":{"name":"Kent County Council","homepage_url":"http://www.kent.gov.uk/","tier":"county","slug":"kent"}}')).toBe("http://www.kent.gov.uk");
    expect(homepageFromApi("<html>")).toBeNull();
  });
});
