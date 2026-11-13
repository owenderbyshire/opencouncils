/**
 * A nightly check of the figures the site shows. Reads the database only (no
 * API calls, nothing written except the run's own record) and fails the run,
 * so the owner hears about it, when a figure breaks a rule:
 *
 * - official percentages between 0 and 100, shares between 0 and 1, and no
 *   figures for periods that haven't started;
 * - no meeting dated more than two years ahead (a misread date would show as
 *   the "next" meeting for years);
 * - the search index holds every agenda item, so counts by topic match the
 *   councils' records;
 * - a summary that reports decisions only where the meeting has minutes;
 * - summaries whose English and Welsh carry the same number of sentences;
 * - every active council has held a meeting in the last 30 days (45 over
 *   the summer break). A council with none has usually moved its ModernGov
 *   site or started refusing the pipeline, and the daily run only warns
 *   about that, so this fails the run outright;
 * - a council's web pages that were read before (its executive posts, its
 *   list of forthcoming decisions) have been read in full in the last four
 *   days. The site stops showing them after one or two weeks without a read.
 *
 *   pnpm pipeline checks
 */
import { sql } from "drizzle-orm";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { MEASURES } from "../../data/curated/performance";
import { summaryMismatches, type MeetingSummaryContent } from "../../src/lib/summary";
import { measureProblems } from "../lib/checks";
import { PartialFailure, type Job } from "../lib/job";
import type { PerformanceData } from "./performance";

/** Today's date in the UK, as YYYY-MM-DD. */
function ukToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

export const checksJob: Job = {
  name: "checks",
  description: "Checks the site's figures against simple rules (no API cost)",
  async run(ctx) {
    const problems: string[] = [];
    const today = ukToday();

    const perf = await ctx.getState<PerformanceData>("performance");
    for (const m of MEASURES) {
      const held = perf?.measures[m.key];
      if (!held) continue;
      const found = measureProblems(m.key, m.unit, { ...held.councils, wales: held.wales }, today);
      ctx.count("measuresChecked");
      problems.push(...found.slice(0, 5));
    }

    const [ahead] = await ctx.db.execute<{ n: number }>(
      sql`select count(*)::int as n from meetings where date > ${today}::date + interval '2 years'`,
    );
    if (Number(ahead?.n)) problems.push(`${ahead.n} meetings are dated more than two years ahead`);

    // Agenda items the last full index run should have picked up: those of meetings read before it started,
    // with the index's own rules (not cancelled, not restricted). Items read since then wait for the next run.
    const [index] = await ctx.db.execute<{ items: number; indexed: number }>(sql`
      with last as (select max(started_at) as at from pipeline_runs where job = 'index' and status = 'ok')
      select
        (select count(*)::int from agenda_items a join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
          where not m.cancelled and not a.is_restricted and m.detail_fetched_at < (select at from last)
            and a.council_id in (select distinct council_id from search_items)) as items,
        (select count(*)::int from search_items i join meetings m on m.council_id = i.council_id and m.id = i.meeting_id
          where m.detail_fetched_at < (select at from last)) as indexed
    `);
    ctx.stats.agendaItems = Number(index?.items ?? 0);
    ctx.stats.indexed = Number(index?.indexed ?? 0);
    if (index && Number(index.indexed) < Number(index.items))
      problems.push(`the search index is missing ${Number(index.items) - Number(index.indexed)} agenda items from meetings read before it was last built`);

    const [unminuted] = await ctx.db.execute<{ n: number }>(sql`
      select count(*)::int as n from summaries s
      where coalesce(s.content->>'mode', 'minutes') = 'minutes'
        and exists (select 1 from jsonb_array_elements(s.content->'items') i where coalesce(i->>'decidedEn', '') <> '')
        and not exists (select 1 from agenda_items a where a.council_id = s.council_id and a.meeting_id = s.meeting_id and a.minutes is not null)
    `);
    if (Number(unminuted?.n)) problems.push(`${unminuted.n} summaries report decisions for meetings with no minutes`);

    // English and Welsh out of step: counted and reported, but not a failure, since repairing them costs money.
    const stored = await ctx.db.execute<{ councilId: string; meetingId: number; content: MeetingSummaryContent }>(
      sql`select council_id as "councilId", meeting_id as "meetingId", content from summaries`,
    );
    const mismatched = stored.filter((s) => summaryMismatches(s.content).length);
    ctx.count("summariesChecked", stored.length);
    ctx.count("summariesMismatched", mismatched.length);
    if (mismatched.length)
      ctx.warn(
        `${mismatched.length} summaries have English and Welsh out of step (for example ${mismatched
          .slice(0, 3)
          .map((s) => `${s.councilId} ${s.meetingId}`)
          .join(", ")}); see "summaries --repair --dry-run"`,
      );

    // Web pages read before that can no longer be read: the site leaves them out after a week or two (src/data/cabinets.ts,
    // src/data/forward-plans.ts), so the owner should hear before then.
    const unread = await ctx.db.execute<{ council: string; source: string; last: string; outcome: string }>(sql`
      select council_id as council, source, (read_at at time zone 'Europe/London')::date::text as last, outcome
      from source_reads where read_at is not null and read_at < now() - interval '4 days' order by 1, 2
    `);
    ctx.count("pagesUnread", unread.length);
    for (const u of unread) problems.push(`${u.council}: its ${u.source} pages were last read in full on ${u.last} (the last look: ${u.outcome})`);

    // Active councils with no meeting held lately: a site that has moved or blocks the pipeline (Anglesey, November 2026)
    // leaves the daily run succeeding with a warning, so this is a failure, not a problem to warn about.
    const summer = /-(08-\d\d|09-0\d|09-1[0-4])$/.test(today);
    const days = summer ? 45 : 30;
    const ids = ACTIVE_COUNCILS.map((c) => c.id);
    const quiet = await ctx.db.execute<{ council: string; last: string | null }>(sql`
      select c.id as council, (select max(m.date)::text from meetings m where m.council_id = c.id and m.date <= ${today}::date and not m.cancelled) as last
      from unnest(string_to_array(${ids.join(",")}, ',')) as c(id)
      where not exists (
        select 1 from meetings m where m.council_id = c.id and not m.cancelled and m.date between ${today}::date - ${days}::int and ${today}::date)
    `);
    ctx.count("quietCouncils", quiet.length);

    ctx.count("problems", problems.length);
    for (const p of problems) ctx.warn(p);
    if (quiet.length)
      throw new Error(
        `No meetings in the last ${days} days for ${quiet.map((q) => `${q.council} (last ${q.last ?? "never"})`).join(", ")}: check each council's ModernGov address and the relay${problems.length ? `; also ${problems.length} figure problems` : ""}`,
      );
    if (problems.length) throw new PartialFailure(`Figure checks found ${problems.length} problems: ${problems.slice(0, 5).join("; ")}`);
  },
};
