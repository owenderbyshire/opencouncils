import { EN_ORIGIN } from "@/i18n/config";

/** Site-wide settings that aren't secrets. Change them here, not in components. */
export const SITE = {
  name: "OpenCouncils",
  url: EN_ORIGIN,
  contactEmail: "feedback@datblygu.cymru",
  publisher: { name: "DC Group", url: "https://datblygu.cymru" },
  /** opencouncil.wales, the Welsh sister site whose data OpenCouncils reuses for Wales. */
  sister: { name: "OpenCouncil", url: "https://opencouncil.wales" },
};

export type FamilyId = "opensenedd" | "opencouncil" | "opencharity" | "openeconomy";

/**
 * The four free Open sites from Datblygu Cymru, in the order the family footer
 * lists them on every one of them (docs/family-design.md). `welsh` is true
 * where the site serves Welsh pages under /cy. Names and descriptions are in
 * the common messages.
 */
export const FAMILY: Array<{ id: FamilyId; url: string; welsh: boolean }> = [
  { id: "opensenedd", url: "https://opensenedd.com", welsh: true },
  { id: "opencouncil", url: "https://opencouncil.wales", welsh: true },
  { id: "opencharity", url: "https://opencharity.wales", welsh: true },
  { id: "openeconomy", url: "https://openeconomy.wales", welsh: true },
];

/** This site's place in the family. */
export const FAMILY_SELF: FamilyId = "opencouncil";

/** The address of a family site, in the reader's language where it has Welsh pages. */
export function familyUrl(id: FamilyId, locale: "en" | "cy"): string {
  const site = FAMILY.find((f) => f.id === id)!;
  return locale === "cy" && site.welsh ? `${site.url}/cy` : site.url;
}

/** Edau, the data store beneath the Open sites. The family footer is the only place that links to it. */
export const EDAU_URL = "https://edau.wales";
