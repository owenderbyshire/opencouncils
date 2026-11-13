/**
 * The shape of an official measure for "How it's doing". Councils are never
 * scored or ranked on these: each figure is shown with the figure for Wales.
 */
export interface MeasureValues {
  key: string;
  theme: string;
  better: "higher" | "lower" | null;
  unit: "percent" | "count" | "rate" | "share" | "days" | "money";
  /** For rates: per how many people. */
  per?: number;
  /** For rates per something other than people ("children"). */
  perOf?: "children";
  /** The period every council's figure is for, when they share one. */
  period: string | null;
  values: Record<string, number>;
  wales: number | null;
  history?: Record<string, Array<{ period: string; value: number }>>;
  /** The figure for Wales, period by period, up to `period`. */
  walesHistory?: Array<{ period: string; value: number }>;
  source?: string;
  /** "edau" when the publisher's figures were read through Edau's feed. */
  via?: "edau" | null;
  /** Extra text for one council, such as "40 of 52 applications". */
  detail?: Record<string, string>;
  /** Councils whose figure for this period is last year's, carried forward because they didn't submit. */
  estimated?: string[];
}
