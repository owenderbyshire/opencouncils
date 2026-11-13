import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ISSUES, issueBySlug, type IssueDef, type LevyPosition } from "@data/curated/compare-decisions";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { heldItems, type HeldItem } from "@/data/compare-decisions";
import { DATASETS, getCouncilData } from "@/data/council-data";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { compareDecisionMessages } from "@/i18n/messages/compare-decisions";
import { getLocale } from "@/i18n/server";
import { councilConfig, councilShort, COUNCILS } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { meetingUrl } from "@/lib/official-urls";
import { param, type SearchParams } from "@/lib/params";
import { SITE } from "@/lib/site";
import { taxFigures, levyCounts, rowState, type RowState } from "@/lib/compare-decisions";

/*
 * One decision across the 22 councils: a table a reader takes in at a glance
 * (council, the figure, what the minutes say, when, the source), sortable by
 * column, with the first ten rows shown and the rest one click away.
 */

export function generateStaticParams() {
  return ISSUES.map((i) => ({ issue: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/compare/[issue]">): Promise<Metadata> {
  const locale = await getLocale();
  const issue = issueBySlug((await params).issue);
  if (!issue) return { title: common[locale].notFound.title };
  const t = compareDecisionMessages[locale].issues[issue.slug];
  return pageMetadata({ locale, path: `/compare/${issue.slug}`, title: t.title, description: t.lede });
}

export default async function IssuePage({ params, searchParams }: PageProps<"/[lang]/compare/[issue]">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={14} label={common[locale].words.loading} />}>
        <Issue locale={locale} params={params} searchParams={searchParams as Promise<SearchParams>} />
      </Suspense>
    </div>
  );
}

const SORTS = ["council", "figure", "change", "position", "date"] as const;
type Sort = (typeof SORTS)[number];
const POSITION_ORDER: LevyPosition[] = ["adopted", "consulting", "deferred", "not-now"];

interface Row {
  id: string;
  name: string;
  figure: number | null;
  change: number | null;
  position: LevyPosition | null;
  item: HeldItem | null;
  state: RowState;
  later: IssueDef["cells"][number]["later"];
}

async function Issue({ locale, params, searchParams }: { locale: Locale; params: Promise<{ issue: string }>; searchParams: Promise<SearchParams> }) {
  const issue = issueBySlug((await params).issue);
  if (!issue) notFound();
  const m = compareDecisionMessages[locale];
  const t = m.issues[issue.slug];
  const tt = m.issues["council-tax-2026-27"];
  const sp = await searchParams;
  const rawSort = param(sp, "sort");
  const isTax = issue.slug === "council-tax-2026-27";
  // The levy table leads with the councils that have decided something.
  const defaultSort: Sort = isTax ? "council" : "position";
  const sort: Sort = SORTS.includes(rawSort as Sort) ? (rawSort as Sort) : defaultSort;
  const all = param(sp, "all") === "1";

  const [held, money] = await Promise.all([heldItems(issue), isTax ? getCouncilData() : Promise.resolve(null)]);
  const byKey = new Map(held.map((h) => [`${h.councilId}:${h.agendaItemId}`, h]));
  const tax = isTax ? taxFigures(money, "2026-27") : null;

  const rows: Row[] = issue.cells.map((cell) => {
    const c = councilConfig(cell.council);
    const item = cell.agendaItemId ? (byKey.get(`${cell.council}:${cell.agendaItemId}`) ?? null) : null;
    const f = tax?.councils[cell.council];
    return {
      id: cell.council,
      name: c ? councilShort(locale, c) : cell.council,
      figure: f?.now ?? null,
      change: f?.change ?? null,
      position: cell.position ?? null,
      item,
      state: rowState(cell, item),
      later: cell.later,
    };
  });

  const collator = new Intl.Collator(locale === "cy" ? "cy" : "en");
  const byName = (a: Row, b: Row) => collator.compare(a.name, b.name);
  const numeric = (k: "figure" | "change") => (a: Row, b: Row) =>
    (a[k] == null ? 1 : 0) - (b[k] == null ? 1 : 0) || (b[k] ?? 0) - (a[k] ?? 0) || byName(a, b);
  const sorters: Record<Sort, (a: Row, b: Row) => number> = {
    council: byName,
    figure: numeric("figure"),
    change: numeric("change"),
    position: (a, b) =>
      (a.position ? POSITION_ORDER.indexOf(a.position) : 99) - (b.position ? POSITION_ORDER.indexOf(b.position) : 99) || byName(a, b),
    date: (a, b) => (b.item?.date ?? "").localeCompare(a.item?.date ?? "") || byName(a, b),
  };
  rows.sort(sorters[sort]);
  const shown = all ? rows : rows.slice(0, 10);

  const base = href(locale, `/compare/${issue.slug}`);
  const link = (s: Sort, everything = all) => {
    const q = new URLSearchParams();
    if (s !== defaultSort) q.set("sort", s);
    if (everything) q.set("all", "1");
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const cols: Array<{ key: Sort; label: string; numeric?: boolean }> = isTax
    ? [
        { key: "figure", label: tt.figureCol, numeric: true },
        { key: "change", label: tt.changeCol, numeric: true },
      ]
    : [{ key: "position", label: m.issues["visitor-levy"].positionCol }];

  return (
    <>
      <p className="mt-6 text-small">
        <Link href={href(locale, "/compare")}>{m.back}</Link>
      </p>
      <PageHeader title={t.title} lede={t.lede} />

      {isTax && tax ? <TaxHeadline locale={locale} tax={tax} /> : null}
      {!isTax ? <LevyHeadline locale={locale} issue={issue} /> : null}

      <Section className="border-t border-rule">
        {/* On phones the table stacks and its headings are hidden, so the sorts are offered as chips. */}
        <p className="mb-3 flex flex-wrap items-center gap-2 text-small sm:hidden">
          <span className="text-ink-2">{m.sortLabel}</span>
          {[{ key: "council" as Sort, label: m.council }, ...cols, { key: "date" as Sort, label: m.when }].map((c) => (
            <Link key={c.key} href={link(c.key)} className="chip" aria-current={sort === c.key ? "true" : undefined}>
              {c.label}
            </Link>
          ))}
        </p>
        <div className="overflow-x-auto">
          <table className="data-table data-table-stack">
            <thead>
              <tr>
                <th scope="col" aria-sort={sort === "council" ? "ascending" : undefined}>
                  <Link href={link("council")} className={sort === "council" ? "font-semibold" : ""}>
                    {m.council}
                  </Link>
                </th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className={c.numeric ? "sm:text-right" : ""} aria-sort={sort === c.key ? "descending" : undefined}>
                    <Link href={link(c.key)} className={sort === c.key ? "font-semibold" : ""}>
                      {c.label}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="min-w-[18rem]">
                  {m.decided}
                </th>
                <th scope="col" aria-sort={sort === "date" ? "descending" : undefined}>
                  <Link href={link("date")} className={sort === "date" ? "font-semibold" : ""}>
                    {m.when}
                  </Link>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="font-semibold sm:font-normal">
                    <Link href={href(locale, `/${r.id}`)}>{r.name}</Link>
                  </th>
                  {isTax ? (
                    <>
                      <td data-label={tt.figureCol} className="num sm:text-right">
                        {r.figure == null ? <span className="text-ink-3">–</span> : formatMoney(locale, r.figure)}
                      </td>
                      <td data-label={tt.changeCol} className="num sm:text-right">
                        {r.change == null ? <span className="text-ink-3">–</span> : formatPercent(locale, r.change, 2)}
                      </td>
                    </>
                  ) : (
                    <td data-label={m.issues["visitor-levy"].positionCol}>
                      {r.position ? m.issues["visitor-levy"].positions[r.position] : <span className="text-ink-3">–</span>}
                    </td>
                  )}
                  <td data-label={m.decided}>
                    <Decision locale={locale} row={r} />
                  </td>
                  <td data-label={m.when} className="whitespace-nowrap">
                    {r.item ? formatDate(locale, r.item.date, "short") : <span className="text-ink-3">–</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-small">
          <Link href={link(sort, !all)}>{all ? m.showFewer : m.showAll}</Link>
          <a href={`/api/v1/compare/${issue.slug}?format=csv`}>{m.download}</a>
          <a href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`${t.short}: ${m.reportProblem}`)}`}>{m.reportProblem}</a>
        </p>
      </Section>

      <Section id="notes" title={m.figuresTitle} className="border-t border-rule">
        <div className="max-w-[62ch] space-y-3 text-small text-ink-2">
          <p>{t.figureNote}</p>
          {isTax ? (
            <p>
              <a href={`https://stats.gov.wales/${locale === "cy" ? "cy-GB" : "en-GB"}/${DATASETS.bandD}`} rel="noopener">
                {tt.sourceLink}
              </a>
            </p>
          ) : null}
          <p>{m.aiLabel}</p>
          <p>{m.checkedOn.replace("{date}", formatDate(locale, issue.checked))}</p>
        </div>
      </Section>
    </>
  );
}

function Decision({ locale, row }: { locale: Locale; row: Row }) {
  const m = compareDecisionMessages[locale];
  const c = councilConfig(row.id);
  const item = row.item;
  if (!item) return <p className="text-ink-2">{m.notHeld}</p>;
  const official = item.sourceUrl ?? (c ? meetingUrl(c, item.meetingId, locale) : null);
  const summary = locale === "cy" ? (item.summaryCy ?? item.summaryEn) : item.summaryEn;
  const links = (
    <span className="mt-1 flex flex-wrap gap-x-4 text-meta">
      <Link href={href(locale, `/${row.id}/meetings/${item.meetingId}`)}>{m.meetingLink}</Link>
      {official ? (
        <a href={official} rel="noopener">
          {m.sourceLink}
        </a>
      ) : null}
    </span>
  );
  return (
    <div className="max-w-[48ch]">
      {row.state === "summary" ? (
        <Summary text={summary ?? ""} lang={locale === "cy" && !item.summaryCy ? "en" : undefined} more={m.moreSummary} />
      ) : (
        <>
          <p className="font-medium" lang={locale === "cy" ? "en" : undefined}>
            {item.title}
          </p>
          <p className="text-small text-ink-2">{row.state === "recorded" ? m.noSummary : m.notRecorded}</p>
        </>
      )}
      {links}
      {row.later ? (
        <p className="mt-1 text-meta text-ink-2">
          {m.later.replace("{date}", formatDate(locale, row.later.date))}{" "}
          <Link href={href(locale, `/${row.id}/meetings/${row.later.meetingId}`)}>{m.laterLink}</Link>
        </p>
      ) : null}
    </div>
  );
}

/** Sentence ends: a full stop, question or exclamation mark, then a space and a capital or a quote. */
const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z\u00C0-\u017F"'\u2018\u201C])/u;

/** The first two sentences of a summary, with the rest one click away. Nothing is cut, only folded. */
function Summary({ text, lang, more }: { text: string; lang?: string; more: string }) {
  const parts = text.split(SENTENCE_END);
  if (parts.length <= 2) return <p lang={lang}>{text}</p>;
  return (
    <div lang={lang}>
      <p>{parts.slice(0, 2).join(" ")}</p>
      <details className="mt-1">
        <summary className="cursor-pointer text-small text-ink-2">{more}</summary>
        <p className="mt-1">{parts.slice(2).join(" ")}</p>
      </details>
    </div>
  );
}

function Figures({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid max-w-[48rem] grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([value, label]) => (
        <div key={label} className="flex flex-col-reverse justify-end border-t-2 border-accent pt-2">
          <dt className="text-small text-ink-2">{label}</dt>
          <dd className="font-serif text-h3 num">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TaxHeadline({ locale, tax }: { locale: Locale; tax: NonNullable<ReturnType<typeof taxFigures>> }) {
  const t = compareDecisionMessages[locale].issues["council-tax-2026-27"];
  const names = (ids: string[]) =>
    formatList(
      locale,
      ids.map((id) => {
        const c = COUNCILS.find((x) => x.id === id);
        return c ? councilShort(locale, c) : id;
      }),
      { places: true },
    );
  const pct = (n: number) => formatPercent(locale, n, 2);
  return (
    <div className="mb-2 grid gap-6">
      <Figures
        items={[
          [formatNumber(locale, tax.count), t.stats.councils],
          [tax.wales == null ? "–" : formatMoney(locale, tax.wales), t.stats.wales],
          [tax.low ? pct(tax.low.value) : "–", t.stats.low],
          [tax.high ? pct(tax.high.value) : "–", t.stats.high],
        ]}
      />
      {tax.low && tax.high && tax.wales != null ? (
        <p className="max-w-[62ch] text-read">
          {t.lead
            .replace("{low}", pct(tax.low.value))
            .replace("{lowNames}", names(tax.low.ids))
            .replace("{high}", pct(tax.high.value))
            .replace("{highNames}", names(tax.high.ids))
            .replace("{wales}", formatMoney(locale, tax.wales))}
        </p>
      ) : null}
    </div>
  );
}

function LevyHeadline({ locale, issue }: { locale: Locale; issue: IssueDef }) {
  const t = compareDecisionMessages[locale].issues["visitor-levy"];
  const n = levyCounts(issue);
  const names = (ids: string[]) =>
    formatList(
      locale,
      ids.map((id) => {
        const c = COUNCILS.find((x) => x.id === id);
        return c ? councilShort(locale, c) : id;
      }),
      { places: true },
    );
  const sentences = POSITION_ORDER.filter((p) => n[p].length)
    .map((p) => t.sentences[p].replace("{list}", names(n[p])))
    .join(" ");
  return (
    <div className="mb-2 grid gap-6">
      <Figures
        items={[
          [formatNumber(locale, n.adopted.length), t.stats.adopted],
          [formatNumber(locale, n.consulting.length), t.stats.consulting],
          [formatNumber(locale, n.deferred.length + n["not-now"].length), t.stats.deferred],
          [formatNumber(locale, n.none), t.stats.none],
        ]}
      />
      <p className="max-w-[62ch] text-read">
        {t.lead.replace("{sentences}", sentences).replace("{none}", formatNumber(locale, n.none))}
      </p>
    </div>
  );
}
