/**
 * Links to councils' own ModernGov pages. Every fact on OpenCouncil links
 * back to one of these, so readers can check it at source.
 *
 * Built from the council's ModernGov base (data/curated/councils.ts). Welsh
 * pages add the council's Welsh switch (for Cardiff, LLL=1) where it has one.
 */
import type { Locale } from "@/i18n/config";

export interface CouncilSite {
  moderngovBase: string | null;
  welshQuery: string | null;
  welshBase?: string;
}

function page(site: CouncilSite, path: string, locale: Locale): string | null {
  if (!site.moderngovBase) return null;
  if (locale === "cy" && site.welshBase) return `${site.welshBase}/${path}`;
  const url = `${site.moderngovBase}/${path}`;
  if (locale !== "cy" || !site.welshQuery) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${site.welshQuery}`;
}

export function meetingUrl(site: CouncilSite, meetingId: number, locale: Locale = "en") {
  return page(site, `ieListDocuments.aspx?MId=${meetingId}`, locale);
}

export function committeeUrl(site: CouncilSite, committeeId: number, locale: Locale = "en") {
  return page(site, `mgCommitteeDetails.aspx?ID=${committeeId}`, locale);
}

export function councillorUrl(site: CouncilSite, councillorId: number, locale: Locale = "en") {
  return page(site, `mgUserInfo.aspx?UID=${councillorId}`, locale);
}

export function councillorsUrl(site: CouncilSite, locale: Locale = "en") {
  return page(site, "mgMemberIndex.aspx", locale);
}

/** The council's committee list in Welsh, where it publishes one. */
export function welshCommitteeListUrl(site: CouncilSite): string | null {
  if (site.welshBase) return `${site.welshBase}/mgListCommittees.aspx`;
  if (site.moderngovBase && site.welshQuery) return `${site.moderngovBase}/mgListCommittees.aspx?${site.welshQuery}`;
  return null;
}

/** The web service the pipeline reads. Never shown to readers. */
export function webServiceUrl(base: string, op: string, params: Record<string, string | number> = {}) {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return `${base}/mgWebService.asmx/${op}${q ? `?${q}` : ""}`;
}
