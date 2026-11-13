/**
 * The Welsh Government's quarterly count of planning applications received
 * by each authority (pipeline/sources/dm-survey.ts), back to late 2021, to
 * check how complete our own collection is. Each release covers five
 * quarters; a newer release's figure for a quarter replaces an older one, as
 * authorities sometimes revise them. Releases already read are skipped.
 *
 *   pnpm pipeline planning-official [--force]
 */
import { fetchBytes, fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { odsLink, parseSurvey, releaseLinks, SURVEY_SERIES, type QuarterCount } from "../sources/dm-survey";
import { parseOds } from "../sources/ods";

const WEEK = 7 * 86_400_000;
/** Far enough back to cover the planning history (from November 2021). */
const OLDEST = "october-december-2021";

export interface OfficialCounts {
  checked: string;
  /** Release pages read, newest first. */
  releases: string[];
  counts: QuarterCount[];
}

export const planningOfficialJob: Job = {
  name: "planning-official",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "pipeline_state", where: "key = 'planning-official'", expr: "(value - 'checked')::text" }],
    },
  ],
  description: "The Welsh Government's quarterly counts of planning applications received, to check completeness",
  async run(ctx) {
    const had = (await ctx.getState<OfficialCounts>("planning-official")) ?? { checked: "", releases: [], counts: [] };
    if (ctx.args.force !== true && had.checked && Date.now() - Date.parse(had.checked) < WEEK) {
      ctx.log(`checked on ${had.checked.slice(0, 10)}; next check after a week`);
      return;
    }
    const page = await fetchText(SURVEY_SERIES, { fresh: true });
    if (!page.ok) throw new Error(`series page: ${page.error}`);
    const all = releaseLinks(page.text);
    const cut = all.findIndex((u) => u.endsWith(OLDEST));
    const wanted = cut >= 0 ? all.slice(0, cut + 1) : all.slice(0, 20);
    // Oldest first, so newer releases' figures replace older ones.
    const toRead = wanted.filter((u) => !had.releases.includes(u) || u === wanted[0]).reverse();
    const byKey = new Map(had.counts.map((c) => [`${c.authority} ${c.quarter}`, c]));
    const problems: string[] = [];
    const read: string[] = [];
    for (const url of toRead) {
      const rel = await fetchText(url, { fresh: true });
      const ods = rel.ok ? odsLink(rel.text) : null;
      if (!rel.ok) {
        problems.push(`${url}: ${rel.error}`);
        continue;
      }
      if (!ods) {
        // Each quarter appears in five releases, so one without a spreadsheet leaves no gap.
        ctx.warn(`${url}: no .ods spreadsheet on the page; its quarters come from the releases either side`);
        read.push(url);
        continue;
      }
      const file = await fetchBytes(ods);
      if (!file.ok) {
        problems.push(`${ods}: ${file.error}`);
        continue;
      }
      let counts: QuarterCount[];
      try {
        counts = parseSurvey(parseOds(file.bytes));
      } catch (e) {
        problems.push(`${ods}: ${(e as Error).message}`);
        continue;
      }
      if (!counts.length) {
        problems.push(`${ods}: no figures found (the layout may have changed)`);
        continue;
      }
      for (const c of counts) byKey.set(`${c.authority} ${c.quarter}`, c);
      read.push(url);
      ctx.count("releases");
    }
    const counts = [...byKey.values()].sort((a, b) => a.authority.localeCompare(b.authority) || a.start.localeCompare(b.start));
    await ctx.setState("planning-official", {
      checked: problems.length ? had.checked : new Date().toISOString(),
      releases: [...new Set([...read, ...had.releases])],
      counts,
    } satisfies OfficialCounts);
    ctx.count("quarters", counts.length);
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
