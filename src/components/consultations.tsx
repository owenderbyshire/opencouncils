import type { ConsultationRow } from "@/data/consultations";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { consultationMessages } from "@/i18n/messages/consultations";
import { councilConfig, councilShort } from "@/lib/councils";

/** One consultation: its title linking to the source, who runs it, and when it closes. */
export function ConsultationItem({ locale, c, summary = true }: { locale: Locale; c: ConsultationRow; summary?: boolean }) {
  const t = consultationMessages[locale];
  const council = c.councilId ? councilConfig(c.councilId) : undefined;
  const cy = locale === "cy";
  const welsh = cy && c.titleCy;
  const title = welsh ? c.titleCy! : c.titleEn;
  const text = welsh ? (c.summaryCy ?? c.summaryEn) : c.summaryEn;
  const lang = cy && !welsh ? "en" : undefined;
  return (
    <li className="py-4">
      <a href={welsh && c.urlCy ? c.urlCy : c.url} rel="noopener" className="font-semibold" lang={lang}>
        {title}
      </a>
      <p className="mt-1 text-small text-ink-2">
        {c.source === "gov" ? `${t.gov}. ` : council ? `${councilShort(locale, council)}. ` : ""}
        {c.closes ? t.closes.replace("{date}", formatDate(locale, c.closes)) : t.noDate}
        {lang ? `. ${t.englishOnly}` : ""}
      </p>
      {summary && text ? (
        <p className="mt-1 max-w-[62ch] text-small" lang={cy && !(c.summaryCy && welsh) ? "en" : undefined}>
          {text}
        </p>
      ) : null}
    </li>
  );
}
