/**
 * Prints the start of each URL given, to the run's log, so a parser can be written for a source the build
 * environment can't reach. Changes nothing.
 *
 *   pnpm pipeline peek --urls https://example.org/a.csv,https://example.org/b.json [--chars 3000]
 */
import { fetchText } from "../lib/http";
import type { Job } from "../lib/job";
import { argNumber, argString } from "../lib/util";

export const peekJob: Job = {
  name: "peek",
  description: "Prints the start of the given URLs to the log (no changes)",
  async run(ctx) {
    const urls = (argString(ctx.args, "urls") ?? "").split(/[\s,]+/).map((u) => u.replace(/^["']|["']$/g, "")).filter(Boolean);
    const chars = argNumber(ctx.args, "chars") ?? 3000;
    for (const url of urls) {
      const r = await fetchText(url, { retries: 1, timeoutMs: 30_000, fresh: true });
      ctx.log(`=== ${url}\n${r.ok ? `${r.text.length} chars\n${r.text.slice(0, chars)}` : `failed: ${r.error}`}\n=== end`);
    }
  },
};
