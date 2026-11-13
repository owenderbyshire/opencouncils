/**
 * Older planning applications from UK PlanIt. The planning job's first fetch
 * went back six months; this works backwards from there to HISTORY_FROM, a
 * month at a time per authority, a few dozen requests a run, so that with the
 * planning job's own requests it stays within PlanIt's daily allowance. As
 * each month completes, the authority's coverage date (the first day from
 * which every application is held) moves back with it.
 *
 *   pnpm pipeline planning-history [--authority powys] [--budget 40]
 */
import { PLANNING_AUTHORITIES } from "../../data/curated/planning-authorities";
import { fetchJson } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import { PAGE, applicsUrl, toApplication } from "../sources/planit";
import { IDOX_AUTHORITIES } from "./idox";
import { saveApplications } from "./planning";

/** As far back as the meeting records go. */
export const HISTORY_FROM = "2021-11-01";
const MINUTE = 61_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

interface PlanningState {
  areas: Record<string, { name: string; id: number }>;
}

export const planningHistoryJob: Job = {
  name: "planning-history",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "planning_applications" }, { table: "pipeline_state", where: "key = 'planning-coverage'", expr: "value::text" }],
    },
  ],
  description: "Older planning applications from UK PlanIt, back to November 2021, a month at a time",
  async run(ctx) {
    const state = await ctx.getState<PlanningState>("planning");
    if (!state?.areas) {
      ctx.log("the planning job hasn't looked up PlanIt's areas yet");
      return;
    }
    const coverage = (await ctx.getState<Record<string, string>>("planning-coverage")) ?? {};
    const only = argString(ctx.args, "authority");
    const budget = argNumber(ctx.args, "budget") ?? 40;
    // Authorities PlanIt doesn't cover; the other Idox registers are read alongside PlanIt, which still gives their history.
    const idox = new Set<string>(IDOX_AUTHORITIES.filter((x) => x.only).map((x) => x.id));
    let calls = 0;
    let rateLimited = false;
    const problems: string[] = [];

    // Authorities with the most still to fetch go first.
    const todo = PLANNING_AUTHORITIES.filter((a) => (!only || a.id === only) && !idox.has(a.id) && state.areas[a.id] && coverage[a.id] && coverage[a.id] > HISTORY_FROM).sort(
      (x, y) => coverage[y.id].localeCompare(coverage[x.id]),
    );
    if (!todo.length) {
      ctx.log("every authority is held back to " + HISTORY_FROM);
      return;
    }

    for (const a of todo) {
      if (calls >= budget || rateLimited) break;
      const area = state.areas[a.id];
      const apps: NonNullable<ReturnType<typeof toApplication>>[] = [];
      const all = async (start: string, end: string): Promise<string | null> => {
        for (let page = 1; page <= 20; page++) {
          if (calls >= budget || rateLimited) return "out of requests";
          if (calls++ > 0) await sleep(MINUTE);
          const r = await fetchJson<{ records?: Array<Record<string, unknown>> }>(applicsUrl(area.name, { start_date: start, end_date: end, page }), {
            retries: 0,
            timeoutMs: 90_000,
          });
          if (!r.ok) {
            if (/429/.test(r.error)) rateLimited = true;
            return r.error;
          }
          const records = r.data.records ?? [];
          for (const x of records) {
            const app = toApplication(a, x);
            if (app) apps.push(app);
          }
          if (records.length < PAGE) return null;
        }
        return null;
      };

      // One month at a time, backwards; a week at a time if a month is too heavy for PlanIt.
      while (calls < budget && !rateLimited && coverage[a.id] > HISTORY_FROM) {
        const end = addDays(coverage[a.id], -1);
        const start = [addDays(end, -30), HISTORY_FROM].sort().pop()!;
        let err = await all(start, end);
        if (err && /HTTP 400/.test(err)) {
          err = null;
          for (let e = end; e >= start && !err; e = addDays(e, -7)) err = await all([addDays(e, -6), start].sort().pop()!, e);
        }
        if (err) {
          if (err !== "out of requests" && !rateLimited) problems.push(`${a.id} ${start} to ${end}: ${err}`);
          break;
        }
        await saveApplications(ctx, apps.splice(0));
        coverage[a.id] = start;
        await ctx.setState("planning-coverage", coverage);
        ctx.count(`${a.id} months`);
      }
      if (apps.length) ctx.count("unsaved", apps.length);
      ctx.log(`${a.id}: held from ${coverage[a.id]}`);
    }
    ctx.count("requests", calls);
    if (rateLimited) ctx.warn("PlanIt asked us to slow down; the next run carries on");
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
