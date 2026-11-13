/**
 * Planning applications read directly from the Arcus registers of Anglesey,
 * Wrexham and Carmarthenshire (pipeline/sources/arcus.ts), alongside UK
 * PlanIt. Each run asks for applications received in the past three weeks
 * (six months on an authority's first run) and for any changed in the past
 * four days, which brings in decisions. Rows use PlanIt's names
 * ("Anglesey/FPL/2026/232") so the two sources never duplicate, and a value
 * the register lacks keeps the one PlanIt gave.
 *
 *   pnpm pipeline arcus [--authority anglesey] [--restart] [--dry]
 */
import type { Job, JobContext } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { fetchText } from "../lib/http";
import { argString } from "../lib/util";
import type { Application } from "../sources/planit";
import { idoxAppState, idoxAppType, postcodeIn } from "../sources/idox";
import { ARCUS_FIELDS, ARCUS_OBJECT, arcusQuery, arcusRecords, auraBody, auraContext, onOrAfter, type ArcusRecord, type AuraContext, type AuraReply } from "../sources/arcus";
import { sql } from "drizzle-orm";
import { locate } from "./idox";
import { saveApplications } from "./planning";

interface ArcusAuthority {
  id: string;
  planitName: string;
  /** The site, including its path prefix. */
  site: string;
  /** A public page on it, for the framework version and app token. */
  page: string;
  /** Where each application's page is, from its record id. */
  record: string;
}

export const ARCUS_AUTHORITIES: ArcusAuthority[] = [
  {
    id: "anglesey",
    planitName: "Anglesey",
    site: "https://planning-public-register.anglesey.gov.wales/prIoA",
    page: "/s/register-view?language=en_GB&c__r=Arcus_BE_Public_Register",
    record: "/s/planning-application/",
  },
  {
    id: "wrexham",
    planitName: "Wrexham",
    site: "https://register.wrexham.gov.uk/pr",
    page: "/s/register-view?c__r=Arcus_BE_Public_Register&language=en_GB",
    record: "/s/detail/",
  },
  {
    id: "carmarthenshire",
    planitName: "Carmarthenshire",
    site: "https://carmarthenshire.my.site.com/en",
    page: "/s",
    record: "/s/planning-application/",
  },
];

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

async function aura(a: ArcusAuthority, ctx: AuraContext, actions: Parameters<typeof auraBody>[2]): Promise<AuraReply | string> {
  const pageUri = `${new URL(a.site).pathname.replace(/\/$/, "")}/s/`;
  const r = await fetchText(`${a.site}/s/sfsites/aura?r=1`, {
    fresh: true,
    method: "POST",
    accept: "application/json",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: auraBody(ctx, pageUri, actions),
  });
  if (!r.ok) return r.error;
  try {
    return JSON.parse(r.text.replace(/^while\(1\);\s*/, "")) as AuraReply;
  } catch {
    return `unexpected reply: ${r.text.slice(0, 120)}`;
  }
}

/** Every record matching `where`, a page of 200 at a time. */
async function query(a: ArcusAuthority, ctx: AuraContext, fields: string[], where: string, problems: string[]): Promise<ArcusRecord[]> {
  const out: ArcusRecord[] = [];
  let after: string | null = null;
  for (let page = 0; page < 50; page++) {
    const reply = await aura(a, ctx, [{ descriptor: "aura://RecordUiController/ACTION$executeGraphQL", params: { queryInput: { operationName: "apps", query: arcusQuery(fields, where, after), variables: {} } } }]);
    if (typeof reply === "string") {
      problems.push(`${a.id}: ${reply}`);
      break;
    }
    const act = reply.actions?.[0];
    if (act?.state !== "SUCCESS") {
      problems.push(`${a.id}: query failed: ${JSON.stringify(act?.error ?? reply).slice(0, 200)}`);
      break;
    }
    const got = arcusRecords(act.returnValue);
    if (got.errors.length) problems.push(`${a.id}: ${got.errors.join("; ").slice(0, 200)}`);
    out.push(...got.records);
    if (!got.next) break;
    after = got.next;
  }
  return out;
}

/** A decision only counts once the register says it's been made: some fill the field in at recommendation. */
function finalDecision(r: ArcusRecord): string | null {
  if (!r.decision || /^pending$/i.test(r.decision)) return null;
  return r.decided || /closed|decision made|decided|determined/i.test(r.status ?? "") ? r.decision : null;
}

/** The state, or null where the register doesn't say, so PlanIt's stands. */
export function arcusState(r: ArcusRecord): string | null {
  const s = idoxAppState(r.status, finalDecision(r));
  return s === "Unresolved" ? null : s;
}

function toApplication(a: ArcusAuthority, r: ArcusRecord): Application {
  return {
    name: `${a.planitName}/${r.reference}`,
    authority: a.id,
    reference: r.reference,
    address: r.address,
    postcode: postcodeIn(r.address),
    description: r.proposal,
    appType: idoxAppType(r.type),
    appState: arcusState(r),
    appSize: null,
    startDate: r.valid ?? r.received,
    consultedDate: null,
    decidedDate: r.decided,
    targetDate: null,
    decision: finalDecision(r),
    decidedBy: r.level,
    ward: r.ward,
    homes: null,
    lat: null,
    lng: null,
    url: `${a.site}${a.record}${r.id}`,
    docsUrl: `${a.site}${a.record}${r.id}`,
    commentUrl: null,
    planitLink: null,
    lastChanged: new Date(),
  };
}

async function readAuthority(ctx: JobContext, a: ArcusAuthority, firstRun: boolean, problems: string[]): Promise<{ apps: Application[]; from: string; statuses: Map<string, string> } | null> {
  const page = await fetchText(`${a.site}${a.page}`, { fresh: true });
  if (!page.ok) {
    problems.push(`${a.id}: ${page.error}`);
    return null;
  }
  const actx = auraContext(page.text);
  if (!actx) {
    problems.push(`${a.id}: couldn't find the site's framework version; the page may have changed`);
    return null;
  }
  // Ask only for the fields this site shows to visitors.
  const info = await aura(a, actx, [{ descriptor: "aura://RecordUiController/ACTION$getObjectInfo", params: { objectApiName: ARCUS_OBJECT } }]);
  if (typeof info === "string" || info.actions?.[0]?.state !== "SUCCESS") {
    problems.push(`${a.id}: the register's records aren't open to visitors (${typeof info === "string" ? info : JSON.stringify(info.actions?.[0]?.error).slice(0, 160)})`);
    return null;
  }
  const available = new Set(Object.keys((info.actions[0].returnValue as { fields?: Record<string, unknown> }).fields ?? {}));
  const fields = ARCUS_FIELDS.filter((f) => available.has(f));
  if (!fields.includes("Name") || !fields.includes("arcusbuiltenv__Received_Date__c")) {
    problems.push(`${a.id}: the register doesn't show references or dates received`);
    return null;
  }
  ctx.log(`${a.id}: ${fields.length} of ${ARCUS_FIELDS.length} fields shown; missing ${ARCUS_FIELDS.filter((f) => !available.has(f)).join(", ") || "none"}`);
  const from = iso(Date.now() - (firstRun ? 183 : 21) * DAY);
  const byId = new Map<string, ArcusRecord>();
  for (const r of await query(a, actx, fields, onOrAfter("arcusbuiltenv__Received_Date__c", from), problems)) byId.set(r.id, r);
  if (fields.includes("LastModifiedDate")) {
    for (const r of await query(a, actx, fields, onOrAfter("LastModifiedDate", iso(Date.now() - 4 * DAY), true), problems)) byId.set(r.id, r);
  }
  if (ctx.args.dry === true) {
    const seen = new Map<string, number>();
    for (const r of byId.values()) {
      const k = `${r.status ?? "-"} | ${r.decision ?? "-"} | ${r.decided ? "dated" : "undated"} | ${arcusState(r) ?? "(PlanIt's)"}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const [k, n] of [...seen].sort((x, y) => y[1] - x[1])) ctx.log(`STATE ${a.id} ${n} ${k}`);
  }
  const statuses = new Map([...byId.values()].map((r) => [`${a.planitName}/${r.reference}`, r.status ?? ""]));
  return { apps: [...byId.values()].map((r) => toApplication(a, r)), from, statuses };
}

export const arcusJob: Job = {
  name: "arcus",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "planning_applications" }, { table: "pipeline_state", where: "key = 'planning-coverage'", expr: "value::text" }],
    },
  ],
  description: "Planning applications read directly from Anglesey's, Wrexham's and Carmarthenshire's registers",
  async run(ctx) {
    const only = argString(ctx.args, "authority");
    const problems: string[] = [];
    const started = (await ctx.getState<Record<string, string>>("arcus-started")) ?? {};
    for (const a of ARCUS_AUTHORITIES.filter((x) => !only || x.id === only)) {
      const firstRun = !started[a.id] || ctx.args.restart === true;
      const got = await readAuthority(ctx, a, firstRun, problems);
      if (!got) continue;
      ctx.count(`${a.id} applications`, got.apps.length);
      if (ctx.args.dry === true) {
        for (const x of got.apps.slice(0, 5)) ctx.log(`DRY ${x.name} | ${x.appState} | ${x.startDate} | ${x.address?.slice(0, 60)}`);
        continue;
      }
      // Closed on the register with no outcome shown: if what we hold still says waiting, it's out of date, so say
      // the outcome isn't known rather than keep it on the map. A real outcome from PlanIt is kept.
      const closed = got.apps.filter((x) => x.appState === null && /closed|decision made|not proceeded/i.test(got.statuses.get(x.name) ?? ""));
      if (closed.length) {
        const names = closed.map((x) => x.name);
        const held = await ctx.db.execute<{ name: string; app_state: string | null }>(
          sql`select name, app_state from planning_applications where name in (${sql.join(names.map((n) => sql`${n}`), sql`, `)})`,
        );
        const state = new Map(held.map((h) => [h.name, h.app_state]));
        for (const x of closed) {
          const was = state.get(x.name);
          if (was === undefined || was === null || was === "Undecided") x.appState = "Unresolved";
        }
        ctx.count(`${a.id} closed without outcome`, closed.length);
      }
      await locate(ctx, got.apps);
      await saveApplications(ctx, got.apps, { fill: true });
      if (firstRun && got.apps.length) {
        const coverage = (await ctx.getState<Record<string, string>>("planning-coverage")) ?? {};
        if (!coverage[a.id] || got.from < coverage[a.id]) {
          coverage[a.id] = got.from;
          await ctx.setState("planning-coverage", coverage);
        }
        started[a.id] = new Date().toISOString();
        await ctx.setState("arcus-started", started);
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
