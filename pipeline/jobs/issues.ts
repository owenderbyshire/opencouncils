/**
 * Rebuilds the issues: agenda items about the same business across meetings
 * (pipeline/sources/issues.ts), from the search index. Runs after the index.
 *
 *   pnpm pipeline issues [--council cardiff]
 */
import { eq, sql } from "drizzle-orm";
import { issueItems, issues } from "../../src/db/schema";
import { recordCouncilsFor } from "../lib/councils";
import type { Job } from "../lib/job";
import { chunk, sha1 } from "../lib/util";
import { groupIssues } from "../sources/issues";

type Row = {
  agendaItemId: number;
  meetingId: number;
  committeeId: number;
  date: string;
  title: string;
  kind: string;
  headlineEn: string | null;
  headlineCy: string | null;
  decision: string | null;
  decidedEn: string | null;
  topics: string[];
};

const ROUTING = /^(ref(erence)?|referral|recommendations?)\s+(from|of)\s+[^:–-]{0,60}[:–-]\s*/i;

/** The clearest title for an issue: a summary headline if one exists, otherwise the shortest title without routing words. */
function titleOf(group: Row[]): { en: string; cy: string | null } {
  const summarised = [...group].reverse().find((r) => r.headlineEn);
  if (summarised) return { en: summarised.headlineEn!, cy: summarised.headlineCy };
  const titles = group.map((r) => r.title.replace(ROUTING, "").replace(/\s*[–-]\s*(cabinet|council|governance|scrutiny)[^–-]*$/i, "").replace(/\.$/, "").trim());
  return { en: titles.sort((a, b) => a.length - b.length)[0], cy: null };
}

export const issuesJob: Job = {
  name: "issues",
  watches: [
    {
      tags: ["meetings"],
      sources: [{ table: "issues" }, { table: "issue_items" }],
    },
  ],
  description: "Follows the same business across meetings, from the search index",
  async run(ctx) {
    for (const council of recordCouncilsFor(ctx)) {
      const list = [
        ...(await ctx.db.execute<Row>(sql`
          select agenda_item_id as "agendaItemId", meeting_id as "meetingId", committee_id as "committeeId", date::text as date, title,
            committee_kind as kind, headline_en as "headlineEn", headline_cy as "headlineCy", decision, decided_en as "decidedEn", topics
          from search_items where council_id = ${council.id} and date >= '2022-05-01'
        `)),
      ];
      const byId = new Map(list.map((r) => [r.agendaItemId, r]));
      const groups = groupIssues(list).map((g) => g.map((i) => byId.get(i.agendaItemId)!));
      await ctx.db.transaction(async (tx) => {
        await tx.delete(issueItems).where(eq(issueItems.councilId, council.id));
        await tx.delete(issues).where(eq(issues.councilId, council.id));
        const rows = groups.map((g) => {
          const id = Number.parseInt(sha1(`${council.id}:${g[0].agendaItemId}`).slice(0, 8), 16) & 0x7fffffff || 1;
          const title = titleOf(g);
          return {
            issue: {
              councilId: council.id,
              id,
              titleEn: title.en,
              titleCy: title.cy,
              firstDate: g[0].date,
              lastDate: g[g.length - 1].date,
              // Meetings, not agenda items: one meeting can take two items on the same subject.
              steps: new Set(g.map((r) => r.meetingId)).size,
              kinds: [...new Set(g.map((r) => r.kind))],
              topics: [...new Set(g.flatMap((r) => r.topics))],
              decided: g.some((r) => (r.kind === "council" || r.kind === "cabinet") && (r.decision || r.decidedEn)),
            },
            items: g.map((r) => ({ councilId: council.id, issueId: id, agendaItemId: r.agendaItemId, meetingId: r.meetingId, date: r.date })),
          };
        });
        for (const part of chunk(rows, 200)) {
          if (!part.length) continue;
          await tx.insert(issues).values(part.map((r) => r.issue)).onConflictDoNothing();
          await tx.insert(issueItems).values(part.flatMap((r) => r.items)).onConflictDoNothing();
        }
      });
      ctx.count("issues", groups.length);
      ctx.count(`${council.id}`, groups.length);
    }
  },
};
