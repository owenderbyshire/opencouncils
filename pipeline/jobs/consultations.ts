/**
 * Open consultations: the Welsh Government's (from gov.wales) and, where a
 * council lists its own in a form we can read, the council's. A consultation
 * the source stops listing as open is kept, marked closed, so the site can
 * show what closed recently. Copied from OpenSenedd's job.
 *
 *   pnpm pipeline consultations
 */
import { and, eq, inArray, not, sql } from "drizzle-orm";
import { topicsFor } from "../../data/curated/topics";
import { consultations } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import type { Job, JobContext } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { mapLimit } from "../lib/util";
import { CONSULTATION_PAGES } from "../../data/curated/consultation-pages";
import { COUNCIL_READERS } from "../sources/council-consultations";
import {
  OPEN_CONSULTATIONS_URL,
  parseConsultationList,
  parseConsultationPage,
  type ListedConsultation,
} from "../sources/govwales";

const MAX_PAGES = 15;

async function closeMissing(ctx: JobContext, source: string, openUrls: string[]) {
  const where = openUrls.length
    ? and(eq(consultations.source, source), eq(consultations.open, true), not(inArray(consultations.url, openUrls)))
    : and(eq(consultations.source, source), eq(consultations.open, true));
  const closed = await ctx.db
    .update(consultations)
    .set({ open: false, fetchedAt: new Date() })
    .where(where)
    .returning({ url: consultations.url });
  ctx.count(`${source}Closed`, closed.length);
}

async function government(ctx: JobContext): Promise<void> {
  const listed: ListedConsultation[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = page ? `${OPEN_CONSULTATIONS_URL}&page=${page}` : OPEN_CONSULTATIONS_URL;
    const r = await fetchText(url, { fresh: true });
    if (!r.ok) throw new Error(`gov.wales consultations page ${page + 1} unavailable: ${r.error}`);
    const { items, total, hasNext } = parseConsultationList(r.text);
    listed.push(...items);
    if (page === 0) ctx.stats.govListed = total ?? items.length;
    if (!hasNext || !items.length) break;
  }
  const known = new Map(
    (
      await ctx.db
        .select({ url: consultations.url, closes: consultations.closes, titleCy: consultations.titleCy })
        .from(consultations)
        .where(eq(consultations.source, "gov"))
    ).map((r) => [r.url, r]),
  );
  let failures = 0;
  await mapLimit(listed, 2, async (item) => {
    const had = known.get(item.url);
    if (had?.closes && had.titleCy) {
      await ctx.db
        .update(consultations)
        .set({ open: true, typeEn: item.type, area: item.area, fetchedAt: new Date() })
        .where(eq(consultations.url, item.url));
      return;
    }
    const en = await fetchText(item.url, { fresh: true });
    if (!en.ok) {
      failures++;
      ctx.warn(`consultation page unavailable: ${item.url} (${en.error})`);
      return;
    }
    const page = parseConsultationPage(en.text);
    let cy: ReturnType<typeof parseConsultationPage> | null = null;
    if (page.urlCy) {
      const w = await fetchText(page.urlCy, { fresh: true, acceptLanguage: "cy-GB,cy;q=0.9" });
      if (w.ok) cy = parseConsultationPage(w.text);
      else ctx.count("welshFailures");
    }
    const title = page.title || item.title;
    const row = {
      url: item.url,
      source: "gov",
      councilId: null,
      typeEn: item.type,
      titleEn: title,
      titleCy: cy?.title || null,
      urlCy: page.urlCy,
      summaryEn: page.summary,
      summaryCy: cy?.summary ?? null,
      area: item.area,
      opens: page.opens ?? item.published,
      closes: page.closes,
      open: true,
      topics: topicsFor(title, page.summary, item.area),
      fetchedAt: new Date(),
    };
    await ctx.db.insert(consultations).values(row).onConflictDoUpdate({ target: consultations.url, set: row });
    ctx.count("govRead");
  });
  ctx.count("gov", listed.length);
  if (failures > listed.length / 4) throw new PartialFailure(`${failures} consultation pages could not be fetched`);
  await closeMissing(ctx, "gov", listed.map((c) => c.url));
}

/** Councils whose own pages list consultations with dates (pipeline/sources/council-consultations.ts). */
async function councils(ctx: JobContext): Promise<void> {
  const failed: string[] = [];
  for (const [councilId, read] of Object.entries(COUNCIL_READERS)) {
    const page = CONSULTATION_PAGES[councilId];
    const r = await fetchText(page.en, { fresh: true });
    if (!r.ok) {
      failed.push(`${councilId}: ${r.error}`);
      continue;
    }
    const list = read(r.text, page.en);
    // An empty list from a page that loaded is plausible, but more often means the page changed.
    if (!list.length) ctx.warn(`${councilId}: no consultations found on ${page.en}`);
    for (const c of list) {
      const row = {
        url: c.url,
        source: councilId,
        councilId,
        typeEn: null,
        titleEn: c.title,
        titleCy: null,
        urlCy: null,
        summaryEn: c.summary,
        summaryCy: null,
        area: null,
        opens: c.opens,
        closes: c.closes,
        open: true,
        topics: topicsFor(c.title, c.summary),
        fetchedAt: new Date(),
      };
      await ctx.db.insert(consultations).values(row).onConflictDoUpdate({ target: consultations.url, set: row });
    }
    ctx.count(councilId, list.length);
    await closeMissing(ctx, councilId, list.map((c) => c.url));
  }
  if (failed.length) throw new Error(failed.join("; "));
}

export const consultationsJob: Job = {
  name: "consultations",
  watches: [
    {
      tags: ["consultations"],
      sources: [{ table: "consultations" }],
    },
  ],
  description: "Open consultations from the Welsh Government and councils",
  async run(ctx) {
    const errors: string[] = [];
    for (const [name, fn] of [
      ["gov", government],
      ["councils", councils],
    ] as const) {
      try {
        await fn(ctx);
      } catch (err) {
        errors.push(`${name}: ${(err as Error).message}`);
        ctx.warn(`${name} consultations failed: ${(err as Error).message}`);
      }
    }
    await ctx.db.execute(
      sql`delete from consultations where not open and coalesce(closes, fetched_at::date) < now() - interval '1 year'`,
    );
    if (errors.length) throw new PartialFailure(errors.join("; "));
  },
};
