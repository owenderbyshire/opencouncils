/** A monthly topic overview, as stored by pipeline/jobs/topic-briefs.ts and shown on each topic's page. */

export type BriefSourceKind = "record" | "consultation" | "web";

export interface BriefSource {
  /** "r3", "c1", "w2": what points cite. */
  id: string;
  kind: BriefSourceKind;
  title: string;
  url: string | null;
  councilId: string | null;
  meetingId: number | null;
  date: string | null;
}

export interface BriefPoint {
  en: string;
  cy: string;
  sources: string[];
}

export interface TopicBriefContent {
  summary: BriefPoint | null;
  happening: BriefPoint[];
  issues: BriefPoint[];
  policy: BriefPoint[];
  sources: BriefSource[];
  /** How far back the council records go, "2026-09-20". */
  recordsFrom: string;
}

export const BRIEF_SECTIONS = ["happening", "issues", "policy"] as const;
