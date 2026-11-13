import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { periodLabel, showValue } from "@/components/measure-format";
import { NOT_COMPARED } from "@data/curated/performance";
import { queryString } from "@/components/pagination";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { performanceMeasures } from "@/data/performance";
import { THEMES } from "@data/curated/performance";
import { href, type Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { performanceMessages } from "@/i18n/messages/performance";
import { getLocale } from "@/i18n/server";
import { COUNCILS, councilShort } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { param, type SearchParams } from "@/lib/params";

/*
 * One official measure at a time, with every council's figure in
 * alphabetical order and the figure for Wales. Nothing is scored or ranked.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = performanceMessages[locale];
  return pageMetadata({ locale, path: "/performance", title: t.walesTitle, description: t.walesLede });
}

export default async function WalesPerformance({ searchParams }: PageProps<"/[lang]/performance">) {
  const locale = await getLocale();
  const t = performanceMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.walesTitle} lede={t.walesLede} />
      <Suspense fallback={<BlockSkeleton lines={14} label={common[locale].words.loading} />}>
        <Table locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Table({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = performanceMessages[locale];
  const sp = await searchParams;
  // Measures recorded differently from place to place are shown on each council's page but not side by side.
  const measures = (await performanceMeasures()).filter((m) => t.measures[m.key] && !NOT_COMPARED.has(m.key));
  if (!measures.length) return <p className="border-t border-rule pt-6 text-ink-2">{t.waiting}</p>;
  const raw = param(sp, "measure");
  const m = measures.find((x) => x.key === raw) ?? measures[0];
  const sort = param(sp, "sort") === "value" ? "value" : "name";
  const link = (o: Record<string, string | undefined>) =>
    href(locale, "/performance") + queryString({ measure: m.key, sort: sort === "name" ? undefined : sort, ...o });
  const text = t.measures[m.key]!;

  const rows = COUNCILS.map((c) => {
    const v = m.values[c.id];
    const hist = m.history?.[c.id] ?? [];
    return {
      id: c.id,
      name: councilShort(locale, c),
      value: v === undefined ? null : v,
      period: m.period ?? hist[hist.length - 1]?.period ?? null,
      estimated: m.estimated?.includes(c.id) ?? false,
    };
  });
  const byName = (a: (typeof rows)[number], b: (typeof rows)[number]) => a.name.localeCompare(b.name, locale);
  if (sort === "value")
    rows.sort((a, b) => (a.value === null || b.value === null ? (a.value === b.value ? byName(a, b) : a.value === null ? 1 : -1) : b.value - a.value || byName(a, b)));
  else rows.sort(byName);
  const samePeriod = m.period !== null;

  return (
    <>
      <nav aria-label={t.pickMeasure} className="space-y-3 border-t border-rule pt-6">
        {THEMES.filter((th) => measures.some((x) => x.theme === th)).map((th) => (
          <div key={th} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
            <span className="text-small font-semibold">{t.themes[th as keyof typeof t.themes] ?? th}</span>
            <span className="flex flex-wrap gap-2">
              {measures
                .filter((x) => x.theme === th)
                .map((x) => (
                  <Link key={x.key} href={link({ measure: x.key })} className="chip" aria-current={x.key === m.key ? "page" : undefined} scroll={false}>
                    {t.measures[x.key]!.name}
                  </Link>
                ))}
            </span>
          </div>
        ))}
      </nav>

      <Section id="measure" title={text.name} className="mt-6 border-t border-rule">
        <div className="max-w-[62ch] space-y-2 text-small text-ink-2">
          <p>{text.note}</p>
          <p>
            {m.period ? `${t.periodLine.replace("{period}", periodLabel(locale, m.period))} ` : ""}
            {m.source ? (
              <a href={locale === "cy" ? m.source.replace("/en-GB/", "/cy-GB/") : m.source} rel="noopener">
                {t.statsWales}
              </a>
            ) : null}
            {m.source && m.via === "edau" ? ` ${t.viaEdau}` : null}
          </p>
          {m.wales !== null ? (
            <p className="text-body text-ink">
              {t.walesAverage}: <span className="font-semibold num">{showValue(locale, m.unit, m.wales, m.per, m.perOf)}</span>
            </p>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="data-table max-w-[44rem]">
            <thead>
              <tr>
                <th scope="col" aria-sort={sort === "name" ? "ascending" : undefined}>
                  <Link href={link({ sort: undefined })} className={sort === "name" ? "font-semibold" : ""} scroll={false}>
                    {t.council}
                  </Link>
                </th>
                <th scope="col" className="text-right" aria-sort={sort === "value" ? "descending" : undefined}>
                  <Link href={link({ sort: "value" })} className={sort === "value" ? "font-semibold" : ""} scroll={false}>
                    {t.figure}
                  </Link>
                </th>
                {samePeriod ? null : <th scope="col">{t.periodCol}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="text-left font-medium">
                    <Link href={href(locale, `/${r.id}/performance`)}>{r.name}</Link>
                  </th>
                  <td className="text-right num">
                    {r.value === null ? <span className="text-ink-3">–</span> : showValue(locale, m.unit, r.value, m.per, m.perOf)}
                    {r.estimated ? <span className="block text-meta text-ink-2">{t.carriedShort}</span> : null}
                  </td>
                  {samePeriod ? null : <td className="text-small text-ink-2">{r.period ? periodLabel(locale, r.period) : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.some((r) => r.value === null) ? <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.dashNote}</p> : null}
        <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.compareCaution}</p>
      </Section>
    </>
  );
}
