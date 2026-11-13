import { ISSUES } from "@data/curated/compare-decisions";
import { SHOW_ISSUES } from "@/lib/features";
import type { MetadataRoute } from "next";
import { absUrl, EN_ORIGIN } from "@/i18n/config";
import { COUNCIL_ELECTIONS } from "@data/curated/elections";
import { LDPS } from "@data/curated/ldps";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { LIVE_COUNCILS } from "./councils";
import { TOPICS } from "./topics";

/**
 * The site's sitemaps (app/sitemap.xml lists them, app/sitemaps writes them):
 * one for the pages about Wales as a whole, one per live council, and the
 * planning applications in files of their own.
 */
export const PAGES_SITEMAP = "pages";
export const APPLICATIONS_SITEMAP = "planning-";

/** Where sitemap `id` is served (Next's generateSitemaps under app/sitemaps). */
export function sitemapUrl(id: string): string {
  return `${EN_ORIGIN}/sitemaps/sitemap/${id}.xml`;
}

/** A path as two sitemap entries, English and Welsh, each naming the other. */
export function bilingual(path: string): MetadataRoute.Sitemap {
  const languages = { "en-GB": absUrl("en", path), "cy-GB": absUrl("cy", path), "x-default": absUrl("en", path) };
  return [
    { url: languages["en-GB"], alternates: { languages } },
    { url: languages["cy-GB"], alternates: { languages } },
  ];
}

/** Pages about Wales as a whole. Search is left out: it has no content of its own. */
export function walesPaths(): string[] {
  return [
    "/",
    "/about",
    "/guide",
    "/latest",
    "/cabinets",
    "/forward-plans",
    ...(SHOW_ISSUES ? ["/issues"] : []),
    "/topics",
    ...TOPICS.map((t) => `/topics/${t.slug}`),
    "/compare",
    ...ISSUES.map((i) => `/compare/${i.slug}`),
    "/performance",
    "/consultations",
    "/elections",
    ...COUNCIL_ELECTIONS.map((e) => `/elections/${e.id}`),
    "/planning",
    "/planning/map",
    "/planning/league",
    "/planning/plans",
    ...LDPS.map((l) => `/planning/plans/${l.id}`),
    ...PLANNING_AUTHORITIES.filter((a) => a.kind === "national-park").map((a) => `/planning/${a.id}`),
    "/find",
    "/follow",
    "/data",
  ];
}

/** Every live council has a sitemap of its own. */
export function councilSitemapIds(): string[] {
  return LIVE_COUNCILS.map((c) => c.id);
}
