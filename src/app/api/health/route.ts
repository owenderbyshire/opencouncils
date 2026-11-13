/**
 * Uptime check: confirms the site can reach the database and reports when
 * the data was last refreshed. Never cached.
 */
import { connection } from "next/server";
import { one, sql } from "@/data/db";

export async function GET() {
  await connection();
  try {
    const r = await one<{ lastRun: string | null }>(sql`
      select max(finished_at)::text as "lastRun" from pipeline_runs where status in ('ok', 'partial')
    `);
    return Response.json(
      { ok: true, lastPipelineRun: r?.lastRun ?? null },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
