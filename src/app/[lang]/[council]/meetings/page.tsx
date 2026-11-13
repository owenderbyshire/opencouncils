import type { Metadata } from "next";
import { KindGuideLink } from "@/components/take-part";
import { Suspense } from "react";
import { MeetingItem } from "@/components/meeting-item";
import { WeekStrip } from "@/components/week-strip";
import { PageHeader } from "@/components/page-header";
import { FilterGroup, Pagination } from "@/components/pagination";
import { BlockSkeleton, ListSkeleton } from "@/components/skeleton";
import { listMeetings, type MeetingWhen } from "@/data/council";
import { PAGE_SIZE } from "@/data/db";
import type { CommitteeKind } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { getLocale } from "@/i18n/server";
import { councilName, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, pageParam, type SearchParams } from "@/lib/params";
import { councilFrom } from "@/lib/route";

const KINDS = ["council", "cabinet", "scrutiny", "planning", "regulatory", "other"] as const satisfies readonly CommitteeKind[];
const WHEN = ["upcoming", "past"] as const satisfies readonly MeetingWhen[];
const CANCELLED = ["hide"] as const;

type Params = Promise<{ council: string }>;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/meetings">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = councilMessages[locale].meetings;
  const name = councilName(locale, c);
  return pageMetadata({ locale, path: `/${c.id}/meetings`, title: `${t.title}: ${name}`, description: t.lede.replace("{name}", name) });
}

export default async function MeetingsPage({ params, searchParams }: PageProps<"/[lang]/[council]/meetings">) {
  const locale = await getLocale();
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={2} label={loading} />}>
        <Header locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <Week locale={locale} params={params} />
      </Suspense>
      <Suspense fallback={<ListSkeleton label={loading} />}>
        <List locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Header({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = councilMessages[locale].meetings;
  return <PageHeader title={t.title} lede={t.lede.replace("{name}", councilName(locale, c))} />;
}

async function Week({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  return <WeekStrip locale={locale} councilId={c.id} />;
}

async function List({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const c = await councilFrom(params);
  const sp = await searchParams;
  const t = councilMessages[locale];
  const kind = oneOf(sp, "kind", KINDS);
  const when = oneOf(sp, "when", WHEN) ?? "past";
  const page = pageParam(sp);
  const cancelled = oneOf(sp, "cancelled", CANCELLED);
  const { rows, total } = await listMeetings(c.id, { kind, when, page, hideCancelled: cancelled === "hide" });
  const path = `/${c.id}/meetings`;
  return (
    <>
      <div className="mb-6 space-y-3 border-t border-rule pt-6">
        <FilterGroup
          label={t.meetings.filterWhen}
          locale={locale}
          path={path}
          param="when"
          current={when === "past" ? undefined : when}
          params={{ kind, cancelled }}
          options={[
            { value: undefined, label: t.meetings.past },
            { value: "upcoming", label: t.meetings.upcoming },
          ]}
        />
        <FilterGroup
          label={t.meetings.filterKind}
          locale={locale}
          path={path}
          param="kind"
          current={kind}
          params={{ when: when === "past" ? undefined : when, cancelled }}
          options={[{ value: undefined, label: common[locale].words.all }, ...KINDS.map((k) => ({ value: k, label: t.kinds[k] }))]}
        />
        <FilterGroup
          label={t.meetings.filterCancelled}
          locale={locale}
          path={path}
          param="cancelled"
          current={cancelled}
          params={{ kind, when: when === "past" ? undefined : when }}
          options={[
            { value: undefined, label: t.meetings.showCancelled },
            { value: "hide", label: t.meetings.hideCancelled },
          ]}
        />
        {kind ? (
          <p className="max-w-[62ch] text-small text-ink-2">
            {t.kindNotes[kind]} <KindGuideLink locale={locale} kind={kind} />
          </p>
        ) : null}
      </div>
      {rows.length ? (
        <div className="rows">
          {rows.map((r) => (
            <MeetingItem key={r.id} locale={locale} row={r} showOverview={when === "past"} />
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{t.meetings.none}</p>
      )}
      <Pagination locale={locale} path={path} page={page} total={total} pageSize={PAGE_SIZE} params={{ kind, when: when === "past" ? undefined : when, cancelled }} />
    </>
  );
}
