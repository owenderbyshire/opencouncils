import { sql, type SQL } from "drizzle-orm";

/**
 * One honest status for a planning application, used everywhere: lists,
 * application pages, the Wales page, the league table, alerts and the
 * digest. PlanIt's `app_state` alone isn't enough: some registers (Eryri's
 * recent records, for example) say "Permitted" with no decision date and no
 * decision text, which we can't call a decision.
 *
 *   approved   the register shows a decision (a decision date or decision
 *              text) and the state is Permitted or Conditions
 *   refused    the same, with the state Rejected
 *   decided    a decision date, but some other state
 *   withdrawn  Withdrawn
 *   referred   Referred (decided elsewhere, usually by the Welsh Ministers)
 *   waiting    Undecided, with no decision date
 *   unknown    anything else: a blank state, Unresolved, or Permitted with no date or text
 *
 * `planningStatus` and `planningStatusSql` must give the same answer; the
 * tests check the TypeScript one.
 */

export type PlanningStatus = "approved" | "refused" | "decided" | "withdrawn" | "referred" | "waiting" | "unknown";

/** Statuses that mean the council has made its decision. */
export const DECIDED_STATUSES = ["approved", "refused", "decided"] as const satisfies readonly PlanningStatus[];

export interface StatusInput {
  appState: string | null;
  decidedDate: string | null;
  decision: string | null;
}

const blank = (s: string | null) => !s || !s.trim();

export function planningStatus({ appState, decidedDate, decision }: StatusInput): PlanningStatus {
  const state = (appState ?? "").trim();
  if (state === "Withdrawn") return "withdrawn";
  if (state === "Referred") return "referred";
  const shown = !blank(decidedDate) || !blank(decision);
  if (shown && (state === "Permitted" || state === "Conditions")) return "approved";
  if (shown && state === "Rejected") return "refused";
  if (!blank(decidedDate)) return "decided";
  if (state === "Undecided") return "waiting";
  return "unknown";
}

export const isDecided = (s: PlanningStatus) => (DECIDED_STATUSES as readonly string[]).includes(s);

/**
 * The same as `planningStatus`, in SQL, for the planning_applications table
 * under `alias` (or unqualified when alias is empty).
 */
export function planningStatusSql(alias = "p"): SQL {
  const c = (name: string) => sql.raw(alias ? `${alias}.${name}` : name);
  const state = sql`trim(coalesce(${c("app_state")}, ''))`;
  const shown = sql`(${c("decided_date")} is not null or coalesce(trim(${c("decision")}), '') <> '')`;
  return sql`(case
    when ${state} = 'Withdrawn' then 'withdrawn'
    when ${state} = 'Referred' then 'referred'
    when ${shown} and ${state} in ('Permitted', 'Conditions') then 'approved'
    when ${shown} and ${state} = 'Rejected' then 'refused'
    when ${c("decided_date")} is not null then 'decided'
    when ${state} = 'Undecided' then 'waiting'
    else 'unknown' end)`;
}

/** Developments of National Significance: references ending /DNS. The Welsh Ministers decide them, not the council. */
export const isDnsReference = (ref: string | null) => !!ref && /\/dns\s*$/i.test(ref);

export function dnsSql(alias = "p"): SQL {
  return sql`coalesce(${sql.raw(alias ? `${alias}.reference` : "reference")}, '') ~* '/dns\\s*$'`;
}

/** The register says a planning committee made the decision. */
export const decidedByCommittee = (decidedBy: string | null) =>
  !!decidedBy && /committee|pwyllgor/i.test(decidedBy) && !/decision to be made by officer/i.test(decidedBy);

export function committeeDecidedSql(alias = "p"): SQL {
  const c = sql.raw(alias ? `${alias}.decided_by` : "decided_by");
  return sql`(coalesce(${c}, '') ~* '(committee|pwyllgor)' and coalesce(${c}, '') !~* 'decision to be made by officer')`;
}

/** Application types left out of every league measure: they are nearly always granted, or aren't new proposals. */
export const LEAGUE_EXCLUDED_TYPES = ["Conditions", "Trees", "Amendment", "Other"];

/** Whole days from received to decided, or null when either is missing or the decision comes first. */
export function durationDays(received: string | null, decided: string | null): number | null {
  if (!received || !decided) return null;
  const a = Date.parse(`${received.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${decided.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const days = Math.round((b - a) / 86_400_000);
  return days >= 0 ? days : null;
}

/** The median, as Postgres's percentile_cont(0.5) gives it: the mean of the middle two for an even count. Null for none. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Days applications are given to settle before the league counts them. */
export const SETTLE_DAYS = 91;
/** The league looks back at most a year from the end of its window. */
export const LEAGUE_MAX_DAYS = 365;
/** The first fetch of an authority goes back this far (pipeline/jobs/planning.ts). */
export const FIRST_FETCH_DAYS = 183;
/** An authority needs at least eight weeks of settled applications to be in the league. */
export const MIN_WINDOW_DAYS = 56;
/** And at least this many decided applications with dates. */
export const MIN_DECIDED = 30;

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * The applications an authority's league figures are based on: those
 * received from the day its collection began (so nothing is missing) to
 * SETTLE_DAYS before today (so each has had time to be decided), and at most
 * a year. Null when there's no collection start.
 */
export function leagueWindow(collectionStart: string | null, today: string): { from: string; to: string; days: number } | null {
  if (!collectionStart) return null;
  const to = addDays(today, -SETTLE_DAYS);
  const earliest = addDays(to, -LEAGUE_MAX_DAYS);
  const from = collectionStart > earliest ? collectionStart : earliest;
  return { from, to, days: Math.max(0, daysBetween(from, to) + 1) };
}

export type LeagueExclusion = "noData" | "stale" | "short" | "fewDecided" | "datesMissing";

export interface LeagueCheck {
  /** Applications counted at all (null when the authority has no data). */
  received: number | null;
  stale: boolean;
  windowDays: number;
  /** Decided, with both dates. */
  decided: number;
  /** Applications that should have an outcome by now: everything except those still waiting, withdrawn or referred. */
  settled: number;
}

/** Why an authority isn't in the league, or null when it is. */
export function leagueExclusion(r: LeagueCheck): LeagueExclusion | null {
  if (r.received === null) return "noData";
  if (r.stale) return "stale";
  if (r.windowDays < MIN_WINDOW_DAYS) return "short";
  if (r.decided < MIN_DECIDED) return "fewDecided";
  // The register shows no dated decision for more than one in seven
  // applications that should have one: those left out may not be typical, so
  // the time measures could be skewed.
  if (r.decided < r.settled * 0.85) return "datesMissing";
  return null;
}
