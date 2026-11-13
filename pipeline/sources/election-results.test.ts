import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  checkResults,
  isMay2022CouncilElection,
  margins,
  nameKey,
  parseElectionResults,
  partyChanges,
  pickElection,
  shortKey,
  wardsOf,
  type Candidate,
} from "./election-results";

// The first ten candidates of Gwynedd's reply for its 2022 council election (id 9), as published.
const xml = readFileSync(new URL("../fixtures/moderngov/mg-election-results-gwynedd-2022.xml", import.meta.url), "utf8");

describe("parseElectionResults", () => {
  const r = parseElectionResults(xml)!;
  it("reads every candidate with their ward, party, votes and result", () => {
    expect(r.title).toBe("Local Government Elections 2022");
    expect(r.candidates).toHaveLength(10);
    expect(r.candidates[2]).toEqual({
      ward: "Yr Eifl",
      areaId: 282,
      name: "Jina Gwyrfai",
      partyLabel: "Plaid Cymru",
      partyId: "pc",
      votes: 198,
      elected: true,
      declared: "2022-05-06",
    });
    // No party published: kept empty, never guessed.
    expect(r.candidates[0].partyLabel).toBe("");
    expect(r.candidates[0].partyId).toBeNull();
  });
  it("recognises the 2022 council election and nothing else", () => {
    expect(isMay2022CouncilElection({ ...r, candidates: [...r.candidates, ...r.candidates, ...r.candidates] })).toBe(true);
    expect(isMay2022CouncilElection({ ...r, title: "Town and Community Council Elections May 2022" })).toBe(false);
    expect(isMay2022CouncilElection({ ...r, title: "Local Government Elections 2017" })).toBe(false);
    const undated = { title: "County Borough - Local elections", candidates: Array.from({ length: 30 }, () => ({ ...r.candidates[0], declared: "2016-07-27" })) };
    expect(isMay2022CouncilElection(undated)).toBe(false);
    const may = { title: "County Council", candidates: Array.from({ length: 30 }, () => ({ ...r.candidates[0] })) };
    expect(isMay2022CouncilElection(may)).toBe(true);
    expect(pickElection([{ reply: undated }, { reply: may }])?.reply).toBe(may);
    expect(parseElectionResults("<html>")).toBeNull();
  });
});

describe("wards, checks and margins", () => {
  const wards = wardsOf(parseElectionResults(xml)!.candidates);
  it("groups candidates by ward, most votes first", () => {
    expect(wards.map((w) => w.ward)).toEqual(["Cricieth", "Gogledd Pwllheli", "Pen draw Llyn", "Yr Eifl"]);
    expect(wards[3].candidates.map((c) => c.votes)).toEqual([198, 196, 175]);
  });
  it("passes a council only when the councillors elected match the seats filled", () => {
    expect(checkResults(wards, 4)).toEqual([]);
    expect(checkResults(wards, 69)).toEqual(["4 elected, but 69 seats were filled in 2022"]);
    const wrong = wards.map((w) => (w.ward === "Yr Eifl" ? { ...w, candidates: w.candidates.map((c) => ({ ...c, elected: c.name === "Lois Fychan" })) } : w));
    expect(checkResults(wrong, 4)[0]).toMatch(/Yr Eifl: a candidate not elected has more votes/);
  });
  it("measures each contested ward's margin between the last elected and the first not elected", () => {
    const m = margins(wards);
    expect(m.map((x) => [x.ward, x.votes])).toEqual([
      ["Yr Eifl", 2],
      ["Cricieth", 32],
      ["Gogledd Pwllheli", 62],
      ["Pen draw Llyn", 494],
    ]);
    expect(m[0].firstNotElected.name).toBe("Cian Ireland");
  });
  it("leaves out a ward where everyone standing was elected", () => {
    const solo = wardsOf([{ ward: "A", areaId: null, name: "X", partyLabel: "", partyId: null, votes: 0, elected: true, declared: null }]);
    expect(solo[0].uncontested).toBe(true);
    expect(margins(solo)).toEqual([]);
    expect(checkResults(solo, 1)).toEqual([]);
  });
});

describe("partyChanges", () => {
  const w = (name: string, label: string, partyId: string | null): Candidate => ({ ward: "W", areaId: null, name, partyLabel: label, partyId, votes: 1, elected: true, declared: null });
  const winners = [w("Jane Mary Jones", "Welsh Labour", "lab"), w("Owen Price", "Independent", "ind"), w("Sam Bevan", "Plaid Cymru", "pc"), w("Ann Rees", "", null)];
  it("counts only councillors matched by name whose recorded parties differ", () => {
    const now = [
      { id: 1, name: "Jane Jones", partyId: "ind", partyLabel: "Independent" },
      { id: 2, name: "Owen Price", partyId: null, partyLabel: "Gwynedd Independents" },
      { id: 3, name: "Sam Bevan", partyId: "pc", partyLabel: "Plaid Cymru" },
      { id: 4, name: "Ann Rees", partyId: "reform", partyLabel: "Reform UK" },
      { id: 5, name: "Nobody Known", partyId: "con", partyLabel: "Conservative" },
    ];
    expect(partyChanges(winners, now)).toEqual([
      { name: "Jane Jones", councillorId: 1, ward2022: "W", party2022: { id: "lab", label: "Welsh Labour" }, partyNow: { id: "ind", label: "Independent" } },
    ]);
  });
  it("matches names without titles, accents or honours", () => {
    expect(nameKey("Cllr Dr Siân M. Jones, MBE")).toBe("sian m jones");
    expect(shortKey("Siân M. Jones")).toBe("sian jones");
  });
});
