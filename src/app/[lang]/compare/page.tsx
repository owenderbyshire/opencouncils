import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareLinks } from "@/components/compare-links";
import { PageHeader } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { councilActivity } from "@/data/council";
import { getAreasIndex } from "@/data/places";
import { getCouncilData } from "@/data/council-data";
import { href, type Locale } from "@/i18n/config";
import { formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { walesMessages } from "@/i18n/messages/wales";
import { getLocale } from "@/i18n/server";
import { COUNCILS, councilShort } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { param, type SearchParams } from "@/lib/params";

// Second homes are hidden until a reliable source is in place: the census layer used gave figures that don't match councils' own counts.
const COLS = ["councillors", "meetings", "attendance", "bandD", "spend", "welsh", "deprived", "rural"] as const;
type Col = (typeof COLS)[number];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = walesMessages[locale].compare;
  return pageMetadata({ locale, path: "/compare", title: t.title, description: t.lede });
}

export default async function ComparePage({ searchParams }: PageProps<"/[lang]/compare">) {
  const locale = await getLocale();
  const t = walesMessages[locale].compare;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede}>
        <CompareLinks locale={locale} />
      </PageHeader>
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Table locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Table({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = walesMessages[locale].compare;
  const raw = param(await searchParams, "sort");
  const sort: Col | null = COLS.includes(raw as Col) ? (raw as Col) : null;
  const [activity, areas, money] = await Promise.all([councilActivity().catch(() => []), getAreasIndex(), getCouncilData()]);
  const act = new Map(activity.map((a) => [a.councilId, a]));
  const area = new Map((areas?.councils ?? []).map((c) => [c.slug, c.summary]));

  const rows = COUNCILS.map((c) => {
    const a = act.get(c.id);
    const s = area.get(c.id);
    const share = (n: number | undefined) => (s && s.lsoas ? (n ?? 0) / s.lsoas : null);
    const m = money?.councils[c.id];
    const values: Record<Col, number | null> = {
      bandD: m?.bandD.at(-1)?.total ?? null,
      spend: m?.spend?.total?.perHead ?? null,
      councillors: a?.councillors || null,
      // Only where OpenCouncils holds a full year of the council's meetings.
      meetings: a?.fullYear ? a.meetings : null,
      // The Vale's minutes don't record absences, so its rate isn't comparable.
      attendance: a?.fullYear && c.id !== "vale-of-glamorgan" ? a.attendance : null,
      welsh: s?.welsh ?? null,
      deprived: share(s?.deprived10),
      rural: s ? share(s.settlement.rural + s.settlement.town) : null,
    };
    return { id: c.id, name: councilShort(locale, c), values, partial: !a?.fullYear };
  });
  // Missing values sort last whichever way the column runs.
  if (sort)
    rows.sort(
      (x, y) =>
        (x.values[sort] == null ? 1 : 0) - (y.values[sort] == null ? 1 : 0) ||
        (y.values[sort] ?? 0) - (x.values[sort] ?? 0) ||
        x.name.localeCompare(y.name, locale),
    );
  else rows.sort((x, y) => x.name.localeCompare(y.name, locale));

  const show = (col: Col, v: number | null) => {
    if (v == null) return <span className="text-ink-3">–</span>;
    if (col === "attendance" || col === "deprived" || col === "rural") return formatPercent(locale, v);
    if (col === "bandD" || col === "spend") return formatMoney(locale, v, 0);
    if (col === "welsh") return formatPercent(locale, v / 100);
    return formatNumber(locale, Math.round(v));
  };

  return (
    <>
      <div className="overflow-x-auto border-t border-rule">
        <table className="data-table min-w-[56rem]">
          <thead>
            <tr>
              <th scope="col">
                <Link href={href(locale, "/compare")} aria-current={sort ? undefined : "true"}>
                  {t.council}
                </Link>
              </th>
              {COLS.map((col) => (
                <th key={col} scope="col" className="text-right" aria-sort={sort === col ? "descending" : undefined}>
                  <Link href={`${href(locale, "/compare")}?sort=${col}`} className={sort === col ? "font-semibold" : ""}>
                    {t.cols[col]}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="text-left font-medium">
                  <Link href={href(locale, `/${r.id}`)}>{r.name}</Link>
                </th>
                {COLS.map((col) => (
                  <td key={col} className="text-right tabular-nums">
                    {(col === "meetings" || col === "attendance") && r.partial && r.values[col] == null ? (
                      <span className="text-small whitespace-nowrap text-ink-3">{t.waiting}</span>
                    ) : (
                      show(col, r.values[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby="notes" className="mt-10 max-w-[62ch]">
        <h2 id="notes" className="text-h3">
          {t.notesTitle}
        </h2>
        <dl className="mt-4 space-y-3 text-small">
          {COLS.map((col) => (
            <div key={col}>
              <dt className="font-semibold">{t.cols[col]}</dt>
              <dd className="text-ink-2">
                {t.notes[col]}
                {(col === "bandD" || col === "spend") && money?.meta?.via === "edau" ? ` ${t.viaEdau}` : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
