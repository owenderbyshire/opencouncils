export const LOCALES = ["en", "cy"] as const;
export type Locale = (typeof LOCALES)[number];
/** Locales OpenCouncils serves: English only (decided 13 November 2026). The Welsh strings stay in the code from opencouncil.wales but are never routed. */
export const SERVED_LOCALES: readonly Locale[] = ["en"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "cy";
}

/** BCP 47 tag for the <html lang> attribute and Intl formatting. */
export function htmlLang(locale: Locale): string {
  return locale === "cy" ? "cy-GB" : "en-GB";
}

const strip = (u: string | undefined) => (u ? u.replace(/\/$/, "") : "");

/** The English site's address. */
export const EN_ORIGIN = strip(process.env.NEXT_PUBLIC_SITE_URL) || "https://opencouncils.com";
/**
 * The Welsh site's own address, when it has one. Without
 * it, Welsh pages live under /cy on the English address.
 */
export const CY_ORIGIN = strip(process.env.NEXT_PUBLIC_CY_SITE_URL);
/** Whether Welsh pages are served at the root of their own domain. */
export const SPLIT_DOMAINS = Boolean(CY_ORIGIN);

/**
 * Builds an internal href for a locale. English lives at the root. Welsh
 * lives at the root of its own domain when it has one, otherwise under /cy.
 * Links always stay within one language, so they can be relative.
 */
export function href(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === "en" || SPLIT_DOMAINS) return p;
  return p === "/" ? "/cy" : `/cy${p}`;
}

/** The full address of a page, for emails, feeds, sitemaps and links to the other language. */
export function absUrl(locale: Locale, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (locale === "cy" && SPLIT_DOMAINS) return `${CY_ORIGIN}${p === "/" ? "" : p}`;
  const h = href(locale, p);
  return `${EN_ORIGIN}${h === "/" ? "" : h}`;
}

/** Swaps the locale of an existing pathname (used by the language switcher). */
export function switchLocalePath(pathname: string, to: Locale): string {
  const bare =
    pathname === "/cy"
      ? "/"
      : pathname.startsWith("/cy/")
        ? pathname.slice(3)
        : pathname;
  return SPLIT_DOMAINS ? absUrl(to, bare) : href(to, bare);
}
