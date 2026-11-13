/**
 * The fixtures come from the Senedd's ModernGov site, which runs the same
 * software as the councils and returns the same XML. Add council fixtures
 * (Cardiff first) under pipeline/fixtures/moderngov/ as they are collected.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  attendanceStatus,
  committeeKind,
  committeeRole,
  isDeclarationsItem,
  isProceduralItem,
  parseCommittees,
  parseCommitteesByUser,
  parseCouncillorsByWard,
  parseMeeting,
  parseMeetings,
  partyIdFor,
  resolvedText,
  splitHonorific,
} from "./moderngov";

const fixture = (name: string) =>
  readFileSync(path.join(import.meta.dirname, "../fixtures/moderngov", name), "utf8");

describe("parseCouncillorsByWard", () => {
  const rows = parseCouncillorsByWard(fixture("mg-councillors-by-ward.xml"));
  it("reads every councillor with a ward and slug", () => {
    expect(rows.length).toBeGreaterThan(50);
    for (const r of rows) {
      expect(r.id).toBeGreaterThan(0);
      expect(r.ward).not.toBe("");
      expect(r.wardSlug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe("splitHonorific", () => {
  it("drops Councillor and plain titles, keeps academic ones", () => {
    expect(splitHonorific("Councillor Jane Jones")).toEqual({ name: "Jane Jones", honorific: null });
    expect(splitHonorific("Cllr Dr Jane Jones")).toEqual({ name: "Jane Jones", honorific: "Dr" });
    expect(splitHonorific("Councillor Mrs Ann Hughes")).toEqual({ name: "Ann Hughes", honorific: null });
    expect(splitHonorific("Y Cynghorydd Huw Thomas")).toEqual({ name: "Huw Thomas", honorific: null });
  });
});

describe("parseCommittees", () => {
  it("reads IDs, titles and expiry", () => {
    const rows = parseCommittees(fixture("mg-committees.xml"));
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.id > 0 && r.title)).toBe(true);
    expect(rows.some((r) => r.expired)).toBe(true);
  });
});

describe("parseCommitteesByUser", () => {
  it("reads committee IDs and roles", () => {
    const rows = parseCommitteesByUser(fixture("mg-committees-by-user-426.xml"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].committeeId).toBeGreaterThan(0);
  });
});

describe("parseMeetings", () => {
  it("reads meeting IDs, dates and times", () => {
    const rows = parseMeetings(fixture("mg-meetings-908-2026-10.xml"));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (r.time) expect(r.time).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe("parseMeeting", () => {
  const m = parseMeeting(fixture("mg-meeting-16304.xml"))!;
  it("reads the meeting, its items in order and attendees", () => {
    expect(m.meetingId).toBe(16304);
    expect(m.date).toBe("2026-10-19");
    expect(m.time).toBe("13:31");
    expect(m.items.length).toBeGreaterThan(3);
    expect(m.items.map((i) => i.seq)).toEqual(m.items.map((_, i) => i + 1));
    expect(m.attendees.length).toBeGreaterThan(3);
    expect(m.attendees.find((a) => a.name === "Cristiana Emsley")?.role).toBe("Chair");
  });
  it("keeps documents with their URLs", () => {
    const docs = m.items.flatMap((i) => i.documents);
    for (const d of docs) expect(d.url).toMatch(/^https:\/\//);
  });
});

describe("committeeKind", () => {
  it("classifies council bodies by title", () => {
    expect(committeeKind("Council")).toBe("council");
    expect(committeeKind("County Council")).toBe("council");
    expect(committeeKind("Cabinet")).toBe("cabinet");
    expect(committeeKind("Economy & Culture Scrutiny Committee")).toBe("scrutiny");
    expect(committeeKind("Planning Committee")).toBe("planning");
    expect(committeeKind("Weekly Planning Lists")).toBe("other");
    expect(committeeKind("Public Protection Committee")).toBe("other");
    expect(committeeKind("Governance and Audit Committee")).toBe("regulatory");
    expect(committeeKind("Licensing Sub Committee")).toBe("regulatory");
    expect(committeeKind("Ordinary Meeting of the Council")).toBe("council");
    expect(committeeKind("Flintshire County Council")).toBe("council");
    expect(committeeKind("The Executive")).toBe("cabinet");
    expect(committeeKind("Executive Board")).toBe("cabinet");
    expect(committeeKind("Cabinet Scrutiny Committee")).toBe("scrutiny");
    expect(committeeKind("Pwyllgor Cynllunio")).toBe("planning");
    expect(committeeKind("Cyngor")).toBe("council");
  });
});

describe("committeeRole", () => {
  it("separates chairs, vice-chairs and substitutes", () => {
    expect(committeeRole("Chair")).toBe("chair");
    expect(committeeRole("Vice-Chair")).toBe("vice-chair");
    expect(committeeRole("Deputy Chair")).toBe("vice-chair");
    expect(committeeRole("Substitute")).toBe("substitute");
    expect(committeeRole("Committee Member")).toBe("member");
    expect(committeeRole("Leader of Opposition Observer")).toBe("observer");
    expect(committeeRole("Co-opted Member")).toBe("observer");
  });
});

describe("attendanceStatus", () => {
  it("normalises ModernGov wording", () => {
    expect(attendanceStatus("Present, as expected")).toBe("present");
    expect(attendanceStatus("Present, as substitute")).toBe("substitute");
    expect(attendanceStatus("Apologies")).toBe("apologies");
    expect(attendanceStatus("Apologies, sent representative")).toBe("sent_substitute");
    expect(attendanceStatus("Expected")).toBe("expected");
    expect(attendanceStatus("In attendance")).toBe("in_attendance");
  });
});

describe("partyIdFor", () => {
  it("tells the Greens from Plaid Cymru", () => {
    expect(partyIdFor("Green Party / Plaid Werdd")).toBe("green");
    expect(partyIdFor("Wales Green Party / Plaid Werdd Cymru")).toBe("green");
    expect(partyIdFor("Plaid Cymru a'r Blaid Werdd")).toBeNull();
    expect(partyIdFor("Plaid Cymru, Green Party, Common Ground")).toBeNull();
    expect(partyIdFor("Plaid Cymru - The Party of Wales")).toBe("pc");
  });
  it("maps national parties and leaves local groups alone", () => {
    expect(partyIdFor("Welsh Labour")).toBe("lab");
    expect(partyIdFor("Plaid Cymru")).toBe("pc");
    expect(partyIdFor("Welsh Conservative Party")).toBe("con");
    expect(partyIdFor("Welsh Liberal Democrats")).toBe("ld");
    expect(partyIdFor("Independent")).toBe("ind");
    expect(partyIdFor("Propel")).toBeNull();
  });
});

describe("resolvedText", () => {
  it("returns the resolution word for word", () => {
    const minute = "The Cabinet considered a report on the budget.\n\nRESOLVED: that the budget proposals be approved.";
    expect(resolvedText(minute)).toBe("RESOLVED: that the budget proposals be approved.");
  });
  it("returns null when nothing was resolved", () => {
    expect(resolvedText("The report was noted.")).toBeNull();
    expect(resolvedText(null)).toBeNull();
  });
});

describe("isDeclarationsItem", () => {
  it("spots the declarations item in either language", () => {
    expect(isDeclarationsItem("Declarations of Interest")).toBe(true);
    expect(isDeclarationsItem("Datganiadau o Fuddiant")).toBe(true);
    expect(isDeclarationsItem("Minutes")).toBe(false);
  });
});

describe("decisions in minutes", () => {
  it("finds resolutions however the council writes them", () => {
    expect(resolvedText("The Cabinet considered the report. RESOLVED that the plan be approved.")).toMatch(/^RESOLVED/);
    expect(resolvedText("Resolved that: 1) the PSPO be renewed for three years.")).toMatch(/^Resolved that/);
    expect(resolvedText("After discussion it was resolved to note the report and its appendices.")).toMatch(/^it was resolved/);
    expect(resolvedText("Penderfynwyd cymeradwyo'r adroddiad a'r argymhellion.")).toBeNull();
    expect(resolvedText("PENDERFYNWYD cymeradwyo'r adroddiad a'r argymhellion.")).toMatch(/^PENDERFYNWYD/);
    expect(resolvedText("Members agreed to note the update from officers.")).toBeNull();
  });
  it("leaves routine items out", () => {
    expect(isProceduralItem("Disclosure of Personal & Prejudicial Interests")).toBe(true);
    expect(isProceduralItem("TO SIGN AS A CORRECT RECORD THE MINUTES OF THE MEETING")).toBe(true);
    expect(isProceduralItem("Apologies for Absence")).toBe(true);
    expect(isProceduralItem("Public Spaces Protection Order")).toBe(false);
  });
  it("files appointment panels apart from planning", () => {
    expect(committeeKind("Appointments Committee - Assistant Director Planning and Transportation")).toBe("regulatory");
    expect(committeeKind("Planning Committee")).toBe("planning");
  });
});
