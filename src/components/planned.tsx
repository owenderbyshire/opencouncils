import Link from "next/link";
import { Section } from "@/components/page-header";
import { queryString } from "@/components/pagination";
import { forwardPlanCoverage, plannedDecisions, type PlannedDecision } from "@/data/forward-plans";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { forwardPlanMessages } from "@/i18n/messages/forward-plans";
import { councilConfig, councilShort } from "@/lib/councils";
import { topicName } from "@/lib/topics";
import { addDays } from "@/lib/forward-plan";
import { tidyTitle } from "@/lib/agenda";

/*
 * Planned decisions: the pieces shared by the all-Wales page, a council's
 * overview and the topic pages. Titles, decision makers and lead members are
 * the council's own words, usually English, so they carry lang="en" on Welsh
 * pages.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** How far ahead "soon" reaches. */
export const SOON_DAYS = 28;

/**
 * Due in the next 28 days. A decision with only a month counts when that month is the current one: it is then due
 * before the month ends. A later month could fall outside the 28 days, so it waits under "Later".
 */
export const isSoon = (d: PlannedDecision, today: string) =>
  d.when !== null && (d.monthOnly ? d.when.slice(0, 7) === today.slice(0, 7) : d.when <= addDays(today, SOON_DAYS));

/** When a decision is due, as a reader would say it: a day, or "during" a month. */
export function whenText(locale: Locale, d: PlannedDecision): string {
  const t = forwardPlanMessages[locale];
  if (!d.when) return "";
  return d.monthOnly ? fill(t.dueMonth, { month: formatDate(locale, d.when, "month") }) : formatDate(locale, d.when, "weekday");
}

const en = (locale: Locale) => (locale === "cy" ? "en" : undefined);

/**
 * One planned decision: when, what (linked to the council's own page for it),
 * who decides, and what the council says about it. `compact` leaves out the
 * description and the lines beneath, for short lists inside other pages.
 */
export function PlannedRow({ locale, d, showCouncil = true, compact = false, filters = {} }: { locale: Locale; d: PlannedDecision; showCouncil?: boolean; compact?: boolean; filters?: { council?: string; topic?: string; makers?: string } }) {
  const t = forwardPlanMessages[locale];
  const c = councilConfig(d.councilId);
  const link = (o: Record<string, string | undefined>) => href(locale, "/forward-plans") + queryString({ ...filters, ...o });
  const notes = [
    d.isKey === true ? t.key : null,
    d.restriction && !/^open\b/i.test(d.restriction) ? t.restricted : null,
    d.finalDue ? fill(t.finalDue, { date: formatDate(locale, d.finalDue) }) : null,
  ].filter(Boolean);
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <p className="text-small text-ink-2">{d.when ? <time dateTime={d.monthOnly ? d.when.slice(0, 7) : d.when}>{whenText(locale, d)}</time> : null}</p>
      <div>
        <h3 className="font-sans text-body font-semibold">
          <a href={d.url} rel="noopener" lang={en(locale)}>
            {tidyTitle(d.title)}
          </a>
        </h3>
        <p className="mt-0.5 text-small text-ink-2">
          {showCouncil && c ? (
            <>
              <Link href={link({ council: d.councilId })} scroll={false}>
                {councilShort(locale, c)}
              </Link>
              {", "}
            </>
          ) : null}
          <span lang={en(locale)}>{d.makers}</span>
        </p>
        {!compact && d.purpose ? (
          <p className="mt-1 line-clamp-2 max-w-[72ch] text-small" lang={en(locale)}>
            {d.purpose}
          </p>
        ) : null}
        {!compact && (notes.length || d.leadMember) ? (
          <p className="mt-1 max-w-[72ch] text-small text-ink-2">
            {notes.join(". ")}
            {notes.length ? ". " : ""}
            {d.leadMember ? (
              <>
                {t.leadMember}: <span lang={en(locale)}>{d.leadMember}</span>.
              </>
            ) : null}
          </p>
        ) : null}
        {!compact && d.topics.length ? (
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-meta">
            {d.topics.map((s) => (
              <Link key={s} href={link({ topic: s })} className="text-ink-2" scroll={false}>
                {topicName(locale, s)}
              </Link>
            ))}
          </p>
        ) : null}
        {d.takenMeetingId ? (
          <p className="mt-1 text-small">
            <Link href={href(locale, `/${d.councilId}/meetings/${d.takenMeetingId}${d.takenItemId ? `#item-${d.takenItemId}` : ""}`)}>
              {fill(t.onAgenda, { date: d.when ? formatDate(locale, d.when) : "" })}
            </Link>
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * "Coming to Cabinet" on a council's overview: the next few decisions its
 * Cabinet plans to take. Nothing is shown for a council whose list of
 * forthcoming decisions OpenCouncil has not read.
 */
export async function ComingToCabinetBlock({ locale, councilId }: { locale: Locale; councilId: string }) {
  const [lists, coverage] = await Promise.all([plannedDecisions(), forwardPlanCoverage()]);
  const mine = coverage.find((c) => c.councilId === councilId);
  if (!mine?.shown) return null;
  const t = forwardPlanMessages[locale];
  const ahead = lists.ahead.filter((d) => d.councilId === councilId && d.executive);
  // Everything still on the council's list, whoever decides it: what the linked page shows.
  const all = [...lists.ahead, ...lists.undated, ...lists.overdue].filter((d) => d.councilId === councilId).length;
  return (
    <Section
      id="coming-to-cabinet"
      icon="decisions"
      title={t.block.title}
      className="border-t border-rule"
      aside={all ? <Link href={`${href(locale, "/forward-plans")}?council=${councilId}&makers=all`}>{fill(all === 1 ? t.block.showOne : t.block.showAll, { n: formatNumber(locale, all) })}</Link> : undefined}
    >
      <p className="-mt-1 mb-2 max-w-[62ch] text-small text-ink-2">{t.block.lede}</p>
      {ahead.length ? (
        <ul className="rows">
          {ahead.slice(0, 4).map((d) => (
            <PlannedRow key={d.issueId} locale={locale} d={d} showCouncil={false} compact />
          ))}
        </ul>
      ) : (
        <p className="text-ink-2">{t.block.none}</p>
      )}
      {mine.readOn ? <p className="mt-3 max-w-[62ch] text-meta text-ink-2">{fill(t.block.source, { date: formatDate(locale, mine.readOn) })}</p> : null}
    </Section>
  );
}

/** Planned decisions on a topic page: the next few, and a link to them all. Nothing when no list has one on the topic. */
export async function TopicPlannedBlock({ locale, topic }: { locale: Locale; topic: string }) {
  const t = forwardPlanMessages[locale];
  const ahead = (await plannedDecisions()).ahead.filter((d) => d.topics.includes(topic));
  if (!ahead.length) return null;
  return (
    <Section id="planned" title={t.topicBlock.title} className="border-t border-rule">
      <p className="-mt-1 mb-2 text-meta text-ink-2">{t.topicBlock.lede}</p>
      <ul className="rows text-small">
        {ahead.slice(0, 3).map((d) => {
          const c = councilConfig(d.councilId);
          return (
            <li key={`${d.councilId}-${d.issueId}`} className="py-2.5">
              <span className="text-ink-2">
                {c ? `${councilShort(locale, c)}, ` : ""}
                {whenText(locale, d)}
              </span>
              <span className="block">
                <a href={d.url} rel="noopener" lang={en(locale)}>
                  {tidyTitle(d.title)}
                </a>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-small">
        <Link href={`${href(locale, "/forward-plans")}?topic=${topic}&makers=all`}>{fill(t.topicBlock.showAll, { n: formatNumber(locale, ahead.length) })}</Link>
      </p>
    </Section>
  );
}
