import { describe, expect, it } from "vitest";
import { findSystems, guesses, moderngovBaseOf } from "./census";

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
});
