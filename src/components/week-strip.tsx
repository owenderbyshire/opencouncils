import Link from "next/link";
import { weekAhead } from "@/data/council";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber } from "@/i18n/format";
import { councilMessages } from "@/i18n/messages/council";
import { timelineMessages } from "@/i18n/messages/timeline";

/*
 * The next seven days at a glance: for each day, how many meetings are due
 * and of which kinds. One bar per day shows the number against the busiest
 * day; the kinds are written out, so nothing rests on colour. On a phone the
 * days stack as rows; from small screens up they sit side by side.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

export async function WeekStrip({ locale, councilId }: { locale: Locale; councilId: string }) {
  const days = await weekAhead(councilId);
  const totals = days.map((d) => d.kinds.reduce((n, k) => n + k.n, 0));
  const max = Math.max(...totals);
  if (!max) return null;
  const t = timelineMessages[locale];
  const kinds = councilMessages[locale].kinds;
  return (
    <section aria-labelledby="week-strip" className="mb-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6">
        <h2 id="week-strip" className="font-sans text-body font-semibold">
          {t.weekTitle}
        </h2>
        <Link href={`${href(locale, `/${councilId}/meetings`)}?when=upcoming`} className="text-small">
          {t.weekLink}
        </Link>
      </div>
      <ol className="mt-3 grid gap-[2px] sm:grid-cols-7">
        {days.map((d, i) => {
          const n = totals[i];
          const list = d.kinds.map((k) => (k.n > 1 ? `${kinds[k.kind]} (${formatNumber(locale, k.n)})` : kinds[k.kind]));
          return (
            <li key={d.date} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-x-3 bg-surface px-3 py-2 sm:block sm:min-h-[8.5rem] sm:rounded-sm">
              <p className="text-small">
                <span className="font-semibold">{formatDate(locale, d.date, "weekdayShort")}</span>{" "}
                <span className="text-ink-2 num">{formatDate(locale, d.date, "dayMonth")}</span>
              </p>
              <div className="sm:mt-2">
                <div className="h-2 w-full rounded-sm bg-bg" aria-hidden="true">
                  {n ? <div className="h-2 rounded-sm bg-accent" style={{ width: `${Math.max(8, (n / max) * 100)}%` }} /> : null}
                </div>
                <p className="mt-1 text-small font-semibold num">{n ? fill(n === 1 ? t.weekCountOne : t.weekCount, { n: formatNumber(locale, n) }) : t.weekNone}</p>
                {list.length ? <p className="text-meta text-ink-2">{formatList(locale, list)}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
