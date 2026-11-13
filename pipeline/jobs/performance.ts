/**
 * How each council is doing, from StatsWales (data/curated/performance.ts).
 * For each measure: the series for every council and for Wales, matched on
 * labels. Counts with breakdowns take the largest matching figure, which is
 * the total. A measure that matches fewer than 20 councils keeps what the
 * website already shows. Runs weekly, or with --force.
 *
 *   pnpm pipeline performance [--force]
 */
import { COUNCILS } from "../../data/curated/councils";
import { MEASURES } from "../../data/curated/performance";
import type { Job } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { tidy, type Tidy } from "../sources/council-data";
import { edauFeed, edauSlice, readSome, type EdauFeed } from "../sources/edau";
import { statsWalesSome } from "../sources/statswales";

const WEEK = 7 * 86_400_000;
/** Points kept per series: twelve years, or two years of months. */
const KEEP = { year: 12, month: 25 } as const;

export type Point = { period: string; value: number };
export interface PerformanceData {
  updatedAt: string;
  measures: Record<
    string,
    {
      councils: Record<string, Point[]>;
      wales: Point[];
      /** `via` is "edau" when the figures were read through Edau's feed. */
      source: { id: string; titleEn: string | null; titleCy: string | null; via?: "edau" | null };
    }
  >;
}

export function series(rows: Tidy[], labels: string[], unit: string, keep: number): Map<string, Point[]> {
  const byKey = new Map<string, number>();
  for (const r of rows) {
    if (!labels.every((l) => r.labels.has(l))) continue;
    const k = `${r.area}|${r.year}`;
    const prev = byKey.get(k);
    // Counts broken down further: the total is the largest.
    byKey.set(k, prev === undefined ? r.value : unit === "count" ? Math.max(prev, r.value) : prev);
  }
  const out = new Map<string, Point[]>();
  for (const [k, value] of byKey) {
    const [area, period] = k.split("|");
    const list = out.get(area) ?? [];
    list.push({ period, value });
    out.set(area, list);
  }
  for (const [area, list] of out) out.set(area, list.sort((a, b) => a.period.localeCompare(b.period)).slice(-keep));
  return out;
}

const POPULATION = "82d9faea-b515-41cd-aedb-8f4594f66ce5";

/** Mid-year population estimates for every council and Wales, all ages. */
async function loadPopulation(problems: string[], feed: EdauFeed | null): Promise<Map<string, Point[]> | null> {
  const labels = ["all ages", "persons", "population"];
  const r = feed ? await edauSlice(feed, POPULATION, labels) : await statsWalesSome(POPULATION, labels);
  if (!r.ok) {
    problems.push(`population: ${r.error}`);
    return null;
  }
  return series(tidy(r.rows), ["all ages", "persons", "population"], "count", 40);
}

/** The population for a period: the estimate for its year, or the latest before it. */
export function peopleIn(pop: Map<string, Point[]>, area: string, period: string): number | null {
  const list = pop.get(area) ?? (area === "wales-councils" ? pop.get("wales") : undefined) ?? [];
  const year = period.slice(0, 4);
  const hit = [...list].reverse().find((p) => p.period <= year) ?? list[0];
  return hit?.value ?? null;
}

export const performanceJob: Job = {
  name: "performance",
  watches: [
    {
      tags: ["reference"],
      sources: [{ table: "pipeline_state", where: "key = 'performance'", expr: "value::text" }],
    },
  ],
  description: "How each council is doing: homelessness, housing, children and schools, from StatsWales",
  async run(ctx) {
    const previous = await ctx.getState<PerformanceData>("performance");
    if (!ctx.args.force && previous && Date.now() - Date.parse(previous.updatedAt) < WEEK) {
      ctx.log(`updated ${previous.updatedAt.slice(0, 10)}; next update after a week (or pass --force)`);
      return;
    }
    const data: PerformanceData = { updatedAt: new Date().toISOString(), measures: { ...(previous?.measures ?? {}) } };
    const problems: string[] = [];
    const feed = edauFeed();
    ctx.log(feed ? "StatsWales figures: read from Edau's feed" : "StatsWales figures: read from StatsWales (EDAU_FEED_URL and EDAU_FEED_KEY are not set)");
    let population: Map<string, Point[]> | null | undefined;
    const cache = new Map<string, { rows: Tidy[]; titleEn: string | null; titleCy: string | null; via: "edau" | null } | null>();
    for (const m of MEASURES) {
      if (!cache.has(m.dataset)) {
        // Every label any measure on this dataset needs, so one request serves them all.
        const wanted = MEASURES.filter((x) => x.dataset === m.dataset).flatMap((x) => [...x.labels, ...(x.numerator ?? []), ...(x.plus ?? [])]);
        const r = await readSome(feed, m.dataset, wanted);
        cache.set(m.dataset, r.ok ? { rows: tidy(r.rows), titleEn: r.titleEn, titleCy: r.titleCy, via: r.via } : null);
        if (!r.ok) problems.push(`${m.dataset}: ${r.error}`);
      }
      const d = cache.get(m.dataset);
      if (!d) continue;
      // Counts, including those turned into a rate per head below, take the total row when the labels also match breakdowns.
      let s = series(d.rows, m.labels, m.numerator || m.per ? "count" : m.unit, KEEP[m.frequency]);
      if (m.numerator) {
        // A share of two published counts, period by period.
        const top = series(d.rows, m.numerator, "count", KEEP[m.frequency]);
        s = new Map(
          [...s].map(([area, list]) => [
            area,
            list.flatMap((p) => {
              const t = top.get(area)?.find((x) => x.period === p.period);
              return t && p.value > 0 ? [{ period: p.period, value: t.value / p.value }] : [];
            }),
          ]),
        );
      }
      if (m.per) {
        population ??= await loadPopulation(problems, feed);
        const pop = population;
        s = new Map(
          [...s].map(([area, list]) => [
            area,
            list.flatMap((p) => {
              const people = pop ? peopleIn(pop, area, p.period) : null;
              return people ? [{ period: p.period, value: (p.value / people) * m.per! }] : [];
            }),
          ]),
        );
      }
      if (m.plus) {
        // Both rows must be there for a period to count, so a missing half never passes for the total.
        const other = series(d.rows, m.plus, "count", KEEP[m.frequency]);
        s = new Map(
          [...s].map(([area, list]) => [
            area,
            list.flatMap((p) => {
              const o = other.get(area)?.find((x) => x.period === p.period);
              return o ? [{ period: p.period, value: p.value + o.value }] : [];
            }),
          ]),
        );
      }
      if (m.scale) {
        const k = m.scale;
        s = new Map([...s].map(([area, list]) => [area, list.map((p) => ({ ...p, value: p.value * k }))]));
      }
      const found = COUNCILS.filter((c) => s.get(c.id)?.length);
      if (found.length < (m.minCouncils ?? 20)) {
        const missing = COUNCILS.filter((c) => !s.get(c.id)?.length).map((c) => c.id);
        problems.push(`${m.key}: matched ${found.length} of 22 councils (none for ${missing.join(", ")}); kept the previous figures`);
        continue;
      }
      data.measures[m.key] = {
        councils: Object.fromEntries(found.map((c) => [c.id, s.get(c.id)!])),
        wales: s.get("wales-councils") ?? s.get("wales") ?? [],
        source: { id: m.dataset, titleEn: d.titleEn, titleCy: d.titleCy, via: d.via },
      };
      ctx.count("measures");
    }
    await ctx.setState("performance", data);
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
