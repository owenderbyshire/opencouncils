import Link from "next/link";
import { Section } from "@/components/page-header";
import { councilPapers, type CouncilPaperRow } from "@/data/papers";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatMoney, formatNumber, formatPercent } from "@/i18n/format";
import { papersMessages } from "@/i18n/messages/papers";
import type { Cite, MoneyContent, MoneyFact, RisksContent } from "@/lib/council-papers";
import { RISK_THEMES, themeName } from "@/lib/risk-themes";

/*
 * The budget, how the year is going, and the risk register, from a council's
 * own papers (pipeline/jobs/council-papers.ts). Every sentence links to the
 * page of the paper its figures are on. Nothing shows for a part not yet read.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** "£421.9 million" in running text; exact pounds below a million. */
function amount(locale: Locale, n: number): string {
  if (Math.abs(n) < 1_000_000) return formatMoney(locale, n, 0);
  const v = new Intl.NumberFormat(locale === "cy" ? "cy-GB" : "en-GB", { maximumFractionDigits: 1 }).format(n / 1_000_000);
  return fill(papersMessages[locale].million, { n: v });
}

/** "2026-27" as councils and readers write it: "2026-27". */
const fy = (y: string | null) => y ?? "";

function SourceLink({ locale, row, cite }: { locale: Locale; row: CouncilPaperRow<unknown>; cite: Cite }) {
  const doc = row.documents[cite.doc];
  if (!doc) return null;
  return (
    <a href={`${doc.url}#page=${cite.page}`} rel="noopener" className="ml-1 whitespace-nowrap text-meta text-ink-2" title={doc.title}>
      ({fill(papersMessages[locale].page, { n: formatNumber(locale, cite.page) })})
    </a>
  );
}

function Sentence({ locale, row, text, cites }: { locale: Locale; row: CouncilPaperRow<unknown>; text: string; cites: Cite[] }) {
  // One link per page cited, in order.
  const seen = new Set<string>();
  const unique = cites.filter((c) => {
    const k = `${c.doc}:${c.page}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <>
      {text}
      {unique.map((c) => (
        <SourceLink key={`${c.doc}:${c.page}`} locale={locale} row={row} cite={c} />
      ))}{" "}
    </>
  );
}

function PaperLinks({ locale, councilId, row }: { locale: Locale; councilId: string; row: CouncilPaperRow<unknown> }) {
  const t = papersMessages[locale];
  return (
    <p className="mt-3 text-small text-ink-2">
      <Link href={href(locale, `/${councilId}/meetings/${row.meetingId}${row.itemId ? `#item-${row.itemId}` : ""}`)}>{t.meeting}</Link>
      {row.documents[0] ? (
        <>
          {"  "}
          <a href={row.documents[0].url} rel="noopener" lang="en">
            {t.paper}
          </a>
        </>
      ) : null}
    </p>
  );
}

function Budget({ locale, councilId, row }: { locale: Locale; councilId: string; row: CouncilPaperRow<MoneyContent> }) {
  const t = papersMessages[locale].budget;
  const f = (k: MoneyFact["key"]) => row.content.facts.find((x) => x.key === k);
  const net = f("net_budget");
  const rise = f("council_tax_rise");
  const bandD = f("band_d");
  const savings = f("savings");
  const reserves = f("reserves_used");
  const gaps = row.content.facts.filter((x) => x.key === "gap_future" && x.year).sort((a, b) => a.year!.localeCompare(b.year!));
  const year = fy(row.content.year ?? net?.year ?? null);
  const parts: Array<{ text: string; cites: Cite[] }> = [];
  if (net && year) parts.push({ text: fill(t.net, { year, amount: amount(locale, net.value) }), cites: [net] });
  if (rise && bandD) parts.push({ text: fill(t.taxBoth, { pct: formatPercent(locale, rise.value / 100, 2), bandD: formatMoney(locale, bandD.value) }), cites: [rise, bandD] });
  else if (rise) parts.push({ text: fill(t.taxRise, { pct: formatPercent(locale, rise.value / 100, 2) }), cites: [rise] });
  else if (bandD) parts.push({ text: fill(t.taxBandD, { bandD: formatMoney(locale, bandD.value) }), cites: [bandD] });
  if (savings) parts.push({ text: fill(t.savings, { amount: amount(locale, savings.value) }), cites: [savings] });
  if (reserves) parts.push({ text: fill(t.reserves, { amount: amount(locale, reserves.value) }), cites: [reserves] });
  if (gaps.length)
    parts.push({
      text: fill(t.gaps, { list: formatList(locale, gaps.map((g) => fill(t.gapItem, { amount: amount(locale, g.value), year: g.year! }))) }),
      cites: gaps,
    });
  if (!parts.length) return null;
  return (
    <div>
      <h3 className="font-semibold">{t.title}</h3>
      <p className="mt-2 max-w-[62ch] text-read">
        {parts.map((p, i) => (
          <Sentence key={i} locale={locale} row={row} text={p.text} cites={p.cites} />
        ))}
      </p>
      <p className="mt-2 max-w-[62ch] text-small text-ink-2">
        {fill(t.setBy, { committee: row.committee, date: formatDate(locale, row.date) })} {bandD || rise ? t.noteBandD : ""}
      </p>
      <PaperLinks locale={locale} councilId={councilId} row={row} />
    </div>
  );
}

/** Whether a report is about a financial year that ended before it was written ("2025-26" reported in July 2026). */
function yearEnded(year: string | null, date: string): boolean {
  const start = Number(year?.slice(0, 4));
  return Number.isFinite(start) && start > 0 && date > `${start + 1}-03-31`;
}

function Monitoring({ locale, councilId, row }: { locale: Locale; councilId: string; row: CouncilPaperRow<MoneyContent> }) {
  const t = papersMessages[locale].monitoring;
  const total = row.content.facts.find((x) => x.key === "forecast_variance" && x.direction);
  if (!total) return null;
  const services = row.content.facts
    .filter((x) => x.key === "service_variance" && x.direction === "over" && x.service)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const year = fy(row.content.year ?? total.year);
  const variance = fill(total.direction === "over" ? t.over : t.under, { amount: amount(locale, total.value) });
  const vars = { variance, year, committee: row.committee, date: formatDate(locale, row.date), period: row.content.period ?? "" };
  const lead = yearEnded(row.content.year, row.date) ? t.past : row.content.period ? t.now : t.nowNoPeriod;
  return (
    <div className="mt-6">
      <h3 className="font-semibold">{t.title}</h3>
      <p className="mt-2 max-w-[62ch] text-read">
        <Sentence locale={locale} row={row} text={fill(lead, vars)} cites={[total]} />
        {services.length ? (
          <Sentence
            locale={locale}
            row={row}
            text={fill(t.services, { list: formatList(locale, services.map((s) => fill(t.serviceItem, { service: s.service!, amount: amount(locale, s.value) }))) })}
            cites={services}
          />
        ) : null}
      </p>
      <p className="mt-2 max-w-[62ch] text-small text-ink-2">{t.note}</p>
      <PaperLinks locale={locale} councilId={councilId} row={row} />
    </div>
  );
}

const SHOWN = 8;

function Risks({ locale, councilId, row }: { locale: Locale; councilId: string; row: CouncilPaperRow<RisksContent> }) {
  const t = papersMessages[locale];
  const risks = row.content.risks;
  if (!risks.length) return null;
  const counts = new Map<string, number>();
  for (const r of risks) for (const k of r.themes.length ? r.themes : ["other"]) counts.set(k, (counts.get(k) ?? 0) + 1);
  const order = [...RISK_THEMES.map((x) => x.key), "other"];
  const themes = [...counts].sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]));
  const item = (r: (typeof risks)[number], i: number) => (
    <li key={i} className="py-3">
      <p className="font-semibold" lang={locale === "cy" ? "en" : undefined}>
        {r.title}
      </p>
      <p className="mt-1">
        {locale === "cy" ? r.summaryCy : r.summaryEn}
        <SourceLink locale={locale} row={row} cite={r} />
      </p>
      {r.rating || r.trend ? (
        <p className="mt-1 text-small text-ink-2">
          {[r.rating ? fill(t.risks.rating, { rating: r.rating }) : null, r.trend ? t.risks.trend[r.trend] : null].filter(Boolean).join(", ")}
        </p>
      ) : null}
    </li>
  );
  return (
    <Section id="risks" title={t.risks.title} className="border-t border-rule">
      <div className="max-w-[62ch]">
        <p className="text-read">
          {fill(t.risks.lede, {
            committee: row.committee,
            date: formatDate(locale, row.date),
            asOf: row.content.asOf ? fill(t.risks.asOf, { date: formatDate(locale, row.content.asOf) }) : "",
            n: formatNumber(locale, risks.length),
          })}
        </p>
        <p className="mt-3 text-small">
          <span className="text-ink-2">{t.risks.themes}: </span>
          {themes.map(([k, n], i) => (
            <span key={k}>
              {i ? ", " : ""}
              {themeName(locale, k)} {formatNumber(locale, n)}
            </span>
          ))}
        </p>
        <ul className="rows mt-4">{risks.slice(0, SHOWN).map(item)}</ul>
        {risks.length > SHOWN ? (
          <details className="mt-1">
            <summary className="cursor-pointer text-small text-ink-2">{fill(t.risks.more, { n: formatNumber(locale, risks.length) })}</summary>
            <ul className="rows">{risks.slice(SHOWN).map((r, i) => item(r, i + SHOWN))}</ul>
          </details>
        ) : null}
        <p className="mt-4 text-small text-ink-2">{t.risks.note}</p>
        <p className="mt-2 text-small text-ink-2">{t.read}</p>
        <PaperLinks locale={locale} councilId={councilId} row={row} />
      </div>
    </Section>
  );
}

/** The budget and how the year is going, for the council page and the money page. */
export async function CouncilMoney({ locale, councilId, moreLink = false }: { locale: Locale; councilId: string; moreLink?: boolean }) {
  const p = await councilPapers(councilId);
  if (!p.budget && !p.monitoring) return null;
  const t = papersMessages[locale];
  const budget = p.budget ? <Budget locale={locale} councilId={councilId} row={p.budget} /> : null;
  const monitoring = p.monitoring ? <Monitoring locale={locale} councilId={councilId} row={p.monitoring} /> : null;
  if (!budget && !monitoring) return null;
  return (
    <Section id="budget" title={t.moneyTitle} className="border-t border-rule">
      {budget}
      {monitoring}
      <p className="mt-4 max-w-[62ch] text-small text-ink-2">{t.read}</p>
      {moreLink ? (
        <p className="mt-2 text-small">
          <Link href={href(locale, `/${councilId}/money`)}>{t.moreMoney}</Link>
        </p>
      ) : null}
    </Section>
  );
}

/** The council's risk register, for the council page. */
export async function CouncilRisks({ locale, councilId }: { locale: Locale; councilId: string }) {
  const p = await councilPapers(councilId);
  return p.risks ? <Risks locale={locale} councilId={councilId} row={p.risks} /> : null;
}
