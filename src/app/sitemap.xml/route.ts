import { applicationSitemapCount } from "@/data/sitemap";
import { APPLICATIONS_SITEMAP, councilSitemapIds, PAGES_SITEMAP, sitemapUrl } from "@/lib/sitemap";

/**
 * The sitemap index robots.txt points to. It lists the sitemaps app/sitemaps
 * writes, so search engines can submit one address and find every page.
 */
export async function GET(): Promise<Response> {
  const applications = await applicationSitemapCount();
  const ids = [PAGES_SITEMAP, ...councilSitemapIds(), ...Array.from({ length: applications }, (_, i) => `${APPLICATIONS_SITEMAP}${i}`)];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...ids.map((id) => `  <sitemap><loc>${sitemapUrl(id)}</loc></sitemap>`),
    "</sitemapindex>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
