/**
 * Applies the Welsh corrections in pipeline/lib/welsh-fixes.ts to summaries
 * and declarations already stored. Reads and writes the database only, with
 * no API calls, and changes only text that contains a listed slip.
 *
 *   pnpm pipeline welsh-fixes [--council cardiff]
 */
import { and, eq, sql } from "drizzle-orm";
import { declarations, summaries } from "../../src/db/schema";
import type { MeetingSummaryContent } from "../../src/lib/summary";
import { recordCouncilsFor } from "../lib/councils";
import type { Job } from "../lib/job";
import { fixWelsh } from "../lib/welsh-fixes";

const PATTERN = "(tair|dair|dwy|ddwy) (c|ch|g)ais|(^|[^[:alpha:]])[Aa] estyniad|efsefyllfa";

export const welshFixesJob: Job = {
  name: "welsh-fixes",
  description: "Corrects known Welsh slips in stored summaries and declarations (no API cost)",
  async run(ctx) {
    for (const council of recordCouncilsFor(ctx)) {
      const list = await ctx.db.execute<{ id: number; meetingId: number; content: MeetingSummaryContent }>(sql`
        select id, meeting_id as "meetingId", content from summaries
        where council_id = ${council.id} and content::text ~* ${PATTERN}
      `);
      for (const row of list) {
        let fixed = 0;
        const fix = (x: string | undefined) => {
          if (!x) return x ?? "";
          const r = fixWelsh(x);
          fixed += r.fixed;
          return r.text;
        };
        const c = row.content;
        const next: MeetingSummaryContent = {
          ...c,
          overviewCy: fix(c.overviewCy),
          items: c.items.map((it) => ({
            ...it,
            headlineCy: fix(it.headlineCy),
            decidedCy: fix(it.decidedCy),
            whyCy: fix(it.whyCy),
            ...(it.proposedCy !== undefined ? { proposedCy: fix(it.proposedCy) } : {}),
          })),
        };
        if (!fixed) continue;
        await ctx.db.update(summaries).set({ content: next }).where(eq(summaries.id, row.id));
        ctx.count("summariesFixed");
        ctx.count("fixes", fixed);
        ctx.touched.add(`meeting:${council.id}:${row.meetingId}`);
      }

      const decl = await ctx.db.execute<{ id: number; meetingId: number; natureCy: string }>(sql`
        select id, meeting_id as "meetingId", nature_cy as "natureCy" from declarations
        where council_id = ${council.id} and nature_cy ~* ${PATTERN}
      `);
      for (const d of decl) {
        const r = fixWelsh(d.natureCy);
        if (!r.fixed) continue;
        await ctx.db
          .update(declarations)
          .set({ natureCy: r.text })
          .where(and(eq(declarations.id, d.id), eq(declarations.councilId, council.id)));
        ctx.count("declarationsFixed");
        ctx.touched.add(`meeting:${council.id}:${d.meetingId}`);
      }
    }
    if (ctx.stats.summariesFixed || ctx.stats.declarationsFixed) {
      ctx.touched.add("meetings");
      ctx.touched.add("councillors");
    }
  },
};
