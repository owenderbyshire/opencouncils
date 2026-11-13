/**
 * Council tax and budgets by service for every council, from StatsWales (pipeline/sources/council-data.ts). These are
 * published once or twice a year, so the job runs weekly, or with --force.
 *
 * Each dataset's rows are matched on their labels. A sample of every dataset
 * (headers, a few rows, each column's values) is saved as
 * probe:statswales-<key> so the matching can be checked. A dataset whose
 * figures can't be matched for most councils keeps what the website already
 * shows.
 *
 *   pnpm pipeline council-data [--force]
 */
import { COUNCILS } from "../../data/curated/councils";
import type { Job } from "../lib/job";
import { PartialFailure } from "../lib/job";
import {
  bandD,
  DATASETS,
  emptyFigures,
  sample,
  spend,
  SPEND_LABELS,
  spendHistory,
  support,
  SUPPORT_LABELS,
  tidy,
  type CouncilData,
  type DatasetKey,
  type Tidy,
} from "../sources/council-data";
import { edauFeed, edauSlice, readSome } from "../sources/edau";
import { statsWalesAll, statsWalesMeta, type StatsWalesMeta } from "../sources/statswales";

const WEEK = 7 * 86_400_000;
/** Revenue outturn expenditure by authority and service: what was actually spent. */
const OUTTURN = "213aeb99-18eb-42c9-b00e-e4b716e82cdf";
/** Standard spending assessments and central government support. */
const SUPPORT = "e3aa4de2-5084-4f57-afeb-f21d17fa9bd5";

export interface CouncilDataMeta {
  updatedAt: string;
  sources: Partial<Record<DatasetKey, { id: string; titleEn: string | null; titleCy: string | null; coverageEnd: string | null; matched: number }>>;
  /** "edau" when the last update read StatsWales through Edau's feed. */
  via?: "edau" | null;
}

export const councilDataJob: Job = {
  name: "council-data",
  watches: [
    {
      tags: ["reference"],
      sources: [{ table: "pipeline_state", where: "key = 'council-data'", expr: "value::text" }],
    },
  ],
  description: "Council tax and budgets by service, from StatsWales",
  async run(ctx) {
    const meta = await ctx.getState<CouncilDataMeta>("council-data-meta");
    if (!ctx.args.force && meta && Date.now() - Date.parse(meta.updatedAt) < WEEK) {
      ctx.log(`updated ${meta.updatedAt.slice(0, 10)}; next update after a week (or pass --force)`);
      return;
    }
    const previous = (await ctx.getState<CouncilData>("council-data")) ?? null;
    const data: CouncilData = {
      councils: Object.fromEntries(COUNCILS.map((c) => [c.id, previous?.councils[c.id] ?? emptyFigures()])),
      wales: previous?.wales ?? emptyFigures(),
    };
    const sources: CouncilDataMeta["sources"] = { ...(meta?.sources ?? {}) };
    const problems: string[] = [];
    const feed = edauFeed();
    ctx.log(feed ? "StatsWales figures: read from Edau's feed" : "StatsWales figures: read from StatsWales (EDAU_FEED_URL and EDAU_FEED_KEY are not set)");
    // Every row of a dataset, and its metadata: through Edau when it is set up, otherwise from StatsWales.
    const metaFromEdau = new Map<string, StatsWalesMeta | null>();
    const readAll = async (id: string) => {
      if (!feed) return statsWalesAll(id);
      const e = await edauSlice(feed, id, "whole");
      if (!e.ok) return { ok: false as const, error: e.error, tried: [`edau: ${e.error}`], filters: null };
      metaFromEdau.set(id, e.meta);
      return { ok: true as const, rows: e.rows, tried: [`edau: ${e.rows.length} rows`], filters: null };
    };
    const readMeta = async (id: string): Promise<Awaited<ReturnType<typeof statsWalesMeta>>> => {
      if (!feed) return statsWalesMeta(id);
      const m = metaFromEdau.get(id);
      return m ? { ok: true, meta: m } : { ok: false, error: "Edau gave no metadata for the dataset" };
    };

    for (const key of Object.keys(DATASETS) as DatasetKey[]) {
      const id = DATASETS[key];
      const r = await readAll(id);
      const filters = JSON.stringify(r.filters ?? null).slice(0, 20_000);
      if (!r.ok) {
        await ctx.setState(`probe:statswales-${key}`, { at: new Date().toISOString(), tried: r.tried, filters });
        problems.push(`${key}: ${r.error}`);
        continue;
      }
      await ctx.setState(`probe:statswales-${key}`, { at: new Date().toISOString(), tried: r.tried, ...sample(r.rows), filters });
      const rows: Tidy[] = tidy(r.rows);
      ctx.log(`${key}: ${r.rows.length} rows, ${rows.length} matched to an area and year`);

      // Pick the figures, then check they cover the councils before keeping them.
      const pick = (area: string) => {
        switch (key) {
          case "bandD":
            return bandD(rows).get(area);
          case "budget":
            return spend(rows).get(area);
        }
      };
      const found = COUNCILS.filter((c) => {
        const v = pick(c.id);
        return Array.isArray(v) ? v.length > 0 : Boolean(v);
      });
      if (found.length < 20) {
        problems.push(`${key}: figures matched for only ${found.length} of 22 councils; kept the previous figures`);
        continue;
      }
      const field = { bandD: "bandD", budget: "spend" } as const;
      const set = (area: string, target: CouncilData["wales"]) => {
        const v = pick(area);
        if (v !== undefined) (target as unknown as Record<string, unknown>)[field[key]] = v;
      };
      for (const c of found) set(c.id, data.councils[c.id]);
      // The councils' own total where StatsWales gives one, otherwise Wales.
      set(pick("wales-councils") ? "wales-councils" : "wales", data.wales);

      const m = await readMeta(id);
      sources[key] = {
        id,
        titleEn: m.ok ? m.meta.titleEn : (sources[key]?.titleEn ?? null),
        titleCy: m.ok ? m.meta.titleCy : (sources[key]?.titleCy ?? null),
        coverageEnd: m.ok ? m.meta.coverageEnd : (sources[key]?.coverageEnd ?? null),
        matched: found.length,
      };
      ctx.count(`${key}Councils`, found.length);
    }

    // What each council actually spent, year by year.
    const out = await readSome(feed, OUTTURN, SPEND_LABELS);
    if (out.ok) {
      const hist = spendHistory(tidy(out.rows));
      const found = COUNCILS.filter((c) => hist.get(c.id)?.length);
      if (found.length >= 20) {
        for (const c of found) data.councils[c.id].outturn = hist.get(c.id)!.slice(-10);
        data.wales.outturn = (hist.get("wales-councils") ?? hist.get("wales") ?? []).slice(-10);
        ctx.count("outturnCouncils", found.length);
      } else {
        problems.push(`outturn: matched ${found.length} of 22 councils`);
        await ctx.setState("probe:statswales-outturn", { at: new Date().toISOString(), tried: [feed ? "edau" : "statswales"], ...sample(out.rows) });
      }
    } else problems.push(`outturn: ${out.error}`);

    // What the Welsh Government gives each council.
    const sup = await readSome(feed, SUPPORT, SUPPORT_LABELS);
    if (sup.ok) {
      const bySupport = support(tidy(sup.rows));
      const found = COUNCILS.filter((c) => bySupport.get(c.id)?.length);
      if (found.length >= 20) {
        for (const c of found) data.councils[c.id].support = bySupport.get(c.id)!.slice(-12);
        data.wales.support = (bySupport.get("wales-councils") ?? []).slice(-12);
        ctx.count("supportCouncils", found.length);
      } else problems.push(`support: matched ${found.length} of 22 councils`);
    } else problems.push(`support: ${sup.error}`);

    await ctx.setState("council-data", data);
    await ctx.setState("council-data-meta", { updatedAt: new Date().toISOString(), sources, via: feed ? "edau" : null } satisfies CouncilDataMeta);
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
