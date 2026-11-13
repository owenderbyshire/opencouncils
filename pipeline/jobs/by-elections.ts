/**
 * Council by-elections in Wales since the May 2022 elections, from Open
 * Council Data's archive (pipeline/sources/by-elections.ts). Saved in
 * pipeline_state under "by-elections"; the elections pages read it.
 *
 *   pnpm pipeline by-elections
 */
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { BY_ELECTION_SOURCE, parseByElections, type ByElection } from "../sources/by-elections";

const FROM = "2022-05-06";

export interface ByElectionsState {
  updatedAt: string;
  rows: ByElection[];
}

export const byElectionsJob: Job = {
  name: "by-elections",
  watches: [
    {
      tags: ["reference"],
      sources: [{ table: "pipeline_state", where: "key = 'by-elections'", expr: "(value - 'updatedAt')::text" }],
    },
  ],
  description: "Council by-elections in Wales since May 2022, from Open Council Data",
  async run(ctx) {
    const thisYear = Number(new Date().toISOString().slice(0, 4));
    const rows: ByElection[] = [];
    const problems: string[] = [];
    for (let y = 2022; y <= thisYear; y++) {
      const url = BY_ELECTION_SOURCE(y);
      const r = await fetchText(url, { fresh: true });
      if (!r.ok) {
        problems.push(`${url}: ${r.error}`);
        continue;
      }
      const found = parseByElections(r.text, url).filter((x) => x.date >= FROM);
      ctx.count(`year ${y}`, found.length);
      rows.push(...found);
    }
    // A year's page can repeat a row from the year before it; keep one of each.
    const seen = new Set<string>();
    const unique = rows
      .filter((x) => {
        const k = `${x.date}|${x.councilId}|${x.ward}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    if (problems.length && !unique.length) throw new Error(problems.join("; "));
    // Never replace a good list with a much shorter one: a page may have changed shape.
    const previous = await ctx.getState<ByElectionsState>("by-elections");
    if (previous && unique.length < previous.rows.length * 0.8) {
      throw new Error(`found ${unique.length} by-elections, fewer than the ${previous.rows.length} saved before: the archive may have changed`);
    }
    await ctx.setState("by-elections", { updatedAt: new Date().toISOString(), rows: unique } satisfies ByElectionsState);
    ctx.count("by-elections", unique.length);
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
