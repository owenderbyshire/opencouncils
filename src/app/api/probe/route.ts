/**
 * Reads back a reply saved by the pipeline's probe job. Protected by the
 * revalidation secret, passed as ?token=. For development only.
 *
 *   GET /api/probe?token=...&n=0
 */
import { timingSafeEqual } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { one, rows, sql } from "@/data/db";

export async function GET(request: NextRequest) {
  await connection();
  const url = new URL(request.url);
  const token = Buffer.from(url.searchParams.get("token") ?? "");
  const secret = Buffer.from(process.env.REVALIDATE_SECRET ?? "");
  if (!secret.length || token.length !== secret.length || !timingSafeEqual(token, secret))
    return new Response("Not found", { status: 404 });
  // ?runs=1: the latest pipeline runs, with their errors.
  if (url.searchParams.get("runs")) {
    // ?runs=N: the latest N runs (40 at most), errors cut to 600 characters.
    const n = Math.min(40, Math.max(1, Number(url.searchParams.get("runs")) || 40));
    const runs = await rows(sql`select job, started_at::text as "startedAt", finished_at::text as "finishedAt", status, stats, left(error, 600) as error
      from pipeline_runs order by started_at desc limit ${n}`);
    return new Response(JSON.stringify(runs, null, 1), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  }
  const name = url.searchParams.get("key");
  if (name && /^[a-zA-Z0-9-]{1,40}$/.test(name)) {
    const saved = await one<{ value: unknown }>(sql`select value from pipeline_state where key = ${`probe:${name}`}`);
    if (!saved) return new Response("No probe saved", { status: 404 });
    let value = saved.value as Record<string, unknown>;
    // ?compact=1: just each column's values, without the raw filters, rows or figures.
    if (url.searchParams.get("compact") && value && typeof value === "object") {
      const distinct = (value.distinct ?? {}) as Record<string, string[]>;
      value = {
        count: value.count,
        tried: value.tried,
        columns: Object.fromEntries(
          Object.entries(distinct)
            .filter(([k]) => !/^data values?$/i.test(k))
            .map(([k, v]) => [k, v.slice(0, 40)]),
        ),
      };
    }
    return new Response(JSON.stringify(value, null, 1).slice(0, 200_000), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const n = Number(url.searchParams.get("n") ?? "0");
  const row = await one<{ value: { url: string; ok: boolean; status: number; at: string; text: string } }>(
    sql`select value from pipeline_state where key = ${`probe:${Number.isFinite(n) ? n : 0}`}`,
  );
  if (!row) return new Response("No probe saved", { status: 404 });
  const { text, ...meta } = row.value;
  const from = Number(url.searchParams.get("from") ?? "0");
  return new Response(`${JSON.stringify(meta)}\n\n${text.slice(from, from + 60_000)}`, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
