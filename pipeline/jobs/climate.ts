/**
 * Each council's climate emergency declaration, net zero date and latest climate action plan, from CAPE, the Climate
 * Action Plans Explorer run by mySociety and Climate Emergency UK. Weekly.
 *
 *   pnpm pipeline climate
 */
import { sql } from "drizzle-orm";
import { CURRENT_COUNCILS } from "../../data/curated/councils";
import { councilClimate } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { mapLimit } from "../lib/util";

export const CAPE = "https://cape.mysociety.org";

export interface CapeCouncil {
  name: string;
  url: string;
  gss_code: string | null;
  authority_code: string;
  plan_count: number;
  plans_last_update: string | null;
  carbon_neutral_date: number | string | null;
  declared_emergency: string | null;
}

export interface CapeDocument {
  title: string;
  document_type: string;
  url: string;
  updated_at: string | null;
}

/** The plan to point to: the newest "Action plan", or failing that the newest document of any kind. */
export function latestPlan(docs: CapeDocument[]): CapeDocument | null {
  const newest = (xs: CapeDocument[]) => [...xs].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0] ?? null;
  return newest(docs.filter((d) => /action plan/i.test(d.document_type))) ?? newest(docs);
}

export const climateJob: Job = {
  name: "climate",
  watches: [{ tags: ["reference"], sources: [{ table: "council_climate" }] }],
  description: "Climate emergency declarations and action plans, from mySociety's CAPE",
  async run(ctx) {
    const r = await fetchText(`${CAPE}/api/councils/?format=json`, { retries: 2, timeoutMs: 60_000 });
    if (!r.ok) throw new Error(`CAPE could not be fetched (${r.error})`);
    const list = JSON.parse(r.text) as CapeCouncil[];
    const byGss = new Map(CURRENT_COUNCILS.filter((c) => c.gss).map((c) => [c.gss!, c.id]));
    const matched = list.flatMap((c) => (c.gss_code && byGss.has(c.gss_code) ? [{ id: byGss.get(c.gss_code)!, c }] : []));
    if (matched.length < 300) throw new PartialFailure(`only ${matched.length} CAPE councils matched the register; nothing stored`);

    let docFailures = 0;
    const rows = await mapLimit(matched, 4, async ({ id, c }) => {
      let plan: CapeDocument | null = null;
      if (c.plan_count > 0) {
        const d = await fetchText(`${CAPE}/api/councils/${encodeURIComponent(c.authority_code)}/documents?format=json`, { retries: 1, timeoutMs: 30_000 });
        if (d.ok) plan = latestPlan(JSON.parse(d.text) as CapeDocument[]);
        else docFailures++;
      }
      return {
        councilId: id,
        capeUrl: `${CAPE}${c.url}`,
        planCount: c.plan_count,
        planTitle: plan?.title ?? null,
        planUrl: plan?.url ?? null,
        plansLastUpdate: c.plans_last_update,
        declaredEmergency: c.declared_emergency,
        carbonNeutral: c.carbon_neutral_date == null ? null : String(c.carbon_neutral_date),
      };
    });
    await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`delete from council_climate`);
      for (const row of rows) await tx.insert(councilClimate).values(row).onConflictDoNothing();
    });
    ctx.count("councils", rows.length);
    ctx.count("withPlan", rows.filter((x) => x.planCount > 0).length);
    ctx.count("docFailures", docFailures);
    ctx.touched.add("reference");
  },
};
