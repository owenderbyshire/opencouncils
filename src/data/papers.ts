import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CouncilPaperKind, MoneyContent, PaperRef, RisksContent } from "@/lib/council-papers";
import { rows, sql } from "./db";

export interface CouncilPaperRow<C> {
  kind: CouncilPaperKind;
  meetingId: number;
  itemId: number | null;
  date: string;
  committee: string;
  title: string;
  documents: PaperRef[];
  content: C;
}

export interface CouncilPapers {
  risks: CouncilPaperRow<RisksContent> | null;
  budget: CouncilPaperRow<MoneyContent> | null;
  monitoring: CouncilPaperRow<MoneyContent> | null;
}

/** A council's latest risk register, budget and budget monitoring, as read by pipeline/jobs/council-papers.ts. */
export async function councilPapers(councilId: string): Promise<CouncilPapers> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councils");
  const found = await rows<CouncilPaperRow<unknown>>(sql`
    select kind, meeting_id as "meetingId", item_id as "itemId", date::text as date, committee, title, documents, content
    from council_papers where council_id = ${councilId}`).catch(() => []);
  const pick = <C,>(k: CouncilPaperKind) => (found.find((r) => r.kind === k) as CouncilPaperRow<C> | undefined) ?? null;
  return { risks: pick<RisksContent>("risks"), budget: pick<MoneyContent>("budget"), monitoring: pick<MoneyContent>("monitoring") };
}
