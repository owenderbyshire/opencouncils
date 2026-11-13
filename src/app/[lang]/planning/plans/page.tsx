import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { queryString } from "@/components/pagination";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { LDPS } from "@data/curated/ldps";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { planToday } from "@/data/ldp";
import { common } from "@/i18n/messages/common";
import { plansMessages } from "@/i18n/messages/plans";
import { getLocale } from "@/i18n/server";
import { nextStepText, periodEnded, planDate, replacementUnderWay } from "@/lib/ldp";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, type SearchParams } from "@/lib/params";

/*
 * Where each of Wales's 25 local development plans stands: the plan in force
 * and progress on its replacement (data/curated/ldps.ts), in alphabetical
 * order. Each row links to the authority's plan page.
 */

const KINDS = ["council", "national-park"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = plansMessages[locale];
  return pageMetadata({ locale, path: "/planning/plans", title: t.title, description: t.lede });
}

export default async function PlansPage({ searchParams }: PageProps<"/[lang]/planning/plans">) {
  const locale = await getLocale();
  const t = plansMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <div className="prose-read max-w-[62ch] space-y-3 border-t border-rule pt-6 text-ink-2">
        <p>{t.what}</p>
        <p>{t.amrWhat}</p>
      </div>
      <Suspense fallback={<BlockSkeleton lines={14} label={common[locale].words.loading} />}>
        <Table locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Table({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = plansMessages[locale];
  const sp = await searchParams;
  const kind = oneOf(sp, "kind", KINDS);
  const today = await planToday();
  const link = (k: string | undefined) => href(locale, "/planning/plans") + queryString({ kind: k });
  const authorities = PLANNING_AUTHORITIES.filter((a) => !kind || a.kind === kind)
    .map((a) => ({ a, name: locale === "cy" ? a.nameCy : a.nameEn, ldp: LDPS.find((l) => l.id === a.id) }))
    .sort((x, y) => x.name.localeCompare(y.name, locale));

  return (
    <Section id="plans" title={t.tableTitle} className="mt-8 border-t border-rule">
      <nav aria-label={t.filters} className="mb-4 flex flex-wrap gap-2">
        <Link href={link(undefined)} className="chip" aria-current={!kind ? "page" : undefined} scroll={false}>
          {t.kinds.all}
        </Link>
        {KINDS.map((k) => (
          <Link key={k} href={link(k)} className="chip" aria-current={kind === k ? "page" : undefined} scroll={false}>
            {t.kinds[k]}
          </Link>
        ))}
      </nav>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t.cols.authority}</th>
              <th scope="col">{t.cols.plan}</th>
              <th scope="col">{t.cols.period}</th>
              <th scope="col">{t.cols.replacement}</th>
              <th scope="col">{t.cols.next}</th>
            </tr>
          </thead>
          <tbody>
            {authorities.map(({ a, name, ldp }) => (
              <tr key={a.id}>
                <th scope="row" className="text-left font-medium">
                  {ldp ? <Link href={href(locale, `/planning/plans/${a.id}`)}>{name}</Link> : name}
                </th>
                {ldp ? (
                  <>
                    <td className="text-small" lang="en">
                      {ldp.adopted.title}
                    </td>
                    <td className="text-small num whitespace-nowrap">
                      {(ldp.adopted.periodStart ? t.periodRange.replace("{from}", String(ldp.adopted.periodStart)) : t.periodTo).replace("{to}", String(ldp.adopted.periodEnd))}
                      {periodEnded(ldp, today) ? <span className="block text-meta text-ink-2">{t.expired.replace("{year}", String(ldp.adopted.periodEnd))}</span> : null}
                    </td>
                    <td className="text-small">
                      {replacementUnderWay(ldp)
                        ? ldp.replacement.stageDate
                          ? t.stageAt.replace("{stage}", t.stages[ldp.replacement.stage]).replace("{date}", planDate(locale, ldp.replacement.stageDate))
                          : t.stages[ldp.replacement.stage]
                        : t.noReplacement}
                    </td>
                    <td className="text-small text-ink-2">
                      {replacementUnderWay(ldp) ? nextStepText(locale, ldp, t) : ""}
                      {replacementUnderWay(ldp) && ldp.replacement.slipped ? <span className="block text-meta">{t.slippedShort}</span> : null}
                    </td>
                  </>
                ) : (
                  <td colSpan={4} className="text-small text-ink-3">
                    {t.notChecked}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
