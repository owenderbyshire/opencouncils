import Link from "next/link";
import { RangeStrip } from "@/components/charts";
import { getCouncilData } from "@/data/council-data";
import { href, type Locale } from "@/i18n/config";
import { formatMoney, formatNumber } from "@/i18n/format";
import { moneyMessages } from "@/i18n/messages/money";
import { councilConfig, councilShort } from "@/lib/councils";

/*
 * Where a council's Band D council tax sits among all 22 councils this year,
 * with the Welsh average as a tick. The other councils are not named. From
 * StatsWales through the council data job, the same figures as the money page.
 */

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));

/** The latest year with a Band D total for at least 20 councils, and every council's total for it. */
export function bandDYear(councils: Record<string, { bandD: Array<{ year: string; total: number | null }> }>): { year: string; totals: Record<string, number> } | null {
  const counts = new Map<string, number>();
  for (const c of Object.values(councils)) for (const y of c.bandD) if (y.total !== null) counts.set(y.year, (counts.get(y.year) ?? 0) + 1);
  const year = [...counts].filter(([, n]) => n >= 20).map(([y]) => y).sort().at(-1);
  if (!year) return null;
  const totals: Record<string, number> = {};
  for (const [id, c] of Object.entries(councils)) {
    const t = c.bandD.find((y) => y.year === year)?.total;
    if (t !== null && t !== undefined) totals[id] = t;
  }
  return { year, totals };
}

export async function BandDRange({ locale, councilId, link = false }: { locale: Locale; councilId: string; link?: boolean }) {
  const data = await getCouncilData();
  if (!data) return null;
  const found = bandDYear(data.councils);
  if (!found || found.totals[councilId] === undefined) return null;
  const t = moneyMessages[locale];
  const c = councilConfig(councilId);
  const name = c ? councilShort(locale, c) : councilId;
  const values = Object.values(found.totals);
  const mine = found.totals[councilId];
  const wales = data.wales.bandD.find((y) => y.year === found.year)?.total ?? null;
  const money = (n: number) => formatMoney(locale, n, 0);
  const v = { n: formatNumber(locale, values.length), min: money(Math.min(...values)), max: money(Math.max(...values)), year: found.year };
  return (
    <figure className="m-0">
      <figcaption className="mb-2 text-small font-semibold">{fill(t.rangeTitle, { year: found.year })}</figcaption>
      <RangeStrip
        values={values}
        mine={mine}
        wales={wales}
        format={money}
        mineLabel={name}
        walesLabel={t.walesAverage}
        otherLabel={t.rangeOther}
        summary={fill(t.rangeSummary, { ...v, name, v: money(mine), w: wales === null ? "–" : money(wales) })}
      />
      <p className="mt-1 text-meta text-ink-2">
        {fill(t.rangeLine, v)}
        {link ? (
          <>
            {" "}
            <Link href={href(locale, `/${councilId}/money`)}>{t.rangeLink}</Link>
          </>
        ) : null}
      </p>
    </figure>
  );
}
