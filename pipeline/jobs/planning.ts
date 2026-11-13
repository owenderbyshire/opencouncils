/**
 * Planning applications for Wales's 25 planning authorities, from UK PlanIt
 * (pipeline/sources/planit.ts). PlanIt asks for about one request a minute,
 * so the job waits a minute between requests, spends about 30 a run (three runs a day), and asks only for what has
 * changed since its last run. The first run for an authority goes back six
 * months. Afterwards it links applications to the planning committee items
 * whose titles or text give their reference.
 *
 *   pnpm pipeline planning [--authority cardiff] [--days 30]
 */
import { sql } from "drizzle-orm";
import { PLANNING_AUTHORITIES } from "../../data/curated/planning-authorities";
import { planningApplications } from "../../src/db/schema";
import { fetchJson } from "../lib/http";
import type { Job, JobContext } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import {
  PAGE,
  applicsUrl,
  matchAreas,
  PLANIT,
  toApplication,
  type PlanitArea,
} from "../sources/planit";

const MINUTE = 61_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlanningState {
  /** Our authority id to PlanIt's area name and id. */
  areas: Record<
    string,
    { name: string; id: number; maxDate: string | null; scraper: string | null }
  >;
  /** When each authority was last fetched successfully. */
  fetched: Record<string, string>;
  /** Where an unfinished first fetch reached, to carry on from next run. */
  cursor?: Record<string, string>;
}

export const planningJob: Job = {
  name: "planning",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "planning_applications" }, { table: "pipeline_state", where: "key = 'planning-coverage'", expr: "value::text" }],
    },
  ],
  description:
    "Planning applications for all 25 Welsh planning authorities, from UK PlanIt",
  async run(ctx) {
    const state: PlanningState = (await ctx.getState<PlanningState>(
      "planning",
    )) ?? { areas: {}, fetched: {} };
    const problems: string[] = [];

    // PlanIt's names for our authorities, looked up once a week.
    const areasAge = await ctx.getState<string>("planning-areas-at");
    if (
      !areasAge ||
      Date.now() - Date.parse(areasAge) > 7 * 86_400_000 ||
      Object.keys(state.areas).length < 15
    ) {
      const r = await fetchJson<{ records?: PlanitArea[] }>(
        `${PLANIT}/api/areas/json?pg_sz=1000&select=area_id,area_name,long_name,area_type,scraper_type,max_date`,
        { retries: 0, timeoutMs: 60_000 },
      );
      if (r.ok && r.data.records?.length) {
        const matched = matchAreas(r.data.records);
        state.areas = Object.fromEntries(
          [...matched].map(([id, a]) => [
            id,
            {
              name: a.area_name,
              id: a.area_id,
              maxDate: a.max_date ?? null,
              scraper: a.scraper_type ?? null,
            },
          ]),
        );
        await ctx.setState("planning-areas-at", new Date().toISOString());
        await ctx.setState("probe:planit-areas", {
          at: new Date().toISOString(),
          matched: state.areas,
          unmatched: PLANNING_AUTHORITIES.filter((a) => !matched.has(a.id)).map(
            (a) => a.id,
          ),
          welshLooking: r.data.records
            .filter((x) =>
              /wales|cymru|anglesey|gwynedd|conwy|powys|glamorgan|brecon|snowdon|eryri|pembroke|carmarthen|ceredigion|swansea|cardiff|newport|caerphilly|torfaen|merthyr|rhondda|bridgend|neath|monmouth|blaenau|wrexham|flint|denbigh/i.test(
                `${x.area_name} ${x.long_name ?? ""}`,
              ),
            )
            .slice(0, 80),
        });
        await sleep(MINUTE);
      } else problems.push(`areas: ${r.ok ? "no records" : r.error}`);
    }

    const only = argString(ctx.args, "authority");
    const forcedDays = argNumber(ctx.args, "days");
    // PlanIt allows about 300 requests a day. Each run spends a share of that
    // (PLANNING_BUDGET, set by the once-a-day schedule, or 30),
    // oldest-fetched authorities first, and the next run carries on.
    const budget = argNumber(ctx.args, "budget") ?? (Number(process.env.PLANNING_BUDGET) || 30);
    let calls = 0;
    let rateLimited = false;
    const call = async (url: string) => {
      if (calls++ > 0) await sleep(MINUTE);
      const r = await fetchJson<{ records?: Array<Record<string, unknown>>; total?: number }>(url, { retries: 0, timeoutMs: 90_000 });
      if (!r.ok && /429/.test(r.error)) rateLimited = true;
      return r;
    };
    state.cursor ??= {};
    const authorities = PLANNING_AUTHORITIES.filter((x) => !only || x.id === only).sort((x, y) =>
      (state.fetched[x.id] ?? "").localeCompare(state.fetched[y.id] ?? ""),
    );
    for (const a of authorities) {
      if (calls >= budget || rateLimited) break;
      const area = state.areas[a.id];
      if (!area) {
        problems.push(`${a.id}: not found in PlanIt's list of areas`);
        continue;
      }
      const startedAt = new Date().toISOString();
      const apps: NonNullable<ReturnType<typeof toApplication>>[] = [];
      const take = (records: Array<Record<string, unknown>>) => {
        for (const x of records) {
          const app = toApplication(a, x);
          if (app) apps.push(app);
        }
      };
      // Every page of one query, PAGE at a time. Returns an error, or null when complete.
      const all = async (param: Record<string, string | number>): Promise<string | null> => {
        for (let page = 1; page <= 20; page++) {
          if (calls >= budget || rateLimited) return "out of requests for this run";
          const r = await call(applicsUrl(area.name, { ...param, page }));
          if (!r.ok) return r.error;
          const records = r.data.records ?? [];
          take(records);
          if (records.length < PAGE) return null;
        }
        return null;
      };

      const last = state.fetched[a.id];
      let failed: string | null = null;
      if (last && !forcedDays && !state.cursor[a.id]) {
        // Up to date: ask for what changed since the last run, with two days' overlap.
        const days = Math.min(60, Math.ceil((Date.now() - Date.parse(last)) / 86_400_000) + 2);
        failed = await all({ changed: days });
        if (failed && /HTTP 400/.test(failed)) {
          // Too heavy for PlanIt: fall back to what was received in that time, a week at a time.
          failed = null;
          for (let from = -days; from <= 0 && !failed; from += 7)
            failed = await all({ start_date: isoDay(from), end_date: isoDay(Math.min(0, from + 6)) });
          if (!failed) ctx.count(`${a.id} changed-fallback`);
        }
        if (!failed) state.fetched[a.id] = startedAt;
      } else {
        // First fetch (or --days): a week at a time from the cursor, so big authorities stay under PlanIt's time limit.
        const from = forcedDays ? isoDay(-forcedDays) : (state.cursor[a.id] ?? isoDay(-183));
        // The first day from which we hold every application (src/data/planning.ts reads this for the league).
        if (!forcedDays && !state.cursor[a.id]) {
          const coverage = (await ctx.getState<Record<string, string>>("planning-coverage")) ?? {};
          if (!coverage[a.id]) {
            coverage[a.id] = from;
            await ctx.setState("planning-coverage", coverage);
          }
        }
        let cursor = from;
        while (cursor <= isoDay(0) && !failed) {
          const end = addDaysIso(cursor, 6);
          let err = await all({ start_date: cursor, end_date: end });
          if (err && /HTTP 400/.test(err)) {
            // Still too heavy: one day at a time for that week.
            err = null;
            for (let d = cursor; d <= end && !err; d = addDaysIso(d, 1)) err = await all({ start_date: d, end_date: d });
          }
          if (err) failed = err;
          else cursor = addDaysIso(end, 1);
        }
        if (failed) state.cursor[a.id] = cursor;
        else {
          delete state.cursor[a.id];
          state.fetched[a.id] = startedAt;
        }
      }
      await saveApplications(ctx, apps);
      if (failed && failed !== "out of requests for this run") problems.push(`${a.id}: ${failed}`);
      ctx.count("applications", apps.length);
      ctx.log(`${a.id}: ${apps.length} applications${failed ? ` (${failed})` : ""}`);
    }
    ctx.count("requests", calls);
    if (rateLimited) ctx.warn("PlanIt asked us to slow down; the next run carries on");
    await ctx.setState("planning", state);

    // Link applications to the planning committee items that name their reference.
    const linked = await ctx.db.execute<{ n: number }>(sql`
      with hits as (
        select distinct on (p.id) p.id, i.council_id, i.meeting_id, i.id as item_id
        from planning_applications p
        join agenda_items i on i.council_id = p.authority
        join meetings m on m.council_id = i.council_id and m.id = i.meeting_id
        join committees c on c.council_id = m.council_id and c.id = m.committee_id and c.kind = 'planning'
        where p.reference is not null and length(p.reference) >= 6 and p.agenda_item_id is null
          and m.date >= coalesce(p.start_date, '2000-01-01')
          and strpos(upper(i.title || ' ' || coalesce(left(i.agenda_text, 4000), '')), upper(p.reference)) > 0
        order by p.id, m.date desc
      )
      update planning_applications p set council_id = h.council_id, meeting_id = h.meeting_id, agenda_item_id = h.item_id
      from hits h where p.id = h.id
      returning 1 as n
    `);
    ctx.count("linkedToCommittee", [...linked].length);
    await ctx.setState("probe:planit-problems", {
      at: new Date().toISOString(),
      problems,
    });
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};

/**
 * Inserts or updates applications by name. With `fill`, a value the new row lacks keeps the one already held,
 * so a second source (an Idox register) adds to PlanIt's rows without blanking what PlanIt gave.
 */
export async function saveApplications(ctx: JobContext, apps: NonNullable<ReturnType<typeof toApplication>>[], opts: { fill?: boolean } = {}) {
  for (const batch of chunks(apps, 200)) {
    await ctx.db
      .insert(planningApplications)
      .values(batch)
      .onConflictDoUpdate({
        target: planningApplications.name,
        set: {
          reference: opts.fill ? sql.raw("coalesce(excluded.reference, planning_applications.reference)") : sql`excluded.reference`,
          address: opts.fill ? sql.raw("coalesce(excluded.address, planning_applications.address)") : sql`excluded.address`,
          postcode: opts.fill ? sql.raw("coalesce(excluded.postcode, planning_applications.postcode)") : sql`excluded.postcode`,
          description: opts.fill ? sql.raw("coalesce(excluded.description, planning_applications.description)") : sql`excluded.description`,
          appType: opts.fill ? sql.raw("coalesce(excluded.app_type, planning_applications.app_type)") : sql`excluded.app_type`,
          appState: opts.fill ? sql.raw("coalesce(excluded.app_state, planning_applications.app_state)") : sql`excluded.app_state`,
          appSize: opts.fill ? sql.raw("coalesce(excluded.app_size, planning_applications.app_size)") : sql`excluded.app_size`,
          startDate: opts.fill ? sql.raw("coalesce(excluded.start_date, planning_applications.start_date)") : sql`excluded.start_date`,
          consultedDate: opts.fill ? sql.raw("coalesce(excluded.consulted_date, planning_applications.consulted_date)") : sql`excluded.consulted_date`,
          decidedDate: opts.fill ? sql.raw("coalesce(excluded.decided_date, planning_applications.decided_date)") : sql`excluded.decided_date`,
          targetDate: opts.fill ? sql.raw("coalesce(excluded.target_date, planning_applications.target_date)") : sql`excluded.target_date`,
          decision: opts.fill ? sql.raw("coalesce(excluded.decision, planning_applications.decision)") : sql`excluded.decision`,
          decidedBy: opts.fill ? sql.raw("coalesce(excluded.decided_by, planning_applications.decided_by)") : sql`excluded.decided_by`,
          ward: opts.fill ? sql.raw("coalesce(excluded.ward, planning_applications.ward)") : sql`excluded.ward`,
          homes: opts.fill ? sql.raw("coalesce(excluded.homes, planning_applications.homes)") : sql`excluded.homes`,
          lat: opts.fill ? sql.raw("coalesce(excluded.lat, planning_applications.lat)") : sql`excluded.lat`,
          lng: opts.fill ? sql.raw("coalesce(excluded.lng, planning_applications.lng)") : sql`excluded.lng`,
          url: opts.fill ? sql.raw("coalesce(excluded.url, planning_applications.url)") : sql`excluded.url`,
          docsUrl: opts.fill ? sql.raw("coalesce(excluded.docs_url, planning_applications.docs_url)") : sql`excluded.docs_url`,
          commentUrl: opts.fill ? sql.raw("coalesce(excluded.comment_url, planning_applications.comment_url)") : sql`excluded.comment_url`,
          planitLink: opts.fill ? sql.raw("coalesce(excluded.planit_link, planning_applications.planit_link)") : sql`excluded.planit_link`,
          lastChanged: sql`excluded.last_changed`,
          updatedAt: sql`now()`,
        },
      });
  }
}

function addDaysIso(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The date n days from today, as YYYY-MM-DD. */
function isoDay(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size)
    out.push(items.slice(i, i + size));
  return out;
}
