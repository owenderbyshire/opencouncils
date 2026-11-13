import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isKeyType, isModernGovPage, officerPost, parseDecisionTableIds, parseDue, parseExecPost, parseExecPostList, parseForthcoming, parseIssue } from "./moderngov-pages";

/* Real replies from councils' ModernGov sites, read on 11 November 2026, with officers' names and contact details taken out. */
const fixture = (name: string) => readFileSync(path.join(import.meta.dirname, "../fixtures/moderngov", name), "utf8");

describe("executive posts", () => {
  it("lists a council's posts (Swansea)", () => {
    const posts = parseExecPostList(fixture("exec-posts-swansea.html"));
    expect(posts).toHaveLength(10);
    expect(posts).toContainEqual({ id: 196, title: "Cabinet Member - Economy, Finance and Strategy (Leader)" });
    expect(posts).toContainEqual({ id: 774, title: "Cabinet Member - Children, Young People & families" });
  });

  it("reads who holds a post, including a shared one (Swansea)", () => {
    expect(parseExecPost(fixture("exec-post-swansea-572.html"))).toEqual({
      title: "Cabinet Member - Community (Job Share)",
      holders: [
        { councillorId: 630, name: "Cyril Anderson" },
        { councillorId: 2192, name: "Rebecca Fogarty" },
      ],
    });
  });

  it("gives no holder for a vacant post (Newport)", () => {
    expect(parseExecPost(fixture("exec-post-newport-613.html"))).toEqual({ title: "Cabinet Member for Infrastructure", holders: [] });
  });

  it("reads a political group's post as the page gives it (Neath Port Talbot); the site leaves such posts out later", () => {
    expect(parseExecPost(fixture("exec-post-npt-342.html"))).toEqual({ title: "Leader of Plaid Cymru", holders: [{ councillorId: 70, name: "Councillor Alun Llewelyn" }] });
  });

  it("does not take another page for a post", () => {
    expect(parseExecPost("<html><body><h1>Just a moment...</h1></body></html>")).toBeNull();
    expect(parseExecPostList("<html><body><h1>Just a moment...</h1></body></html>")).toEqual([]);
    expect(isModernGovPage("<html><title>Azure WAF</title></html>")).toBe(false);
    expect(isModernGovPage(fixture("exec-posts-swansea.html"))).toBe(true);
  });
});

describe("when a decision is due", () => {
  it("reads the forms ModernGov uses", () => {
    expect(parseDue("28/01/2027")).toEqual({ date: "2027-01-28", monthOnly: false });
    expect(parseDue("17 Dec 2026")).toEqual({ date: "2026-12-17", monthOnly: false });
    expect(parseDue("3 Nov 2026")).toEqual({ date: "2026-11-03", monthOnly: false });
    expect(parseDue("01/2027")).toEqual({ date: "2027-01-01", monthOnly: true });
    expect(parseDue("June 2027")).toEqual({ date: "2027-06-01", monthOnly: true });
  });
  it("gives nothing for anything else", () => {
    for (const s of ["", "Not before 1st Jan 2027", "31/02/2027", "13/2027", "Spring 2027", "TBC"]) expect(parseDue(s)).toBeNull();
  });
});

describe("forthcoming decisions", () => {
  it("reads a council's list (Swansea)", () => {
    const list = parseForthcoming(fixture("forthcoming-swansea.html"));
    expect(list.recognised).toBe(true);
    expect(list.decisions).toHaveLength(33);
    expect(list.decisions[0]).toEqual({
      issueId: 62187,
      title: "Adoption of the Council Tax Reduction Scheme.",
      purpose:
        "To explain the requirement to annually consider whether to revise or replace the Council’s existing Council Tax Reduction Scheme and the requirement to either adopt a new scheme or re-adopt the existing scheme by 31 January 2027.",
      makers: "Council",
      due: { date: "2027-01-28", monthOnly: false },
      dueUnread: null,
      noticePublished: "2026-11-06",
      restriction: "Open",
    });
    const civic = list.decisions.find((d) => d.issueId === 62186)!;
    expect(civic.title).toBe("Civic Centre Next Steps.");
    expect(civic.makers).toBe("Cabinet");
    expect(civic.due).toEqual({ date: "2026-12-17", monthOnly: false });
    // "Fully exempt - view reasons": the link's words are not part of it.
    expect(civic.restriction).toBe("Fully exempt");
    // Every entry has a title and a link to the council's page for it; officers' names are not read at all.
    for (const d of list.decisions) {
      expect(d.title.length).toBeGreaterThan(3);
      expect(d.title).not.toMatch(/^\d{2}\/\d{2}\/\d{4}/);
      expect(Object.keys(d)).not.toContain("leadOfficer");
    }
  });

  it("knows an empty list from a page that is not the list (Neath Port Talbot lists none)", () => {
    const none = parseForthcoming(fixture("forthcoming-npt-none.html"));
    expect(none).toEqual({ recognised: true, decisions: [] });
    expect(parseForthcoming("<html><title>Azure WAF</title><body>JS Challenge</body></html>")).toEqual({ recognised: false, decisions: [] });
    expect(parseForthcoming(fixture("exec-posts-swansea.html")).recognised).toBe(false);
  });

  it("reads which matters the council's own filter calls key decisions (Swansea)", () => {
    const key = parseDecisionTableIds(fixture("forthcoming-key-swansea.html"));
    expect(key.recognised).toBe(true);
    expect(key.issueIds).toHaveLength(33);
    expect(key.issueIds).toContain(62186);
    expect(parseDecisionTableIds("<html></html>")).toEqual({ recognised: false, issueIds: [] });
  });
});

describe("a council's page for one matter", () => {
  it("reads the lead member, the type and when it goes to Cabinet (Swansea)", () => {
    expect(parseIssue(fixture("issue-swansea-62186.html"))).toEqual({
      title: "Civic Centre Next Steps.",
      decisionType: "Allweddol",
      status: "For Determination",
      stages: [{ maker: "Cabinet", due: { date: "2026-12-17", monthOnly: false } }],
      leadMember: "Cabinet Member - Investment & Delivery (Joint Deputy Leader)",
      leadDirector: "Director of Place",
      agendaItems: [],
    });
  });

  it("reads each body a matter goes to, and the agenda items the council links (Conwy)", () => {
    const issue = parseIssue(fixture("issue-conwy-31289.html"))!;
    expect(issue.title).toBe("Revised Local Development Plan (RLDP) - Submission");
    expect(issue.decisionType).toBe("Key");
    expect(issue.stages).toEqual([
      { maker: "Economy and Place Overview and Scrutiny Committee", due: { date: "2026-12-10", monthOnly: false } },
      { maker: "Cabinet", due: { date: "2026-12-15", monthOnly: false } },
      { maker: "Council", due: { date: "2026-12-17", monthOnly: false } },
    ]);
    expect(issue.leadMember).toBe("Cabinet Member for Finance and Strategic Planning");
    expect(issue.leadDirector).toBeNull();
    expect(issue.agendaItems).toEqual([{ agendaItemId: 32482, date: "2012-02-23", committee: "Council" }]);
    // The contact line names an officer: it is not read.
    expect(JSON.stringify(issue)).not.toMatch(/contact|removed/i);
  });

  it("is not fooled by another page", () => {
    expect(parseIssue(fixture("exec-post-newport-613.html"))).toBeNull();
    expect(parseIssue("<html></html>")).toBeNull();
  });

  it("keeps a lead officer's post and never a name", () => {
    // Posts as Swansea and Carmarthenshire write them.
    expect(officerPost("Director of Place")).toBe("Director of Place");
    expect(officerPost("Head of Service - Adult Services & Tackling Poverty")).toBe("Head of Service - Adult Services & Tackling Poverty");
    expect(officerPost("Deputy Chief Legal")).toBe("Deputy Chief Legal");
    expect(officerPost("Director of Place & Infrastructure")).toBe("Director of Place & Infrastructure");
    // Anything that does not open with a rank could be a person: left out.
    expect(officerPost("Jane Example")).toBeNull();
    expect(officerPost("Jane Example, Director of Place")).toBeNull();
    expect(officerPost("Director of Place (jane.example@example.gov.uk)")).toBeNull();
    expect(officerPost("")).toBeNull();
    expect(officerPost(null)).toBeNull();
  });

  it("says key or not only when the council's word does", () => {
    expect(isKeyType("Key")).toBe(true);
    expect(isKeyType("Allweddol")).toBe(true);
    expect(isKeyType("Non-Key")).toBe(false);
    expect(isKeyType("Non key")).toBe(false);
    expect(isKeyType("Operational")).toBeNull();
    expect(isKeyType(null)).toBeNull();
  });
});
