import type { Metadata } from "next";
import { Suspense } from "react";
import { ConsultationItem } from "@/components/consultations";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { openConsultations } from "@/data/consultations";
import { CONSULTATION_PAGES, consultationPage } from "@data/curated/consultation-pages";
import type { Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { consultationMessages } from "@/i18n/messages/consultations";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { COUNCILS } from "@data/curated/councils";
import { councilName } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";

/*
 * Open consultations: the Welsh Government's that concern councils, every
 * other Welsh Government consultation, and where each council lists its own.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = consultationMessages[locale];
  return pageMetadata({ locale, path: "/consultations", title: t.title, description: t.lede });
}

export default async function ConsultationsPage() {
  const locale = await getLocale();
  const t = consultationMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Body locale={locale} />
      </Suspense>
    </div>
  );
}

async function Body({ locale }: { locale: Locale }) {
  const t = consultationMessages[locale];
  const all = await openConsultations();
  const councils = all.filter((c) => c.source !== "gov");
  const about = all.filter((c) => c.source === "gov" && c.aboutCouncils);
  const other = all.filter((c) => c.source === "gov" && !c.aboutCouncils);
  const pages = COUNCILS.filter((c) => CONSULTATION_PAGES[c.id]).sort((a, b) =>
    councilName(locale, a).localeCompare(councilName(locale, b), locale),
  );
  return (
    <>
      <Section id="how" title={t.howTitle} className="border-t border-rule">
        <p className="max-w-[62ch]">{t.how}</p>
      </Section>
      <Section id="about-councils" title={t.aboutTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.aboutLede}</p>
        {about.length ? (
          <ul className="rows mt-2 max-w-[52rem]">
            {about.map((c) => (
              <ConsultationItem key={c.url} locale={locale} c={c} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-2">{t.none}</p>
        )}
      </Section>
      <Section id="councils" title={t.councilsTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.councilsSome}</p>
        {councils.length ? (
          <ul className="rows mt-2 max-w-[52rem]">
            {councils.map((c) => (
              <ConsultationItem key={c.url} locale={locale} c={c} />
            ))}
          </ul>
        ) : null}
        <p className="mt-6 max-w-[62ch] text-small text-ink-2">{t.councilsNone}</p>
        <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((c) => (
            <li key={c.id}>
              <a href={consultationPage(c.id, locale)!} rel="noopener">
                {councilName(locale, c)}
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="other" title={t.otherTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.otherLede}</p>
        {other.length ? (
          <ul className="rows mt-2 max-w-[52rem]">
            {other.map((c) => (
              <ConsultationItem key={c.url} locale={locale} c={c} summary={false} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-ink-2">{t.none}</p>
        )}
        <p className="mt-4 text-small text-ink-2">
          <Rich
            text={t.source}
            links={{ gov: locale === "cy" ? "https://www.llyw.cymru/ymgyngoriadau?field_consultation_status=1" : "https://www.gov.wales/consultations?field_consultation_status=1" }}
          />
        </p>
      </Section>
    </>
  );
}
