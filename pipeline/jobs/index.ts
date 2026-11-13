/**
 * Rebuilds the cross-council search index (`search_items`): one row per agenda
 * item with its title, recorded decision, summary and minute, and the topics
 * it belongs to. Runs after summaries so new summaries are searchable.
 *
 *   pnpm pipeline index [--council cardiff]
 */
import { eq, sql } from "drizzle-orm";
import { topicsFor } from "../../data/curated/topics";
import { searchItems } from "../../src/db/schema";
import type { MeetingSummaryContent } from "../../src/lib/summary";
import { recordCouncilsFor } from "../lib/councils";
import type { Job } from "../lib/job";
import { chunk } from "../lib/util";

/** Longest stretch of a minute kept for matching. */
const MAX_BODY = 20_000;

type Row = {
  agendaItemId: number;
  meetingId: number;
  committeeId: number;
  committeeKind: string;
  date: string;
  title: string;
  decision: string | null;
  minutes: string | null;
  summary: MeetingSummaryContent | null;
};

export const indexJob: Job = {
  name: "index",
  watches: [
    {
      tags: ["meetings"],
      sources: [{ table: "search_items" }],
    },
  ],
  description: "Rebuilds the search index and topics across all councils",
  async run(ctx) {
    for (const council of recordCouncilsFor(ctx)) {
      const rows = await ctx.db.execute<Row>(sql`
        select a.id as "agendaItemId", a.meeting_id as "meetingId", m.committee_id as "committeeId", c.kind as "committeeKind",
          m.date::text as date, a.title, d.text as decision, a.minutes,
          (select s.content from summaries s where s.council_id = a.council_id and s.meeting_id = a.meeting_id
            order by s.created_at desc limit 1) as summary
        from agenda_items a
        join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
        join committees c on c.council_id = m.council_id and c.id = m.committee_id
        left join decisions d on d.council_id = a.council_id and d.agenda_item_id = a.id
        where a.council_id = ${council.id} and not m.cancelled and not a.is_restricted
      `);
      const values = rows.map((r) => {
        const s = r.summary?.items.find((i) => i.agendaItemId === Number(r.agendaItemId));
        return {
          councilId: council.id,
          agendaItemId: Number(r.agendaItemId),
          meetingId: Number(r.meetingId),
          committeeId: Number(r.committeeId),
          committeeKind: r.committeeKind as typeof searchItems.$inferInsert.committeeKind,
          date: r.date,
          title: r.title,
          decision: r.decision,
          headlineEn: s?.headlineEn || null,
          headlineCy: s?.headlineCy || null,
          decidedEn: s?.decidedEn || null,
          decidedCy: s?.decidedCy || null,
          body: r.minutes ? r.minutes.slice(0, MAX_BODY) : null,
          topics: topicsFor(r.title, r.decision, s?.headlineEn, s?.decidedEn),
        };
      });
      await ctx.db.transaction(async (tx) => {
        await tx.delete(searchItems).where(eq(searchItems.councilId, council.id));
        for (const part of chunk(values, 500)) await tx.insert(searchItems).values(part);
      });
      ctx.count("items", values.length);
      ctx.count("withTopic", values.filter((v) => v.topics.length).length);
    }
  },
};
