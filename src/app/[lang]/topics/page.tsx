import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeleton";
import { topicStats } from "@/data/search";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { walesMessages } from "@/i18n/messages/wales";
import { getLocale } from "@/i18n/server";
import { pageMetadata } from "@/lib/metadata";
import { TOPICS, topicNote } from "@/lib/topics";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = walesMessages[locale].topics;
  return pageMetadata({ locale, path: "/topics", title: t.title, description: t.lede });
}

export default async function TopicsPage() {
  const locale = await getLocale();
  const t = walesMessages[locale].topics;
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton label={common[locale].words.loading} />}>
        <List locale={locale} />
      </Suspense>
    </div>
  );
}

async function List({ locale }: { locale: Locale }) {
  const t = walesMessages[locale].topics;
  const stats = new Map((await topicStats()).map((s) => [s.topic, s]));
  return (
    <ul className="rows border-t border-rule">
      {TOPICS.map((topic) => {
        const s = stats.get(topic.slug);
        return (
          <li key={topic.slug} className="grid gap-x-8 gap-y-1 py-4 md:grid-cols-[1fr_16rem]">
            <div>
              <h2 className="font-sans text-body font-semibold">
                <Link href={href(locale, `/topics/${topic.slug}`)}>{topic[locale]}</Link>
              </h2>
              <p className="max-w-[62ch] text-small text-ink-2">{topicNote(locale, topic)}</p>
            </div>
            <p className="text-small text-ink-2">
              {s ? (
                <>
                  {t.items.replace("{n}", formatNumber(locale, s.items))} {t.councils.replace("{n}", formatNumber(locale, s.councils))}
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
