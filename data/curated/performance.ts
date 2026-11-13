/**
 * How each council is doing: official statistics from StatsWales, matched
 * on the labels the StatsWales site shows. Checked against each dataset on
 * 27 October 2026. `better` says which way is good; measures without one are
 * shown for context and never ranked.
 */
/** Themes in the order they're shown. */
/**
 * Figures the Welsh Government carried forward from the year before because
 * a council didn't submit, by measure and period start year. They are shown
 * with a note and left out of rankings and changes.
 * Homelessness 2025-26: the Vale of Glamorgan couldn't submit (https://www.gov.wales/node/77690).
 */
export const CARRIED_FORWARD: Record<string, Record<string, string[]>> = {
  "homelessness-prevented": { "2025": ["vale-of-glamorgan"] },
  "homelessness-relieved": { "2025": ["vale-of-glamorgan"] },
  "temporary-accommodation": { "2025": ["vale-of-glamorgan"] },
};

export const THEMES = ["housing", "homes", "schools", "children", "social-care", "roads", "planning", "money", "democracy"] as const;
export type Theme = (typeof THEMES)[number];

export interface Measure {
  key: string;
  theme: Theme;
  dataset: string;
  /** Every label a row must carry, lower case, as StatsWales writes them. */
  labels: string[];
  unit: "percent" | "count" | "rate" | "share" | "money";
  /** Multiply published figures by this, for example 1,000 for figures in £ thousand. */
  scale?: number;
  /** Another row to add to `labels`, period by period, for totals the table splits in two. */
  plus?: string[];
  /** Divide by the area's population and multiply by this, for example 10,000 for "per 10,000 people". */
  per?: number;
  /**
   * For a rate the publisher has already worked out (so nothing is divided
   * here): per how many of whom, for the label, as in "134 per 10,000 children".
   */
  publishedPer?: { n: number; of: "children" };
  /** A share worked out from two published counts: these labels for the top line, `labels` for the bottom. */
  numerator?: string[];
  better: "higher" | "lower" | null;
  /** How often the figure is published. */
  frequency: "year" | "month";
  /**
   * The fewest councils with figures for the measure to be updated (20 unless
   * set). Lower for series some councils don't report: those councils show no
   * figure.
   */
  minCouncils?: number;
}

/**
 * Measures whose figures can't fairly be set side by side between councils
 * (police forces record serious injuries differently), so no council's figure
 * is shown beside Wales's or another council's.
 */
export const NOT_COMPARED = new Set(["road-casualties"]);

export const MEASURES: Measure[] = [
  {
    key: "homelessness-prevented",
    theme: "housing",
    dataset: "e856209f-09d4-4e98-824c-19c101813f67",
    labels: ["percentage (%)", "successful prevention - eligible, threatened with homelessness, prevention assistance provided (section 66)"],
    unit: "percent",
    better: "higher",
    frequency: "year",
  },
  {
    key: "homelessness-relieved",
    theme: "housing",
    dataset: "e856209f-09d4-4e98-824c-19c101813f67",
    labels: ["percentage (%)", "successfully relieved - eligible, homeless, subject to duty to help to secure (section 73)"],
    unit: "percent",
    better: "higher",
    frequency: "year",
  },
  {
    key: "temporary-accommodation",
    theme: "housing",
    dataset: "35713e0f-e755-4444-ab14-915d8d9432e1",
    labels: ["total number of homeless people temporarily accommodated", "total"],
    unit: "rate",
    per: 10_000,
    better: null,
    frequency: "month",
  },
  {
    key: "council-homes-built",
    theme: "homes",
    dataset: "60138097-1bda-4bde-8631-28b5f6a97764",
    labels: ["local authority new dwellings completed", "total"],
    unit: "count",
    better: null,
    frequency: "year",
  },
  {
    key: "homes-built",
    theme: "homes",
    dataset: "60138097-1bda-4bde-8631-28b5f6a97764",
    labels: ["total new dwellings completed", "total"],
    unit: "rate",
    per: 10_000,
    better: null,
    frequency: "year",
  },
  {
    key: "children-looked-after",
    theme: "children",
    dataset: "7c684fb9-452b-4ca5-9dee-1c4baec412ff",
    labels: ["children looked after at 31 march per 10,000 population aged under 18"],
    unit: "rate",
    publishedPer: { n: 10_000, of: "children" },
    better: null,
    frequency: "year",
  },
  {
    key: "welsh-medium-year-1",
    theme: "schools",
    dataset: "73c5b701-f2ae-4ba2-8763-26edfcd03978",
    labels: ["percentage of pupils taught welsh as a first language", "year group 1"],
    unit: "percent",
    better: null,
    frequency: "year",
  },
  {
    key: "secondary-attendance",
    theme: "schools",
    dataset: "c12083b4-a874-45d4-bf25-0653f5564223",
    labels: ["percentage of possible half-day sessions attended"],
    unit: "percent",
    better: "higher",
    frequency: "year",
  },
  {
    key: "placement-moves",
    theme: "children",
    dataset: "d2270c0c-730a-46ef-a4ac-9d33d3ebc539",
    labels: ["percentage of children", "children with 3 or more placements during year"],
    unit: "percent",
    better: "lower",
    frequency: "year",
  },
  {
    key: "child-assessments-on-time",
    theme: "children",
    dataset: "4e6e2c82-3a7d-4abf-b19d-c475a24534cf",
    numerator: ["ch/012: number of new assessments completed for children during the year that were completed within statutory timescales"],
    labels: ["ch/006: number of new assessments completed for children during the year"],
    unit: "share",
    better: "higher",
    frequency: "year",
  },
  {
    key: "adult-assessment-waits",
    theme: "social-care",
    dataset: "403e5a3e-9fdb-448e-b4b8-c8140556011b",
    labels: ["adults waiting over 3 months for assessment"],
    unit: "rate",
    per: 10_000,
    better: "lower",
    frequency: "month",
    // Not every council reports this series to the Welsh Government.
    minCouncils: 15,
  },
  {
    key: "home-care-waits",
    theme: "social-care",
    dataset: "403e5a3e-9fdb-448e-b4b8-c8140556011b",
    labels: ["adults waiting over 3 months for domiciliary care"],
    unit: "rate",
    per: 10_000,
    better: "lower",
    frequency: "month",
    // Not every council reports this series to the Welsh Government.
    minCouncils: 15,
  },
  {
    key: "council-tax-collected",
    theme: "money",
    dataset: "04eb4d05-55ab-4c1c-80fa-627fa809fc14",
    labels: ["amount received as a percentage of total debit", "%", "in-year council tax"],
    unit: "percent",
    better: "higher",
    frequency: "year",
  },
  {
    key: "council-tax-unpaid",
    theme: "money",
    dataset: "04eb4d05-55ab-4c1c-80fa-627fa809fc14",
    labels: ["amounts outstanding at 31 march", "£ thousand", "in-year council tax"],
    unit: "money",
    scale: 1000,
    // More unpaid is worse, but bigger councils collect more tax, so the figure isn't scored.
    better: null,
    frequency: "year",
  },
  {
    key: "council-tax-arrears",
    theme: "money",
    dataset: "04eb4d05-55ab-4c1c-80fa-627fa809fc14",
    labels: ["amounts outstanding at 31 march", "£ thousand", "arrears of council tax"],
    unit: "money",
    scale: 1000,
    better: null,
    frequency: "year",
  },
  {
    key: "council-tax-written-off",
    theme: "money",
    dataset: "04eb4d05-55ab-4c1c-80fa-627fa809fc14",
    // The table splits write-offs between this year's tax and earlier years' arrears: the measure is both.
    labels: ["amounts written off during year", "£ thousand", "in-year council tax"],
    plus: ["amounts written off during year", "£ thousand", "arrears of council tax"],
    unit: "money",
    scale: 1000,
    better: null,
    frequency: "year",
  },
  {
    key: "business-rates-collected",
    theme: "money",
    dataset: "5eeb55b8-ba2b-44c6-8dca-282923028e1e",
    labels: ["ndr collection rate (%)", "%"],
    unit: "percent",
    better: "higher",
    frequency: "year",
  },
  {
    key: "road-casualties",
    theme: "roads",
    dataset: "2159ac9b-9672-4f09-80fd-e461f0efd5e1",
    labels: ["number of casualties", "ksi", "all roads", "total", "all users"],
    unit: "rate",
    per: 100_000,
    // Not ranked: police forces record "serious" injuries differently (see the note).
    better: null,
    frequency: "year",
  },
];
