import { topicTimeline, type TimelineKind } from "@/data/search";
import type { Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";
import { councilMessages } from "@/i18n/messages/council";
import { timelineMessages } from "@/i18n/messages/timeline";
import { countStep, yearLabelled } from "@/lib/timeline";

/*
 * When each of a council's main committees took up a topic: one row each for
 * full Council, Cabinet, scrutiny and planning, one column per month for the
 * last twelve. A cell's shade is the number of meetings with business on the
 * topic, in fixed steps of one blue (lighter is fewer); an empty cell is none.
 * The same counts are in a table for screen readers, and each cell says its
 * count on hover.
 */

// None is an empty outlined square, so it differs from one meeting by shape as well as shade.
const STEP_FILL = ["transparent", "var(--map-1)", "var(--map-3)", "var(--map-5)"];
const cell = (step: number) => ({ background: STEP_FILL[step], boxShadow: step === 0 ? "inset 0 0 0 1px var(--rule-strong)" : undefined });

/** A topic's name inside a sentence: "took up housing". */
const inSentence = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

export async function TopicTimeline({ locale, topic, council, topicName }: { locale: Locale; topic: string; council: string; topicName: string }) {
  const { months, rows } = await topicTimeline(topic, council);
  const total = rows.reduce((n, r) => n + r.counts.reduce((a, b) => a + b, 0), 0);
  if (!total) return null;
  const t = timelineMessages[locale];
  const kinds = councilMessages[locale].kinds as Record<TimelineKind, string>;
  const years = yearLabelled(months);
  const monthName = (m: string) => formatDate(locale, `${m}-01`, "monthShort");
  const meetings = (n: number) => fill(n === 1 ? t.meetingOne : t.meetingMany, { n: formatNumber(locale, n) });
  return (
    <figure className="m-0 mb-8 max-w-[44rem]">
      <figcaption className="text-small font-semibold">{fill(t.title, { topic: inSentence(topicName) })}</figcaption>
      <p className="mt-1 mb-3 max-w-[62ch] text-meta text-ink-2">{fill(t.lede, { from: monthName(months[0]), to: monthName(months[months.length - 1]) })}</p>
      <div aria-hidden="true" className="grid grid-cols-[6.75rem_repeat(12,minmax(0,1fr))] gap-[2px] text-meta sm:grid-cols-[7rem_repeat(12,minmax(0,1fr))]">
        <span />
        {months.map((m, i) => (
          <span key={m} className="text-center text-ink-3">
            {/* Month initials; the year only where it starts and at the first column. */}
            {formatDate(locale, `${m}-01`, "monthAbbr").slice(0, 1)}
            {years[i] ? <span className="block text-[0.65rem] leading-none num">{m.slice(0, 4)}</span> : null}
          </span>
        ))}
        {rows.map((r) => (
          <Row key={r.kind} label={kinds[r.kind]} counts={r.counts} months={months} hover={(m, n) => `${kinds[r.kind]}, ${monthName(m)}: ${meetings(n)}`} />
        ))}
      </div>
      <ul aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-2">
        {t.legend.map((label, i) => (
          <li key={label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[3px]" style={cell(i)} />
            {label}
          </li>
        ))}
      </ul>
      <div className="visually-hidden">
        <table>
        <caption>{fill(t.title, { topic: inSentence(topicName) })}</caption>
        <thead>
          <tr>
            <th scope="col">{t.month}</th>
            {rows.map((r) => (
              <th key={r.kind} scope="col">
                {kinds[r.kind]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}>
              <th scope="row">{formatDate(locale, `${m}-01`, "month")}</th>
              {rows.map((r) => (
                <td key={r.kind}>{formatNumber(locale, r.counts[i])}</td>
              ))}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </figure>
  );
}

function Row({ label, counts, months, hover }: { label: string; counts: number[]; months: string[]; hover: (m: string, n: number) => string }) {
  return (
    <>
      <span className="self-center truncate pr-2 text-small text-ink-2">{label}</span>
      {counts.map((n, i) => (
        <span key={months[i]} title={hover(months[i], n)} className="aspect-square rounded-[3px]" style={cell(countStep(n))} />
      ))}
    </>
  );
}
