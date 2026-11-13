import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { WatchdogsState } from "../../pipeline/jobs/watchdogs";
import type { CouncilWatchdogs } from "../../pipeline/sources/watchdogs";
import { one, sql } from "./db";

export type { AnnualLetter, AuditFinding, AuditReport, CouncilWatchdogs } from "../../pipeline/sources/watchdogs";

/**
 * Audit Wales reports about a council and the Ombudsman's annual letters to
 * it, as the pipeline copied them from Edau (pipeline/jobs/watchdogs.ts).
 * Null when nothing is held for the council.
 */
export async function councilWatchdogs(councilId: string): Promise<(CouncilWatchdogs & { readAt: string }) | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const r = await one<{ value: WatchdogsState }>(sql`select value from pipeline_state where key = 'watchdogs'`).catch(() => null);
  const c = r?.value?.councils?.[councilId];
  if (!c || (!c.reports.length && !c.letters.length)) return null;
  return c;
}
