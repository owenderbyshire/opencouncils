import { COUNCILS, councilConfig, type CouncilConfig } from "@data/curated/councils";
import type { Locale } from "@/i18n/config";

export { COUNCILS, councilConfig, type CouncilConfig };

/** Councils shown on the site. */
export const LIVE_COUNCILS = COUNCILS.filter((c) => c.active && c.system !== "none");

/** The live council named by a URL segment, or undefined. */
export function liveCouncil(id: string): CouncilConfig | undefined {
  const c = councilConfig(id);
  return c && c.active && c.system !== "none" ? c : undefined;
}

export function councilShort(locale: Locale, c: CouncilConfig): string {
  return locale === "cy" ? c.shortCy : c.shortEn;
}

export function councilName(locale: Locale, c: CouncilConfig): string {
  return locale === "cy" ? c.nameCy : c.nameEn;
}
