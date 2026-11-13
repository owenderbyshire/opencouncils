/** A monthly overview of one council, as stored by pipeline/jobs/council-briefs.ts and shown on its page. */
import type { BriefPoint } from "./topic-brief";

export type CouncilSourceKind = "fact" | "record" | "upcoming" | "consultation" | "web";

export interface CouncilBriefSource {
  /** "f1", "r3", "u2", "c1", "w4": what points cite. */
  id: string;
  kind: CouncilSourceKind;
  title: string;
  url: string | null;
  meetingId: number | null;
  date: string | null;
}

export interface CouncilBriefContent {
  summary: BriefPoint | null;
  priorities: BriefPoint[];
  recent: BriefPoint[];
  watch: BriefPoint[];
  sources: CouncilBriefSource[];
  /** How far back the council records go. */
  recordsFrom: string;
}

export const COUNCIL_BRIEF_SECTIONS = ["priorities", "recent", "watch"] as const;

/**
 * "What to watch for" without the points that rest only on agendas for days
 * that have passed. The overview is written once a month, so a point such as
 * "On 10 November, the committee is due to look at..." would otherwise still
 * read as coming up after the meeting has happened.
 */
export function withoutPastWatch(c: CouncilBriefContent, today: string): CouncilBriefContent {
  const byId = new Map(c.sources.map((s) => [s.id, s]));
  const watch = c.watch.filter((p) => {
    const cited = p.sources.map((id) => byId.get(id)).filter((s) => s !== undefined);
    const agendas = cited.filter((s) => s.kind === "upcoming" && s.date);
    // Kept when it cites anything other than a dated agenda, or any agenda still to come.
    if (!agendas.length || agendas.length < cited.length) return true;
    return agendas.some((s) => s.date! >= today);
  });
  return watch.length === c.watch.length ? c : { ...c, watch };
}
