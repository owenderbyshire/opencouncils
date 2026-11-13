import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { queryString } from "@/components/pagination";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { planningCompleteness, planningLeague, type LeagueRow } from "@/data/planning";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { softMutateMonth } from "@/i18n/welsh";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, type SearchParams } from "@/lib/params";
import { leagueExclusion, type LeagueExclusion } from "@/lib/planning-status";

/*
 * Planning decisions by authority: every one of Wales's 25 planning
 * authorities in one table, in alphabetical order, with the figures Local
 * Record can work out from its register (src/data/planning.ts,
 * planningLeague). Nothing is ranked. Where figures can't be given fairly,
 * the row says why.
 */

const SORTS = ["name", "within8", "median", "approved", "received"] as const;
type Sort = (typeof SORTS)[number];
const KINDS = ["council", "national-park"] as const;
const DATA = ["full"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = planningMessages[locale].league;
  return pageMetadata({ locale, path: "/planning/league", title: t.title, description: t.lede });
}

export default async function LeaguePage({ searchParams }: PageProps<"/[lang]/planning/league">) {
  const locale = await getLocale();
  const t = planningMessages[locale].league;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<BlockSkeleton lines={14} label={common[locale].words.loading} />}>
        <Table locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

const pageFor = (id: string) => {
  const a = PLANNING_AUTHORITIES.find((x) => x.id === id);
  return a?.councilId && liveCouncil(a.councilId) ? `/${a.councilId}/planning` : `/planning/${id}`;
};

const OFFICIAL = "https://www.gov.wales/development-management-quarterly-survey-july-september-2025";

interface Row {
  id: string;
  name: string;
  kind: (typeof KINDS)[number];
  r: LeagueRow | undefined;
  /** Why rates aren't shown, or null when they are. */
  reason: LeagueExclusion | null;
}

/** The value a column sorts by; null sorts last whichever way. */
function value(x: Row, s: Exclude<Sort, "name">): number | null {
  const r = x.r;
  if (!r) return null;
  if (s === "received") return x.reason === "noData" ? null : r.received;
  if (x.reason !== null) return null;
  switch (s) {
    case "within8":
      return r.decided ? r.within8 / r.decided : null;
    case "median":
      return r.medianDays;
    case "approved":
      return r.outcomes ? r.approved / r.outcomes : null;
  }
}

async function Table({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = planningMessages[locale].league;
  const sp = await searchParams;
  const sort: Sort = oneOf(sp, "sort", SORTS) ?? "name";
  const kind = oneOf(sp, "kind", KINDS);
  const data = oneOf(sp, "data", DATA);
  const [all, completeness] = await Promise.all([planningLeague(), planningCompleteness()]);
  const compl = new Map(completeness.map((c) => [c.authority, c]));
  const byId = new Map(all.map((r) => [r.authority, r]));

  const rows: Row[] = PLANNING_AUTHORITIES.map((a) => {
    const r = byId.get(a.id);
    const reason: LeagueExclusion | null = !r
      ? "noData"
      : leagueExclusion({ received: r.received, stale: r.stale, windowDays: r.windowDays, decided: r.decided, settled: r.settled });
    return { id: a.id, name: locale === "cy" ? a.nameCy : a.nameEn, kind: a.kind, r, reason };
  })
    .filter((x) => !kind || x.kind === kind)
    .filter((x) => !data || x.reason === null);

  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, locale);
  if (sort === "name") rows.sort(byName);
  else {
    // Quickest first for time; highest first for everything else.
    const dir = sort === "median" ? 1 : -1;
    rows.sort((a, b) => {
      const va = value(a, sort);
      const vb = value(b, sort);
      if (va === null || vb === null) return va === vb ? byName(a, b) : va === null ? 1 : -1;
      return (va - vb) * dir || byName(a, b);
    });
  }

  const weeks = (d: number | null) => (d === null ? "–" : t.weeks.replace("{n}", formatNumber(locale, Math.round((d / 7) * 10) / 10)));
  const pct = (n: number, d: number) => (d ? formatPercent(locale, n / d) : "–");
  const to = all.find((r) => !r.stale)?.to ?? all[0]?.to;
  const quarter = (c: { start: string; end: string }) => {
    const to = formatDate(locale, c.end, "month");
    return t.quarter.replace("{from}", formatDate(locale, c.start, "monthName")).replace("{to}", locale === "cy" ? softMutateMonth(to) : to);
  };
  const noteFor = (x: Row) => {
    const reason = x.reason ? t.reasons[x.reason].replace("{date}", x.r?.latest ? formatDate(locale, x.r.latest) : "–") : null;
    const c = compl.get(x.id);
    const short = c && c.ours < c.official * 0.9 ? t.shortfall.replace("{quarter}", quarter(c)) : null;
    return [reason, short].filter(Boolean).join(" ") || null;
  };
  const link = (o: Record<string, string | undefined>) =>
    href(locale, "/planning/league") + queryString({ sort: sort === "name" ? undefined : sort, kind, data, ...o });
  const dash = <span className="text-ink-3">–</span>;
  const cols = ["within8", "median", "approved", "received"] as const;

  return (
    <>
      <div className="border-t border-rule pt-6">
        {to ? <p className="max-w-[62ch] text-small text-ink-2">{t.how.replace("{to}", formatDate(locale, to))}</p> : null}
        <p className="mt-2 max-w-[62ch] text-small text-ink-2">
          {t.howOfficial}{" "}
          <a href={OFFICIAL} rel="noopener">
            {t.official}
          </a>
        </p>
      </div>

      <Section id="table" title={t.tableTitle} className="mt-6 border-t border-rule">
        <nav aria-label={t.filters} className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-small">
          <span className="flex flex-wrap gap-2">
            <Link href={link({ kind: undefined })} className="chip" aria-current={!kind ? "page" : undefined} scroll={false}>
              {t.kinds.all}
            </Link>
            {KINDS.map((k) => (
              <Link key={k} href={link({ kind: k })} className="chip" aria-current={kind === k ? "page" : undefined} scroll={false}>
                {t.kinds[k]}
              </Link>
            ))}
          </span>
          <span className="flex flex-wrap gap-2">
            <Link href={link({ data: undefined })} className="chip" aria-current={!data ? "page" : undefined} scroll={false}>
              {t.dataAll}
            </Link>
            <Link href={link({ data: "full" })} className="chip" aria-current={data ? "page" : undefined} scroll={false}>
              {t.dataFull}
            </Link>
          </span>
        </nav>
        <p className="mb-2 text-small text-ink-2 num">{t.count.replace("{n}", formatNumber(locale, rows.length))}</p>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[76rem]">
            <thead>
              <tr>
                <th scope="col" aria-sort={sort === "name" ? "ascending" : undefined}>
                  <Link href={link({ sort: undefined })} className={sort === "name" ? "font-semibold" : ""} scroll={false}>
                    {t.cols.authority}
                  </Link>
                </th>
                {cols.map((k) => (
                  <th key={k} scope="col" className="text-right" aria-sort={sort === k ? (k === "median" ? "ascending" : "descending") : undefined}>
                    <Link href={link({ sort: k })} className={sort === k ? "font-semibold" : ""} scroll={false}>
                      {t.cols[k]}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="text-right">
                  {t.cols.waiting}
                </th>
                <th scope="col" className="text-right">
                  {t.cols.noRecord}
                </th>
                <th scope="col" className="text-right">
                  {t.cols.from}
                </th>
                <th scope="col" className="text-right">
                  {t.cols.official}
                </th>
                <th scope="col">{t.cols.notes}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => {
                const r = x.r;
                const full = r && x.reason === null;
                return (
                  <tr key={x.id}>
                    <th scope="row" className="text-left font-medium whitespace-nowrap">
                      <Link href={href(locale, pageFor(x.id))}>{x.name}</Link>
                    </th>
                    <td className="text-right num">{full ? pct(r.within8, r.decided) : dash}</td>
                    <td className="text-right num">{full ? weeks(r.medianDays) : dash}</td>
                    <td className="text-right num">{full ? pct(r.approved, r.outcomes) : dash}</td>
                    <td className="text-right num">{r ? formatNumber(locale, r.received) : dash}</td>
                    <td className="text-right num">{full ? formatNumber(locale, r.waiting) : dash}</td>
                    <td className="text-right num">{full ? formatNumber(locale, r.noRecord) : dash}</td>
                    <td className="text-right num">{r ? formatDate(locale, r.from, "short") : dash}</td>
                    <td className="text-right num whitespace-nowrap">
                      {compl.get(x.id) ? (
                        <>
                          {t.ofOfficial.replace("{ours}", formatNumber(locale, compl.get(x.id)!.ours)).replace("{official}", formatNumber(locale, compl.get(x.id)!.official))}
                          <span className="block text-meta text-ink-2">{quarter(compl.get(x.id)!)}</span>
                        </>
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="min-w-[22rem] max-w-[26rem] text-small text-ink-2">{noteFor(x)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="mt-4 max-w-[62ch] space-y-1 text-small text-ink-2">
          {(["within8", "median", "approved", "waiting", "noRecord", "official", "notes"] as const).map((k) => (
            <div key={k}>
              <dt className="inline font-semibold">{t.cols[k]}: </dt>
              <dd className="inline">{t.colNotes[k]}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
