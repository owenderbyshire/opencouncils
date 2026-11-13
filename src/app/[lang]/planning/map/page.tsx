import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PlanningMap, type PlanningMapLabels } from "@/components/planning-map";
import { BlockSkeleton } from "@/components/skeleton";
import { liveApplicationMap, MAP_KINDS } from "@/data/planning";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { planningMessages } from "@/i18n/messages/planning";
import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, type SearchParams } from "@/lib/params";

/*
 * Every planning application waiting for a decision, on a map
 * (src/components/planning-map.tsx). The type filter is a link, so every view
 * has its own address.
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = planningMessages[locale].map;
  return pageMetadata({ locale, path: "/planning/map", title: t.title, description: t.lede });
}

export default async function PlanningMapPage({ searchParams }: PageProps<"/[lang]/planning/map">) {
  const locale = await getLocale();
  const t = planningMessages[locale].map;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede}>
        <Suspense fallback={null}>
          <Summary locale={locale} />
        </Suspense>
      </PageHeader>
      <Suspense fallback={<BlockSkeleton lines={10} label={common[locale].words.loading} />}>
        <MapView locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
      <p className="mt-6 max-w-[62ch] text-small text-ink-2">
        <Link href={`${href(locale, "/planning")}#near`}>{t.list}</Link>
      </p>
      <p className="mt-2 max-w-[62ch] text-small text-ink-3">{t.source}</p>
    </div>
  );
}

async function Summary({ locale }: { locale: Locale }) {
  const t = planningMessages[locale].map;
  const m = await liveApplicationMap();
  const names = m.leftOut
    .map((id) => PLANNING_AUTHORITIES.find((a) => a.id === id))
    .filter((a) => !!a)
    .map((a) => (locale === "cy" ? a.nameCy : a.nameEn))
    .sort((x, y) => x.localeCompare(y, locale));
  return (
    <div className="mt-3 max-w-[62ch] space-y-2 text-small text-ink-2">
      <p>
        {t.summary
          .replace("{n}", formatNumber(locale, m.total))
          .replace("{from}", formatDate(locale, m.from))
          .replace("{unlocated}", formatNumber(locale, m.unlocated))}
      </p>
      {names.length ? <p>{t.leftOut.replace("{list}", formatList(locale, names, { places: true }))}</p> : null}
    </div>
  );
}

async function MapView({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const t = planningMessages[locale];
  const sp = await searchParams;
  const kind = oneOf(sp, "type", MAP_KINDS) ?? "all";
  const labels: PlanningMapLabels = {
    region: t.map.region,
    loading: t.map.loading,
    failed: t.map.failed,
    received: t.map.received,
    consultation: t.map.consultation,
    open: t.map.open,
    comment: t.map.comment,
    shown: t.map.shown,
    zoomHint: t.map.zoomHint,
  };
  const link = (k: "all" | (typeof MAP_KINDS)[number]) => (k === "all" ? href(locale, "/planning/map") : `${href(locale, "/planning/map")}?type=${k}`);
  return (
    <>
      <nav aria-label={t.map.kind} className="mb-3 flex flex-wrap gap-2">
        {(["all", ...MAP_KINDS] as Array<"all" | (typeof MAP_KINDS)[number]>).map((k) => (
          <Link key={k} href={link(k)} className="chip" aria-current={kind === k ? "page" : undefined} scroll={false}>
            {t.near.types[k]}
          </Link>
        ))}
      </nav>
      <PlanningMap key={kind} locale={locale} kind={kind} labels={labels} />
    </>
  );
}
