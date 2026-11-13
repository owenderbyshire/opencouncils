import type { Locale } from "./config";

/**
 * Chooses the Welsh or English version of a bilingual field. When only the
 * other language exists, `lang` is set so the element can be marked up with
 * the right language for screen readers and hyphenation.
 */
export function pickText(
  locale: Locale,
  en: string | null | undefined,
  cy: string | null | undefined,
): { text: string; lang?: Locale } {
  if (locale === "cy") {
    if (cy) return { text: cy };
    return { text: en ?? "", lang: en ? "en" : undefined };
  }
  if (en) return { text: en };
  return { text: cy ?? "", lang: cy ? "cy" : undefined };
}

/** Renders a bilingual field with the right `lang` attribute when it falls back. */
export function Bi({
  locale,
  en,
  cy,
  as: Tag = "span",
  className,
}: {
  locale: Locale;
  en: string | null | undefined;
  cy: string | null | undefined;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3";
  className?: string;
}) {
  const { text, lang } = pickText(locale, en, cy);
  return (
    <Tag lang={lang} className={className}>
      {text}
    </Tag>
  );
}
