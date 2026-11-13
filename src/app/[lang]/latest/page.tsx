import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import Link from "next/link";
import { Suspense } from "react";
import { FilterForm } from "@/components/filter-form";
import { ItemRowView } from "@/components/item-row";
import { PageHeader, Section } from "@/components/page-header";
import { Pagination, queryString } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeleton";
import { PAGE_SIZE } from "@/data/db";
import { latestItems, MAIN_KINDS, mainMeetingsAhead, type MainKind } from "@/data/search";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { councilMessages } from "@/i18n/messages/council";
import { forwardPlanMessages } from "@/i18n/messages/forward-plans";
import { Rich } from "@/i18n/rich";
import { walesMessages } from "@/i18n/messages/wales";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, pageParam, param, type SearchParams } from "@/lib/params";
import { TOPIC_BY_SLUG } from "@/lib/topics";

/*
 * Latest business across Wales, newest first, and the meetings coming up,
 * each filterable by council and (for business) topic.
 */

const VIEWS = ["business", "coming"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = walesMessages[locale].latest;
  return pageMetadata({ locale, path: "/latest", title: t.title, description: t.lede });
}

export default async function LatestPage({ searchParams }: PageProps<"/[lang]/latest">) {
  const locale = await getLocale();
  const t = walesMessages[locale].latest;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton rows={8} label={common[locale].words.loading} />}>
        <Body locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Body({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = walesMessages[locale].latest;
  const view = oneOf(sp, "view", VIEWS) ?? "business";
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const topicRaw = param(sp, "topic");
  const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
  const decided = param(sp, "decided") === "1";
  const page = pageParam(sp);
  const kind = oneOf(sp, "kind", MAIN_KINDS);
  const period = oneOf(sp, "period", ["month"] as const) ?? "week";
  const link = (o: Record<string, string | undefined>) =>
    href(locale, "/latest") +
    queryString({
      view: view === "business" ? undefined : view,
      council,
      topic: view === "business" ? topic : undefined,
      decided: decided ? "1" : undefined,
      kind: view === "coming" ? kind : undefined,
      period: view === "coming" && period === "month" ? "month" : undefined,
      ...o,
    });

  return (
    <>
      <nav aria-label={t.title} className="flex flex-wrap gap-2 border-t border-rule pt-6">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={link({ view: v === "business" ? undefined : v })}
            className="chip"
            aria-current={view === v ? "page" : undefined}
            scroll={false}
          >
            {v === "business" ? t.business : t.coming}
          </Link>
        ))}
      </nav>
      <div className="mt-5">
        <FilterForm
          locale={locale}
          path="/latest"
          council={council}
          topic={topic}
          showTopic={view === "business"}
          hidden={{
            view: view === "business" ? undefined : view,
            decided: decided ? "1" : undefined,
            kind: view === "coming" ? kind : undefined,
            period: view === "coming" && period === "month" ? "month" : undefined,
          }}
        />
      </div>
      {view === "business" ? (
        <Business locale={locale} council={council} topic={topic} decided={decided} page={page} link={link} />
      ) : (
        <Coming locale={locale} council={council} kind={kind} period={period} link={link} />
      )}
    </>
  );
}

async function Business({
  locale,
  council,
  topic,
  decided,
  page,
  link,
}: {
  locale: Locale;
  council?: string;
  topic?: string;
  decided: boolean;
  page: number;
  link: (o: Record<string, string | undefined>) => string;
}) {
  const t = walesMessages[locale].latest;
  const { rows, total } = await latestItems({ council, topic, decidedOnly: decided, noRoutine: true, page });
  return (
    <Section
      id="business"
      title={t.business}
      className="mt-6 border-t border-rule"
      aside={
        <span className="flex gap-2 text-small">
          <Link href={link({ decided: undefined })} className="chip" aria-current={!decided ? "page" : undefined} scroll={false}>
            {t.allItems}
          </Link>
          <Link href={link({ decided: "1" })} className="chip" aria-current={decided ? "page" : undefined} scroll={false}>
            {t.decidedOnly}
          </Link>
        </span>
      }
    >
      <p className="-mt-2 mb-2 text-small text-ink-2 num">{total === 1 ? t.countOne : t.count.replace("{n}", formatNumber(locale, total))}</p>
      {rows.length ? (
        <div className="rows">
          {rows.map((r) => (
            <ItemRowView key={`${r.councilId}-${r.agendaItemId}`} locale={locale} row={r} showCouncil={!council} />
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{t.none}</p>
      )}
      <Pagination
        locale={locale}
        path="/latest"
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        params={{ council, topic, decided: decided ? "1" : undefined }}
      />
    </Section>
  );
}

const PERIODS = { week: 7, month: 28 } as const;

async function Coming({
  locale,
  council,
  kind,
  period,
  link,
}: {
  locale: Locale;
  council?: string;
  kind?: MainKind;
  period: keyof typeof PERIODS;
  link: (o: Record<string, string | undefined>) => string;
}) {
  const t = walesMessages[locale].latest;
  const k = councilMessages[locale].kinds;
  const rows = await mainMeetingsAhead(PERIODS[period], council, kind);
  return (
    <Section id="coming" title={t.coming} className="mt-6 border-t border-rule">
      <p className="-mt-2 mb-3 max-w-[62ch] text-small text-ink-2">
        {t.comingNote} <Rich text={forwardPlanMessages[locale].latestLink} links={{ p: href(locale, "/forward-plans") + queryString({ council }) }} />
      </p>
      <nav aria-label={t.comingFilters} className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-small">
        <span className="flex flex-wrap gap-2">
          <Link href={link({ kind: undefined })} className="chip" aria-current={!kind ? "page" : undefined} scroll={false}>
            {t.allMeetings}
          </Link>
          {MAIN_KINDS.map((x) => (
            <Link key={x} href={link({ kind: x })} className="chip" aria-current={kind === x ? "page" : undefined} scroll={false}>
              {k[x]}
            </Link>
          ))}
        </span>
        <span className="flex flex-wrap gap-2">
          <Link href={link({ period: undefined })} className="chip" aria-current={period === "week" ? "page" : undefined} scroll={false}>
            {t.nextWeek}
          </Link>
          <Link href={link({ period: "month" })} className="chip" aria-current={period === "month" ? "page" : undefined} scroll={false}>
            {t.nextMonth}
          </Link>
        </span>
      </nav>
      {rows.length ? (
        <ul className="rows">
          {rows.map((m) => {
            const c = councilConfig(m.councilId);
            const name = committeeName(locale, m.committeeEn, m.committeeCy);
            return (
              <li key={`${m.councilId}-${m.meetingId}`} className="grid gap-x-6 py-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
                <p className="text-small text-ink-2">
                  <time dateTime={m.date}>{formatDate(locale, m.date, "weekdayDay")}</time>
                  {m.startTime ? `, ${m.startTime}` : ""}
                </p>
                <div>
                  <p>
                    <Link href={href(locale, `/${m.councilId}/meetings/${m.meetingId}`)} className="font-semibold" lang={name.lang}>
                      {name.text}
                    </Link>
                    {c && !council ? <span className="text-ink-2">, {councilShort(locale, c)}</span> : null}
                  </p>
                  {m.items.length ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-small" lang={locale === "cy" ? "en" : undefined}>
                      {m.items.slice(0, 8).map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                      {m.items.length > 8 ? (
                        <li className="list-none text-ink-2">{t.moreItems.replace("{n}", String(m.items.length - 8))}</li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="mt-1 text-small text-ink-2">{m.agendaPublished ? t.onlyRoutine : t.noAgendaYet}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-ink-2">{period === "week" ? t.comingNoneWeek : t.comingNone}</p>
      )}
    </Section>
  );
}
