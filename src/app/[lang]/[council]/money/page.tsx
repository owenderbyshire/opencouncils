import { CouncilMoney } from "@/components/council-papers";
import type { Metadata } from "next";
import { committeeName } from "@/lib/committees";
import { Suspense } from "react";
import { CompareBars, LineChart, SplitBar } from "@/components/charts";
import { BandDRange } from "@/components/band-d-range";
import { PageHeader, Section } from "@/components/page-header";
import { BlockSkeleton } from "@/components/skeleton";
import { budgetPapers } from "@/data/council";
import { DATASETS, getCouncilData, type AreaFigures, type BandDYear } from "@/data/council-data";
import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { common } from "@/i18n/messages/common";
import { moneyMessages } from "@/i18n/messages/money";
import { Rich } from "@/i18n/rich";
import { getLocale } from "@/i18n/server";
import { councilName, councilShort, liveCouncil } from "@/lib/councils";
import { pageMetadata } from "@/lib/metadata";
import { ynPlace } from "@/i18n/welsh";
import { councilFrom } from "@/lib/route";

/*
 * Council tax and the council's budget by service, from StatsWales via
 * pipeline/jobs/council-data.ts. Every figure is published; the page works
 * out only changes and shares.
 */

type Params = Promise<{ council: string }>;
type T = (typeof moneyMessages)["en"];

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
/** StatsWales datasets: central government support for councils, and revenue outturn (pipeline/jobs/council-data.ts). */
const SUPPORT_DATASET = "e3aa4de2-5084-4f57-afeb-f21d17fa9bd5";
const OUTTURN_DATASET = "213aeb99-18eb-42c9-b00e-e4b716e82cdf";
const statsWales = (locale: Locale, id: string) => `https://stats.gov.wales/${locale === "cy" ? "cy-GB" : "en-GB"}/${id}`;

export async function generateMetadata({ params }: PageProps<"/[lang]/[council]/money">): Promise<Metadata> {
  const locale = await getLocale();
  const c = liveCouncil((await params).council);
  if (!c) return { title: common[locale].notFound.title };
  const t = moneyMessages[locale];
  return pageMetadata({
    locale,
    path: `/${c.id}/money`,
    title: fill(t.title, { name: councilName(locale, c) }),
    description: t.lede,
  });
}

export default async function MoneyPage({ params }: PageProps<"/[lang]/[council]/money">) {
  const locale = await getLocale();
  return (
    <div className="container-page">
      <Suspense fallback={<BlockSkeleton lines={12} label={common[locale].words.loading} />}>
        <Money locale={locale} params={params} />
      </Suspense>
    </div>
  );
}

async function Money({ locale, params }: { locale: Locale; params: Params }) {
  const c = await councilFrom(params);
  const t = moneyMessages[locale];
  const data = await getCouncilData();
  const mine = data?.councils[c.id];
  const name = councilName(locale, c);
  const area = councilShort(locale, c);
  const ready = mine && (mine.bandD.length || mine.spend);
  return (
    <>
      <PageHeader title={fill(t.title, { name })} lede={t.lede} />
      <CouncilMoney locale={locale} councilId={c.id} />
      {!ready || !data ? (
        <p className="border-t border-rule pt-6 text-ink-2">{t.waiting}</p>
      ) : (
        <>
          {mine.bandD.length ? <Tax locale={locale} t={t} area={area} mine={mine} wales={data.wales} councilId={c.id} /> : null}
          {mine.spend ? <Spend locale={locale} t={t} mine={mine} wales={data.wales} /> : null}
          {mine.support?.length ? <Support locale={locale} t={t} area={area} mine={mine} wales={data.wales} /> : null}
          {mine.outturn?.length ? <Outturn locale={locale} t={t} mine={mine} /> : null}
          <Papers locale={locale} t={t} councilId={c.id} />
          <Section id="sources" title={t.sourcesTitle} className="border-t border-rule">
            <p className="max-w-[62ch] text-small text-ink-2">{t.sources}</p>
            {data.meta?.via === "edau" ? <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.viaEdau}</p> : null}
            <ul className="mt-3 space-y-1 text-small">
              <li>
                <a href={statsWales(locale, DATASETS.bandD)} rel="noopener">
                  {t.sourceLinks.bandD}
                </a>
              </li>
              <li>
                <a href={statsWales(locale, DATASETS.budget)} rel="noopener">
                  {t.sourceLinks.budget}
                </a>
              </li>
              <li>
                <a href={statsWales(locale, SUPPORT_DATASET)} rel="noopener">
                  {t.sourceLinks.support}
                </a>
              </li>
              <li>
                <a href={statsWales(locale, OUTTURN_DATASET)} rel="noopener">
                  {t.sourceLinks.outturn}
                </a>
              </li>
            </ul>
            {data.meta?.updatedAt ? (
              <p className="mt-3 text-meta text-ink-2">{fill(t.updated, { date: formatDate(locale, data.meta.updatedAt.slice(0, 10)) })}</p>
            ) : null}
          </Section>
        </>
      )}
    </>
  );
}

const money0 = (locale: Locale) => (n: number) => formatMoney(locale, n, 0);

function Tax({ locale, t, area, mine, wales, councilId }: { locale: Locale; t: T; area: string; mine: AreaFigures; wales: AreaFigures; councilId: string }) {
  const list = mine.bandD;
  const now = list[list.length - 1];
  const prev = list[list.length - 2];
  const tenAgo = list.length > 10 ? list[list.length - 11] : null;
  const walesNow = wales.bandD.find((y) => y.year === now.year);
  const money = money0(locale);
  const change = prev?.total && now.total ? (now.total - prev.total) / prev.total : null;
  const sentences = [
    fill(t.taxHeadline, { inArea: locale === "cy" ? ynPlace(area) : `in ${area}`, total: money(now.total!), year: now.year }),
    change !== null
      ? fill(t.taxChange, {
          change: fill(change >= 0 ? t.taxChangeUp : t.taxChangeDown, { pct: formatPercent(locale, Math.abs(change), 1) }),
        })
      : "",
    tenAgo?.total ? fill(t.taxLongRun, { year: tenAgo.year, then: money(tenAgo.total) }) : "",
    walesNow?.total ? fill(t.taxWales, { wales: money(walesNow.total) }) : "",
  ].filter(Boolean);

  const parts = [
    { key: "county", label: t.parts.county, value: now.county ?? 0 },
    { key: "police", label: t.parts.police, value: now.police ?? 0 },
    { key: "community", label: t.parts.community, value: now.community ?? 0 },
  ].filter((p) => p.value > 0);

  // From 1996-97, when today's councils began.
  const since = list.filter((y) => y.year >= "1996-97");
  const series = [
    { label: area, tone: "accent" as const, values: since.map((y) => ({ x: y.year, y: y.total! })) },
    {
      label: t.walesAverage,
      tone: "muted" as const,
      values: wales.bandD.filter((y) => y.year >= since[0]?.year && y.total !== null).map((y) => ({ x: y.year, y: y.total! })),
    },
  ];
  return (
    <>
      <Section id="tax" title={t.taxTitle} className="border-t border-rule">
        <p className="max-w-[62ch] text-read">
          <Rich text={sentences.join(" ")} />
        </p>
        <p className="mt-3 max-w-[62ch] text-small text-ink-2">
          <Rich text={t.bandDNote} links={{ bandd: href(locale, "/guide#term-band-d") }} />
        </p>
        <div className="mt-6 max-w-[24rem]">
          <BandDRange locale={locale} councilId={councilId} />
        </div>
        {parts.length > 1 ? (
          <div className="mt-8 max-w-[48rem]">
            <h3 className="text-h4">{t.splitTitle}</h3>
            <p className="mt-1 mb-4 max-w-[62ch] text-small text-ink-2">{t.splitLede}</p>
            <SplitBar parts={parts.map((p) => ({ ...p, text: formatMoney(locale, p.value, 0) }))} />
          </div>
        ) : null}
      </Section>
      {since.length > 2 ? (
        <Section id="history" title={fill(t.historyTitle, { year: since[0].year })} className="border-t border-rule">
          <div className="max-w-[48rem]">
            <LineChart series={series} format={money} labelEvery={locale === "cy" ? 6 : 5} />
          </div>
          <p className="mt-2 text-meta text-ink-2">{t.historyNote}</p>
          <History locale={locale} t={t} list={since} wales={wales.bandD} />
        </Section>
      ) : null}
    </>
  );
}

function History({ locale, t, list, wales }: { locale: Locale; t: T; list: BandDYear[]; wales: BandDYear[] }) {
  const w = new Map(wales.map((y) => [y.year, y.total]));
  return (
    <details className="mt-4 text-small">
      <summary className="cursor-pointer">{t.tableShow}</summary>
      <table className="data-table mt-3 max-w-[32rem]">
        <thead>
          <tr>
            <th scope="col">{t.year}</th>
            <th scope="col" className="text-right">
              {t.total}
            </th>
            <th scope="col" className="text-right">
              {t.walesAverage}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...list].reverse().map((y) => (
            <tr key={y.year}>
              <td>{y.year}</td>
              <td className="text-right num">{formatMoney(locale, y.total, 2)}</td>
              <td className="text-right num">{w.get(y.year) != null ? formatMoney(locale, w.get(y.year)!, 2) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

function Spend({ locale, t, mine, wales }: { locale: Locale; t: T; mine: AreaFigures; wales: AreaFigures }) {
  const s = mine.spend!;
  const w = new Map((wales.spend?.year === s.year ? wales.spend.groups : []).map((g) => [g.key, g.perHead]));
  // "Law and order" is mostly the levy to the fire and rescue authority, which these figures leave out: no row for it.
  const rows = s.groups
    .filter((g) => g.perHead !== null && g.key !== "law")
    .map((g) => ({ key: g.key, label: t.groups[g.key].name, note: t.groups[g.key].note, value: g.perHead, compare: w.get(g.key) ?? null }))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  // The published total of every service; the groups don't quite add up to it, because of small items listed apart.
  const total = s.total?.perHead ?? null;
  const top = rows.find((r) => (r.value ?? 0) > 0);
  const money = money0(locale);
  return (
    <Section id="spending" title={t.spendTitle} className="border-t border-rule">
      <p className="max-w-[62ch] text-small text-ink-2">{fill(t.spendLede, { year: s.year })}</p>
      {top && total && total > 0 ? (
        <p className="mt-4 max-w-[62ch] text-read">
          <Rich
            text={fill(t.spendHeadline, {
              total: money(total),
              year: s.year,
              top: top.label,
              amount: money(top.value!),
              share: formatPercent(locale, top.value! / total),
            })}
          />
        </p>
      ) : null}
      <div className="mt-6 max-w-[56rem]">
        <CompareBars rows={rows} format={money} compareLabel={t.walesAverage} />
      </div>
      <p className="mt-6 max-w-[62ch] text-small text-ink-2">{t.funding}</p>
      <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.perPersonBasis}</p>
    </Section>
  );
}

function Outturn({ locale, t, mine }: { locale: Locale; t: T; mine: AreaFigures }) {
  const years = (mine.outturn ?? []).slice(-6).filter((y) => y.total?.perHead != null);
  if (!years.length) return null;
  const cell = (v: number | null | undefined) => (v == null ? "–" : formatMoney(locale, v, 0));
  return (
    <Section id="outturn" title={t.historyTitle2} className="border-t border-rule">
      <p className="max-w-[62ch] text-small text-ink-2">{t.historyLede}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="data-table min-w-[32rem]">
          <thead>
            <tr>
              <th scope="col">{t.service}</th>
              {years.map((y) => (
                <th key={y.year} scope="col" className="text-right">
                  {y.year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="text-left font-semibold">
                {t.allServices}
              </th>
              {years.map((y) => (
                <td key={y.year} className="text-right font-semibold num">
                  {cell(y.total?.perHead)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Section>
  );
}

async function Papers({ locale, t, councilId }: { locale: Locale; t: T; councilId: string }) {
  const papers = await budgetPapers(councilId);
  return (
    <Section id="papers" title={t.papersTitle} className="border-t border-rule">
      <p className="max-w-[62ch] text-small text-ink-2">{t.papersLede}</p>
      {papers.length ? (
        <ul className="rows mt-4 max-w-[56rem]">
          {papers.map((p) => {
            const committee = committeeName(locale, p.committeeEn, p.committeeCy);
            return (
              <li key={p.itemId} className="grid gap-x-6 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <span className="text-small text-ink-2">{formatDate(locale, p.date)}</span>
                <span>
                  <Link href={href(locale, `/${councilId}/meetings/${p.meetingId}#item-${p.itemId}`)} lang={locale === "cy" ? "en" : undefined}>
                    {p.title}
                  </Link>
                  <span className="block text-small text-ink-2">
                    <span lang={committee.lang}>{committee.text}</span>
                    {p.documents ? `, ${t.papersDocs.replace("{n}", formatNumber(locale, p.documents))}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-ink-2">{t.papersNone}</p>
      )}
    </Section>
  );
}

function bigMoney(locale: Locale, t: T, thousands: number): string {
  const pounds = thousands * 1000;
  if (pounds >= 1e9) return t.billion.replace("{n}", formatNumber(locale, Math.round(pounds / 1e8) / 10, 1));
  const m = pounds / 1e6;
  // Whole millions from £100 million up; one decimal below that.
  return t.million.replace("{n}", m >= 100 ? formatNumber(locale, Math.round(m)) : formatNumber(locale, Math.round(m * 10) / 10, 1));
}

/**
 * The Welsh Government's published like-for-like change in its support for
 * councils (the final local government settlement), by year. Raw totals
 * aren't comparable year to year, because services move in and out.
 */
const SETTLEMENTS: Record<string, { pct: number; floor: number; source: string }> = {
  "2026-27": { pct: 4.5, floor: 4.0, source: "https://www.gov.wales/node/73907" },
};

/** The council's support, with its parts only when they add up to the total. */
function supportSentence(locale: Locale, t: T, now: NonNullable<AreaFigures["support"]>[number]): string {
  const base = {
    year: now.year,
    total: bigMoney(locale, t, now.total.thousands!),
    perHead: formatMoney(locale, now.total.perHead!, 0),
  };
  if (now.rsg === null || now.ndr === null) return fill(t.supportTotalOnly, base);
  const other = now.total.thousands! - now.rsg - now.ndr;
  const parts = { ...base, rsg: bigMoney(locale, t, now.rsg), ndr: bigMoney(locale, t, now.ndr) };
  // Within £0.5 million: the two parts make up the total.
  if (Math.abs(other) < 500) return fill(t.supportLine, parts);
  if (other > 0) return fill(t.supportLineOther, { ...parts, other: bigMoney(locale, t, other) });
  return fill(t.supportTotalOnly, base);
}

function Support({ locale, t, area, mine, wales }: { locale: Locale; t: T; area: string; mine: AreaFigures; wales: AreaFigures }) {
  const list = mine.support!;
  const now = list[list.length - 1];
  const w = wales.support ?? [];
  const wNow = w.find((y) => y.year === now.year);
  // The Welsh Government's own like-for-like change, where we hold it for this year.
  const settlement = wNow ? SETTLEMENTS[wNow.year] : undefined;
  const money = (n: number) => formatMoney(locale, n, 0);
  const since = list.slice(-10);
  return (
    <Section id="support" title={t.supportTitle} className="border-t border-rule">
      {now.total.thousands !== null && now.total.perHead !== null ? (
        <p className="max-w-[62ch] text-read">
          <Rich text={supportSentence(locale, t, now)} />
        </p>
      ) : null}
      {wNow?.total.thousands ? (
        <p className="mt-2 max-w-[62ch]">
          <Rich text={fill(t.supportWales, { total: bigMoney(locale, t, wNow.total.thousands), year: wNow.year })} />
          {settlement ? (
            <>
              {" "}
              {fill(t.supportSettlement, { pct: formatPercent(locale, settlement.pct / 100, 1), floor: formatPercent(locale, settlement.floor / 100, 1) })}{" "}
              <a href={settlement.source} rel="noopener">
                {t.supportSettlementLink}
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {since.length > 2 ? (
        <div className="mt-6 max-w-[48rem]">
          <h3 className="text-h4">{fill(t.supportChart, { year: since[0].year })}</h3>
          <div className="mt-2">
            <LineChart
              series={[
                { label: area, tone: "accent", values: since.filter((y) => y.total.perHead !== null).map((y) => ({ x: y.year, y: y.total.perHead! })) },
                {
                  label: t.walesAverage,
                  tone: "muted",
                  values: w.filter((y) => y.year >= since[0].year && y.total.perHead !== null).map((y) => ({ x: y.year, y: y.total.perHead! })),
                },
              ]}
              format={money}
              labelEvery={3}
            />
          </div>
        </div>
      ) : null}
      <p className="mt-3 max-w-[62ch] text-small text-ink-2">
        <Rich text={t.supportNote} links={{ os: locale === "cy" ? "https://opensenedd.com/cy" : "https://opensenedd.com" }} />
      </p>
    </Section>
  );
}
