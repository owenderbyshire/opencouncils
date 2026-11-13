/*
 * Small charts drawn as plain SVG on the server. Each one is decorative: the
 * page states the figures in text, and a table of every value sits beside the
 * chart. The council is drawn in the accent colour, Wales in grey, and lines
 * are labelled at their ends, so colour is never the only signal.
 */

export interface LineSeries {
  label: string;
  values: Array<{ x: string; y: number }>;
  tone: "accent" | "muted";
}

const W = 640;
const H = 260;
const PAD = { top: 16, right: 112, bottom: 28, left: 52 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Years along the bottom, with two or three lines and a label at the end of each. */
export function LineChart({
  series,
  format,
  labelEvery = 5,
}: {
  series: LineSeries[];
  format: (n: number) => string;
  labelEvery?: number;
}) {
  const xs = [...new Set(series.flatMap((s) => s.values.map((v) => v.x)))].sort();
  if (xs.length < 2) return null;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values.map((v) => v.y))));
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (k: string) => PAD.left + (xs.indexOf(k) / (xs.length - 1)) * iw;
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  // End labels, nudged apart when two lines finish close together.
  const ends = series
    .map((s) => ({ s, v: s.values[s.values.length - 1] }))
    .filter((e) => e.v)
    .map((e) => ({ ...e, ly: y(e.v.y) }))
    .sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 30) ends[i].ly = ends[i - 1].ly + 30;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={1} />
          <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)">
            {format(t)}
          </text>
        </g>
      ))}
      {xs.map((k, i) =>
        i % labelEvery === 0 || i === xs.length - 1 ? (
          <text key={k} x={x(k)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
            {k}
          </text>
        ) : null,
      )}
      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.tone === "accent" ? "var(--accent)" : "var(--ink-3)"}
          strokeWidth={s.tone === "accent" ? 2.5 : 1.5}
          strokeDasharray={s.tone === "accent" ? undefined : "4 3"}
          strokeLinejoin="round"
          points={s.values.map((v) => `${x(v.x)},${y(v.y)}`).join(" ")}
        />
      ))}
      {ends.map((e) => (
        <g key={e.s.label}>
          <circle cx={x(e.v.x)} cy={y(e.v.y)} r={3.5} fill={e.s.tone === "accent" ? "var(--accent)" : "var(--ink-3)"} />
          <text x={x(e.v.x) + 10} y={e.ly - 2} fontSize={12} fontWeight={600} fill="var(--ink)">
            {format(e.v.y)}
          </text>
          <text x={x(e.v.x) + 10} y={e.ly + 12} fontSize={11} fill="var(--ink-2)">
            {e.s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export interface BarRow {
  key: string;
  label: string;
  note?: string;
  value: number | null;
  compare: number | null;
}

/**
 * One bar per row for the council, with a tick showing Wales. Rows are HTML so
 * the labels wrap and read naturally; only the bars are drawn.
 */
export function CompareBars({
  rows,
  format,
  compareLabel,
}: {
  rows: BarRow[];
  format: (n: number) => string;
  compareLabel: string;
}) {
  const max = niceMax(Math.max(1, ...rows.flatMap((r) => [r.value ?? 0, r.compare ?? 0])));
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  return (
    <ul className="rows">
      {rows.map((r) => (
        <li key={r.key} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[16rem_minmax(0,1fr)]">
          <div>
            <p className="font-semibold">{r.label}</p>
            {r.note ? <p className="text-meta text-ink-2">{r.note}</p> : null}
          </div>
          <div className="self-center">
            <div className="relative h-5 rounded-sm bg-surface">
              {r.value !== null && r.value > 0 ? (
                <div className="absolute inset-y-0 left-0 rounded-sm bg-accent" style={{ width: pct(r.value) }} />
              ) : null}
              {r.compare !== null && r.compare > 0 ? (
                <div
                  className="absolute -inset-y-1 w-0.5 bg-ink"
                  style={{ left: pct(r.compare) }}
                  title={`${compareLabel}: ${format(r.compare)}`}
                />
              ) : null}
            </div>
            <p className="mt-1 text-small">
              <span className="font-semibold num">{r.value === null ? "–" : format(r.value)}</span>
              {r.compare !== null ? (
                <span className="text-ink-2">
                  {" "}
                  ({compareLabel}: <span className="num">{format(r.compare)}</span>)
                </span>
              ) : null}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** One bar split into parts, each labelled underneath. */
export function SplitBar({ parts }: { parts: Array<{ key: string; label: string; value: number; text: string }> }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  if (total <= 0) return null;
  const tones = ["var(--accent)", "var(--ink-3)", "var(--rule-strong)"];
  return (
    <div>
      <div className="flex h-6 overflow-hidden rounded-sm" aria-hidden="true">
        {parts.map((p, i) => (
          <div key={p.key} style={{ width: `${(p.value / total) * 100}%`, background: tones[i % tones.length] }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-small">
        {parts.map((p, i) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: tones[i % tones.length] }} />
            <span>
              {p.label}: <span className="font-semibold num">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/*
 * Range strip: where one council sits among all 22 on one measure. The other
 * councils are unnamed dots, so it shows a position, never an order of names.
 * Wales is a tick. The council's own figure is the accent dot with its value
 * above it; Wales's value sits under its tick. Nothing is drawn with fewer than
 * three councils' figures.
 */
const RS = { w: 320, h: 58, x0: 10, x1: 310, y: 30 };

export function rangeDomain(values: number[]): [number, number] | null {
  const ok = values.filter((v) => Number.isFinite(v));
  if (ok.length < 3) return null;
  const lo = Math.min(...ok);
  const hi = Math.max(...ok);
  if (hi === lo) return [lo - 1, hi + 1];
  return [lo, hi];
}

export function RangeStrip({
  values,
  mine,
  wales,
  format,
  mineLabel,
  walesLabel,
  otherLabel,
  summary,
}: {
  /** Every council's figure, the council's own included. */
  values: number[];
  mine: number;
  wales: number | null;
  format: (n: number) => string;
  mineLabel: string;
  walesLabel: string;
  /** For the hover text of an unnamed dot: "Another council". */
  otherLabel: string;
  /** The whole picture in one sentence, for screen readers. */
  summary: string;
}) {
  const domain = rangeDomain([...values, ...(wales === null ? [] : [wales])]);
  if (!domain) return null;
  const [lo, hi] = domain;
  const x = (v: number) => RS.x0 + ((v - lo) / (hi - lo)) * (RS.x1 - RS.x0);
  // Text anchored so it never runs off either end.
  const anchor = (px: number) => (px < 60 ? "start" : px > RS.w - 60 ? "end" : "middle");
  const tx = (px: number) => (px < 60 ? Math.max(0, px - 6) : px > RS.w - 60 ? Math.min(RS.w, px + 6) : px);
  const mx = x(mine);
  const wx = wales === null ? null : x(wales);
  // The council's own figure is drawn once, on top, as the accent dot.
  const mineAt = values.indexOf(mine);
  return (
    <svg viewBox={`0 0 ${RS.w} ${RS.h}`} className="h-auto w-full max-w-[20rem] overflow-visible" role="img" aria-label={summary}>
      <line x1={RS.x0} x2={RS.x1} y1={RS.y} y2={RS.y} stroke="var(--rule-strong)" strokeWidth={1} />
      {values.map((v, i) => {
        if (i === mineAt) return null;
        return (
          <circle key={i} cx={x(v)} cy={RS.y} r={3.5} fill="var(--data-context)" fillOpacity={0.7} stroke="var(--bg)" strokeWidth={1}>
            <title>{`${otherLabel}: ${format(v)}`}</title>
          </circle>
        );
      })}
      {wx !== null ? (
        <g>
          <line x1={wx} x2={wx} y1={RS.y - 9} y2={RS.y + 9} stroke="var(--ink)" strokeWidth={2}>
            <title>{`${walesLabel}: ${format(wales!)}`}</title>
          </line>
          <text x={tx(wx)} y={RS.y + 24} textAnchor={anchor(wx)} fontSize={11} fill="var(--ink-2)">
            {`${walesLabel} ${format(wales!)}`}
          </text>
        </g>
      ) : null}
      <circle cx={mx} cy={RS.y} r={6} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2}>
        <title>{`${mineLabel}: ${format(mine)}`}</title>
      </circle>
      <text x={tx(mx)} y={RS.y - 12} textAnchor={anchor(mx)} fontSize={12} fontWeight={600} fill="var(--ink)">
        {`${mineLabel} ${format(mine)}`}
      </text>
    </svg>
  );
}

export interface TrendPoint {
  period: string;
  value: number;
}

/**
 * A small line over time for one council, with Wales dashed beside it when
 * the two share a scale. The latest value is labelled at the line's end; the
 * first and last periods sit under it. Nothing is drawn with fewer than three
 * points.
 */
export function TrendLine({
  points,
  wales,
  format,
  periodText,
  mineLabel,
  walesLabel,
  summary,
}: {
  points: TrendPoint[];
  wales?: TrendPoint[] | null;
  format: (n: number) => string;
  periodText: (p: string) => string;
  mineLabel: string;
  walesLabel: string;
  summary: string;
}) {
  if (points.length < 3) return null;
  const W2 = 300;
  const H2 = 96;
  const P = { top: 10, right: 8, bottom: 22, left: 8 };
  const periods = points.map((p) => p.period);
  const w = (wales ?? []).filter((p) => periods.includes(p.period));
  const all = [...points, ...w].map((p) => p.value);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  const iw = W2 - P.left - P.right;
  const ih = H2 - P.top - P.bottom;
  const x = (p: string) => P.left + (periods.indexOf(p) / (periods.length - 1)) * iw;
  const y = (v: number) => P.top + ih - ((v - lo) / (hi - lo)) * ih;
  const last = points[points.length - 1];
  const line = (s: TrendPoint[]) => s.map((p) => `${x(p.period).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W2} ${H2}`} className="h-auto w-full max-w-[20rem]" role="img" aria-label={summary}>
        <line x1={P.left} x2={W2 - P.right} y1={H2 - P.bottom} y2={H2 - P.bottom} stroke="var(--rule)" strokeWidth={1} />
        {w.length >= 2 ? (
          <polyline points={line(w)} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
        ) : null}
        <polyline points={line(points)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.period} cx={x(p.period)} cy={y(p.value)} r={8} fill="transparent">
            <title>{`${mineLabel}, ${periodText(p.period)}: ${format(p.value)}`}</title>
          </circle>
        ))}
        <circle cx={x(last.period)} cy={y(last.value)} r={4} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
        <text x={P.left} y={H2 - 6} fontSize={11} fill="var(--ink-3)">
          {`${periodText(points[0].period)}: ${format(points[0].value)}`}
        </text>
        <text x={W2 - P.right} y={H2 - 6} textAnchor="end" fontSize={11} fill="var(--ink-3)">
          {`${periodText(last.period)}: ${format(last.value)}`}
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-0.5 w-4 bg-accent" />
          {mineLabel}
        </span>
        {w.length >= 2 ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block w-4 border-t-[1.5px] border-dashed border-ink-3" />
            {walesLabel}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
