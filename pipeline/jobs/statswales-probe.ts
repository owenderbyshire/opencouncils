/**
 * Saves a sample of StatsWales datasets (columns, a few rows, each column's
 * values) as probe:sw-<first 8 characters of the id>, for working out how to
 * read a new dataset. Development only.
 *
 *   pnpm pipeline statswales-probe --ids <id>,<id>
 */
import type { Job } from "../lib/job";
import { statsWalesFilters } from "../sources/statswales";

export const statsWalesProbeJob: Job = {
  name: "statswales-probe",
  description: "Save samples of StatsWales datasets for development",
  async run(ctx) {
    const ids = String(ctx.args.ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^[0-9a-f-]{36}$/.test(s));
    for (const id of ids) {
      // The filters list every column's values, which is all that's needed to read a dataset; the rows can be huge.
      const f = await statsWalesFilters(id);
      await ctx.setState(
        `probe:sw-${id.slice(0, 8)}`,
        f.ok
          ? {
              at: new Date().toISOString(),
              distinct: Object.fromEntries(f.columns.map((c) => [`${c.names.join(" / ")}`, [...c.values.values()].slice(0, 60)])),
            }
          : { error: f.error },
      );
      ctx.log(`${id}: ${f.ok ? `${f.columns.length} columns` : f.error}`);
    }
  },
};
