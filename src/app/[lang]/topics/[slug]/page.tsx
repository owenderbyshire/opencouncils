import type { Metadata } from "next";
import Link from "next/link";
import { TopicTimeline } from "@/components/topic-timeline";
import { TopicLeadsBlock } from "@/components/cabinet";
import { FilterForm } from "@/components/filter-form";
import { TopicPlannedBlock } from "@/components/planned";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CompareLinks } from "@/components/compare-links";
import { FollowLinks } from "@/components/follow-links";
import { ItemRowView } from "@/components/item-row";
import { PageHeader, Section } from "@/components/page-header";
import { TopicPrimer } from "@/components/topic-primer";
import { Pagination, queryString } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeleton";
import { PAGE_SIZE } from "@/data/db";
import { latestItems, topicByCouncil } from "@/data/search";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { briefMessages } from "@/i18n/messages/briefs";
import { topicBrief } from "@/data/briefs";
import { BRIEF_SECTIONS, type BriefPoint } from "@/lib/topic-brief";
import { common } from "@/i18n/messages/common";
import { walesMessages } from "@/i18n/messages/wales";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { pageParam, param, type SearchParams } from "@/lib/params";
import { TOPIC_BY_SLUG, TOPICS, topicName, topicNote, type TopicDef } from "@/lib/topics";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/topics/[slug]">): Promise<Metadata> {
  const locale = await getLocale();
  const topic = TOPIC_BY_SLUG.get((await params).slug);
  if (!topic) return { title: common[locale].notFound.title };
  return pageMetadata({ locale, path: `/topics/${topic.slug}`, title: topic[locale], description: topicNote(locale, topic) });
}

async function topicFor(params: Params): Promise<TopicDef> {
  const topic = TOPIC_BY_SLUG.get((await params).slug);
  if (!topic) notFound();
  return topic;
}

export default async function TopicPage({ params, searchParams }: PageProps<"/[lang]/topics/[slug]">) {
  const locale = await getLocale();
  const loading = common[locale].words.loading;
  return (
    <div className="container-page">
      <Suspense fallback={<ListSkeleton rows={2} label={loading} />}>
        <Header locale={locale} params={params} />
        <Brief locale={locale} params={params} />
        <Primer locale={locale} params={params} />
      </Suspense>
      <div className="grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <aside className="min-w-0 lg:col-start-2 lg:row-start-1 lg:border-l lg:border-rule lg:pl-10">
          <Suspense fallback={<ListSkeleton rows={4} label={loading} />}>
            <ByCouncil locale={locale} params={params} />
          </Suspense>
        </aside>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <Suspense fallback={<ListSkeleton label={loading} />}>
            <Latest locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

async function Header({ locale, params }: { locale: Locale; params: Params }) {
  const topic = await topicFor(params);
  return <PageHeader kicker={walesMessages[locale].topics.title} title={topic[locale]} lede={topicNote(locale, topic)} />;
}

async function Brief({ locale, params }: { locale: Locale; params: Params }) {
  const topic = await topicFor(params);
  const b = await topicBrief(topic.slug);
  if (!b) return null;
  const t = briefMessages[locale];
  const c = b.content;
  const sources = new Map(c.sources.map((s, i) => [s.id, { ...s, n: i + 1 }]));
  const cite = (ids: string[]) =>
    ids
      .map((id) => sources.get(id))
      .filter((s) => s !== undefined)
      .map((s) => (
        <a key={s.id} href={`#brief-source-${s.n}`} className="ml-1 text-meta text-ink-2 no-underline" aria-label={`${t.sources} ${s.n}`}>
          [{s.n}]
        </a>
      ));
  const text = (p: BriefPoint) => (locale === "cy" ? p.cy : p.en);
  const month = formatDate(locale, `${b.month}-01`, "month");
  return (
    <Section id="this-month" title={t.title} className="border-t border-rule">
      <div className="max-w-[62ch]">
        {c.summary ? (
          <p className="text-read">
            {text(c.summary)}
            {cite(c.summary.sources)}
          </p>
        ) : null}
        {BRIEF_SECTIONS.filter((k) => c[k].length).map((k) => (
          <div key={k} className="mt-5">
            <h3 className="font-semibold">{t.sections[k]}</h3>
            <ul className="prose-read mt-2 list-disc space-y-2 pl-5">
              {c[k].map((p, i) => (
                <li key={i}>
                  {text(p)}
                  {cite(p.sources)}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-5 text-small text-ink-2">
          {t.written.replace("{month}", month).replace("{from}", formatDate(locale, c.recordsFrom))} {t.how}
        </p>
        <details className="mt-3 text-small">
          <summary className="cursor-pointer text-ink-2">{t.sources}</summary>
          <ol className="mt-2 space-y-1">
            {[...sources.values()].map((s) => (
              <li key={s.id} id={`brief-source-${s.n}`}>
                {s.n}.{" "}
                {s.kind === "record" && s.councilId && s.meetingId ? (
                  <Link href={href(locale, `/${s.councilId}/meetings/${s.meetingId}`)}>
                    {t.meeting.replace("{council}", councilConfig(s.councilId) ? councilShort(locale, councilConfig(s.councilId)!) : s.councilId).replace("{date}", s.date ? formatDate(locale, s.date) : "")}
                  </Link>
                ) : s.url ? (
                  <a href={s.url} rel="noopener">
                    {s.kind === "consultation" ? `${t.consultation}: ` : ""}
                    <span lang="en">{s.title}</span>
                  </a>
                ) : (
                  <span lang="en">{s.title}</span>
                )}
                {s.kind === "record" ? (
                  <span className="text-ink-2" lang="en">
                    {" "}
                    {s.title}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      </div>
    </Section>
  );
}

async function Primer({ locale, params }: { locale: Locale; params: Params }) {
  const topic = await topicFor(params);
  return <TopicPrimer locale={locale} slug={topic.slug} />;
}

async function ByCouncil({ locale, params }: { locale: Locale; params: Params }) {
  const topic = await topicFor(params);
  const t = walesMessages[locale].topics;
  const rows = await topicByCouncil(topic.slug);
  return (
    <>
      <Section id="by-council" title={t.byCouncil} className="border-t border-rule">
        <p className="-mt-1 mb-3 text-meta text-ink-2">{t.byCouncilNote}</p>
        <div className="mb-4">
          <CompareLinks locale={locale} topic={topic.slug} />
        </div>
        {rows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t.council}</th>
                <th scope="col" className="text-right">
                  {t.itemsCol}
                </th>
                <th scope="col" className="text-right">
                  {t.decidedCol}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = councilConfig(r.councilId);
                return (
                  <tr key={r.councilId}>
                    <td>
                      <Link href={href(locale, `/topics/${topic.slug}`) + queryString({ council: r.councilId })} scroll={false}>
                        {c ? councilShort(locale, c) : r.councilId}
                      </Link>
                    </td>
                    <td className="text-right num">{formatNumber(locale, r.items)}</td>
                    <td className="text-right num">{formatNumber(locale, r.decided)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-small text-ink-2">{t.none}</p>
        )}
      </Section>
      <TopicLeadsBlock locale={locale} topic={topic.slug} />
      <TopicPlannedBlock locale={locale} topic={topic.slug} />
      <Section id="follow" title={walesMessages[locale].feeds.title} className="border-t border-rule">
        <FollowLinks locale={locale} rss={`/feeds/topic-${topic.slug}.xml`} />
      </Section>
    </>
  );
}

async function Latest({ locale, params, searchParams }: { locale: Locale; params: Params; searchParams: Promise<SearchParams> }) {
  const topic = await topicFor(params);
  const sp = await searchParams;
  const t = walesMessages[locale].topics;
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const page = pageParam(sp);
  const { rows, total } = await latestItems({ topic: topic.slug, council, page });
  const c = council ? councilConfig(council) : undefined;
  return (
    <Section
      id="latest"
      title={c ? `${t.latestTitle}: ${councilShort(locale, c)}` : t.latestTitle}
      className="border-t border-rule"
      aside={
        c ? (
          <Link href={href(locale, `/topics/${topic.slug}`)} scroll={false}>
            {walesMessages[locale].search.allCouncils}
          </Link>
        ) : undefined
      }
    >
      <div className="mb-4">
        <FilterForm locale={locale} path={`/topics/${topic.slug}`} council={council} showTopic={false} />
      </div>
      {council ? <TopicTimeline locale={locale} topic={topic.slug} council={council} topicName={topicName(locale, topic.slug)} /> : null}
      {rows.length ? (
        <div className="rows">
          {rows.map((r) => (
            <ItemRowView key={`${r.councilId}-${r.agendaItemId}`} locale={locale} row={r} showTopics={false} showCouncil={!council} />
          ))}
        </div>
      ) : (
        <p className="text-ink-2">{t.none}</p>
      )}
      <Pagination locale={locale} path={`/topics/${topic.slug}`} page={page} total={total} pageSize={PAGE_SIZE} params={{ council }} />
    </Section>
  );
}
