/**
 * Planning applications read directly from Idox Public Access registers, for
 * authorities UK PlanIt doesn't cover, and alongside PlanIt for those whose
 * registers answer us (pipeline/sources/idox.ts). Each run reads the newest
 * weekly lists of validated applications (up to six months of weeks on the
 * first run), then each new application's pages, and rechecks undecided
 * applications so decisions arrive. Rows use PlanIt's names
 * ("Monmouthshire/DM/2026/01257") so the two sources never duplicate, and a
 * value the register lacks keeps the one PlanIt gave.
 *
 *   pnpm pipeline idox [--authority monmouthshire] [--weeks 3]
 */
import { sql } from "drizzle-orm";
import { planningApplications } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job, type JobContext } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import type { Application } from "../sources/planit";
import {
  idoxAppState,
  idoxAppType,
  idoxCsrf,
  idoxDate,
  idoxWeeks,
  parseIdoxResults,
  parseIdoxTable,
  postcodeIn,
  type IdoxListItem,
} from "../sources/idox";
import { saveApplications } from "./planning";

/**
 * Registers read directly. `planitName` is the authority's PlanIt area name, for row names. `only` marks an
 * authority PlanIt doesn't cover, so its older applications can't come from PlanIt's backfill either.
 */
export const IDOX_AUTHORITIES: ReadonlyArray<{ id: string; planitName: string; base: string; only?: boolean }> = [
  { id: "monmouthshire", planitName: "Monmouthshire", base: "https://planningonline.monmouthshire.gov.uk/online-applications", only: true },
  { id: "neath-port-talbot", planitName: "Neath", base: "https://planningonline.npt.gov.uk/online-applications" },
  { id: "rhondda-cynon-taf", planitName: "Rhondda", base: "https://planonline.rctcbc.gov.uk/online-applications" },
  { id: "caerphilly", planitName: "Caerphilly", base: "https://publicaccess.caerphilly.gov.uk/PublicAccess" },
  { id: "torfaen", planitName: "Torfaen", base: "https://planningonline.torfaen.gov.uk/online-applications" },
  { id: "bannau-brycheiniog", planitName: "BreconBeacons", base: "https://planningonline.beacons-npa.gov.uk/online-applications" },
];

const FORM = { "content-type": "application/x-www-form-urlencoded" };
/** Undecided applications rechecked each run, oldest check first. */
const RECHECK = 150;
/** Weeks read on an authority's first run: about six months. */
const FIRST_WEEKS = 26;

async function weekList(base: string, week: string, problems: string[]): Promise<IdoxListItem[]> {
  const form = await fetchText(`${base}/search.do?action=weeklyList&searchType=Application`, { fresh: true });
  if (!form.ok) {
    problems.push(`weekly list form: ${form.error}`);
    return [];
  }
  const csrf = idoxCsrf(form.text) ?? "";
  const first = await fetchText(`${base}/weeklyListResults.do?action=firstPage`, {
    fresh: true,
    method: "POST",
    headers: FORM,
    body: new URLSearchParams({ _csrf: csrf, "searchCriteria.parish": "", "searchCriteria.ward": "", week, dateType: "DC_Validated", searchType: "Application" }).toString(),
  });
  if (!first.ok) {
    problems.push(`week ${week}: ${first.error}`);
    return [];
  }
  let parsed = parseIdoxResults(first.text);
  const items = [...parsed.items];
  const total = parsed.total;
  if (total !== null && total > items.length) {
    // Ask for 100 a page, then read every page.
    const pageCsrf = idoxCsrf(first.text) ?? csrf;
    for (let page = 1; (page === 1 || items.length < total) && page <= 20; page++) {
      const r = await fetchText(`${base}/pagedSearchResults.do`, {
        fresh: true,
        method: "POST",
        headers: FORM,
        body: new URLSearchParams({
          _csrf: pageCsrf,
          "searchCriteria.page": String(page),
          action: "page",
          orderBy: "DateReceived",
          orderByDirection: "Descending",
          "searchCriteria.resultsPerPage": "100",
        }).toString(),
      });
      if (!r.ok) {
        problems.push(`week ${week} page ${page}: ${r.error}`);
        break;
      }
      parsed = parseIdoxResults(r.text);
      if (page === 1) items.length = 0;
      items.push(...parsed.items);
      if (!parsed.items.length) break;
    }
    if (items.length < total) {
      // Some registers ignore the page-size form and only follow the "next page" links, a page of ten at a time.
      const seen = new Map(items.map((x) => [x.keyVal, x]));
      if (!seen.size) for (const x of parseIdoxResults(first.text).items) seen.set(x.keyVal, x);
      for (let page = 2; seen.size < total && page <= 40; page++) {
        const r = await fetchText(`${base}/pagedSearchResults.do?action=page&searchCriteria.page=${page}`, { fresh: true });
        if (!r.ok) break;
        const got = parseIdoxResults(r.text).items;
        const before = seen.size;
        for (const x of got) seen.set(x.keyVal, x);
        if (seen.size === before) break;
      }
      items.length = 0;
      items.push(...seen.values());
    }
    if (items.length < total) problems.push(`week ${week}: read ${items.length} of ${total}`);
  }
  return items;
}

async function readApplication(
  a: { id: string; planitName: string; base: string },
  keyVal: string,
  listed: IdoxListItem | null,
): Promise<Application | null> {
  const url = (tab: string) => `${a.base}/applicationDetails.do?activeTab=${tab}&keyVal=${keyVal}`;
  const [summary, dates, details] = await Promise.all([
    fetchText(url("summary"), { fresh: true }),
    fetchText(url("dates"), { fresh: true }),
    fetchText(url("details"), { fresh: true }),
  ]);
  if (!summary.ok) return null;
  const s = parseIdoxTable(summary.text);
  const d = dates.ok ? parseIdoxTable(dates.text) : {};
  const f = details.ok ? parseIdoxTable(details.text) : {};
  const reference = s.Reference || listed?.reference;
  if (!reference) return null;
  const decision = s.Decision && !/not available/i.test(s.Decision) ? s.Decision : null;
  const decided = idoxDate(d["Decision Made Date"]) ?? idoxDate(d["Decision Issued Date"]) ?? idoxDate(s["Decision Issued Date"]);
  const address = s.Address || listed?.address || null;
  const consult = [d["Neighbour Consultation Expiry Date"], d["Standard Consultation Expiry Date"]].map(idoxDate).filter((x): x is string => !!x).sort();
  const level = f["Actual Decision Level"] || f["Decision Level"] || "";
  return {
    name: `${a.planitName}/${reference}`,
    authority: a.id,
    reference,
    address,
    postcode: postcodeIn(address),
    description: s.Proposal || listed?.description || null,
    appType: idoxAppType(f["Application Type"] ?? null),
    appState: idoxAppState(s.Status || listed?.status || null, decision),
    appSize: null,
    startDate: idoxDate(s["Application Validated"]) ?? listed?.validated ?? idoxDate(s["Application Received"]) ?? listed?.received ?? null,
    consultedDate: consult.length ? consult[consult.length - 1] : null,
    decidedDate: decided,
    targetDate: idoxDate(d["Agreed Expiry Date"]) ?? idoxDate(d["Expiry Date"]),
    decision,
    decidedBy: level && !/not available/i.test(level) ? level : null,
    ward: f.Ward && !/not available/i.test(f.Ward) ? f.Ward : null,
    homes: null,
    lat: null,
    lng: null,
    url: url("summary"),
    docsUrl: url("documents"),
    commentUrl: url("makeComment"),
    planitLink: null,
    lastChanged: new Date(),
  };
}

/** Postcode centres from postcodes.io, a hundred at a time. */
export async function locate(ctx: JobContext, apps: Application[]): Promise<void> {
  const codes = [...new Set(apps.map((x) => x.postcode).filter((x): x is string => !!x))];
  const where = new Map<string, { lat: number; lng: number }>();
  for (let i = 0; i < codes.length; i += 100) {
    const r = await fetchText("https://api.postcodes.io/postcodes", {
      fresh: true,
      method: "POST",
      accept: "application/json",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: codes.slice(i, i + 100) }),
    });
    if (!r.ok) {
      ctx.warn(`postcodes.io: ${r.error}`);
      continue;
    }
    const data = JSON.parse(r.text) as { result?: Array<{ query: string; result: { latitude: number; longitude: number } | null }> };
    for (const x of data.result ?? []) if (x.result) where.set(x.query, { lat: x.result.latitude, lng: x.result.longitude });
  }
  for (const a of apps) {
    const p = a.postcode ? where.get(a.postcode) : undefined;
    // Only places inside Wales and its borders, as for PlanIt's rows.
    if (p && p.lat > 51.3 && p.lat < 53.5 && p.lng > -5.5 && p.lng < -2.6) {
      a.lat = p.lat;
      a.lng = p.lng;
    }
  }
  ctx.count("located", apps.filter((a) => a.lat !== null).length);
}

export const idoxJob: Job = {
  name: "idox",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "planning_applications" }, { table: "pipeline_state", where: "key = 'planning-coverage'", expr: "value::text" }],
    },
  ],
  description: "Planning applications read directly from Idox registers PlanIt doesn't cover",
  async run(ctx) {
    const only = argString(ctx.args, "authority");
    const problems: string[] = [];
    for (const a of IDOX_AUTHORITIES.filter((x) => !only || x.id === only)) {
      // The first run reads up to six months of weeks and, if that reaches further back than anything held, moves
      // the authority's start back to the oldest week read.
      const started = (await ctx.getState<Record<string, string>>("idox-started")) ?? {};
      const firstRun = !started[a.id] || ctx.args.restart === true;
      const form = await fetchText(`${a.base}/search.do?action=weeklyList&searchType=Application`, { fresh: true });
      if (!form.ok) {
        problems.push(`${a.id}: ${form.error}`);
        continue;
      }
      const weeks = idoxWeeks(form.text);
      if (!weeks.length) {
        problems.push(`${a.id}: no weeks offered on the weekly list form; the page may have changed`);
        continue;
      }
      const take = firstRun ? Math.min(weeks.length, argNumber(ctx.args, "first-weeks") ?? FIRST_WEEKS) : Math.min(weeks.length, argNumber(ctx.args, "weeks") ?? 3);
      const listed = new Map<string, IdoxListItem>();
      for (const week of weeks.slice(0, take)) {
        for (const item of await weekList(a.base, week, problems)) listed.set(item.keyVal, item);
        ctx.count(`${a.id} weeks`);
      }
      // Undecided applications already held, and any refusal once misread as approval: read again.
      const open = await ctx.db.execute<{ url: string }>(sql`
        select url from ${planningApplications}
        where authority = ${a.id} and url is not null
          and (app_state = 'Undecided' or (app_state in ('Permitted', 'Conditions') and decision ilike '%unacceptable%'))
        order by updated_at limit ${RECHECK}`);
      const keys = new Map<string, IdoxListItem | null>([...listed].map(([k, v]) => [k, v]));
      for (const r of open) {
        const k = r.url.match(/keyVal=([A-Z0-9]+)/i)?.[1];
        if (k && !keys.has(k)) keys.set(k, null);
      }
      const apps: Application[] = [];
      let failed = 0;
      for (const [k, item] of keys) {
        const app = await readApplication(a, k, item);
        if (app) apps.push(app);
        else failed++;
      }
      if (failed > keys.size * 0.1) problems.push(`${a.id}: ${failed} of ${keys.size} applications could not be read`);
      await locate(ctx, apps);
      await saveApplications(ctx, apps, { fill: true });
      ctx.count(`${a.id} applications`, apps.length);
      // The first day from which every validated application is held: the oldest week read on the first run.
      if (firstRun && apps.length) {
        const from = idoxDate(weeks[take - 1]);
        if (from) {
          // Never later than what's already held (PlanIt's backfill may reach further back).
          const coverage = (await ctx.getState<Record<string, string>>("planning-coverage")) ?? {};
          if (!coverage[a.id] || from < coverage[a.id]) {
            coverage[a.id] = from;
            await ctx.setState("planning-coverage", coverage);
          }
          await ctx.setState("idox-started", { ...started, [a.id]: new Date().toISOString() });
        }
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
