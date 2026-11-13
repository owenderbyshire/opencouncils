/**
 * Councillors, their wards and the committees they sit on, from ModernGov's
 * GetCouncillorsByWard and GetCommitteesByUser.
 *
 * Councillors who drop out of the council's list are kept, marked as no
 * longer current, so their attendance and declarations stay linked.
 *
 *   pnpm pipeline councillors [--council cardiff]
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { committeeMembers, committees, councillors, wards } from "../../src/db/schema";
import { webServiceUrl } from "../../src/lib/official-urls";
import { councilsFor } from "../lib/councils";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { mapLimit } from "../lib/util";
import { committeeRole, parseCommitteesByUser, parseCouncillorsByWard } from "../sources/moderngov";

export const councillorsJob: Job = {
  name: "councillors",
  watches: [
    {
      tags: ["councillors", "committees"],
      sources: [{ table: "councillors" }, { table: "wards" }, { table: "committee_members" }],
    },
  ],
  description: "Councillors, wards and committee membership, from each council's ModernGov web service",
  async run(ctx) {
    const failed: string[] = [];
    for (const council of councilsFor(ctx)) {
      const r = await fetchText(webServiceUrl(council.moderngovBase, "GetCouncillorsByWard"), { accept: "text/xml" });
      if (!r.ok) {
        ctx.warn(`${council.id}: councillors could not be fetched (${r.error})`);
        failed.push(`${council.id}: councillors could not be fetched (${r.error})`);
        continue;
      }
      const list = parseCouncillorsByWard(r.text);
      if (!list.length) {
        ctx.warn(`${council.id}: GetCouncillorsByWard returned nobody`);
        failed.push(`${council.id}: GetCouncillorsByWard returned nobody`);
        continue;
      }

      // Wards, with the number of seats each has now.
      const seats = new Map<string, { name: string; seats: number }>();
      for (const c of list) {
        const w = seats.get(c.wardSlug) ?? { name: c.ward, seats: 0 };
        w.seats++;
        seats.set(c.wardSlug, w);
      }
      for (const [slug, w] of seats) {
        await ctx.db
          .insert(wards)
          .values({ councilId: council.id, slug, nameEn: w.name, seats: w.seats })
          .onConflictDoUpdate({ target: [wards.councilId, wards.slug], set: { nameEn: w.name, seats: w.seats } });
      }
      ctx.count("wards", seats.size);

      for (const c of list) {
        const row = {
          councilId: council.id,
          id: c.id,
          name: c.name,
          honorific: c.honorific,
          wardSlug: c.wardSlug,
          partyLabel: c.partyLabel || null,
          partyId: c.partyId,
          groupLabel: c.groupLabel || null,
          photoUrl: c.photoUrl,
          email: c.email,
          phone: c.phone,
          keyPosts: c.keyPosts,
          termStart: c.termStart,
          current: true,
          updatedAt: new Date(),
        };
        await ctx.db
          .insert(councillors)
          .values(row)
          .onConflictDoUpdate({ target: [councillors.councilId, councillors.id], set: row });
      }
      const ids = list.map((c) => c.id);
      await ctx.db
        .update(councillors)
        .set({ current: false })
        .where(and(eq(councillors.councilId, council.id), notInArray(councillors.id, ids)));
      ctx.count("councillors", ids.length);

      // Committee membership. Only committees we already hold, so a councillor's
      // outside bodies and working groups that ModernGov lists don't create rows.
      const known = new Set(
        (
          await ctx.db
            .select({ id: committees.id })
            .from(committees)
            .where(and(eq(committees.councilId, council.id), eq(committees.active, true)))
        ).map((c) => c.id),
      );
      let membershipFailures = 0;
      await mapLimit(list, 2, async (c) => {
        const m = await fetchText(webServiceUrl(council.moderngovBase, "GetCommitteesByUser", { lUserId: c.id }), {
          accept: "text/xml",
        });
        if (!m.ok) {
          membershipFailures++;
          return;
        }
        const rows = parseCommitteesByUser(m.text)
          .filter((x) => !x.expired && known.has(x.committeeId))
          .map((x) => ({
            councilId: council.id,
            committeeId: x.committeeId,
            councillorId: c.id,
            role: committeeRole(x.role),
            roleRaw: x.role,
          }));
        await ctx.db.transaction(async (tx) => {
          await tx
            .delete(committeeMembers)
            .where(and(eq(committeeMembers.councilId, council.id), eq(committeeMembers.councillorId, c.id)));
          if (rows.length) await tx.insert(committeeMembers).values(rows).onConflictDoNothing();
        });
        ctx.count("memberships", rows.length);
      });
      // Former councillors sit on nothing.
      const former = await ctx.db
        .select({ id: councillors.id })
        .from(councillors)
        .where(and(eq(councillors.councilId, council.id), eq(councillors.current, false)));
      if (former.length)
        await ctx.db.delete(committeeMembers).where(
          and(
            eq(committeeMembers.councilId, council.id),
            inArray(
              committeeMembers.councillorId,
              former.map((f) => f.id),
            ),
          ),
        );
      if (membershipFailures > list.length / 4) failed.push(`${council.id}: ${membershipFailures} of ${list.length} councillors' committees unread`);
      ctx.count("membershipFailures", membershipFailures);
    }
    if (failed.length) throw new PartialFailure(`councillors could not be read in full: ${failed.join("; ")}`);
  },
};
