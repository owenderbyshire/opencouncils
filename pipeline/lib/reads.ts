/**
 * Keeps a note of each look at a council's web pages (its executive posts, its
 * forthcoming decisions): when, and what came back. The site uses it to say
 * when a council was last read and why another is not shown.
 */
import { sql } from "drizzle-orm";
import { sourceReads } from "../../src/db/schema";
import type { FetchResult } from "./http";
import type { JobContext } from "./job";

/**
 * - ok: read in full
 * - empty: read, and the council lists nothing there
 * - robots: the council's robots.txt closes the page, so it was not asked for
 * - challenge: the site refused, or asked automated readers to pass a check; the pipeline does not attempt one
 * - missing: the site has no such page
 * - failed: no answer, or one that was not the page expected
 */
export type ReadOutcome = "ok" | "empty" | "robots" | "challenge" | "missing" | "failed";

export type ReadSource = "executive-posts" | "forward-plan";

/** What a reply that was not the page means. */
export function refusalOutcome(r: Extract<FetchResult, { ok: false }>): "challenge" | "missing" | "failed" {
  if (r.status === 404 || r.status === 410) return "missing";
  if (r.status === 401 || r.status === 403 || /just a moment|azure waf|js challenge|captcha|request blocked|access denied/i.test(r.error)) return "challenge";
  return "failed";
}

export async function recordRead(ctx: JobContext, councilId: string, source: ReadSource, outcome: ReadOutcome, rows = 0, note: string | null = null): Promise<void> {
  const now = new Date();
  const read = outcome === "ok" || outcome === "empty";
  await ctx.db
    .insert(sourceReads)
    .values({ councilId, source, checkedAt: now, readAt: read ? now : null, outcome, rows, note })
    .onConflictDoUpdate({
      target: [sourceReads.councilId, sourceReads.source],
      // A look that failed keeps the date of the last full read, and the count of what that read found.
      set: read ? { checkedAt: now, readAt: now, outcome, rows, note } : { checkedAt: now, outcome, note, readAt: sql`${sourceReads.readAt}`, rows: sql`${sourceReads.rows}` },
    });
  ctx.count(outcome);
}
