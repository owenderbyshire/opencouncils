/**
 * Planning applications read directly from the "planning-register" public
 * access system (pipeline/sources/planning-register.ts), alongside UK PlanIt.
 * Each run accepts the register's disclaimer, searches by date received a
 * week at a time (up to six months on an authority's first run, the last
 * three weeks after that), reads each application's page, and rechecks
 * undecided applications so decisions arrive. Rows use PlanIt's names
 * ("Bridgend/P/26/548/FUL") so the two sources never duplicate, and a value
 * the register lacks keeps the one PlanIt gave.
 *
 *   pnpm pipeline planning-register [--authority bridgend] [--weeks 3] [--restart]
 */
import { sql } from "drizzle-orm";
import { planningApplications } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import type { Application } from "../sources/planit";
import { idoxAppState, idoxAppType, postcodeIn } from "../sources/idox";
import { hiddenFields, lastResultsPage, registerApplication, resultReferences } from "../sources/planning-register";
import { locate } from "./idox";
import { saveApplications } from "./planning";

interface RegisterAuthority {
  id: string;
  /** The authority's PlanIt area name, for row names. */
  planitName: string;
  base: string;
  /** The advanced search page and where its form posts. */
  searchPage: string;
  searchAction: string;
  dateFormat: "iso" | "dmy";
  /** Extra form fields, to search planning applications only. */
  fields: Record<string, string>;
}

export const REGISTER_AUTHORITIES: RegisterAuthority[] = [
  {
    id: "bridgend",
    planitName: "Bridgend",
    base: "https://planning.bridgend.gov.uk",
    searchPage: "/Search/Planning/Advanced",
    searchAction: "/Search/Results",
    dateFormat: "dmy",
    fields: {},
  },
  {
    id: "vale-of-glamorgan",
    planitName: "Glamorgan",
    base: "https://vogonline.planning-register.co.uk",
    searchPage: "/Search/Advanced",
    searchAction: "/Search/SiteResults",
    dateFormat: "iso",
    fields: { SearchPlanning: "true", SearchEnforcement: "false", SearchBuildingControl: "false" },
  },
];

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const RECHECK = 150;
const FIRST_WEEKS = 26;
const DAY = 86_400_000;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

async function acceptDisclaimer(a: RegisterAuthority): Promise<boolean> {
  const r = await fetchText(`${a.base}/Disclaimer/Accept?returnUrl=%2F`, { fresh: true, method: "POST", headers: FORM, body: "" });
  return r.ok;
}

/** References of applications received between two days, inclusive. */
async function received(a: RegisterAuthority, from: string, to: string, problems: string[]): Promise<string[]> {
  const page = await fetchText(`${a.base}${a.searchPage}`, { fresh: true });
  if (!page.ok) {
    problems.push(`${a.id} search page: ${page.error}`);
    return [];
  }
  const body = hiddenFields(page.text);
  for (const [k, v] of Object.entries(a.fields)) body.set(k, v);
  const fmt = a.dateFormat === "iso" ? (d: string) => d : dmy;
  body.set("DateReceivedFrom", fmt(from));
  body.set("DateReceivedTo", fmt(to));
  const first = await fetchText(`${a.base}${a.searchAction}`, { fresh: true, method: "POST", headers: FORM, body: body.toString() });
  if (!first.ok) {
    problems.push(`${a.id} ${from}: ${first.error}`);
    return [];
  }
  const refs = resultReferences(first.text);
  // The pager only links a few pages ahead, so keep going until a page adds nothing.
  const more = lastResultsPage(first.text) > 1;
  for (let n = 2; more && n <= 60; n++) {
    const r = await fetchText(`${a.base}/Search/ResultsPage/${n}?module=PLA`, { fresh: true });
    if (!r.ok) {
      problems.push(`${a.id} ${from} page ${n}: ${r.error}`);
      break;
    }
    const before = refs.length;
    for (const ref of resultReferences(r.text)) if (!refs.includes(ref)) refs.push(ref);
    if (refs.length === before) break;
  }
  return refs;
}

async function readApplication(a: RegisterAuthority, reference: string): Promise<Application | null> {
  const url = `${a.base}/Planning/Display/${reference}`;
  const r = await fetchText(url, { fresh: true });
  if (!r.ok) return null;
  const x = registerApplication(reference, r.text);
  if (!x.address && !x.proposal) return null;
  return {
    name: `${a.planitName}/${x.reference}`,
    authority: a.id,
    reference: x.reference,
    address: x.address,
    postcode: postcodeIn(x.address),
    description: x.proposal,
    appType: idoxAppType(x.appType),
    appState: idoxAppState(x.status, x.decision),
    appSize: null,
    startDate: x.valid ?? x.received,
    consultedDate: x.lastComment,
    decidedDate: x.decided,
    targetDate: x.target,
    decision: x.decision,
    decidedBy: x.level,
    ward: x.ward,
    homes: null,
    lat: null,
    lng: null,
    url,
    docsUrl: url,
    commentUrl: `${a.base}/Planning/Comment/${x.reference}`,
    planitLink: null,
    lastChanged: new Date(),
  };
}

export const planningRegisterJob: Job = {
  name: "planning-register",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "planning_applications" }, { table: "pipeline_state", where: "key = 'planning-coverage'", expr: "value::text" }],
    },
  ],
  description: "Planning applications read directly from Bridgend's and the Vale of Glamorgan's registers",
  async run(ctx) {
    const only = argString(ctx.args, "authority");
    const problems: string[] = [];
    const started = (await ctx.getState<Record<string, string>>("register-started")) ?? {};
    for (const a of REGISTER_AUTHORITIES.filter((x) => !only || x.id === only)) {
      const firstRun = !started[a.id] || ctx.args.restart === true;
      if (!(await acceptDisclaimer(a))) {
        problems.push(`${a.id}: the register didn't answer`);
        continue;
      }
      const weeks = firstRun ? (argNumber(ctx.args, "first-weeks") ?? FIRST_WEEKS) : (argNumber(ctx.args, "weeks") ?? 3);
      const now = Date.now();
      const refs = new Set<string>();
      let oldest = iso(now);
      for (let w = 0; w < weeks; w++) {
        const to = iso(now - w * 7 * DAY);
        const from = iso(now - (w * 7 + 6) * DAY);
        for (const ref of await received(a, from, to, problems)) refs.add(ref);
        oldest = from;
        ctx.count(`${a.id} weeks`);
      }
      // Undecided applications already held: read again so decisions arrive.
      const open = await ctx.db.execute<{ reference: string }>(sql`
        select reference from ${planningApplications}
        where authority = ${a.id} and reference is not null and app_state = 'Undecided'
        order by updated_at limit ${RECHECK}`);
      for (const r of open) refs.add(r.reference);

      const apps: Application[] = [];
      let failed = 0;
      for (const ref of refs) {
        const app = await readApplication(a, ref);
        if (app) apps.push(app);
        else failed++;
      }
      if (failed > refs.size * 0.1) problems.push(`${a.id}: ${failed} of ${refs.size} applications could not be read`);
      await locate(ctx, apps);
      await saveApplications(ctx, apps, { fill: true });
      ctx.count(`${a.id} applications`, apps.length);
      if (firstRun && apps.length) {
        // Never later than what's already held (PlanIt's backfill may reach further back).
        const coverage = (await ctx.getState<Record<string, string>>("planning-coverage")) ?? {};
        if (!coverage[a.id] || oldest < coverage[a.id]) {
          coverage[a.id] = oldest;
          await ctx.setState("planning-coverage", coverage);
        }
        started[a.id] = new Date().toISOString();
        await ctx.setState("register-started", started);
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
