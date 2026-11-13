import { notFound } from "next/navigation";
import { SHOW_ISSUES } from "@/lib/features";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterForm } from "@/components/filter-form";
import { IssueRowView } from "@/components/issue-row";
import { PageHeader, Section } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { ListSkeleton } from "@/components/skeleton";
import { PAGE_SIZE } from "@/data/db";
import { listIssues } from "@/data/issues";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { issueMessages } from "@/i18n/messages/issues";
import { getLocale } from "@/i18n/server";
import { liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { pageParam, param, type SearchParams } from "@/lib/params";
import { TOPIC_BY_SLUG } from "@/lib/topics";

/* Issues across Wales: business followed from meeting to meeting, newest activity first. */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = issueMessages[locale];
  return pageMetadata({ locale, path: "/issues", title: t.title, description: t.lede });
}

export default async function IssuesPage({ searchParams }: PageProps<"/[lang]/issues">) {
  if (!SHOW_ISSUES) notFound();
  const locale = await getLocale();
  const t = issueMessages[locale];
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
  const t = issueMessages[locale];
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const topicRaw = param(sp, "topic");
  const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
  const page = pageParam(sp);
  const { rows, total } = await listIssues({ council, topic, page });
  return (
    <>
      <div className="border-t border-rule pt-6">
        <FilterForm locale={locale} path="/issues" council={council} topic={topic} />
      </div>
      <Section id="issues" title={total === 1 ? t.countOne : t.count.replace("{n}", formatNumber(locale, total))} className="mt-6 border-t border-rule">
        {rows.length ? (
          <ul className="rows max-w-[56rem]">
            {rows.map((r) => (
              <IssueRowView key={`${r.councilId}-${r.id}`} locale={locale} issue={r} showCouncil={!council} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">{t.none}</p>
        )}
        <Pagination locale={locale} path="/issues" page={page} total={total} pageSize={PAGE_SIZE} params={{ council, topic }} />
      </Section>
      <Section id="how" title={t.howTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.how}</p>
      </Section>
    </>
  );
}
