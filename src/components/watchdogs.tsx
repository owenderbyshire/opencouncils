import { Section } from "@/components/page-header";
import { councilWatchdogs, type AuditReport } from "@/data/watchdogs";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { watchdogsMessages } from "@/i18n/messages/watchdogs";
import { softMutate } from "@/i18n/welsh";
import type { CouncilConfig } from "@data/curated/councils";
import { councilName } from "@/lib/councils";
import { SITE } from "@/lib/site";

/*
 * What the watchdogs say about a council: Audit Wales reports about it and
 * the Ombudsman's annual letters to it, copied from Edau by
 * pipeline/jobs/watchdogs.ts. Titles, dates and summaries are Audit Wales's
 * own; the findings under a report were read by AI, are labelled so and link
 * to the page of the report each rests on. Left out when nothing is held.
 */

/** Reports shown before the rest open from "Show all". */
const FIRST = 4;

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const plural = (locale: Locale, p: { one: string; other: string }, n: number) => fill(n === 1 ? p.one : p.other, { n: formatNumber(locale, n) });

function ReportRow({ locale, r }: { locale: Locale; r: AuditReport }) {
  const t = watchdogsMessages[locale];
  const cy = locale === "cy";
  const title = cy ? r.title.cy || r.title.en : r.title.en;
  const summary = cy ? r.summary.cy || r.summary.en : r.summary.en;
  const reading = r.aiReading;
  return (
    <li className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[9rem_1fr]">
      <span className="text-small text-ink-2">{formatDate(locale, r.date, "short")}</span>
      <div className="max-w-[62ch]">
        <a href={cy ? r.url.cy || r.url.en : r.url.en} rel="noopener" className="font-semibold" lang={cy && !r.title.cy ? "en" : undefined}>
          {title}
        </a>
        {summary ? (
          <p className="mt-1 text-small text-ink-2" lang={cy && !r.summary.cy ? "en" : undefined}>
            {summary}
          </p>
        ) : null}
        {reading ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-small font-semibold">{plural(locale, t.aiTitle, reading.findings.length)}</summary>
            <div className="mt-2 border-l-2 border-rule pl-3">
              <p className="text-meta text-ink-2">{t.aiLabel}</p>
              <ul className="mt-2 space-y-1 text-small">
                {reading.findings.map((f, i) => (
                  <li key={i}>
                    <span className="font-semibold">{t.kinds[f.kind] ?? f.kind}:</span>{" "}
                    <span lang={cy && !f.text.cy ? "en" : undefined}>{cy ? f.text.cy || f.text.en : f.text.en}</span>
                    {f.sourceUrl ? (
                      <>
                        {" "}
                        <a href={f.sourceUrl} rel="noopener" className="whitespace-nowrap text-meta text-ink-2">
                          ({fill(t.page, { n: formatNumber(locale, f.page) })})
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
              {reading.total > reading.findings.length ? (
                <p className="mt-2 text-meta text-ink-2">{fill(t.aiShown, { shown: formatNumber(locale, reading.findings.length), total: formatNumber(locale, reading.total) })}</p>
              ) : null}
            </div>
          </details>
        ) : null}
        {r.pdf.en || r.pdf.cy ? (
          <p className="mt-1 flex flex-wrap gap-x-4 text-meta">
            {r.pdf.en ? (
              <a href={r.pdf.en} rel="noopener" className="text-ink-2">
                {t.pdf}
              </a>
            ) : null}
            {r.pdf.cy ? (
              <a href={r.pdf.cy} rel="noopener" className="text-ink-2" hrefLang="cy">
                {t.pdfCy}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export async function WatchdogsSection({ locale, council }: { locale: Locale; council: CouncilConfig }) {
  const held = await councilWatchdogs(council.id);
  if (!held) return null;
  const t = watchdogsMessages[locale];
  const name = councilName(locale, council);
  const { reports, letters } = held;
  const credits = [...new Set([...reports.map((r) => r.ownerCredit), ...letters.map((l) => l.ownerCredit)])];
  return (
    <Section id="watchdogs" title={t.title} className="border-t border-rule">
      <p className="-mt-1 max-w-[62ch] text-small text-ink-2">{t.lede}</p>
      {reports.length ? (
        <div className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6">
            <h3 className="font-serif text-h4">{fill(t.auditTitle, { name: locale === "cy" ? softMutate(name) : name })}</h3>
            <span className="text-small text-ink-2">{plural(locale, t.auditCount, reports.length)}</span>
          </div>
          <p className="mt-1 max-w-[62ch] text-small text-ink-2">{t.auditHelp}</p>
          <ol className="rows mt-2">
            {reports.slice(0, FIRST).map((r) => (
              <ReportRow key={r.id} locale={locale} r={r} />
            ))}
          </ol>
          {reports.length > FIRST ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-small font-semibold">{fill(t.showAll, { n: formatNumber(locale, reports.length) })}</summary>
              <ol className="rows">
                {reports.slice(FIRST).map((r) => (
                  <ReportRow key={r.id} locale={locale} r={r} />
                ))}
              </ol>
            </details>
          ) : null}
        </div>
      ) : null}
      {letters.length ? (
        <div className="mt-8">
          <h3 className="font-serif text-h4">{t.lettersTitle}</h3>
          <p className="mt-1 max-w-[62ch] text-small text-ink-2">{t.lettersHelp}</p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-small">
            {letters.map((l) => (
              <li key={l.year}>
                <a href={l.url} rel="noopener" aria-label={fill(t.letterLabel, { year: l.year })} className="num">
                  {l.year}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-6 max-w-[62ch] text-meta text-ink-2">
        {t.source}{" "}
        {credits.map((c) => (
          <span key={c} lang={locale === "cy" ? "en" : undefined}>
            {/[.!]$/.test(c) ? c : `${c}.`}{" "}
          </span>
        ))}
        <a href={`mailto:${SITE.contactEmail}?subject=${encodeURIComponent(`${name}: ${t.reportProblem}`)}`}>{t.reportProblem}</a>
      </p>
    </Section>
  );
}
