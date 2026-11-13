/**
 * Named job sequences. Kept free of imports and side effects so the website
 * can show the nightly order without loading the CLI.
 */
export const DAILY_SEQUENCE = [
  // OpenCouncils (UK): the meetings core only. The Welsh site's extra jobs
  // (planning, LDPs, StatsWales figures, consultations, Welsh fixes, by-elections
  // from Open Council Data, AI briefs) stay in the code but out of the nightly run.
  "seed",
  "committees",
  "councillors",
  "meetings",
  "meeting-details",
  "vale",
  "executive-posts",
  "forward-plans",
  "summaries",
  "index",
  "watchdogs",
  "alerts",
  "digest",
  "checks",
] as const;
