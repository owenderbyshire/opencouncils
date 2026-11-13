/**
 * Fills in each council's meeting history back five years, to November 2021,
 * one council per run, so the regular schedule never has to. Runs every six
 * hours from its own schedule; a council is marked done only when both its
 * meetings and their details have been read.
 *
 * A council the pipeline reaches only through the website's relay
 * (src/lib/relay-hosts.ts) is read a quarter at a time instead, newest
 * first, one quarter a run, so years of meetings and their papers never go
 * through the relay at once: five years take about five days. Its progress
 * is kept as the earliest date read.
 *
 *   pnpm pipeline history [--council cardiff]
 */
import { sql } from "drizzle-orm";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { PIPELINE_RELAY_HOSTS } from "../../src/lib/relay-hosts";
import { PartialFailure, type Job, type JobContext } from "../lib/job";
import { addDays, today } from "../lib/util";
import { meetingDetailsJob, meetingsJob } from "./meetings";

export const HISTORY_FROM = "2021-11-01";
/** Progress marker. Renamed when HISTORY_FROM moved back from May 2022, so every council is read again. */
const DONE_KEY = "history-done-2021-11";
/** How much of a relayed council's history one run reads. */
export const RELAY_WINDOW_DAYS = 92;
const relayKey = (council: string) => `history-relay-${council}`;

/** Whether the pipeline reaches this council's ModernGov site only through the relay. */
export function throughRelay(c: { moderngovBase?: string | null }): boolean {
  try {
    return Boolean(c.moderngovBase) && PIPELINE_RELAY_HOSTS.has(new URL(c.moderngovBase!).host);
  } catch {
    return false;
  }
}

/** The next quarter to read, ending the day before the earliest date read, or null when the history reaches HISTORY_FROM. */
export function nextRelayWindow(reached: string, from = HISTORY_FROM, days = RELAY_WINDOW_DAYS): { from: string; to: string } | null {
  if (reached <= from) return null;
  const start = addDays(reached, -days);
  return { from: start < from ? from : start, to: addDays(reached, -1) };
}

/** Runs the calendar and the details for one council over one window; some meetings or papers failing still counts as read. */
async function readWindow(ctx: JobContext, council: string, from: string, to?: string): Promise<PartialFailure | null> {
  const args = ctx.args;
  ctx.args = { ...args, council, from, ...(to ? { to } : {}) };
  let partial: PartialFailure | null = null;
  try {
    for (const job of [meetingsJob, meetingDetailsJob]) {
      try {
        await job.run(ctx);
      } catch (err) {
        if (err instanceof PartialFailure) partial = err;
        else throw err;
      }
    }
  } finally {
    ctx.args = args;
  }
  return partial;
}

export const historyJob: Job = {
  name: "history",
  description: "Meeting history back to November 2021, one council per run",
  async run(ctx) {
    const done = new Set((await ctx.getState<string[]>(DONE_KEY)) ?? []);
    // Councils whose history is already in (for example from a manual backfill) count as done.
    const have = await ctx.db.execute<{ council: string }>(sql`
      select council_id as council from meetings where date < ${"2022-03-01"}::date group by council_id having count(*) >= 20
    `);
    const held = new Set<string>();
    for (const r of have) {
      done.add(r.council);
      held.add(r.council);
    }
    const forced = typeof ctx.args.council === "string" ? ctx.args.council : null;

    // A relayed council whose history is not yet held: one more quarter, newest first.
    const relayed = ACTIVE_COUNCILS.filter((c) => throughRelay(c) && !held.has(c.id) && (!forced || c.id === forced));
    for (const c of relayed) {
      let reached = await ctx.getState<string>(relayKey(c.id));
      if (!reached) {
        // Where the regular runs have got to: the earliest meeting held, or four weeks back when there is none.
        const [row] = await ctx.db.execute<{ d: string | null }>(sql`select min(date)::text as d from meetings where council_id = ${c.id}`);
        reached = row?.d ?? addDays(today(), -28);
      }
      const w = nextRelayWindow(reached);
      if (!w) continue;
      ctx.log(`${c.id}: reading meetings from ${w.from} to ${w.to}, through the relay, a quarter at a time`);
      const partial = await readWindow(ctx, c.id, w.from, w.to);
      await ctx.setState(relayKey(c.id), w.from);
      ctx.count("relayQuarters");
      if (partial) throw partial;
      return;
    }
    if (forced && relayed.some((c) => c.id === forced)) {
      ctx.log(`${forced}: history held back to ${HISTORY_FROM}`);
      return;
    }

    const next = forced ?? ACTIVE_COUNCILS.find((c) => !done.has(c.id) && !throughRelay(c))?.id;
    if (!next) {
      ctx.log("every council's history is in");
      await ctx.setState(DONE_KEY, [...done]);
      return;
    }
    ctx.log(`${next}: reading meetings since ${HISTORY_FROM}`);
    // Some documents or meetings failing doesn't stop the history counting as read.
    const partial = await readWindow(ctx, next, HISTORY_FROM);
    done.add(next);
    await ctx.setState(DONE_KEY, [...done]);
    ctx.count("councilsDone", done.size);
    if (partial) throw partial;
  },
};
