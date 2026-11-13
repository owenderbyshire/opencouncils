import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Place, PlacesIndex } from "../../pipeline/sources/places";
import { one, sql } from "./db";

export type { Place, PlaceLsoa, PlaceSummary, PlacesIndex, WimdDomain } from "../../pipeline/sources/places";
export { WIMD_DOMAINS } from "../../pipeline/sources/places";

/** Every council area's outline and headline figures (pipeline/jobs/places.ts). */
export async function getAreasIndex(): Promise<(PlacesIndex & { updatedAt: string | null }) | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const [index, meta] = await Promise.all([
    one<{ value: PlacesIndex }>(sql`select value from pipeline_state where key = 'areas'`).catch(() => null),
    one<{ value: { updatedAt: string } }>(sql`select value from pipeline_state where key = 'areas-meta'`).catch(() => null),
  ]);
  return index ? { ...index.value, updatedAt: meta?.value.updatedAt ?? null } : null;
}

/** One council area's neighbourhoods and figures. */
export async function getArea(councilId: string): Promise<Place | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const r = await one<{ value: Place }>(sql`select value from pipeline_state where key = ${`area:${councilId}`}`).catch(() => null);
  return r?.value ?? null;
}
