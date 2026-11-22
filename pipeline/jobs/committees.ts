/**
 * Each council's committees, from ModernGov's GetCommittees, with Welsh names
 * from the council's committee list in Welsh where it publishes one.
 *
 *   pnpm pipeline committees [--council cardiff]
 */
import { sql } from "drizzle-orm";
import { committees } from "../../src/db/schema";
import { webServiceUrl, welshCommitteeListUrl } from "../../src/lib/official-urls";
import { councilsFor } from "../lib/councils";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { committeeKind, parseCommittees, parseWelshCommitteeNames } from "../sources/moderngov";
import { COUNCILS_AT_ONCE, mapLimit } from "../lib/util";

export const committeesJob: Job = {
  name: "committees",
  watches: [
    {
      tags: ["committees"],
      sources: [{ table: "committees" }],
    },
  ],
  description: "Committees of each council, from its ModernGov web service",
  async run(ctx) {
    const failed: string[] = [];
    await mapLimit(councilsFor(ctx), COUNCILS_AT_ONCE, async (council) => {
      const r = await fetchText(webServiceUrl(council.moderngovBase, "GetCommittees"), { accept: "text/xml" });
      if (!r.ok) {
        ctx.warn(`${council.id}: committees could not be fetched (${r.error})`);
        failed.push(`${council.id}: committees could not be fetched (${r.error})`);
        return;
      }
      const rows = parseCommittees(r.text).filter((c) => !c.deleted);
      // A council with no committees in the reply means the reply was wrong, not that the council has none.
      if (!rows.length) {
        ctx.warn(`${council.id}: GetCommittees returned no committees`);
        failed.push(`${council.id}: GetCommittees returned no committees`);
        return;
      }

      const welsh = new Map<number, string>();
      const welshList = welshCommitteeListUrl(council);
      if (welshList) {
        const cy = await fetchText(welshList);
        if (cy.ok) for (const w of parseWelshCommitteeNames(cy.text)) welsh.set(w.id, w.nameCy);
        else ctx.warn(`${council.id}: Welsh committee names could not be fetched (${cy.error})`);
      }

      for (const c of rows) {
        // Only keep a Welsh name that differs from the English one; otherwise the page wasn't translated.
        const nameCy = welsh.get(c.id);
        const row = {
          councilId: council.id,
          id: c.id,
          nameEn: c.title,
          nameCy: nameCy && nameCy !== c.title ? nameCy : null,
          category: c.category,
          kind: committeeKind(c.title),
          active: !c.expired,
        };
        await ctx.db
          .insert(committees)
          .values(row)
          .onConflictDoUpdate({
            target: [committees.councilId, committees.id],
            set: {
              nameEn: row.nameEn,
              // Keep a Welsh name found earlier if this run couldn't read the Welsh page.
              nameCy: sql`coalesce(${row.nameCy}, ${committees.nameCy})`,
              category: row.category,
              kind: row.kind,
              active: row.active,
            },
          });
        ctx.count("committees");
      }
      ctx.count("welshNames", [...welsh.keys()].length);
    });
    if (failed.length) throw new PartialFailure(`committees could not be read: ${failed.join("; ")}`);
  },
};
