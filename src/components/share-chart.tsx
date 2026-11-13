import type { Locale } from "@/i18n/config";
import { formatPercent } from "@/i18n/format";

/*
 * Each party's share of council seats (in 2022 and now) against its share of
 * the vote at the 2026 Senedd election and in the latest polls, as a dot plot:
 * one row per party, one mark per measure. The marks take the party's colour;
 * which measure a mark shows is told by its shape and the legend, never by
 * colour alone. Every mark has a hover label and the same figures are in the
 * table below the chart.
 */

export interface ShareRow {
  key: string;
  label: string;
  colour: string;
  /** Percentages, 0 to 100; null where there is no figure. */
  seats2022: number | null;
  seatsNow: number | null;
  senedd: number | null;
  polls: number | null;
}

export interface ShareLabels {
  seats2022: string;
  seatsNow: string;
  senedd: string;
  polls: string;
  party: string;
  table: string;
  caption: string;
}

const W = 540;
const LABEL = 172;
const RIGHT = 16;
const ROW = 48;
/** Council seats sit just above each row's middle, votes just below, so close figures don't overlap. */
const OFFSET: Record<"seats2022" | "seatsNow" | "senedd" | "polls", number> = { seats2022: -8, seatsNow: -8, senedd: 8, polls: 8 };
const TOP = 28;

type Measure = "seats2022" | "seatsNow" | "senedd" | "polls";
const MEASURES: Measure[] = ["seats2022", "seatsNow", "senedd", "polls"];

function Mark({ m, x, y, colour }: { m: Measure; x: number; y: number; colour: string }) {
  const ring = { stroke: "var(--surface)", strokeWidth: 2, paintOrder: "stroke" as const };
  switch (m) {
    case "seats2022":
      return <circle cx={x} cy={y} r={6} fill="var(--surface)" stroke={colour} strokeWidth={2} />;
    case "seatsNow":
      return <circle cx={x} cy={y} r={6} fill={colour} {...ring} />;
    case "senedd":
      return <path d={`M${x} ${y - 7} L${x + 7} ${y} L${x} ${y + 7} L${x - 7} ${y} Z`} fill={colour} {...ring} />;
    case "polls":
      return <rect x={x - 5.5} y={y - 5.5} width={11} height={11} fill="var(--surface)" stroke={colour} strokeWidth={2} />;
  }
}

export function ShareChart({ locale, rows, labels }: { locale: Locale; rows: ShareRow[]; labels: ShareLabels }) {
  const max = Math.max(10, ...rows.flatMap((r) => MEASURES.map((m) => r[m] ?? 0)));
  const top = Math.ceil(max / 10) * 10;
  const plot = W - LABEL - RIGHT;
  const x = (v: number) => LABEL + (v / top) * plot;
  const height = TOP + rows.length * ROW + 8;
  const pct = (v: number | null) => (v === null ? "–" : formatPercent(locale, v / 100, 1));
  const ticks = Array.from({ length: top / 10 + 1 }, (_, i) => i * 10);

  return (
    <figure className="max-w-[40rem]">
      <ul className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-small text-ink-2" aria-label={labels.caption}>
        {MEASURES.map((m) => (
          <li key={m} className="inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <Mark m={m} x={8} y={8} colour="var(--ink-2)" />
            </svg>
            {labels[m]}
          </li>
        ))}
      </ul>
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={labels.caption}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP - 8} y2={height - 8} stroke="var(--rule)" strokeWidth={1} />
            <text x={x(t)} y={TOP - 14} textAnchor="middle" className="fill-[var(--ink-3)] text-[12px]">
              {formatPercent(locale, t / 100, 0)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const y = TOP + i * ROW + ROW / 2;
          return (
            <g key={r.key}>
              <text x={0} y={y + 4} className="fill-[var(--ink)] text-[15px]">
                {r.label}
              </text>
              {r.seats2022 !== null && r.seatsNow !== null ? (
                <line x1={x(r.seats2022)} x2={x(r.seatsNow)} y1={y - 8} y2={y - 8} stroke={r.colour} strokeWidth={2} opacity={0.5} />
              ) : null}
              {MEASURES.map((m) =>
                r[m] === null ? null : (
                  <g key={m}>
                    <title>{`${r.label}: ${labels[m]}, ${pct(r[m])}`}</title>
                    {/* A hit target bigger than the mark. */}
                    <circle cx={x(r[m]!)} cy={y + OFFSET[m]} r={10} fill="transparent" />
                    <Mark m={m} x={x(r[m]!)} y={y + OFFSET[m]} colour={r.colour} />
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <details className="mt-3 text-small">
        <summary className="cursor-pointer text-ink-2">{labels.table}</summary>
        <div className="overflow-x-auto">
          <table className="data-table mt-2">
            <thead>
              <tr>
                <th scope="col">{labels.party}</th>
                {MEASURES.map((m) => (
                  <th key={m} scope="col" className="text-right">
                    {labels[m]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="text-left font-medium">
                    {r.label}
                  </th>
                  {MEASURES.map((m) => (
                    <td key={m} className="text-right num">
                      {pct(r[m])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
