import Link from "next/link";
import { committeeName } from "@/lib/committees";
import type { ItemRow } from "@/data/search";
import { href, type Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";
import { walesMessages } from "@/i18n/messages/wales";
import { pickText } from "@/i18n/pick";
import { councilConfig, councilShort } from "@/lib/councils";
import { topicName } from "@/lib/topics";
import { tidyMinute, tidyTitle } from "@/lib/agenda";

/** Search matches come back with [[ and ]] around matched words. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/g);
  return (
    <>
      {parts.map((p, i) => (p.startsWith("[[") && p.endsWith("]]") ? <mark key={i}>{p.slice(2, -2)}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

/**
 * One piece of council business: where and when, its plain headline (or the
 * agenda title), and what was decided. Used by search, topics and the home page.
 */
export function ItemRowView({
  locale,
  row,
  showCouncil = true,
  showTopics = true,
}: {
  locale: Locale;
  row: ItemRow;
  showCouncil?: boolean;
  showTopics?: boolean;
}) {
  const t = walesMessages[locale];
  const c = councilConfig(row.councilId);
  const committee = committeeName(locale, row.committeeEn, row.committeeCy);
  const headline = pickText(locale, row.headlineEn, row.headlineCy);
  const decided = pickText(locale, row.decidedEn, row.decidedCy);
  const link = href(locale, `/${row.councilId}/meetings/${row.meetingId}#item-${row.agendaItemId}`);
  return (
    <article className="py-4">
      <p className="text-meta text-ink-2">
        {showCouncil && c ? `${councilShort(locale, c)}, ` : ""}
        <span lang={committee.lang}>{committee.text}</span>, <time dateTime={row.date}>{formatDate(locale, row.date)}</time>
      </p>
      <h3 className="mt-0.5 font-sans text-body font-semibold">
        {headline.text ? (
          <Link href={link} lang={headline.lang}>
            {headline.text}
          </Link>
        ) : (
          <Link href={link} lang={locale === "cy" ? "en" : undefined}>
            {tidyTitle(row.title)}
          </Link>
        )}
      </h3>
      {row.snippet ? (
        <p className="mt-1 max-w-[72ch] text-small text-ink-2">
          <Snippet text={row.snippet} />
        </p>
      ) : decided.text ? (
        <p className="mt-1 max-w-[72ch] text-small" lang={decided.lang}>
          <span className="font-semibold">{t.item.decided}: </span>
          {decided.text}
        </p>
      ) : row.decision ? (
        <p className="mt-1 line-clamp-3 max-w-[72ch] text-small text-ink-2" lang={locale === "cy" ? "en" : undefined}>
          {tidyMinute(row.decision)}
        </p>
      ) : null}
      {showTopics && row.topics.length ? (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-meta">
          <span className="visually-hidden">{t.item.topics}: </span>
          {row.topics.map((s) => (
            <Link key={s} href={href(locale, `/topics/${s}`)} className="text-ink-2">
              {topicName(locale, s)}
            </Link>
          ))}
        </p>
      ) : null}
    </article>
  );
}
