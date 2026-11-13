/**
 * The arithmetic and rules behind the issue tables
 * (data/curated/compare-decisions.ts), kept apart from the page so they can
 * be tested.
 */
import type { IssueCell, IssueDef, LevyPosition } from "@data/curated/compare-decisions";

/** The only figures the council tax table needs from the StatsWales data. */
interface BandDSource {
  councils: Record<string, { bandD: Array<{ year: string; total: number | null; county: number | null }> }>;
  wales: { bandD: Array<{ year: string; total: number | null }> };
}

export interface TaxFigures {
  year: string;
  /** Each council's own share of Band D (StatsWales "county council CT, excluding community councils") and its change on the year before, as a share. */
  councils: Record<string, { now: number; before: number | null; change: number | null }>;
  count: number;
  /** The Welsh average Band D bill, every part included. */
  wales: number | null;
  low: { value: number; ids: string[] } | null;
  high: { value: number; ids: string[] } | null;
}

/** "2026-27" to "2025-26". */
export function yearBefore(year: string): string {
  const start = Number(year.slice(0, 4)) - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Changes are compared to two decimal places, as shown, so councils that look tied are tied. */
const shown = (n: number) => Math.round(n * 10_000) / 10_000;

export function taxFigures(data: BandDSource | null, year: string): TaxFigures | null {
  if (!data) return null;
  const prev = yearBefore(year);
  const councils: TaxFigures["councils"] = {};
  for (const [id, c] of Object.entries(data.councils)) {
    const now = c.bandD.find((y) => y.year === year)?.county ?? null;
    if (now == null) continue;
    const before = c.bandD.find((y) => y.year === prev)?.county ?? null;
    councils[id] = { now, before, change: before ? shown(now / before - 1) : null };
  }
  const changes = Object.entries(councils).filter(([, v]) => v.change != null) as Array<[string, { change: number }]>;
  const extreme = (pick: (a: number, b: number) => number) => {
    if (!changes.length) return null;
    const value = changes.map(([, v]) => v.change).reduce((a, b) => pick(a, b));
    return { value, ids: changes.filter(([, v]) => v.change === value).map(([id]) => id) };
  };
  return {
    year,
    councils,
    count: Object.keys(councils).length,
    wales: data.wales.bandD.find((y) => y.year === year)?.total ?? null,
    low: extreme(Math.min),
    high: extreme(Math.max),
  };
}

/**
 * What a row can show. "summary": the summary's own sentence. "recorded": the
 * minutes record a decision but no summary is held (or the summary leans on
 * sentences around it), so the title and a link to the papers. "unrecorded":
 * the item is held but its minutes, as held, record no decision. "none": no
 * item found.
 */
export type RowState = "summary" | "recorded" | "unrecorded" | "none";

export function rowState(
  cell: Pick<IssueCell, "agendaItemId" | "summaryLeansOnOthers">,
  item: { summaryEn: string | null; recorded: string | null } | null,
): RowState {
  if (!cell.agendaItemId || !item) return "none";
  if (item.summaryEn && !cell.summaryLeansOnOthers) return "summary";
  if (item.recorded?.trim() || item.summaryEn) return "recorded";
  return "unrecorded";
}

export type LevyCounts = Record<LevyPosition, string[]> & { none: number };

export function levyCounts(issue: Pick<IssueDef, "cells">): LevyCounts {
  const out: LevyCounts = { adopted: [], consulting: [], deferred: [], "not-now": [], none: 0 };
  for (const c of issue.cells) {
    if (c.position) out[c.position].push(c.council);
    else out.none++;
  }
  return out;
}
