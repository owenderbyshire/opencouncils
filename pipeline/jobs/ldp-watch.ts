/**
 * Once a month, reads each authority's development plan pages (the plan in
 * force, the new plan and the monitoring reports, from data/curated/ldps.ts)
 * and lists the documents they link to. New links since last time, such as a
 * new monitoring report or a draft plan, are emailed to the site's owner so
 * the plan list can be updated by hand. Nothing changes on the site by itself.
 *
 *   pnpm pipeline ldp-watch [--force]
 */
import { LDPS } from "../../data/curated/ldps";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { notifyOwner } from "../lib/notify";
import { documentLinks } from "../sources/ldp";

const MONTH = 28 * 86_400_000;

export const ldpWatchJob: Job = {
  name: "ldp-watch",
  description: "Monthly check of each authority's plan pages for new documents",
  async run(ctx) {
    const last = await ctx.getState<{ at: string; links: Record<string, string[]> }>("ldp-watch");
    if (ctx.args.force !== true && last && Date.now() - Date.parse(last.at) < MONTH) {
      ctx.log(`checked on ${last.at.slice(0, 10)}; next check after four weeks`);
      return;
    }
    const links: Record<string, string[]> = {};
    const found: string[] = [];
    const problems: string[] = [];
    for (const l of LDPS) {
      const pages = [l.adopted.pageUrl, l.replacement.pageUrl, l.amr.source]
        .flatMap((s) => (s ?? "").split(/[\s;]+/))
        .filter((u) => /^https?:\/\//.test(u) && !/\.pdf($|\?)/i.test(u));
      for (const page of [...new Set(pages)]) {
        const r = await fetchText(page, { fresh: true });
        if (!r.ok) {
          problems.push(`${l.id}: ${page}: ${r.error.slice(0, 80)}`);
          continue;
        }
        const now = documentLinks(r.text, page);
        links[page] = now;
        const before = last?.links[page];
        if (!before) continue; // First look at this page: nothing to compare with.
        const added = now.filter((u) => !before.includes(u));
        for (const u of added) found.push(`${l.id}: ${u}\n  (on ${page})`);
      }
    }
    ctx.count("pages", Object.keys(links).length);
    ctx.count("new documents", found.length);
    if (found.length) {
      for (const f of found) ctx.log(`NEW ${f}`);
      await notifyOwner(
        ctx,
        "ldp-watch",
        `OpenCouncil: ${found.length} new development plan document${found.length === 1 ? "" : "s"}`,
        [
          "These documents have appeared on councils' and national parks' development plan pages since last month's check. If any is a new monitoring report, a draft plan or an adopted plan, add it to data/curated/ldps.ts so it is read.",
          "",
          ...found,
          "",
          ...(problems.length ? ["Pages that couldn't be read:", ...problems] : []),
        ].join("\n"),
      );
    }
    await ctx.setState("ldp-watch", { at: new Date().toISOString(), links: { ...(last?.links ?? {}), ...links } });
    if (problems.length > Object.keys(links).length / 2) throw new PartialFailure(problems.join("; "));
    for (const p of problems) ctx.warn(p);
  },
};
