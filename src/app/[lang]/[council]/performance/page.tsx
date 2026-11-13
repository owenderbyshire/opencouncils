import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Section } from "@/components/page-header";
import { periodLabel, showValue } from "@/components/measure-format";
import { BlockSkeleton } from "@/components/skeleton";
import { RangeStrip, TrendLine } from "@/components/charts";
import { performanceMeasures } from "@/data/performance";
import { councilWatchdogs } from "@/data/watchdogs";
import { WatchdogsSection } from "@/components/watchdogs";
import { NOT_COMPARED, THEMES } from "@data/curated/performance";
import { href, type Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { performanceMessages } from "@/i18n/messages/performance";
import { getLocale } from "@/i18n/server";
import { councilName, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { councilFrom } from "@/lib/route";
import type { MeasureValues } from "@/lib/scores";

/*
 * How a council is doing: official measures grouped by theme, each with the
 * figure for Wales and the trend. Nothing is scored or ranked.
 */

type T = (typeof performanceMessages)["en"];
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/performance">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = performanceMessages[locale];
  return pageMetadata({ locale, path: `/${c.id}/performance`, title: fill(t.title, { name: councilName(locale, c) }), description: t.lede });
}

export default async function PerformancePage({ params }: PageProps<"/[lang]/[council]/performance">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Body locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

function MeasureRow({ locale, t, m, councilId, councilShortName }: { locale: Locale; t: T; m: MeasureValues; councilId: string; councilShortName: string }) {
  const value = m.values[councilId];
  if (value === undefined) return null;
  const text = t.measures[m.key];
  if (!text) return null;
  const history = m.history?.[councilId] ?? [];
  const prev = history.length > 1 ? history[history.length - 2] : null;
  const estimated = m.estimated?.includes(councilId) ?? false;
  const diff = prev && !estimated ? value - prev.value : null;
  const rounded = diff === null ? null : Math.round(diff * 10) / 10;
  const diffText =
    prev && rounded !== null
      ? fill(t.change, {
          change:
            rounded === 0
              ? t.same
              : fill(rounded > 0 ? t.up : t.down, {
                  // A change under 1 keeps its decimal, so it never reads "Up 0".
                  // A change in a percentage is in percentage points, and says so.
                  n:
                    m.unit === "money"
                      ? showValue(locale, m.unit, Math.abs(rounded))
                      : m.unit === "percent"
                        ? fill(Math.abs(rounded) === 1 ? t.points.one : t.points.other, { n: formatNumber(locale, Math.abs(rounded), Math.abs(rounded) < 1 ? 1 : 0) })
                        : formatNumber(locale, Math.abs(rounded), Math.abs(rounded) < 1 ? 1 : 0),
                }),
          then: periodLabel(locale, prev.period),
        })
      : null;
  const detail = m.detail?.[councilId];
  // Where the council sits among the 22, and Wales, only for figures that can
  // fairly sit side by side: shares and rates, not sums that grow with a
  // council's size, and never road casualties.
  const comparable = (m.unit === "percent" || m.unit === "share" || m.unit === "rate") && !NOT_COMPARED.has(m.key);
  const all = Object.values(m.values);
  const fmt = (v: number) => showValue(locale, m.unit, v, m.per, m.perOf);
  // Inside the small charts a rate is just its number: the unit is in the headline beside them.
  const short = (v: number) => (m.unit === "rate" ? formatNumber(locale, Math.round(v * 10) / 10) : showValue(locale, m.unit, v));
  const range = comparable && all.length >= 3 ? { n: all.length, min: Math.min(...all), max: Math.max(...all) } : null;
  const wales = comparable ? m.wales : null;
  const trend = history.length > 2 ? history : null;
  return (
    <li className="grid gap-x-10 gap-y-3 py-5 md:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="max-w-[62ch]">
        <h4 className="font-sans text-body font-semibold">{text.name}</h4>
        <p className="mt-1 text-small text-ink-2">{text.note}</p>
        <p className="mt-2 text-meta text-ink-2">
          {m.better ? t.better[m.better] : t.context}
          {m.source ? (
            <>
              {" "}
              <a href={locale === "cy" ? m.source.replace("/en-GB/", "/cy-GB/") : m.source} rel="noopener">
                {t.statsWales}
              </a>
              {m.via === "edau" ? ` ${t.viaEdau}` : null}
            </>
          ) : null}
        </p>
      </div>
      <div>
        <p className="flex items-baseline gap-3">
          <span className="font-serif text-h3 num">{fmt(value)}</span>
          {m.period ? <span className="text-small text-ink-2">{periodLabel(locale, m.period)}</span> : null}
        </p>
        {detail ? <p className="text-small text-ink-2 num">{detail}</p> : null}
        {estimated ? <p className="mt-1 text-small text-ink-2">{t.carriedForward}</p> : null}
        {diffText ? <p className="text-small text-ink-2">{diffText}</p> : null}
        {range ? (
          <div className="mt-3">
            <RangeStrip
              values={all}
              mine={value}
              wales={wales}
              format={short}
              mineLabel={councilShortName}
              walesLabel={t.walesAverage}
              otherLabel={t.otherCouncil}
              summary={fill(wales !== null ? t.rangeSummary : t.rangeSummaryNoWales, {
                name: councilShortName,
                v: fmt(value),
                w: wales !== null ? fmt(wales) : "",
                n: formatNumber(locale, range.n),
                min: fmt(range.min),
                max: fmt(range.max),
              })}
            />
            <p className="mt-1 text-meta text-ink-2">{fill(t.rangeLine, { n: formatNumber(locale, range.n), min: fmt(range.min), max: fmt(range.max) })}</p>
          </div>
        ) : null}
        {trend ? (
          <div className="mt-3">
            <TrendLine
              points={trend}
              wales={comparable ? m.walesHistory : null}
              format={short}
              periodText={(p) => periodLabel(locale, p)}
              mineLabel={councilShortName}
              walesLabel={t.walesAverage}
              summary={fill(t.trendSummary, {
                name: councilShortName,
                first: fmt(trend[0].value),
                from: periodLabel(locale, trend[0].period),
                last: fmt(trend[trend.length - 1].value),
                to: periodLabel(locale, trend[trend.length - 1].period),
              })}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

async function Body({ locale, params }: { locale: Locale; params: Promise<{ council: string }> }) {
  const c = await councilFrom(params);
  const t = performanceMessages[locale];
  const [measures, watchdogs] = await Promise.all([performanceMeasures(), councilWatchdogs(c.id)]);
  const mine = measures.filter((m) => m.values[c.id] !== undefined);
  const name = councilName(locale, c);
  const cy = locale === "cy";
  // Audit Wales and the Ombudsman are explained in "What the watchdogs say" when it shows their records, so they are not listed twice.
  const inspections = (
    [
      ["audit", cy ? "https://www.archwilio.cymru" : "https://www.audit.wales"],
      ["estyn", cy ? "https://www.estyn.llyw.cymru" : "https://www.estyn.gov.wales"],
      ["ciw", cy ? "https://www.arolygiaethgofal.cymru" : "https://www.careinspectorate.wales"],
      ["ombudsman", cy ? "https://www.ombwdsmon.cymru" : "https://www.ombudsman.wales"],
    ] as const
  ).filter(([k]) => !(k === "audit" && watchdogs?.reports.length) && !(k === "ombudsman" && watchdogs?.letters.length));
  const themes = THEMES.filter((th) => mine.some((m) => m.theme === th));

  return (
    <>
      <PageHeader title={fill(t.title, { name })} lede={t.lede} />
      {!themes.length ? (
        <p className="border-t border-rule pt-6 text-ink-2">{t.waiting}</p>
      ) : (
        <Section id="themes" title={t.figuresTitle} className="border-t border-rule">
          <p className="-mt-1 mb-4 max-w-[62ch] text-small text-ink-2">
            {t.figuresLede}{" "}
            <Link href={href(locale, "/performance")}>{t.allCouncilsLink}</Link>
          </p>
          {themes.map((th) => (
            <div key={th} id={`theme-${th}`} className="mt-6">
              <h3 className="font-serif text-h4">{t.themes[th as keyof typeof t.themes] ?? th}</h3>
              <ul className="rows">
                {mine
                  .filter((m) => m.theme === th)
                  .map((m) => (
                    <MeasureRow key={m.key} locale={locale} t={t} m={m} councilId={c.id} councilShortName={councilShort(locale, c)} />
                  ))}
              </ul>
            </div>
          ))}
        </Section>
      )}
      <WatchdogsSection locale={locale} council={c} />
      <Section id="inspections" title={watchdogs ? t.inspectorsTitle : t.inspectionsTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.inspectionsLede}</p>
        <ul className="rows mt-4 max-w-[48rem]">
          {inspections.map(([k, url]) => (
            <li key={k} className="grid gap-x-6 py-3 sm:grid-cols-[16rem_1fr]">
              <a href={url} rel="noopener" className="font-semibold">
                {t.inspections[k].name}
              </a>
              <span className="text-small text-ink-2">{t.inspections[k].note}</span>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="sources" title={t.sourcesTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-small text-ink-2">{t.sources}</p>
      </Section>
    </>
  );
}
