import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CouncilDataMeta } from "../../pipeline/jobs/council-data";
import type { CouncilData } from "../../pipeline/sources/council-data";
import { one, sql } from "./db";

export type { AreaFigures, BandDYear, CouncilData, ServiceGroup, SpendGroup } from "../../pipeline/sources/council-data";
export { DATASETS, SERVICE_GROUPS } from "../../pipeline/sources/council-data";
export type { CouncilDataMeta };

/** Council tax and budgets by service for every council (pipeline/jobs/council-data.ts). */
export async function getCouncilData(): Promise<(CouncilData & { meta: CouncilDataMeta | null }) | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const [data, meta] = await Promise.all([
    one<{ value: CouncilData }>(sql`select value from pipeline_state where key = 'council-data'`).catch(() => null),
    one<{ value: CouncilDataMeta }>(sql`select value from pipeline_state where key = 'council-data-meta'`).catch(() => null),
  ]);
  return data ? { ...data.value, meta: meta?.value ?? null } : null;
}
