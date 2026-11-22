/**
 * Each council's page on WhatDoTheyKnow, so council pages can link to the freedom of information requests made to
 * it. The council register carries WhatDoTheyKnow's internal id; mySociety's authorities dataset gives the page
 * address for that id. Weekly.
 *
 *   pnpm pipeline wdtk
 */
import { sql } from "drizzle-orm";
import { CURRENT_COUNCILS } from "../../data/curated/councils";
import { councilWdtk } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { csvRecords } from "../sources/statswales";

export const WDTK_AUTHORITIES_CSV = "https://pages.mysociety.org/wdtk_authorities_list/data/whatdotheyknow_authorities_dataset/latest/authorities.csv";

export const wdtkJob: Job = {
  name: "wdtk",
  watches: [{ tags: ["reference"], sources: [{ table: "council_wdtk" }] }],
  description: "Each council's page on WhatDoTheyKnow, from mySociety's authorities dataset",
  async run(ctx) {
    const r = await fetchText(WDTK_AUTHORITIES_CSV, { retries: 2, timeoutMs: 90_000 });
    if (!r.ok) throw new Error(`WhatDoTheyKnow authorities could not be fetched (${r.error})`);
    const byId = new Map<number, { urlName: string; defunct: boolean }>();
    for (const row of csvRecords(r.text)) {
      const id = Number(row["internal-id"]);
      if (id && row["url-name"]) byId.set(id, { urlName: row["url-name"], defunct: /^true$/i.test(row.defunct ?? "") });
    }
    const found = CURRENT_COUNCILS.flatMap((c) => {
      const w = c.wdtkId ? byId.get(c.wdtkId) : undefined;
      return w && !w.defunct ? [{ councilId: c.id, urlName: w.urlName }] : [];
    });
    if (found.length < 300) throw new PartialFailure(`only ${found.length} councils matched WhatDoTheyKnow's list; nothing stored`);
    await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`delete from council_wdtk`);
      for (const f of found) await tx.insert(councilWdtk).values(f);
    });
    ctx.count("councils", found.length);
    ctx.touched.add("reference");
  },
};
