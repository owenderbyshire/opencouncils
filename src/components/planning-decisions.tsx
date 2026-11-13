import { decisionMonths } from "@/data/planning";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber, formatPercent } from "@/i18n/format";
import { planningMessages } from "@/i18n/messages/planning";
import { yearLabelled } from "@/lib/timeline";

/*
 * What an authority decided over the last year, from its register: one bar of
 * decisions by outcome, in shades of one blue (never green and red, which
 * would read as good and bad), and a column for each month's decisions.
 * Both say their counts in text and in a table for screen readers.
 */

/** A share, with a decimal place when it is under 1%, so a small part never reads 0%. */
const pct = (locale: Locale, v: number) => formatPercent(locale, v, v > 0 && v < 0.01 ? 1 : 0);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
const OUTCOME_FILL = { approved: "var(--map-5)", refused: "var(--map-3)", other: "var(--map-1)" } as const;
const OUTCOMES = ["approved", "refused", "other"] as const;

export async function PlanningDecisions({ locale, authority }: { locale: Locale; authority: string }) {
  const d = await decisionMonths(authority);
  if (!d) return null;
  const t = planningMessages[locale].decisionsChart;
  const sums = { approved: 0, refused: 0, other: 0 };
  for (const m of d.months) for (const k of OUTCOMES) sums[k] += m[k];
  const total = sums.approved + sums.refused + sums.other;
  const perMonth = d.months.map((m) => ({ month: m.month, n: m.approved + m.refused + m.other }));
  const max = Math.max(...perMonth.map((m) => m.n), 1);
  const peak = perMonth.reduce((a, b) => (b.n > a.n ? b : a));
  const last = perMonth[perMonth.length - 1];
  const period = { from: formatDate(locale, `${d.from}-01`, "month"), to: formatDate(locale, `${d.to}-01`, "month") };
  const years = yearLabelled(perMonth.map((m) => m.month));
  const monthLong = (m: string) => formatDate(locale, `${m}-01`, "month");
  return (
    <section aria-labelledby="decisions-chart" className="mb-10 max-w-[48rem]">
      <h2 id="decisions-chart" className="text-h3">
        {t.title}
      </h2>
      <p className="mt-1 max-w-[62ch] text-small text-ink-2">{fill(t.lede, { ...period, n: formatNumber(locale, total) })}</p>

      <h3 className="mt-6 font-sans text-body font-semibold">{t.outcomeTitle}</h3>
      <div
        className="mt-2 flex h-5 gap-[2px]"
        role="img"
        aria-label={OUTCOMES.filter((k) => sums[k]).map((k) => `${t.outcomes[k]}: ${formatNumber(locale, sums[k])}`).join(", ")}
      >
        {OUTCOMES.filter((k) => sums[k]).map((k) => (
          <div
            key={k}
            title={`${t.outcomes[k]}: ${formatNumber(locale, sums[k])} (${pct(locale, sums[k] / total)})`}
            className="h-full rounded-[4px]"
            style={{ width: `${(sums[k] / total) * 100}%`, background: OUTCOME_FILL[k] }}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-small">
        {OUTCOMES.filter((k) => sums[k]).map((k) => (
          <li key={k} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-[3px]" style={{ background: OUTCOME_FILL[k] }} />
            <span>
              {t.outcomes[k]}: <span className="font-semibold num">{formatNumber(locale, sums[k])}</span>{" "}
              <span className="text-ink-2 num">({pct(locale, sums[k] / total)})</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-meta text-ink-2">{t.otherNote}</p>

      <h3 className="mt-6 font-sans text-body font-semibold">{t.monthTitle}</h3>
      <div aria-hidden="true" className="mt-3 grid h-32 grid-cols-12 items-end gap-1 border-b border-rule" style={{ gridTemplateColumns: `repeat(${perMonth.length}, minmax(0, 1fr))` }}>
        {perMonth.map((m) => {
          const labelled = m === peak || m === last;
          return (
            <div key={m.month} className="flex h-full flex-col items-center justify-end" title={`${monthLong(m.month)}: ${formatNumber(locale, m.n)}`}>
              {labelled ? <span className="mb-0.5 text-meta text-ink-2 num">{formatNumber(locale, m.n)}</span> : null}
              <div className="w-full max-w-6 rounded-t-[4px] bg-accent" style={{ height: `${(m.n / max) * 100}%`, minHeight: m.n ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="mt-1 grid text-center text-meta text-ink-3" style={{ gridTemplateColumns: `repeat(${perMonth.length}, minmax(0, 1fr))` }}>
        {perMonth.map((m, i) => (
          <span key={m.month}>
            {formatDate(locale, `${m.month}-01`, "monthAbbr").slice(0, 1)}
            {years[i] ? <span className="block text-[0.65rem] leading-none num">{m.month.slice(0, 4)}</span> : null}
          </span>
        ))}
      </div>
      <p className="mt-2 text-meta text-ink-2">{t.source}</p>
      <div className="visually-hidden">
        <table>
        <caption>{t.monthTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{t.month}</th>
            {OUTCOMES.map((k) => (
              <th key={k} scope="col">
                {t.outcomes[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {d.months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthLong(m.month)}</th>
              {OUTCOMES.map((k) => (
                <td key={k}>{formatNumber(locale, m[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </section>
  );
}
