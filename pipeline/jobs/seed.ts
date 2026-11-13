/**
 * Writes the list of councils from data/curated/councils.ts. Safe to run
 * every time: it only ever reflects the curated file.
 */
import { COUNCILS } from "../../data/curated/councils";
import { councils } from "../../src/db/schema";
import type { Job } from "../lib/job";

export const seedJob: Job = {
  name: "seed",
  watches: [
    {
      tags: ["reference"],
      sources: [{ table: "councils" }],
    },
  ],
  description: "Councils and their ModernGov addresses, from data/curated/councils.ts",
  async run(ctx) {
    for (const c of COUNCILS) {
      const row = {
        id: c.id,
        nameEn: c.nameEn,
        nameCy: c.nameCy,
        moderngovBase: c.moderngovBase,
        website: c.website,
        active: c.active && c.system !== "none",
      };
      await ctx.db.insert(councils).values(row).onConflictDoUpdate({ target: councils.id, set: row });
      ctx.count("councils");
    }
  },
};
