import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  matchValeMinutes,
  matchValeName,
  parseValeCommittee,
  parseValeCouncillors,
  parseValeIndex,
  parseValeMeeting,
  parseValeProfile,
  valeCommitteeKey,
  splitValeMinutes,
  valeApologies,
  valeCommitteeName,
  valeDateTime,
  valePresent,
} from "./vale";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/vale", name), "utf8");

describe("Vale of Glamorgan pages", () => {
  it("lists committee pages from the index", () => {
    const list = parseValeIndex(fixture("index.html"));
    expect(list.length).toBeGreaterThanOrEqual(25);
    expect(list.some((c) => c.url.endsWith("/agendas/cabinet/Cabinet-Agendas.aspx"))).toBe(true);
    expect(list.some((c) => /Historic/.test(c.url))).toBe(false);
    expect(valeCommitteeName(fixture("committee-cabinet.html"))).toBe("Cabinet");
  });

  it("lists a committee's meetings from page names", () => {
    const list = parseValeCommittee(fixture("committee-council.html"));
    const oct = list.find((m) => m.date === "2026-10-05")!;
    expect(oct.url).toBe(
      "https://www.valeofglamorgan.gov.uk/en/our_council/Council-Structure/minutes,_agendas_and_reports/agendas/council/2026/26-10-05.aspx",
    );
    expect(oct.recording).toContain("youtube.com");
    const specials = list.filter((m) => m.date === "2026-01-12");
    expect(specials.map((m) => m.time)).toEqual(["18:00", "18:15", "18:30", "18:45"]);
    expect(specials[0].decisionNotice).toMatch(/Decision-Notice-Special-6\.00pm\.pdf$/);
  });

  it("reads a meeting's details and agenda", () => {
    const m = parseValeMeeting(fixture("meeting-council-26-10-05.html"));
    expect(m).toMatchObject({ committee: "Council", date: "2026-10-05", time: "18:00" });
    expect(m.venue).toContain("Hybrid");
    expect(m.minutes).toMatch(/2026\/26-10-05\/Minutes\.pdf$/);
    expect(m.urlCy).toMatch(/^https:\/\/www\.valeofglamorgan\.gov\.uk\/cy\//);
    expect(m.items.map((i) => i.number).slice(0, 16)).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
    );
    const constitution = m.items.find((i) => i.number === "6")!;
    expect(constitution.title).toContain("Amendments to the Council");
    expect(constitution.documents[0].url).toMatch(/Amendments-to-the-Council-Constitution\.pdf$/);
  });

  it("reads a Cabinet page, whose details are paragraphs", () => {
    const m = parseValeMeeting(fixture("meeting-cabinet-26-09-24.html"));
    expect(m).toMatchObject({ committee: "CABINET", date: "2026-09-24", time: "14:00" });
    expect(m.venue).toMatch(/^HYBRID MEETING/);
    expect(m.items).toHaveLength(21);
    expect(m.items[8].title).toBe("Capital Monitoring Quarter 1 2026/27 - 1st April to 30th June 2026.");
  });

  it("reads Vale dates", () => {
    expect(valeDateTime("THURSDAY 24TH SEPTEMBER 2026 AT 2.00 PM")).toEqual({ date: "2026-09-24", time: "14:00" });
    expect(valeDateTime("Monday, 5th October 2026 – 6.00pm")).toEqual({ date: "2026-10-05", time: "18:00" });
  });
});

describe("Vale minutes", () => {
  const text = fixture("minutes-council-26-10-05.txt");
  it("splits the minutes at each minute", () => {
    const list = splitValeMinutes(text);
    expect(list.map((m) => m.number).slice(0, 8)).toEqual(["270", "271", "272", "273", "274", "275", "276", "277"]);
    expect(list[7].title).toBe("REVIEW OF SECTION 19 OF THE CONSTITUTION: STANDARDS OF CONDUCT FRAMEWORK (MO/HLDS)");
    expect(list[6].text).toMatch(/^The Leader presented the report/);
    expect(list[6].text).toContain("RESOLVED");
    expect(list.some((m) => /TRIM/.test(m.text))).toBe(false);
  });

  it("matches minutes to agenda items", () => {
    const meeting = parseValeMeeting(fixture("meeting-council-26-10-05.html"));
    const matched = matchValeMinutes(meeting.items, splitValeMinutes(text));
    expect(matched.get("1")).toMatch(/This was received from/);
    expect(matched.get("6")).toMatch(/amendments to the Council’s Constitution/);
    expect(matched.get("7")).toMatch(/Standards Committee Procedures Working Group/);
    expect(matched.get("10")).toMatch(/reference from Cabinet of 23rd July/);
    expect(matched.get("14")).toContain("CASH MANAGEMENT");
  });
});

describe("Vale councillors and attendance", () => {
  const list = parseValeCouncillors(fixture("councillors.html"));
  it("reads the councillor cards", () => {
    expect(list).toHaveLength(9);
    expect(list[0]).toMatchObject({ name: "Anne Asbrey", party: "Plaid Cymru - The Party of Wales", ward: "Dinas Powys" });
    expect(list.find((c) => c.surname === "Brooks")?.name).toBe("Bronwen Brooks");
  });
  it("reads who was present and who sent apologies, and matches them", () => {
    const text = fixture("minutes-council-26-10-05.txt");
    const present = valePresent(text);
    expect(present[0]).toBe("Carys Stallard");
    expect(present).toContain("Shirley Hodges");
    expect(present).toContain("Dr. Ian Johnson");
    expect(present).toHaveLength(51);
    expect(present.map((n) => matchValeName(n, list)?.name).filter(Boolean)).toEqual([
      "Carys Stallard",
      "Anne Asbrey",
      "Bronwen Brooks",
      "Nic Hodges",
      "Shirley Hodges",
      "Ian J. Johnson",
      "Neil C. Thomas",
    ]);
    expect(matchValeName("Neil Thomas", list)?.url).toMatch(/Thomas-Neil-C/);
    const apologies = valeApologies(splitValeMinutes(text));
    expect(apologies).toEqual(["N.J. Wood"]);
    expect(matchValeName("N.J. Wood", list)?.surname).toBe("Wood");
  });

  it("reads a councillor's own page", () => {
    const p = parseValeProfile(fixture("councillor-perry.html"));
    expect(p.email).toBe("ianperry@valeofglamorgan.gov.uk");
    expect(p.phone).toBe("07927 588943");
    expect(p.roles).toEqual([
      { name: "Discretionary Housing Payments Review Committee", until: "13 July" },
      { name: "Equalities Consultative Forum", until: null },
      { name: "Place Scrutiny Committee", until: null },
      { name: "Planning Committee", until: null },
    ]);
    expect(valeCommitteeKey("Scrutiny (Place)")).toBe(valeCommitteeKey("Place Scrutiny Committee"));
    expect(valeCommitteeKey("Discretionary Housing Payments Review")).toBe(valeCommitteeKey("Discretionary Housing Payments Review Committee"));
    expect(p.attendance?.period).toBe("from the Annual Meeting on 13 May 2026 to the Annual Meeting on 24 May 2027");
    expect(p.attendance?.rows).toEqual([
      { name: "Council (including Annual Meeting)", url: expect.stringMatching(/\/agendas\/council\/council\.aspx$/), held: 2, attended: 2, apologies: null },
      { name: "Discretionary Housing Payments Review", url: expect.stringMatching(/Discretionary-Housing-Payments-Review\.aspx$/), held: null, attended: null, apologies: null },
      { name: "Planning", url: expect.stringMatching(/\/planning\/planning\.aspx$/), held: 4, attended: 4, apologies: null },
      { name: "Scrutiny (Place)", url: expect.stringMatching(/Scrutiny-Place\.aspx$/), held: 3, attended: 3, apologies: null },
    ]);
    const a = parseValeProfile(fixture("councillor-asbrey.html"));
    expect(a.email).toBe("aasbrey@valeofglamorgan.gov.uk");
    expect(a.roles).toContainEqual({ name: "Start Well Scrutiny Committee", until: null });
    expect(a.attendance?.rows.length).toBeGreaterThanOrEqual(3);
  });
});
