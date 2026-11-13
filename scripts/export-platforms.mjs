/**
 * Writes data/curated/platforms.json from the platform census held in the
 * database (pipeline_state "census"). Run after `pnpm pipeline census`; the
 * census workflow does both and commits the file when it changes.
 *
 *   DATABASE_URL=... node scripts/export-platforms.mjs
 *
 * Keeps the file's "active" list (councils switched on for full pages) as it is.
 */
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL must be set");
const sql = postgres(url, { max: 1 });
const [row] = await sql`select value from pipeline_state where key = 'census'`;
await sql.end();
if (!row) throw new Error("No census in the database yet: run `pnpm pipeline census` first");

const file = new URL("../data/curated/platforms.json", import.meta.url);
const current = JSON.parse(readFileSync(file, "utf8"));
const councils = Object.fromEntries(
  Object.entries(row.value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, e]) => [id, { platform: e.platform, base: e.base, website: e.website, feedOk: e.feedOk, checked: e.checked, ...(e.note ? { note: e.note } : {}) }]),
);
const checked = Object.values(councils).map((e) => e.checked).sort().at(-1) ?? null;
writeFileSync(file, `${JSON.stringify({ ...current, checked, councils }, null, 1)}\n`);
const tally = {};
for (const e of Object.values(councils)) tally[e.platform + (e.feedOk ? " (feed ok)" : "")] = (tally[e.platform + (e.feedOk ? " (feed ok)" : "")] ?? 0) + 1;
console.log(`${Object.keys(councils).length} councils`, tally);
