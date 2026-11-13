import "server-only";
import { leagueExclusion } from "@/lib/planning-status";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import type { PerformanceData, Point } from "../../pipeline/jobs/performance";
import { one, rows, sql } from "./db";
import type { MeasureValues } from "@/lib/scores";
import { CARRIED_FORWARD, MEASURES as CURATED } from "@data/curated/performance";
import { COUNCILS } from "@data/curated/councils";
import { planningLeague } from "./planning";
import { councilActivity } from "./council";

export type { PerformanceData, Point };
export { MEASURES, type Measure } from "@data/curated/performance";

/** Official measures for every council (pipeline/jobs/performance.ts). */
export async function getPerformance(): Promise<PerformanceData | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const r = await one<{ value: PerformanceData }>(sql`select value from pipeline_state where key = 'performance'`).catch(() => null);
  return r?.value ?? null;
}

export interface PlanningSpeed {
  authority: string;
  received: number;
  within8: number;
}

/**
 * Of the applications (other than large ones) received three to six months
 * ago, how many were decided within eight weeks of arriving. Measured on a
 * group of applications that have all had time to be decided, so slow ones
 * aren't left out. Withdrawn applications don't count.
 */
export async function planningSpeed(): Promise<PlanningSpeed[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("planning");
  const today = ukToday();
  return rows<PlanningSpeed>(sql`
    select authority, count(*)::int as received,
      count(*) filter (where decided_date is not null and decided_date - start_date <= 56)::int as within8
    from planning_applications
    where start_date between ${today}::date - 183 and ${today}::date - 91
      and coalesce(app_size, '') <> 'Large' and coalesce(app_state, '') <> 'Withdrawn'
    group by authority
  `).catch(() => []);
}


const STATSWALES_PAGE = (id: string) => `https://stats.gov.wales/en-GB/${id}`;

/**
 * Every measure for every council, ready to score: the StatsWales measures
 * at the latest period most councils share, plus planning speed and
 * councillors' attendance from OpenCouncil's own records.
 */
export async function performanceMeasures(): Promise<MeasureValues[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference", "planning", "meetings");
  const [perf, league, activity] = await Promise.all([getPerformance(), planningLeague(), councilActivity().catch(() => [])]);
  const out: MeasureValues[] = [];
  for (const m of CURATED) {
    const d = perf?.measures[m.key];
    if (!d) continue;
    // The latest period that at least 20 councils have a figure for.
    const counts = new Map<string, number>();
    for (const s of Object.values(d.councils)) for (const p of s) counts.set(p.period, (counts.get(p.period) ?? 0) + 1);
    const period = [...counts].filter(([, n]) => n >= 20).map(([p]) => p).sort().at(-1) ?? null;
    if (!period) continue;
    const values: Record<string, number> = {};
    for (const [id, s] of Object.entries(d.councils)) {
      const v = s.find((p) => p.period === period);
      if (v) values[id] = v.value;
    }
    out.push({
      key: m.key,
      per: m.per ?? m.publishedPer?.n,
      perOf: m.publishedPer?.of,
      estimated: CARRIED_FORWARD[m.key]?.[period.slice(0, 4)] ?? [],
      theme: m.theme,
      better: m.better,
      unit: m.unit,
      period,
      values,
      wales: d.wales.find((p) => p.period === period)?.value ?? null,
      walesHistory: d.wales.filter((p) => p.period <= period),
      history: Object.fromEntries(Object.entries(d.councils).map(([id, s]) => [id, s.filter((p) => p.period <= period)])),
      source: STATSWALES_PAGE(m.dataset),
      via: d.source.via ?? null,
    });
  }
  // Planning speed: councils only, where the figures are recent and numerous enough.
  const councilIds = new Set(COUNCILS.map((c) => c.id));
  const fair = league.filter(
    (r) =>
      councilIds.has(r.authority) &&
      leagueExclusion({ received: r.received, stale: r.stale, windowDays: r.windowDays, decided: r.decided, settled: r.settled }) === null,
  );
  if (fair.length) {
    const within = fair.reduce((n, r) => n + r.within8, 0);
    const total = fair.reduce((n, r) => n + r.decided, 0);
    out.push({
      key: "planning-speed",
      theme: "planning",
      better: "higher",
      unit: "share",
      period: null,
      values: Object.fromEntries(fair.map((r) => [r.authority, r.within8 / r.decided])),
      wales: total ? within / total : null,
      detail: Object.fromEntries(fair.map((r) => [r.authority, `${r.within8}/${r.decided}`])),
    });
  }
  // Only councils with a full year of meetings in OpenCouncil, and not the Vale, whose minutes don't record absences.
  const att = activity.filter((a) => a.attendance !== null && a.fullYear && a.councilId !== "vale-of-glamorgan");
  if (att.length) {
    out.push({
      key: "attendance",
      theme: "democracy",
      better: "higher",
      unit: "share",
      period: null,
      values: Object.fromEntries(att.map((a) => [a.councilId, a.attendance!])),
      // The middle council, not a Wales-wide rate: councils record attendance differently.
      wales: null,
    });
  }
  return out;
}
