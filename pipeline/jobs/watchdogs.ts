/**
 * What the watchdogs have published about each council (pipeline/sources/watchdogs.ts):
 * Audit Wales reports and the Ombudsman's annual letters, read from Edau's
 * feed and kept as one `pipeline_state` entry, "watchdogs".
 *
 * A council whose read fails keeps what it had. When most reads fail the
 * whole entry stays as it was. Skips with a notice when Edau's feed is not
 * set up. Costs nothing: Edau's feed is free to the family's products.
 *
 *   pnpm pipeline watchdogs
 */
import { COUNCILS } from "../../data/curated/councils";
import type { Job } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { edauFeed } from "../sources/edau";
import { COUNCIL_ONS, readWatchdogs, type CouncilWatchdogs } from "../sources/watchdogs";

export interface WatchdogsState {
  updatedAt: string;
  councils: Record<string, CouncilWatchdogs & { readAt: string }>;
}

export const watchdogsJob: Job = {
  name: "watchdogs",
  watches: [{ tags: ["reference"], sources: [{ table: "pipeline_state", where: "key = 'watchdogs'", expr: "value::text" }] }],
  description: "Audit Wales reports and the Ombudsman's annual letters for each council, from Edau",
  async run(ctx) {
    const feed = edauFeed();
    if (!feed) {
      ctx.log("EDAU_FEED_URL and EDAU_FEED_KEY are not set; nothing read, nothing changed");
      return;
    }
    const before = await ctx.getState<WatchdogsState>("watchdogs");
    const councils: WatchdogsState["councils"] = { ...(before?.councils ?? {}) };
    const failed: string[] = [];
    for (const c of COUNCILS) {
      const ons = COUNCIL_ONS[c.id];
      if (!ons) {
        ctx.warn(`${c.id}: no ONS code`);
        failed.push(c.id);
        continue;
      }
      const r = await readWatchdogs(feed, ons);
      if (!r.ok) {
        ctx.warn(`${c.id}: ${r.error}; keeping what was held`);
        failed.push(c.id);
        continue;
      }
      councils[c.id] = { ...r.data, readAt: new Date().toISOString() };
      ctx.count("councils read");
      ctx.count("audit reports", r.data.reports.length);
      ctx.count("reports with an AI reading", r.data.reports.filter((x) => x.aiReading).length);
      ctx.count("annual letters", r.data.letters.length);
      if (r.data.reports.length) ctx.count("councils with audit reports");
      if (r.data.letters.length) ctx.count("councils with letters");
      ctx.log(`${c.id}: ${r.data.reports.length} reports, ${r.data.letters.length} letters`);
    }
    if (failed.length > COUNCILS.length / 2) {
      throw new Error(`${failed.length} of ${COUNCILS.length} councils could not be read; nothing changed`);
    }
    await ctx.setState("watchdogs", { updatedAt: new Date().toISOString(), councils } satisfies WatchdogsState);
    if (failed.length) throw new PartialFailure(`not read: ${failed.join(", ")}`);
  },
};
