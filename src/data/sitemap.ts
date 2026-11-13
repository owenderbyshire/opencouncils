import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { one, rows, sql } from "./db";

/** Every page a council's records give it, for that council's sitemap. */
export interface CouncilSitemapPaths {
  meetings: number[];
  committees: number[];
  councillors: number[];
  wards: string[];
  issues: number[];
}

export async function councilSitemapPaths(councilId: string): Promise<CouncilSitemapPaths> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings", "councillors", "committees");
  const ids = async (q: ReturnType<typeof sql>) => (await rows<{ id: number }>(q).catch(() => [])).map((r) => r.id);
  const [meetings, committees, councillors, issues, wards] = await Promise.all([
    ids(sql`select id from meetings where council_id = ${councilId} order by date desc, id`),
    ids(sql`select id from committees where council_id = ${councilId} order by id`),
    ids(sql`select id from councillors where council_id = ${councilId} order by id`),
    ids(sql`select id from issues where council_id = ${councilId} order by id`),
    rows<{ slug: string }>(sql`select slug from wards where council_id = ${councilId} order by slug`).catch(() => []),
  ]);
  return { meetings, committees, councillors, wards: wards.map((w) => w.slug), issues };
}

/**
 * Planning applications go in sitemaps of their own, this many to a file.
 * Each application is listed in English and Welsh, so a file holds twice
 * this many addresses, under the 50,000 a sitemap may hold.
 */
export const APPLICATIONS_PER_SITEMAP = 20_000;

/** How many planning-application sitemaps there are. */
export async function applicationSitemapCount(): Promise<number> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  const r = await one<{ n: number }>(sql`select count(*)::int as n from planning_applications`).catch(() => null);
  return Math.ceil((r?.n ?? 0) / APPLICATIONS_PER_SITEMAP);
}

/** The planning applications in sitemap `page` (from 0), oldest first so each file stays stable. */
export async function applicationSitemapIds(page: number): Promise<number[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  const r = await rows<{ id: number }>(
    sql`select id from planning_applications order by id limit ${APPLICATIONS_PER_SITEMAP} offset ${page * APPLICATIONS_PER_SITEMAP}`,
  ).catch(() => []);
  return r.map((x) => x.id);
}
