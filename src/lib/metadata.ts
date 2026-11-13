import type { Metadata } from "next";
import { absUrl, type Locale } from "@/i18n/config";
import { SITE } from "./site";

/**
 * Metadata for one page: its title and description, the canonical URL, and
 * the matching page in the other language (hreflang).
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  noindex = false,
}: {
  locale: Locale;
  path: string;
  title?: string;
  description?: string;
  noindex?: boolean;
}): Metadata {
  const canonical = absUrl(locale, path);
  return {
    // Leave the key out when there is no title: Next.js reads `title: undefined`
    // as an empty title and drops the layout's default, so the page has no <title>.
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical,
      languages: { "en-GB": absUrl("en", path), "x-default": absUrl("en", path) },
    },
    openGraph: {
      title: title ?? SITE.name,
      description,
      url: canonical,
      siteName: SITE.name,
      locale: locale === "cy" ? "cy_GB" : "en_GB",
      type: "website",
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}

/** Trims text to a sentence-ish length for meta descriptions. */
export function excerpt(text: string | null | undefined, max = 180): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,;:.\s]+$/, "")}…`;
}
