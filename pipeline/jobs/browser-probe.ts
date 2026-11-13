/**
 * Checks whether a real browser can download reports from the councils whose
 * report downloads refuse the pipeline (Cloudflare "Just a moment" pages). For
 * each, it opens a page on the council's site, then requests two recent
 * reports with the browser's cookies, and records what came back.
 *
 *   pnpm pipeline browser-probe   (the workflow installs Chromium for it)
 */
import { chromium } from "@playwright/test";
import { sql } from "drizzle-orm";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import type { Job } from "../lib/job";

const COUNCILS = ["cardiff", "powys", "torfaen", "rhondda-cynon-taf"];

export const browserProbeJob: Job = {
  name: "browser-probe",
  description: "Checks whether a browser can download reports that refuse the pipeline",
  async run(ctx) {
    const browser = await chromium.launch();
    try {
      for (const id of COUNCILS) {
        const base = ACTIVE_COUNCILS.find((c) => c.id === id)?.moderngovBase;
        if (!base) continue;
        const docs = await ctx.db.execute<{ url: string }>(sql`
          select d.url from documents d join meetings m on m.council_id = d.council_id and m.id = d.meeting_id
          where d.council_id = ${id} and m.date < now() order by m.date desc limit 2`);
        const context = await browser.newContext({ locale: "en-GB" });
        const page = await context.newPage();
        const out: string[] = [];
        try {
          const first = await page.goto(`${base}/mgListCommittees.aspx`, { waitUntil: "domcontentloaded", timeout: 45_000 });
          out.push(`page ${first?.status() ?? "?"}`);
          for (const d of docs) {
            const url = d.url.replace(/^http:/, "https:");
            // Open the report as a page first, so any challenge runs and sets its cookie.
            const r = await page.goto(url, { waitUntil: "load", timeout: 45_000 }).catch((e: Error) => e);
            if (r instanceof Error) out.push(`goto: ${r.message.slice(0, 60)}`);
            else out.push(`goto ${r?.status() ?? "?"} ${(await page.title().catch(() => "")).slice(0, 30)}`);
            await page.waitForTimeout(8_000);
            const res = await context.request.get(url, { timeout: 45_000 });
            const body = await res.body();
            out.push(`get ${res.status()}${body[0] === 0x25 && body[1] === 0x50 ? " pdf" : ` ${res.headers()["content-type"] ?? ""}`}`);
          }
        } catch (e) {
          out.push((e as Error).message.slice(0, 80));
        }
        ctx.stats[`browser ${id}`] = out.join("; ");
        await context.close();
      }
    } finally {
      await browser.close();
    }
  },
};
