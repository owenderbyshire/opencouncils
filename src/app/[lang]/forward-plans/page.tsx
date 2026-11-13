import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Figures } from "@/components/figures";
import { FilterForm } from "@/components/filter-form";
import { PageHeader, Section } from "@/components/page-header";
import { queryString } from "@/components/pagination";
import { isSoon, PlannedRow } from "@/components/planned";
import { ListSkeleton } from "@/components/skeleton";
import { forwardPlanCoverage, plannedDecisions, type ForwardPlanCoverage, type PlannedDecision } from "@/data/forward-plans";
import { FORWARD_PLAN_PAGES } from "@data/curated/forward-plan-pages";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { forwardPlanMessages } from "@/i18n/messages/forward-plans";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { ynPlace } from "@/i18n/welsh";
import { councilConfig, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { oneOf, param, type SearchParams } from "@/lib/params";
import { SITE } from "@/lib/site";
import { TOPIC_BY_SLUG } from "@/lib/topics";

/*
 * What is coming to Cabinet: decisions councils have said they plan to take,
 * soonest first. With no choice made the page shows its figures, which
 * councils are covered, and the next 28 days; everything further off is one
 * click away. Council, topic and decision maker each have their own address.
 */

/** Welsh day names take a small letter inside a sentence: "yw dydd Llun". */
const inSentence = (locale: Locale, s: string) => (locale === "cy" ? s.replace(/^Dydd/, "dydd") : s);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** How many rows a part shows before "Show all". */
const FIRST = 8;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = forwardPlanMessages[locale];
  return pageMetadata({ locale, path: "/forward-plans", title: t.title, description: t.description });
}

export default async function ForwardPlansPage({ searchParams }: PageProps<"/[lang]/forward-plans">) {
  const locale = await getLocale();
  const t = forwardPlanMessages[locale];
  return (
    <div className="container-page">
      <PageHeader title={t.title} lede={t.lede} />
      <Suspense fallback={<ListSkeleton rows={6} label={common[locale].words.loading} />}>
        <Body locale={locale} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

const name = (locale: Locale, id: string) => {
  const c = councilConfig(id);
  return c ? councilShort(locale, c) : id;
};

async function Body({ locale, searchParams }: { locale: Locale; searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const t = forwardPlanMessages[locale];
  const councilRaw = param(sp, "council");
  const council = councilRaw && liveCouncil(councilRaw) ? councilRaw : undefined;
  const topicRaw = param(sp, "topic");
  const topic = topicRaw && TOPIC_BY_SLUG.has(topicRaw) ? topicRaw : undefined;
  const makers = oneOf(sp, "makers", ["all"] as const);
  const filters = { council, topic, makers };
  const [lists, coverage] = await Promise.all([plannedDecisions(), forwardPlanCoverage()]);
  const keep = (d: PlannedDecision) => (!council || d.councilId === council) && (!topic || d.topics.includes(topic)) && (makers === "all" || d.executive);
  const ahead = lists.ahead.filter(keep);
  const soon = ahead.filter((d) => isSoon(d, lists.today));
  const later = ahead.filter((d) => !isSoon(d, lists.today));
  const undated = lists.undated.filter(keep);
  const overdue = lists.overdue.filter(keep);
  const taken = lists.taken.filter(keep);
  const covered = coverage.filter((c) => c.shown);
  const missing = coverage.filter((c) => !c.shown && (!council || c.councilId === council));
  const link = (o: Record<string, string | undefined>) => href(locale, "/forward-plans") + queryString({ ...filters, ...o });
  const rows = (list: PlannedDecision[]) => (
    <ul className="rows">
      {list.map((d) => (
        <PlannedRow key={`${d.councilId}-${d.issueId}`} locale={locale} d={d} showCouncil={!council} filters={filters} />
      ))}
    </ul>
  );
  const fold = (id: string, title: string, list: PlannedDecision[], note?: string) =>
    list.length ? (
      <details id={id} className="border-t border-rule">
        <summary className="cursor-pointer py-4 font-serif text-h4">
          {title} <span className="font-sans text-small text-ink-2 num">({list.length === 1 ? t.countOne : fill(t.count, { n: formatNumber(locale, list.length) })})</span>
        </summary>
        {note ? <p className="mb-2 max-w-[62ch] text-small text-ink-2">{note}</p> : null}
        {rows(list)}
      </details>
    ) : null;

  // A council chosen whose list is not shown: its reason takes the place of the empty lists.
  const chosenMissing = council ? missing.find((c) => c.councilId === council) : undefined;

  // Before any list has been read there is nothing to choose between: say so, and show why each council is missing.
  if (!covered.length)
    return (
      <>
        <p className="max-w-[62ch] pb-8 text-read">{t.leadNone}</p>
        <Missing locale={locale} missing={missing} />
      </>
    );
  return (
    <>
      {!council && !topic && !makers ? <Summary locale={locale} lists={lists} coverage={coverage} /> : null}
      <div className="border-t border-rule pt-6">
        <FilterForm locale={locale} path="/forward-plans" council={council} topic={topic} hidden={{ makers }} />
        <nav aria-label={t.makers.label} className="mt-4 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-small text-ink-2">{t.makers.label}</span>
          <Link href={link({ makers: undefined })} className="chip" aria-current={!makers ? "true" : undefined} scroll={false}>
            {t.makers.executive}
          </Link>
          <Link href={link({ makers: "all" })} className="chip" aria-current={makers ? "true" : undefined} scroll={false}>
            {t.makers.all}
          </Link>
        </nav>
      </div>

      {chosenMissing ? null : (
        <>
          <Section id="soon" title={t.sections.soon} className="mt-6 border-t border-rule">
            {soon.length ? (
              <>
                {rows(soon.slice(0, FIRST))}
                {soon.length > FIRST ? (
                  <details className="border-t border-rule">
                    <summary className="cursor-pointer py-3 text-small">{fill(t.showAll, { n: formatNumber(locale, soon.length) })}</summary>
                    <div className="border-t border-rule">{rows(soon.slice(FIRST))}</div>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="max-w-[62ch] text-ink-2">{ahead.length || undated.length || overdue.length ? t.soonNone : t.none}</p>
            )}
          </Section>
          {fold("later", t.sections.later, later)}
          {fold("undated", t.sections.undated, undated, t.undatedNote)}
          {fold("overdue", t.sections.overdue, overdue, t.overdueNote)}
          {fold("taken", t.sections.taken, taken, t.takenNote)}
        </>
      )}
      <Missing locale={locale} missing={missing} open={Boolean(chosenMissing)} />
      <Foot locale={locale} filters={filters} />
    </>
  );
}

/**
 * The page's figures and its lead, all about decisions for a Cabinet, which is what the page lists first. The lead
 * names the soonest day on which a Cabinet is due to decide and how many decisions each council lists for that day,
 * then says which councils' lists can be read.
 */
function Summary({ locale, lists, coverage }: { locale: Locale; lists: Awaited<ReturnType<typeof plannedDecisions>>; coverage: ForwardPlanCoverage[] }) {
  const t = forwardPlanMessages[locale];
  const covered = coverage.filter((c) => c.shown);
  const ahead = lists.ahead.filter((d) => d.executive);
  const listed = [...ahead, ...lists.undated.filter((d) => d.executive), ...lists.overdue.filter((d) => d.executive)];
  const soon = ahead.filter((d) => isSoon(d, lists.today)).length;
  const read = covered.map((c) => c.readOn).filter((d): d is string => Boolean(d)).sort();
  const names = covered.map((c) => name(locale, c.councilId)).sort((a, b) => a.localeCompare(b, locale));
  const next = ahead.find((d) => !d.monthOnly && d.when);
  const perCouncil = new Map<string, number>();
  for (const d of ahead) if (next && !d.monthOnly && d.when === next.when) perCouncil.set(d.councilId, (perCouncil.get(d.councilId) ?? 0) + 1);
  const parts = [...perCouncil]
    .map(([id, n]) => ({ n, council: name(locale, id) }))
    .sort((a, b) => a.council.localeCompare(b.council, locale))
    // Welsh joins a number to a place with "yn" and a mutation: "12 yn Abertawe", "3 yng Nghonwy".
    .map((x) => fill(t.leadNextPart, { n: formatNumber(locale, x.n), council: x.council, yn: locale === "cy" ? ynPlace(x.council) : "" }));
  return (
    <div className="pb-8">
      <Figures
        items={[
          { value: formatNumber(locale, soon), label: t.figures.soon },
          { value: formatNumber(locale, listed.length), label: t.figures.all },
          { value: fill(t.figures.councilsValue, { n: formatNumber(locale, covered.length), total: formatNumber(locale, coverage.length) }), label: t.figures.councils },
          { value: formatNumber(locale, listed.filter((d) => d.isKey === true).length), label: t.figures.key },
        ]}
      />
      <p className="mt-6 max-w-[62ch] text-read">
        {next ? `${fill(t.leadNext, { date: inSentence(locale, formatDate(locale, next.when, "weekday")), list: formatList(locale, parts) })} ` : ""}
        {fill(covered.length === 1 ? t.leadCoverageOne : t.leadCoverage, {
          councils: formatList(locale, names, { places: true }),
          k: formatNumber(locale, covered.length),
          total: formatNumber(locale, coverage.length),
        })}
      </p>
      {read.length ? (
        <p className="mt-2 text-meta text-ink-2">
          {read[0] === read.at(-1) ? fill(t.readOn, { date: formatDate(locale, read[0]) }) : fill(t.readBetween, { from: formatDate(locale, read[0]), to: formatDate(locale, read.at(-1)) })}
        </p>
      ) : null}
    </div>
  );
}

/** Councils whose planned decisions are not shown, each with the reason and, where there is one, its own forward work programme. */
function Missing({ locale, missing, open = false }: { locale: Locale; missing: ForwardPlanCoverage[]; open?: boolean }) {
  const t = forwardPlanMessages[locale];
  if (!missing.length) return null;
  const sorted = [...missing].sort((a, b) => name(locale, a.councilId).localeCompare(name(locale, b.councilId), locale));
  return (
    <details id="missing" className={open ? "mt-6 border-t border-rule" : "border-t border-rule"} open={open}>
      <summary className="cursor-pointer py-4 font-serif text-h4">
        {t.sections.missing} <span className="font-sans text-small text-ink-2 num">({formatNumber(locale, sorted.length)})</span>
      </summary>
      <p className="mb-2 max-w-[62ch] text-small text-ink-2">{t.missingLede}</p>
      <ul className="rows max-w-[52rem] text-small">
        {sorted.map((c) => {
          const own = FORWARD_PLAN_PAGES[c.councilId];
          return (
            <li key={c.councilId} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
              <span className="font-semibold">
                <Link href={href(locale, `/${c.councilId}`)}>{name(locale, c.councilId)}</Link>
              </span>
              <span>
                {c.gap === "stale" && c.readOn ? fill(t.reasons.stale, { date: formatDate(locale, c.readOn) }) : t.reasons[c.gap === "stale" || !c.gap ? "failed" : c.gap]}
                {c.paper ? (
                  <span className="mt-1 block">
                    {fill(t.paper, { date: formatDate(locale, c.paper.date) })}{" "}
                    <Link href={href(locale, `/${c.councilId}/meetings/${c.paper.meetingId}#item-${c.paper.itemId}`)} lang={locale === "cy" ? "en" : undefined}>
                      {c.paper.title}
                    </Link>
                  </span>
                ) : null}
                {own ? (
                  <span className="mt-1 block">
                    <a href={own} rel="noopener">
                      {t.ownPage}
                    </a>
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** The calendar feed, the download and how the list is put together. */
function Foot({ locale, filters }: { locale: Locale; filters: { council?: string; topic?: string; makers?: string } }) {
  const t = forwardPlanMessages[locale];
  const file = filters.council ? `${filters.council}-planned-decisions` : "planned-decisions";
  const feed = `/feeds/${file}.ics${queryString({ topic: filters.topic, makers: filters.makers, lang: locale === "cy" ? "cy" : undefined })}`;
  const csv = `/api/v1/planned-decisions${queryString({ council: filters.council, topic: filters.topic, executive: filters.makers ? undefined : "1", format: "csv" })}`;
  return (
    <section className="mt-2 border-t border-rule py-8">
      <div className="space-y-3 text-small">
        <div>
          <a href={`${SITE.url.replace(/^https?:/, "webcal:")}${feed}`} className="font-semibold">
            {t.calendar}
          </a>
          <p className="max-w-[62ch] text-meta text-ink-2">{t.calendarNote}</p>
        </div>
        <div>
          <a href={csv} className="font-semibold">
            {t.download}
          </a>
          <p className="max-w-[62ch] text-meta text-ink-2">
            <Rich text={t.downloadNote} links={{ api: href(locale, "/data") }} />
          </p>
        </div>
      </div>
      <details className="mt-5 max-w-[68ch]">
        <summary className="cursor-pointer text-small font-semibold">{t.methodTitle}</summary>
        <div className="mt-3 space-y-3 text-small">
          {t.method.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <p>
            <Rich text={t.problem} values={{ email: SITE.contactEmail }} links={{ email: `mailto:${SITE.contactEmail}` }} />
          </p>
        </div>
      </details>
    </section>
  );
}
