/**
 * What each council has said it plans to decide: its published list of
 * forthcoming decisions, from the decisions pages of its ModernGov site
 * (the same list a visitor sees under "Forthcoming decisions").
 *
 * For each council: the list (one request), the same list through the
 * council's own "key decisions only" filter (one request), then the council's
 * page for each matter that is new or has changed, for the lead member and
 * the day it goes to the Cabinet. A matter that drops off the list is kept,
 * marked as no longer listed; once the agenda item the council links for the
 * day it was due is in the meetings held here, the decision links to it.
 *
 * These are web pages, so each is asked for only where the council's
 * robots.txt allows, and a site that answers with a check for automated
 * readers is left alone and tried again a week later. Titles and decision
 * makers are stored as published. Officers' names are not stored. No AI.
 *
 *   pnpm pipeline forward-plans [--council swansea] [--force]
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { topicsFor } from "../../data/curated/topics";
import { plannedDecisions, sourceReads } from "../../src/db/schema";
import { isExecutiveMaker } from "../../src/lib/forward-plan";
import { councilsFor } from "../lib/councils";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { recordRead, refusalOutcome } from "../lib/reads";
import { mayRead, permission } from "../lib/robots";
import { addDays, COUNCILS_AT_ONCE, mapLimit, sha1, today } from "../lib/util";
import { forthcomingKeyUrl, forthcomingUrl, isKeyType, issueUrl, parseDecisionTableIds, parseForthcoming, parseIssue, type ForthcomingDecision } from "../sources/moderngov-pages";

/** The council's pages for single matters read in one run, per council. */
const MAX_ISSUE_PAGES = 90;
/** How long after its date a decision is still looked for on an agenda. */
const LOOK_BACK_DAYS = 45;
/** A site that was closed or refused is asked again after this many days, not every day. */
const RETRY_CLOSED_DAYS = 6;

const listHash = (d: ForthcomingDecision) => sha1([d.title, d.makers, d.due?.date ?? d.dueUnread ?? "", d.restriction ?? ""].join("|"));

export const forwardPlansJob: Job = {
  name: "forward-plans",
  watches: [
    {
      tags: ["meetings"],
      sources: [{ table: "planned_decisions" }],
    },
  ],
  description: "Decisions each council plans to take, from its published list of forthcoming decisions",
  async run(ctx) {
    const force = ctx.args.force === true || typeof ctx.args.council === "string";
    const trouble: string[] = [];
    const now = today();
    await mapLimit(councilsFor(ctx), COUNCILS_AT_ONCE, async (council) => {
      const base = council.moderngovBase;
      const [last] = await ctx.db
        .select({ outcome: sourceReads.outcome, checkedAt: sourceReads.checkedAt })
        .from(sourceReads)
        .where(and(eq(sourceReads.councilId, council.id), eq(sourceReads.source, "forward-plan")));
      if (!force && last && ["robots", "challenge", "missing"].includes(last.outcome) && Date.now() - last.checkedAt.getTime() < RETRY_CLOSED_DAYS * 86_400_000) {
        ctx.count("leftAlone");
        return;
      }

      const url = forthcomingUrl(base);
      const may = await permission(url);
      if (may === "closed") {
        await recordRead(ctx, council.id, "forward-plan", "robots", 0, "robots.txt closes the page");
        return;
      }
      if (may === "unknown") {
        // Not the same as a site that closes the page: nobody is told its robots.txt keeps the pipeline out.
        await recordRead(ctx, council.id, "forward-plan", "failed", 0, "robots.txt could not be read, so the page was not asked for");
        trouble.push(`${council.id}: robots.txt could not be read`);
        return;
      }
      const r = await fetchText(url, { fresh: true, retries: 1 });
      if (!r.ok) {
        const outcome = refusalOutcome(r);
        await recordRead(ctx, council.id, "forward-plan", outcome, 0, r.error.slice(0, 200));
        ctx.log(`${council.id}: not read (${outcome})`);
        if (outcome === "failed") trouble.push(`${council.id}: ${r.error.slice(0, 120)}`);
        return;
      }
      const list = parseForthcoming(r.text);
      if (!list.recognised) {
        await recordRead(ctx, council.id, "forward-plan", "failed", 0, "the reply was not the decisions list");
        trouble.push(`${council.id}: the reply was not the decisions list`);
        return;
      }

      const held = await ctx.db.select().from(plannedDecisions).where(eq(plannedDecisions.councilId, council.id));
      const heldById = new Map(held.map((h) => [h.issueId, h]));
      const listedBefore = held.filter((h) => h.listed).length;
      // A list that comes back empty where many matters were listed the day before is more likely a fault than a clear-out.
      if (!list.decisions.length && listedBefore >= 5) {
        await recordRead(ctx, council.id, "forward-plan", "failed", 0, `the list came back empty; ${listedBefore} were listed before and are left as they were`);
        trouble.push(`${council.id}: the list came back empty where ${listedBefore} were listed`);
        return;
      }

      // Which of them the council's own filter calls key decisions. If that can't be read, what was known stays.
      let keyIds: Set<number> | null = null;
      if (list.decisions.length) {
        const k = await fetchText(forthcomingKeyUrl(base), { fresh: true, retries: 1 });
        const parsed = k.ok ? parseDecisionTableIds(k.text) : null;
        // A filter that hands back every matter on a long list may not be filtering at all (Conwy and Swansea, November 2026):
        // it then says nothing, and each matter's own page decides.
        if (parsed?.recognised && !(list.decisions.length >= 10 && list.decisions.every((d) => parsed.issueIds.includes(d.issueId)))) keyIds = new Set(parsed.issueIds);
        else ctx.warn(`${council.id}: the key decisions filter could not be read`);
      }

      const seen = new Date();
      for (const d of list.decisions) {
        const before = heldById.get(d.issueId);
        const executive = isExecutiveMaker(d.makers);
        const row = {
          councilId: council.id,
          issueId: d.issueId,
          title: d.title,
          purpose: d.purpose,
          makers: d.makers,
          executive,
          due: d.due?.date ?? null,
          dueMonthOnly: d.due?.monthOnly ?? false,
          // Where the Cabinet alone decides, the day it is due is the day it goes to the Cabinet. Otherwise the council's page for the matter says.
          executiveDue: executive && d.due && !d.due.monthOnly && !d.makers.includes(",") ? d.due.date : (before?.executiveDue ?? null),
          // The matter's own page, once read, decides (below); until then the council's filter, where it filters.
          isKey: before?.detailFetchedAt && before.isKey !== null ? before.isKey : keyIds ? keyIds.has(d.issueId) : (before?.isKey ?? null),
          restriction: d.restriction,
          noticePublished: d.noticePublished,
          topics: topicsFor(d.title, d.purpose),
          url: issueUrl(base, d.issueId),
          listed: true,
          lastSeen: seen,
        };
        await ctx.db
          .insert(plannedDecisions)
          .values({ ...row, firstSeen: seen })
          .onConflictDoUpdate({ target: [plannedDecisions.councilId, plannedDecisions.issueId], set: row });
        if (d.dueUnread) ctx.count("dueUnread");
        ctx.count(before ? "kept" : "new");
      }
      const listedIds = list.decisions.map((d) => d.issueId);
      const gone = held.filter((h) => h.listed && !listedIds.includes(h.issueId)).map((h) => h.issueId);
      if (gone.length)
        await ctx.db
          .update(plannedDecisions)
          .set({ listed: false })
          .where(and(eq(plannedDecisions.councilId, council.id), inArray(plannedDecisions.issueId, gone)));
      ctx.count("noLongerListed", gone.length);

      // The council's page for each matter: new or changed ones first, then those whose day has come, to find the agenda item.
      const hashes = new Map(list.decisions.map((d) => [d.issueId, listHash(d)]));
      const fresh = list.decisions
        .filter((d) => heldById.get(d.issueId)?.detailHash !== hashes.get(d.issueId))
        .sort((a, b) => (a.due?.date ?? "9999").localeCompare(b.due?.date ?? "9999"))
        .map((d) => d.issueId);
      const dayAgo = Date.now() - 20 * 3_600_000;
      const due = held
        .filter((h) => !fresh.includes(h.issueId) && h.takenItemId === null && (h.executiveDue ?? h.due) !== null)
        .filter((h) => {
          const day = (h.executiveDue ?? h.due)!;
          return day <= now && day >= addDays(now, -LOOK_BACK_DAYS) && (!h.detailFetchedAt || h.detailFetchedAt.getTime() < dayAgo);
        })
        .map((h) => h.issueId);
      let pages = 0;
      let unread = 0;
      for (const issueId of [...fresh, ...due].slice(0, MAX_ISSUE_PAGES)) {
        const page = issueUrl(base, issueId);
        if (!(await mayRead(page))) break;
        const p = await fetchText(page, { fresh: true, retries: 1 });
        const issue = p.ok ? parseIssue(p.text) : null;
        if (!issue) {
          unread++;
          // A site that starts refusing is not asked again in this run.
          if (!p.ok && refusalOutcome(p) === "challenge") break;
          continue;
        }
        pages++;
        const current = (await ctx.db.select().from(plannedDecisions).where(and(eq(plannedDecisions.councilId, council.id), eq(plannedDecisions.issueId, issueId))))[0];
        if (!current) continue;
        // The day it goes to the Cabinet: the council's line for the Cabinet where it gives one for each body.
        const stage = issue.stages.find((s) => isExecutiveMaker(s.maker));
        const executiveDue = stage?.due && !stage.due.monthOnly ? stage.due.date : current.executive && !current.dueMonthOnly && !/,/.test(current.makers) ? current.due : null;
        // The agenda item the council links for the day the decision was due, if the meetings held here have it.
        let taken: { meetingId: number; itemId: number } | null = null;
        const day = executiveDue ?? current.due;
        if (day && day <= now) {
          const linked = issue.agendaItems.filter((a) => a.date === day).map((a) => a.agendaItemId);
          if (linked.length) {
            const found = await ctx.db.execute<{ id: number; meetingId: number }>(sql`
              select a.id, a.meeting_id as "meetingId" from agenda_items a join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
              where a.council_id = ${council.id} and a.id in (${sql.join(linked.map((x) => sql`${x}`), sql`, `)}) and m.date = ${day}::date and not m.cancelled
              order by a.id limit 1`);
            if (found[0]) taken = { meetingId: Number(found[0].meetingId), itemId: Number(found[0].id) };
          }
        }
        await ctx.db
          .update(plannedDecisions)
          .set({
            status: issue.status,
            leadMember: issue.leadMember,
            leadDirector: issue.leadDirector,
            executiveDue,
            // The matter's own page says whether it is a key decision; the council's filter stands only where the page does not say.
            isKey: isKeyType(issue.decisionType) ?? current.isKey,
            detailFetchedAt: new Date(),
            detailHash: hashes.get(issueId) ?? current.detailHash,
            ...(taken ? { takenMeetingId: taken.meetingId, takenItemId: taken.itemId } : {}),
          })
          .where(and(eq(plannedDecisions.councilId, council.id), eq(plannedDecisions.issueId, issueId)));
        if (taken) ctx.count("linkedToMeeting");
      }
      ctx.count("issuePages", pages);
      ctx.count("issuePagesUnread", unread);
      await recordRead(ctx, council.id, "forward-plan", list.decisions.length ? "ok" : "empty", list.decisions.length);
      ctx.log(`${council.id}: ${list.decisions.length} listed, ${gone.length} no longer listed, ${pages} pages read`);
    });
    if (trouble.length) throw new PartialFailure(`forthcoming decisions could not be read: ${trouble.join("; ")}`);
  },
};
