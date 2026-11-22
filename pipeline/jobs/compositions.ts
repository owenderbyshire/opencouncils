/**
 * Every council's party balance and control, from Open Council Data UK's free files. Weekly is plenty: the files
 * change after elections, by-elections and defections.
 *
 *   pnpm pipeline compositions [--year 2026]
 */
import { sql } from "drizzle-orm";
import { REGISTER } from "../../data/curated/councils";
import { councilCompositions } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber } from "../lib/util";
import { compositions, councilMatcher, councillorsCsvUrl, HISTORY_CSV_URL, parseCouncillors, parseHistory } from "../sources/opencouncildata";

export const compositionsJob: Job = {
  name: "compositions",
  watches: [{ tags: ["reference"], sources: [{ table: "council_compositions" }] }],
  description: "Party balance and control of every council, from Open Council Data UK",
  async run(ctx) {
    const history = await fetchText(HISTORY_CSV_URL, { retries: 2, timeoutMs: 60_000 });
    if (!history.ok) throw new Error(`Open Council Data history could not be fetched (${history.error})`);
    const hist = parseHistory(history.text);
    if (hist.length < 300) throw new Error(`Open Council Data history has only ${hist.length} rows; leaving the stored figures alone`);

    // The councillor file for this year once it exists, otherwise last year's.
    const thisYear = new Date().getUTCFullYear();
    const years = argNumber(ctx.args, "year") ? [argNumber(ctx.args, "year")!] : [thisYear, thisYear - 1];
    let year = 0;
    let rows: ReturnType<typeof parseCouncillors> = [];
    for (const y of years) {
      const r = await fetchText(councillorsCsvUrl(y), { retries: 2, timeoutMs: 90_000 });
      const parsed = r.ok ? parseCouncillors(r.text) : [];
      if (parsed.length > 10_000) {
        year = y;
        rows = parsed;
        break;
      }
    }
    if (!year) throw new Error(`no Open Council Data councillor file for ${years.join(" or ")} with enough rows; leaving the stored figures alone`);

    const match = councilMatcher(REGISTER, hist);
    const { found, unmatched } = compositions(rows, match);
    const control = new Map<string, string | null>();
    for (const h of hist.filter((x) => x.year === year)) {
      const id = match(h.authority);
      if (id) control.set(id, h.control);
    }
    // Safeguard: a file that matches far fewer councils than the register holds is read as broken.
    if (found.length < 300) throw new PartialFailure(`only ${found.length} councils matched in Open Council Data's ${year} file; nothing stored`);

    await ctx.db.transaction(async (tx) => {
      await tx.execute(sql`delete from council_compositions where year = ${year}`);
      for (const f of found)
        await tx.insert(councilCompositions).values({ councilId: f.councilId, year, seats: f.seats, parties: f.parties, control: control.get(f.councilId) ?? null });
    });
    ctx.count("councils", found.length);
    ctx.count("councillors", rows.length);
    ctx.stats.year = year;
    ctx.touched.add("reference");
    if (unmatched.length) {
      ctx.warn(`${unmatched.length} council names in Open Council Data's file matched nothing in the register: ${unmatched.slice(0, 20).join(", ")}`);
      ctx.stats.unmatched = unmatched.join("; ").slice(0, 500);
    }
  },
};
