import { describe, expect, it } from "vitest";
import { withoutPastWatch, type CouncilBriefContent } from "./council-brief";

const brief = (watch: Array<{ en: string; sources: string[] }>): CouncilBriefContent => ({
  summary: null,
  priorities: [],
  recent: [],
  watch: watch.map((w) => ({ ...w, cy: w.en })),
  recordsFrom: "2026-08-07",
  sources: [
    { id: "u1", kind: "upcoming", title: "Agenda item", url: null, meetingId: 1, date: "2026-11-10" },
    { id: "u2", kind: "upcoming", title: "Agenda item", url: null, meetingId: 2, date: "2026-12-03" },
    { id: "r1", kind: "record", title: "Minutes", url: null, meetingId: 3, date: "2026-09-24" },
  ],
});

describe("withoutPastWatch", () => {
  it("drops a point resting only on agendas for days that have passed", () => {
    const out = withoutPastWatch(brief([{ en: "On 10 November...", sources: ["u1"] }]), "2026-11-12");
    expect(out.watch).toEqual([]);
  });
  it("keeps a point while its meeting is today or still to come", () => {
    expect(withoutPastWatch(brief([{ en: "On 10 November...", sources: ["u1"] }]), "2026-11-10").watch).toHaveLength(1);
    expect(withoutPastWatch(brief([{ en: "x", sources: ["u1", "u2"] }]), "2026-11-12").watch).toHaveLength(1);
  });
  it("keeps a point that also rests on something other than an agenda", () => {
    expect(withoutPastWatch(brief([{ en: "Budget in March", sources: ["u1", "r1"] }]), "2026-11-12").watch).toHaveLength(1);
    expect(withoutPastWatch(brief([{ en: "Budget in March", sources: ["r1"] }]), "2026-11-12").watch).toHaveLength(1);
  });
});
