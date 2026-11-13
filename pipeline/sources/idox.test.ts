import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { idoxAppState, idoxAppType, idoxDate, parseIdoxResults, parseIdoxTable, postcodeIn } from "./idox";

const fixture = (name: string) => readFileSync(join(__dirname, "../fixtures/idox", name), "utf8");

describe("Idox planning register", () => {
  it("reads a weekly list", () => {
    const { items, total } = parseIdoxResults(fixture("results.html"));
    expect(total).toBe(13);
    expect(items.length).toBe(10);
    expect(items[0]).toEqual({
      keyVal: "TN96TIKYGY300",
      reference: "DM/2026/01257",
      description:
        "Extend front porch either side of existing, replacing existing glass roof with a fully insulated tile roof to match existing house. To take down stone wall and steps and replace with safer steps.",
      address: "Bridge Cottage Glynwood Lane Chapel Hill Tintern NP16 6TH",
      received: "2026-10-21",
      validated: "2026-10-21",
      status: "Pending Consideration",
    });
  });

  it("reads the summary, dates and further information tables", () => {
    const s = parseIdoxTable(fixture("summary.html"));
    expect(s.Reference).toBe("DM/2026/01257");
    expect(s.Status).toBe("Pending Consideration");
    const d = parseIdoxTable(fixture("dates.html"));
    expect(idoxDate(d["Expiry Date"])).toBe("2026-11-16");
    expect(idoxDate(d["Decision Made Date"])).toBeNull();
    expect(idoxDate(d["Neighbour Consultation Expiry Date"])).toBe("2026-11-16");
    const f = parseIdoxTable(fixture("details.html"));
    expect(f["Application Type"]).toBe("Fast Track Householder");
    expect(f.Ward).toBe("St Arvans");
  });

  it("maps types and states to PlanIt's words", () => {
    expect(idoxAppType("Fast Track Householder")).toBe("Full");
    expect(idoxAppType("Discharge of Condition")).toBe("Conditions");
    expect(idoxAppType("Variation of Condition (S73)")).toBe("Full");
    expect(idoxAppType("Outline Planning Permission")).toBe("Outline");
    expect(idoxAppType("Listed Building Consent")).toBe("Heritage");
    expect(idoxAppType("Works to Trees in a Conservation Area")).toBe("Trees");
    expect(idoxAppType("Non Material Amendment")).toBe("Amendment");
    expect(idoxAppType("Certificate of Lawfulness (Proposed)")).toBe("Other");
    expect(idoxAppState("Pending Consideration", null)).toBe("Undecided");
    expect(idoxAppState("Decided", "Approved")).toBe("Permitted");
    expect(idoxAppState("Closed", "Prior Approval Required")).toBe("Unresolved");
    expect(idoxAppState("Closed", "Prior Approval Required and Approved")).toBe("Permitted");
    expect(idoxAppState("Decision Made", "Prior Approval Not Required")).toBe("Permitted");
    expect(idoxAppState("Closed", "Condition Discharged")).toBe("Permitted");
    expect(idoxAppState("Closed", "Condition Partially Discharged")).toBe("Unresolved");
    expect(idoxAppState("Closed", "Condition Not Discharged")).toBe("Unresolved");
    expect(idoxAppState("In Review", null)).toBe("Undecided");
    expect(idoxAppState("Decided", "Approved with Conditions")).toBe("Conditions");
    expect(idoxAppState("Decided", "Unacceptable")).toBe("Rejected");
    expect(idoxAppState("Decided", "Acceptable")).toBe("Permitted");
    expect(idoxAppState("Decided", "Refused")).toBe("Rejected");
    expect(idoxAppState("Withdrawn", null)).toBe("Withdrawn");
    expect(idoxAppState("Decided", "Split Decision")).toBe("Unresolved");
    expect(postcodeIn("Bridge Cottage Glynwood Lane Chapel Hill Tintern NP16 6TH")).toBe("NP16 6TH");
    expect(postcodeIn("Land at Usk")).toBeNull();
  });
});

describe("parseIdoxResults, newer layout", () => {
  // Neath Port Talbot's register, November 2026: middle-dot separators and the status in a badge.
  const html = `<p class="pager top"><span class="showing"><strong>Showing 1-10</strong> of 14</span></p>
<ul id="searchresults">
<li class="searchresult">
<div class="badges"><div class="badge-status"><div class="label">Status:</div><div class="value">Awaiting decision</div></div></div>
<a href="/online-applications/applicationDetails.do?keyVal=TNMK0SKZ03300&amp;activeTab=summary" class="summaryLink">
<div class="summaryLinkTextClamp">Works to one Lime tree protected by Tree Preservation Order No. T345</div>
</a>
<p class="address">
20 Maes Yr Hafod Cadoxton Neath Port Talbot SA10 8AZ
</p>
<p class="metaInfo">
Ref. No:
P2026/0706
<span class="divider">&middot;</span>
Received: Mon 26 Oct 2026
<span class="divider">&middot;</span>
Validated: Tue 27 Oct 2026
</p>
</li>
</ul>`;
  it("reads the reference, dates and status", () => {
    const { items, total } = parseIdoxResults(html);
    expect(total).toBe(14);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ keyVal: "TNMK0SKZ03300", reference: "P2026/0706", received: "2026-10-26", validated: "2026-10-27", status: "Awaiting decision" });
  });
});
