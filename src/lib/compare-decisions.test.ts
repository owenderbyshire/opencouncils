import { describe, expect, it } from "vitest";
import { COUNCILS } from "@data/curated/councils";
import { ISSUES, VISITOR_LEVY } from "@data/curated/compare-decisions";
import { levyCounts, rowState, taxFigures, yearBefore } from "./compare-decisions";

describe("issue tables", () => {
  it("give every council exactly one row, and every row a source or a stated gap", () => {
    for (const issue of ISSUES) {
      expect(issue.cells.map((c) => c.council).sort()).toEqual(COUNCILS.filter((c) => c.nation === "Wales").map((c) => c.id).sort());
      for (const c of issue.cells) {
        expect(Boolean(c.agendaItemId) !== Boolean(c.gap), `${issue.slug} ${c.council}`).toBe(true);
        if (c.agendaItemId) expect(c.meetingId, `${issue.slug} ${c.council}`).toBeTruthy();
        if (issue.slug === "visitor-levy") expect(Boolean(c.position), `${c.council}`).toBe(Boolean(c.agendaItemId));
        else expect(c.position).toBeUndefined();
      }
      expect(issue.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("count the visitor levy positions as the rows say", () => {
    const n = levyCounts(VISITOR_LEVY);
    expect(n.adopted).toEqual(["cardiff"]);
    expect(n.adopted.length + n.consulting.length + n.deferred.length + n["not-now"].length + n.none).toBe(22);
  });
});

describe("rowState", () => {
  it("shows a summary only when one is held and stands on its own", () => {
    expect(rowState({ agendaItemId: 1 }, { summaryEn: "Council agreed.", recorded: "RESOLVED" })).toBe("summary");
    expect(rowState({ agendaItemId: 1, summaryLeansOnOthers: true }, { summaryEn: "It then agreed.", recorded: "RESOLVED" })).toBe("recorded");
    expect(rowState({ agendaItemId: 1 }, { summaryEn: null, recorded: "RESOLVED that..." })).toBe("recorded");
    expect(rowState({ agendaItemId: 1 }, { summaryEn: null, recorded: "  " })).toBe("unrecorded");
    expect(rowState({ agendaItemId: 1 }, null)).toBe("none");
    expect(rowState({}, null)).toBe("none");
  });
});

describe("taxFigures", () => {
  const data = {
    councils: {
      ceredigion: { bandD: [{ year: "2025-26", total: 2296.09, county: 1886.567827 }, { year: "2026-27", total: 2419.45, county: 1976.180988 }] },
      npt: { bandD: [{ year: "2025-26", total: 1, county: 2002.784859 }, { year: "2026-27", total: 1, county: 2072.880991 }] },
      fresh: { bandD: [{ year: "2026-27", total: 1, county: 1000 }] },
      old: { bandD: [{ year: "2025-26", total: 1, county: 1000 }] },
    },
    wales: { bandD: [{ year: "2026-27", total: 2300.5 }] },
  };
  it("works out each council's change from its own share of Band D, to two decimal places of a percent", () => {
    const f = taxFigures(data, "2026-27")!;
    expect(f.councils.ceredigion.change).toBe(0.0475);
    expect(f.councils.npt.change).toBe(0.035);
    expect(f.councils.fresh.change).toBeNull();
    expect(f.councils.old).toBeUndefined();
    expect(f.count).toBe(3);
    expect(f.low).toEqual({ value: 0.035, ids: ["npt"] });
    expect(f.high).toEqual({ value: 0.0475, ids: ["ceredigion"] });
    expect(f.wales).toBe(2300.5);
  });
  it("names the year before", () => {
    expect(yearBefore("2026-27")).toBe("2025-26");
    expect(yearBefore("2000-01")).toBe("1999-00");
  });
});
