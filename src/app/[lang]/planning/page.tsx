import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { ApplicationItem, Stages } from "@/components/planning";
import { BlockSkeleton } from "@/components/skeleton";
import { applicationsNear, authorityStats, NEAR_DISTANCES, NEAR_PERIODS, NEAR_SHOW, NEAR_TYPES, recentAtCommittee } from "@/data/planning";
import { lookupPostcode, normalisePostcode } from "@/data/postcode";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { plansMessages } from "@/i18n/messages/plans";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, param, type SearchParams } from "@/lib/params";

/*
 * Planning applications for all of Wales: near a postcode, by authority, and
 * those that went to a planning committee. Data from UK PlanIt via
 * pipeline/jobs/planning.ts.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = planningMessages[locale];
  return pageMetadata({ locale, path: "/planning", title: t.title, description: t.lede });
}

export default async function PlanningPage({ searchParams }: PageProps<"/[lang]/planning">) {
  const locale = await getLocale();
  const t = planningMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede}>
        <Suspense fallback={null}>
          <Coverage locale={locale} />
        </Suspense>
      </PageHeader>
      <p className="-mt-2 mb-6 flex flex-wrap gap-x-6 gap-y-1">
        <Link href={href(locale, "/planning/map")} className="font-semibold">
          {t.map.link}
        </Link>
        <Link href={href(locale, "/planning/league")} className="font-semibold">
          {t.league.link}
        </Link>
        <Link href={href(locale, "/planning/plans")} className="font-semibold">
          {plansMessages[locale].link}
        </Link>
      </p>
      <Section id="near" title={t.nearTitle} className="border-t border-rule">
        <Suspense fallback={<BlockSkeleton lines={4} label={common[locale].words.loading} />}>
          <Near locale={locale} searchParams={searchParams as Promise<SearchParams>} />
        </Suspense>
      </Section>
      <Section id="how" title={t.howTitle} className="border-t border-rule">
        <Stages locale={locale} />
        <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.whatCounts}</p>
      </Section>
      <Suspense fallback={<BlockSkeleton lines={8} label={common[locale].words.loading} />}>
        <Committee locale={locale} />
        <Authorities locale={locale} />
      </Suspense>
    </div>
  );
}

async function Coverage({ locale }: { locale: Locale }) {
  const t = planningMessages[locale];
  const n = (await authorityStats()).filter((s) => !s.stale).length;
  return <p className="mt-3 max-w-[62ch] text-small text-ink-2">{t.coverage.replace("{n}", formatNumber(locale, n))}</p>;
}

function authorityHref(id: string) {
  const a = PLANNING_AUTHORITIES.find((x) => x.id === id);
  return a?.councilId && liveCouncil(a.councilId) ? `/${a.councilId}/planning` : `/planning/${id}`;
}

async function Near({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = planningMessages[locale];
  const sp = await searchParams;
  const raw = param(sp, "postcode") ?? "";
  const kmRaw = Number(param(sp, "km"));
  const km = (NEAR_DISTANCES as readonly number[]).includes(kmRaw) ? (kmRaw as (typeof NEAR_DISTANCES)[number]) : 1;
  const show = oneOf(sp, "show", NEAR_SHOW) ?? "all";
  const monthsRaw = Number(param(sp, "months"));
  const months = (NEAR_PERIODS as readonly number[]).includes(monthsRaw) ? (monthsRaw as (typeof NEAR_PERIODS)[number]) : 6;
  const type = oneOf(sp, "type", NEAR_TYPES) ?? "all";
  const sort = oneOf(sp, "sort", ["nearest"] as const) ?? "newest";
  const select = (id: string, name: string, label: string, value: string, options: Array<[string, string]>) => (
    <div>
      <label htmlFor={id} className="block text-small font-semibold">
        {label}
      </label>
      <select id={id} name={name} defaultValue={value} className="mt-1 rounded border border-rule-strong bg-bg px-2 py-2">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
  const form = (
    <form method="get" action={href(locale, "/planning")} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="pc" className="block text-small font-semibold">
          {t.postcode}
        </label>
        <input
          id="pc"
          name="postcode"
          defaultValue={raw}
          autoComplete="postal-code"
          className="mt-1 w-44 rounded border border-rule-strong bg-bg px-3 py-2 uppercase"
        />
      </div>
      {select("near-km", "km", t.near.distance, String(km), NEAR_DISTANCES.map((d) => [String(d), t.near.km.replace("{n}", formatNumber(locale, d))]))}
      {select("near-show", "show", t.near.show, show, NEAR_SHOW.map((v) => [v, t.near.shows[v]]))}
      {select("near-months", "months", t.near.period, String(months), NEAR_PERIODS.map((m) => [String(m), t.near.months.replace("{n}", String(m))]))}
      {select("near-type", "type", t.near.type, type, NEAR_TYPES.map((v) => [v, t.near.types[v]]))}
      {select("near-sort", "sort", t.near.sort, sort, [["newest", t.near.sorts.newest], ["nearest", t.near.sorts.nearest]])}
      <button type="submit" className="button">
        {t.find}
      </button>
    </form>
  );
  if (!raw) return form;
  const postcode = normalisePostcode(raw);
  const r = postcode ? await lookupPostcode(postcode) : null;
  if (!postcode || !r || !r.ok || r.lat === null || r.lng === null)
    return (
      <>
        {form}
        <p role="status" className="mt-4 text-ink-2">
          {t.nearBad}
        </p>
      </>
    );
  const [list, stats] = await Promise.all([
    applicationsNear(r.lat, r.lng, { km, show, months, type, sort: sort === "nearest" ? "nearest" : "newest" }),
    authorityStats(),
  ]);
  const open = list.filter((a) => a.status === "waiting").length;
  // The council's register may be missing or out of date: say so, so "none near you" isn't misread.
  const own = PLANNING_AUTHORITIES.find((a) => a.councilId === r.councilId);
  const ownStats = own ? stats.find((x) => x.authority === own.id) : undefined;
  const gap = !own ? null : !ownStats ? t.noDataAuthority : ownStats.stale && ownStats.latest ? t.staleAuthority.replace("{date}", formatDate(locale, ownStats.latest)) : null;
  const within = t.near.km.replace("{n}", formatNumber(locale, km));
  const when = show === "waiting" ? t.near.anyTime : t.near.inLast.replace("{n}", String(months));
  return (
    <>
      {form}
      <p role="status" className="mt-6 max-w-[62ch] text-read">
        {list.length
          ? (show === "all" ? t.near.resultAll : t.near.result)
              .replace("{n}", formatNumber(locale, list.length))
              .replace("{what}", t.near.whats[show])
              .replace("{within}", within)
              .replace("{postcode}", postcode)
              .replace("{when}", when)
              .replace("{open}", formatNumber(locale, open))
          : t.near.none.replace("{what}", t.near.whats[show]).replace("{within}", within).replace("{postcode}", postcode).replace("{when}", when)}
      </p>
      {list.length >= 500 ? <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.near.capped}</p> : null}
      {show === "waiting" ? <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.near.waitingNote}</p> : null}
      {gap ? <p className="mt-2 max-w-[62ch] text-small text-ink-2">{gap}</p> : null}
      {list.length ? (
        <ul className="rows mt-4">
          {list.map((a) => (
            <ApplicationItem
              key={a.id}
              locale={locale}
              a={a}
              extra={<span className="text-small text-ink-2 num">{formatNumber(locale, a.metres)} m</span>}
            />
          ))}
        </ul>
      ) : null}
    </>
  );
}

async function Committee({ locale }: { locale: Locale }) {
  const t = planningMessages[locale];
  const list = await recentAtCommittee(8);
  if (!list.length) return null;
  return (
    <Section id="committee" title={t.committeeTitle} className="border-t border-rule">
      <p className="-mt-1 mb-2 max-w-[62ch] text-small text-ink-2">{t.committeeLede}</p>
      <ul className="rows">
        {list.map((a) => (
          <ApplicationItem key={a.id} locale={locale} a={a} />
        ))}
      </ul>
    </Section>
  );
}

async function Authorities({ locale }: { locale: Locale }) {
  const t = planningMessages[locale];
  const stats = new Map((await authorityStats()).map((s) => [s.authority, s]));
  const list = [...PLANNING_AUTHORITIES].sort((a, b) =>
    (locale === "cy" ? a.nameCy : a.nameEn).localeCompare(locale === "cy" ? b.nameCy : b.nameEn, locale),
  );
  return (
    <Section id="authorities" title={t.authoritiesTitle} className="border-t border-rule">
      <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">{t.authoritiesLede}</p>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[40rem]">
          <thead>
            <tr>
              <th scope="col">{t.cols.authority}</th>
              <th scope="col" className="text-right">
                {t.cols.recent}
              </th>
              <th scope="col" className="text-right">
                {t.cols.open}
              </th>
              <th scope="col">{t.cols.latest}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const s = stats.get(a.id);
              const stale = s?.stale;
              return (
                <tr key={a.id}>
                  <th scope="row" className="text-left font-medium">
                    <Link href={href(locale, authorityHref(a.id))}>{locale === "cy" ? a.nameCy : a.nameEn}</Link>
                  </th>
                  <td className="text-right num">{s ? formatNumber(locale, s.recent) : "–"}</td>
                  <td className="text-right num">{s && !stale ? formatNumber(locale, s.waiting) : "–"}</td>
                  <td className={stale || !s ? "text-ink-2" : undefined}>
                    {!s ? t.noData : s.latest ? (stale ? t.stale.replace("{date}", formatDate(locale, s.latest)) : formatDate(locale, s.latest)) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
