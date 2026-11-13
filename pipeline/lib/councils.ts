import { ACTIVE_COUNCILS, RECORD_COUNCILS, type CouncilConfig } from "../../data/curated/councils";
import type { JobContext } from "./job";
import { argString } from "./util";

export type ModernGovCouncil = CouncilConfig & { moderngovBase: string };

/**
 * The councils a job should work on: every active ModernGov council, or the
 * one named with `--council cardiff`.
 */
export function councilsFor(ctx: JobContext): ModernGovCouncil[] {
  const only = argString(ctx.args, "council");
  const list = ACTIVE_COUNCILS.filter((c) => !only || c.id === only) as ModernGovCouncil[];
  if (only && !list.length) throw new Error(`No active ModernGov council called "${only}"`);
  return list;
}

/**
 * Councils whose meetings are in the database from any system: for jobs that
 * work from the database (summaries, the search index), not from ModernGov.
 */
export function recordCouncilsFor(ctx: JobContext): CouncilConfig[] {
  const only = argString(ctx.args, "council");
  const list = RECORD_COUNCILS.filter((c) => !only || c.id === only);
  if (only && !list.length) throw new Error(`No active council called "${only}"`);
  return list;
}
