import { SHOW_ISSUES } from "@/lib/features";
import type { MetadataRoute } from "next";
import { applicationSitemapCount, applicationSitemapIds, councilSitemapPaths } from "@/data/sitemap";
import { liveCouncil } from "@/lib/councils";
import { APPLICATIONS_SITEMAP, bilingual, councilSitemapIds, PAGES_SITEMAP, walesPaths } from "@/lib/sitemap";

/**
 * The sitemaps that app/sitemap.xml lists: Wales-wide pages, each council,
 * then planning applications. The list is fixed when the site is built, so
 * one spare applications file is made for new applications to fill before
 * the next deploy; the index lists it once it has any.
 */
export async function generateSitemaps() {
  const applications = (await applicationSitemapCount()) + 1;
  return [
    { id: PAGES_SITEMAP },
    ...councilSitemapIds().map((id) => ({ id })),
    ...Array.from({ length: applications }, (_, i) => ({ id: `${APPLICATIONS_SITEMAP}${i}` })),
  ];
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  if (id === PAGES_SITEMAP) return walesPaths().flatMap(bilingual);
  if (id.startsWith(APPLICATIONS_SITEMAP)) {
    const page = Number(id.slice(APPLICATIONS_SITEMAP.length));
    if (!Number.isInteger(page) || page < 0) return [];
    return (await applicationSitemapIds(page)).flatMap((n) => bilingual(`/planning/application/${n}`));
  }
  const c = liveCouncil(id);
  if (!c) return [];
  const p = await councilSitemapPaths(c.id);
  const base = `/${c.id}`;
  return [
    base,
    `${base}/meetings`,
    `${base}/committees`,
    `${base}/councillors`,
    `${base}/money`,
    `${base}/planning`,
    `${base}/performance`,
    `${base}/area`,
    ...p.committees.map((n) => `${base}/committees/${n}`),
    ...p.councillors.map((n) => `${base}/councillors/${n}`),
    ...p.wards.map((s) => `${base}/wards/${encodeURIComponent(s)}`),
    ...(SHOW_ISSUES ? p.issues.map((n) => `${base}/issues/${n}`) : []),
    ...p.meetings.map((n) => `${base}/meetings/${n}`),
  ].flatMap(bilingual);
}
