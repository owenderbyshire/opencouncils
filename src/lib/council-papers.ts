/**
 * Facts from a council's own papers, as stored by pipeline/jobs/council-papers.ts and shown on its page.
 * Safe to import anywhere.
 */

export type CouncilPaperKind = "risks" | "budget" | "monitoring";

export interface PaperRef {
  id: number;
  title: string;
  url: string;
}

/** Where a fact is: which paper (index into the row's documents) and which page. */
export interface Cite {
  doc: number;
  page: number;
  /** The words in the paper it rests on. */
  quote: string;
}

export interface CouncilRisk extends Cite {
  /** The risk's name as the council gives it (English as published). */
  title: string;
  /** One plain sentence on what could go wrong, in each language. */
  summaryEn: string;
  summaryCy: string;
  /** The rating as the council states it ("High", "Red", "20"), or null. Not comparable between councils. */
  rating: string | null;
  /** Whether the council says it is rising, steady or falling, if it says. */
  trend: "up" | "steady" | "down" | null;
  themes: string[];
}

export interface RisksContent {
  /** The date the register is as at, if the paper says. */
  asOf: string | null;
  risks: CouncilRisk[];
}

export type BudgetKey =
  | "net_budget"
  | "council_tax_rise"
  | "band_d"
  | "savings"
  | "reserves_used"
  | "settlement_change"
  | "gap_future"
  | "forecast_variance"
  | "service_variance";

export interface MoneyFact extends Cite {
  key: BudgetKey;
  /** The figure exactly as written in the paper ("£12.3 million", "4.5%"). */
  valueText: string;
  /** The figure worked out from valueText: pounds, or a percentage. */
  value: number;
  unit: "gbp" | "pct";
  /** The financial year it is for ("2026-27"), where it matters. */
  year: string | null;
  /** For a variance: an overspend ("over") or underspend ("under"). */
  direction: "over" | "under" | null;
  /** For a service's variance: the service, as the paper names it. */
  service: string | null;
  /** Set when valueText is a bare number from a table in £000 or £m (the page shows that heading). */
  scale: "thousands" | "millions" | null;
}

export interface MoneyContent {
  /** The year the budget is for, or the year being monitored ("2026-27"). */
  year: string | null;
  /** For monitoring: the point in the year ("Quarter 1", "Month 5"), as the paper says. */
  period: string | null;
  facts: MoneyFact[];
}

const MULTIPLIERS: Array<[RegExp, number]> = [
  [/^(bn|billion)$/i, 1e9],
  [/^(m|million|mil)$/i, 1e6],
  [/^(k|thousand)$/i, 1e3],
];

/**
 * A figure as written in a council paper, to a number: "£12.3m" is 12300000, "£1,234,567" is 1234567,
 * "£45k" is 45000, "4.5%" is 4.5, "(£2.1m)" is 2100000 (brackets give a sign the caller reads from the
 * direction). Anything else is null.
 */
export function parseFigure(text: string): { value: number; unit: "gbp" | "pct" } | null {
  const t = text.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
  const pct = t.match(/^[-+−]?\s*(\d+(?:\.\d+)?)\s*(%|per ?cent)$/i);
  if (pct) return { value: Number(pct[1]), unit: "pct" };
  const m = t.match(/^[-+−]?\s*£\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*([a-z]+)?$/i);
  if (!m) return null;
  const whole = Number(m[1].replace(/,/g, ""));
  const value = m[2] ? Number(`${whole}.${m[2]}`) : whole;
  if (!m[3]) return { value, unit: "gbp" };
  const mult = MULTIPLIERS.find(([re]) => re.test(m[3]))?.[1];
  return mult ? { value: Math.round(value * mult), unit: "gbp" } : null;
}
