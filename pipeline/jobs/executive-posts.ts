/**
 * Each council's executive posts ("Cabinet Member for Education") and who
 * holds them, from the executive posts pages of its ModernGov site, and for
 * the Vale of Glamorgan from its own Cabinet page. The site shows a post only
 * for a councillor the council's committee list puts on its Cabinet, and only
 * where the council's list of councillors doesn't already name the portfolio
 * (src/lib/cabinet.ts).
 *
 * These are web pages, not the web service, so each is asked for only where
 * the council's robots.txt allows, and a site that answers with a check for
 * automated readers is left alone. A council is replaced whole or not at all:
 * if any one of its posts can't be read, what was held before stays.
 *
 * No AI. A handful of requests per council, one at a time.
 *
 *   pnpm pipeline executive-posts [--council swansea] [--force]
 */
import { and, eq } from "drizzle-orm";
import { RECORD_COUNCILS, type CouncilConfig } from "../../data/curated/councils";
import { councillors, executivePosts, sourceReads } from "../../src/db/schema";
import { isExecutivePost } from "../../src/lib/cabinet";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { recordRead, refusalOutcome } from "../lib/reads";
import { permission } from "../lib/robots";
import { argString, COUNCILS_AT_ONCE, mapLimit } from "../lib/util";
import { execPostsUrl, execPostUrl, isModernGovPage, parseExecPost, parseExecPostList } from "../sources/moderngov-pages";
import { parseValeCabinet, VALE_CABINET_URL } from "../sources/vale-cabinet";
import { valeId } from "./vale";

/** More posts than this on one council's list means the list is not its Cabinet: nothing is read. */
const MAX_POSTS = 40;
/** A site that was closed or refused is asked again after this many days. */
const RETRY_CLOSED_DAYS = 6;

interface PostRow {
  postId: number;
  councillorId: number;
  title: string;
  url: string;
}

type Read = { outcome: "ok" | "empty"; rows: PostRow[]; note?: string } | { outcome: "robots" | "challenge" | "missing" | "failed"; note: string };

/** Why a page was not asked for, or null when it may be read. A site whose robots.txt could not be read is not the same as one that closes the page. */
async function notAsked(url: string): Promise<{ outcome: "robots" | "failed"; note: string } | null> {
  const may = await permission(url);
  if (may === "allowed") return null;
  return may === "closed" ? { outcome: "robots", note: "robots.txt closes the page" } : { outcome: "failed", note: "robots.txt could not be read, so the page was not asked for" };
}

/** A ModernGov council: the list of posts, then each executive post's own page for its holder. */
async function readModernGov(base: string): Promise<Read> {
  const listUrl = execPostsUrl(base);
  const closed = await notAsked(listUrl);
  if (closed) return closed;
  const list = await fetchText(listUrl, { fresh: true, retries: 1 });
  if (!list.ok) return { outcome: refusalOutcome(list), note: list.error.slice(0, 200) };
  if (!isModernGovPage(list.text)) return { outcome: "failed", note: "the reply was not a ModernGov page" };
  // Councils also keep champions, school governors and political groups' posts here: only executive posts are read.
  const posts = parseExecPostList(list.text).filter((p) => isExecutivePost(p.title));
  if (!posts.length) return { outcome: "empty", rows: [] };
  if (posts.length > MAX_POSTS) return { outcome: "failed", note: `${posts.length} executive posts listed: more than a Cabinet has` };
  const rows: PostRow[] = [];
  for (const p of posts) {
    const url = execPostUrl(base, p.id);
    const postClosed = await notAsked(url);
    if (postClosed) return postClosed;
    const r = await fetchText(url, { fresh: true, retries: 1 });
    if (!r.ok) return { outcome: refusalOutcome(r), note: `post ${p.id}: ${r.error.slice(0, 160)}` };
    const post = parseExecPost(r.text);
    if (!post) return { outcome: "failed", note: `post ${p.id}: the page was not an executive post` };
    // The post's own page is the record: its title there is the one kept.
    for (const h of post.holders) rows.push({ postId: p.id, councillorId: h.councillorId, title: post.title, url });
  }
  return { outcome: rows.length ? "ok" : "empty", rows, note: rows.length ? undefined : "every post is listed without a holder" };
}

/** The Vale of Glamorgan: one table on its Cabinet page. Its councillors are numbered from the address of their own page, which the table links. */
async function readVale(): Promise<Read> {
  const closed = await notAsked(VALE_CABINET_URL);
  if (closed) return closed;
  const r = await fetchText(VALE_CABINET_URL, { fresh: true, retries: 1 });
  if (!r.ok) return { outcome: refusalOutcome(r), note: r.error.slice(0, 200) };
  const parsed = parseValeCabinet(r.text);
  if (!parsed) return { outcome: "failed", note: "the Cabinet page has no portfolio table that could be read" };
  return { outcome: "ok", rows: parsed.map((p) => ({ postId: p.postId, councillorId: valeId(p.holderUrl), title: p.title, url: VALE_CABINET_URL })) };
}

export const executivePostsJob: Job = {
  name: "executive-posts",
  watches: [
    {
      tags: ["councillors"],
      sources: [{ table: "executive_posts" }],
    },
  ],
  description: "Executive posts (Cabinet portfolios) and their holders, from each council's own pages",
  async run(ctx) {
    const only = argString(ctx.args, "council");
    const list = RECORD_COUNCILS.filter((c: CouncilConfig) => !only || c.id === only);
    if (only && !list.length) throw new Error(`No active council called "${only}"`);
    const trouble: string[] = [];
    await mapLimit(list, COUNCILS_AT_ONCE, async (council) => {
      // A site that was closed to the pipeline or refused it is asked again after a few days, not every day.
      const [last] = await ctx.db
        .select({ outcome: sourceReads.outcome, checkedAt: sourceReads.checkedAt })
        .from(sourceReads)
        .where(and(eq(sourceReads.councilId, council.id), eq(sourceReads.source, "executive-posts")));
      if (!only && ctx.args.force !== true && last && ["robots", "challenge", "missing"].includes(last.outcome) && Date.now() - last.checkedAt.getTime() < RETRY_CLOSED_DAYS * 86_400_000) {
        ctx.count("leftAlone");
        return;
      }
      let read: Read;
      try {
        read = council.system === "vale" ? await readVale() : council.moderngovBase ? await readModernGov(council.moderngovBase) : { outcome: "missing", note: "no ModernGov site" };
      } catch (e) {
        read = { outcome: "failed", note: (e as Error).message.slice(0, 200) };
      }
      if (read.outcome !== "ok" && read.outcome !== "empty") {
        // What was read before stays: a look that failed says nothing about who holds what.
        await recordRead(ctx, council.id, "executive-posts", read.outcome, 0, read.note);
        ctx.log(`${council.id}: not read (${read.outcome}: ${read.note})`);
        if (read.outcome === "failed") trouble.push(`${council.id}: ${read.note}`);
        return;
      }
      // Holders the council's own list of councillors doesn't have are dropped: a post can't be shown without its councillor.
      const known = new Set(
        (await ctx.db.select({ id: councillors.id }).from(councillors).where(and(eq(councillors.councilId, council.id), eq(councillors.current, true)))).map((c) => c.id),
      );
      const rows = read.rows.filter((r) => known.has(r.councillorId));
      ctx.count("unknownHolders", read.rows.length - rows.length);
      const now = new Date();
      await ctx.db.transaction(async (tx) => {
        await tx.delete(executivePosts).where(eq(executivePosts.councilId, council.id));
        if (rows.length) await tx.insert(executivePosts).values(rows.map((r) => ({ councilId: council.id, ...r, fetchedAt: now }))).onConflictDoNothing();
      });
      await recordRead(ctx, council.id, "executive-posts", rows.length ? "ok" : "empty", rows.length, read.note ?? null);
      ctx.count("posts", rows.length);
      ctx.log(`${council.id}: ${rows.length} posts with holders`);
    });
    if (trouble.length) throw new PartialFailure(`executive posts could not be read: ${trouble.join("; ")}`);
  },
};
