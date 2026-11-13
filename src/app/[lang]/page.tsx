import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/page-header";
import { SearchForm } from "@/components/search-form";
import { href } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { ukMessages } from "@/i18n/messages/uk";
import { getLocale } from "@/i18n/server";
import { LIVE_COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { CURRENT_COUNCILS, KINDS, NATIONS, REORG_CHANGES, councilsIn, nationSlug } from "@/lib/register";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return pageMetadata({ locale, path: "/", description: common[locale].description });
}

export default async function HomePage() {
  const locale = await getLocale();
  const t = ukMessages[locale];
  const max = Math.max(...NATIONS.map((n) => councilsIn(n).length));
  const surrey = REORG_CHANGES.find((c) => c.id === "surrey-2027");
  return (
    <>
      <div className="border-b border-rule bg-surface">
        <div className="container-page pt-10 pb-12 lg:pt-16 lg:pb-16">
          <h1 className="max-w-[18ch] text-[2.5rem] leading-[1.04] sm:text-display lg:text-display-lg">{t.home.title}</h1>
          <p className="mt-6 max-w-[58ch] text-body text-ink-2 sm:text-read">
            {t.home.lede.replace("{n}", formatNumber(locale, CURRENT_COUNCILS.length))}
          </p>
          <div className="mt-8 max-w-[34rem]">
            <SearchForm locale={locale} id="q-home" large />
          </div>
        </div>
      </div>

      <div className="container-page">
        <Section title={t.home.byNation}>
          <p className="max-w-[62ch] text-small text-ink-2">{t.home.nationNote}</p>
          <ul className="mt-5 space-y-4">
            {NATIONS.map((n) => {
              const all = councilsIn(n);
              return (
                <li key={n} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[11rem_1fr_auto]">
                  <Link href={href(locale, `/councils?nation=${nationSlug(n)}`)} className="font-semibold">
                    {n}
                  </Link>
                  {/* Bar length is the number of councils; the label beside it gives the figure, so colour carries nothing alone. */}
                  <div className="h-3 rounded-sm bg-surface-2" aria-hidden="true">
                    <div className="h-3 rounded-sm bg-accent" style={{ width: `${(all.length / max) * 100}%` }} />
                  </div>
                  <p className="text-small text-ink-2 tabular-nums">
                    {t.index.count.replace("{n}", formatNumber(locale, all.length))}
                    {n === "England" ? (
                      <span className="block text-meta">
                        {KINDS.filter((k) => councilsIn(n, k).length)
                          .map((k) => `${formatNumber(locale, councilsIn(n, k).length)} ${t.kindsCount[k]}`)
                          .join(", ")}
                      </span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-6">
            <Link href={href(locale, "/councils")} className="font-semibold">
              {t.home.browse}
            </Link>
          </p>
        </Section>

        <div className="grid gap-x-12 md:grid-cols-2">
          <Section title={t.home.reorgTitle}>
            <p className="max-w-[58ch] text-small text-ink-2">{t.home.reorg}</p>
            {surrey ? (
              <p className="mt-2 text-small text-ink-2">{t.reorg.starts.replace("{date}", formatDate(locale, surrey.vestingDate))}</p>
            ) : null}
            <p className="mt-3">
              <Link href={href(locale, "/reorganisation")} className="font-semibold">
                {t.home.reorgLink}
              </Link>
            </p>
          </Section>
          <Section title={t.home.electionsTitle}>
            <p className="max-w-[58ch] text-small text-ink-2">{t.home.elections}</p>
          </Section>
        </div>

        <Section title={t.home.coverageTitle}>
          <p className="max-w-[62ch] text-small text-ink-2">{t.home.coverage.replace("{n}", formatNumber(locale, LIVE_COUNCILS.length))}</p>
        </Section>
      </div>
    </>
  );
}
