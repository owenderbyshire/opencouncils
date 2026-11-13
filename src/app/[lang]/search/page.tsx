import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ItemRowView } from "@/components/item-row";
import { PageHeader } from "@/components/page-header";
import { Pagination, queryString } from "@/components/pagination";
import { SearchForm } from "@/components/search-form";
import { ListSkeleton } from "@/components/skeleton";
import { PAGE_SIZE } from "@/data/db";
import { search } from "@/data/search";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { walesMessages } from "@/i18n/messages/wales";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { pageParam, param, searchText, type SearchParams } from "@/lib/params";
import { TOPIC_BY_SLUG, topicName } from "@/lib/topics";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = walesMessages[locale].search;
  return pageMetadata({ locale, path: "/search", title: t.title, description: t.lede, noindex: true });
}

export default async function SearchPage({ searchParams }: PageProps<"/[lang]/search">) {
  const locale = await getLocale();
  const t = walesMessages[locale].search;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton label={common[locale].words.loading} />}>
        <Results locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

async function Results({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = walesMessages[locale].search;
  // Control characters out and spaces collapsed; a query with nothing left shows the search form.
  const q = searchText(param(sp, "q"));
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const topicRaw = param(sp, "topic");
  const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
  const page = pageParam(sp);

  if (!q)
    return (
      <div className="border-t border-rule pt-6">
        <SearchForm locale={locale} council={council} topic={topic} large />
        <p className="mt-3 max-w-[62ch] text-small text-ink-2">{t.tips}</p>
      </div>
    );

  const { rows, total, byCouncil } = await search(q, { council, topic, page });
  const quoted = `“${q}”`;
  const feed = `/feeds/search.xml${queryString({ q, council, topic })}`;
  return (
    <div className="border-t border-rule pt-6">
      <SearchForm locale={locale} q={q} council={council} topic={topic} />
      <div className="mt-6 grid gap-x-14 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <p className="text-small text-ink-2" role="status">
            {total === 0
              ? t.none.replace("{q}", quoted)
              : (total === 1 ? t.resultsOne : t.results).replace("{n}", formatNumber(locale, total)).replace("{q}", quoted)}
            {topic ? ` (${topicName(locale, topic)})` : ""}
          </p>
          {rows.length ? (
            <div className="rows mt-2">
              {rows.map((r) => (
                <ItemRowView key={`${r.councilId}-${r.agendaItemId}`} locale={locale} row={r} />
              ))}
            </div>
          ) : null}
          <Pagination locale={locale} path="/search" page={page} total={total} pageSize={PAGE_SIZE} params={{ q, council, topic }} />
        </div>
        <aside className="mt-8 space-y-6 text-small lg:mt-0">
          {byCouncil.length > 1 || council ? (
            <nav aria-label={t.council}>
              <h2 className="font-sans text-small font-semibold">{t.council}</h2>
              <ul className="mt-2 space-y-1">
                <li>
                  <Link href={href(locale, "/search") + queryString({ q, topic })} aria-current={!council ? "true" : undefined} className="aria-[current=true]:font-semibold">
                    {t.allCouncils}
                  </Link>
                </li>
                {byCouncil.map((b) => {
                  const c = councilConfig(b.councilId);
                  if (!c) return null;
                  return (
                    <li key={b.councilId}>
                      <Link
                        href={href(locale, "/search") + queryString({ q, topic, council: b.councilId })}
                        aria-current={council === b.councilId ? "true" : undefined}
                        className="aria-[current=true]:font-semibold"
                      >
                        {councilShort(locale, c)}
                      </Link>{" "}
                      <span className="text-ink-2 num">{formatNumber(locale, b.n)}</span>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ) : null}
          <div>
            <h2 className="font-sans text-small font-semibold">{t.feed}</h2>
            <p className="mt-1">
              <a href={feed}>RSS</a>
            </p>
            <p className="mt-1 text-meta text-ink-2">{t.feedNote}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
