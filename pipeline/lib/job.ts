/**
 * Job framework. Every pipeline job is idempotent: running it twice leaves the
 * database in the same state as running it once. Each run is recorded in
 * `pipeline_runs` with counts, so the public data-status page can show exactly
 * when each dataset was last refreshed and whether it succeeded.
 */
import { eq } from "drizzle-orm";
import { createDb, type Db } from "../../src/db/client";
import { pipelineRuns, pipelineState } from "../../src/db/schema";
import { startWatches, type Watch } from "./fingerprint";

export interface JobContext {
  db: Db;
  args: Record<string, string | boolean>;
  log: (msg: string, extra?: Record<string, unknown>) => void;
  warn: (msg: string, extra?: Record<string, unknown>) => void;
  stats: Record<string, number | string>;
  count: (key: string, by?: number) => void;
  getState: <T>(key: string) => Promise<T | null>;
  setState: (key: string, value: unknown) => Promise<void>;
  /** Tags of website caches that should be refreshed after this run. */
  touched: Set<string>;
}

export interface Job {
  name: string;
  description: string;
  /**
   * Tables the job's output comes from, with the cache tags they feed. The
   * runner revalidates those tags only when the tables changed. Tags that a
   * job adds to `ctx.touched` itself are sent as they are.
   */
  watches?: Watch[];
  run: (ctx: JobContext) => Promise<void>;
}

export class PartialFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PartialFailure";
  }
}

let shared: ReturnType<typeof createDb> | null = null;

export function pipelineDb() {
  if (!shared) {
    const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
    if (!url)
      throw new Error(
        "DATABASE_URL (or DATABASE_URL_DIRECT) must be set for the pipeline",
      );
    shared = createDb(url, {
      max: Number(process.env.PIPELINE_DB_POOL ?? 8),
      idleTimeout: 60,
    });
  }
  return shared;
}

export async function closePipelineDb() {
  if (shared) {
    await shared.client.end({ timeout: 5 });
    shared = null;
  }
}

function stamp() {
  return new Date().toISOString().slice(11, 19);
}

export async function runJob(
  job: Job,
  args: Record<string, string | boolean>,
  touched: Set<string>,
): Promise<{
  status: "ok" | "partial" | "failed";
  stats: Record<string, number | string>;
}> {
  const { db } = pipelineDb();
  const [run] = await db
    .insert(pipelineRuns)
    .values({ job: job.name })
    .returning({ id: pipelineRuns.id });
  const stats: Record<string, number | string> = {};
  let warnings = 0;
  const ctx: JobContext = {
    db,
    args,
    stats,
    touched,
    log: (msg, extra) =>
      console.log(
        `[${stamp()}] ${job.name}: ${msg}${extra ? " " + JSON.stringify(extra) : ""}`,
      ),
    warn: (msg, extra) => {
      console.warn(
        `[${stamp()}] ${job.name}: WARN ${msg}${extra ? " " + JSON.stringify(extra) : ""}`,
      );
      // The first few warnings also show on the GitHub Actions run page.
      if (process.env.GITHUB_ACTIONS && warnings++ < 8)
        console.log(
          `::warning title=${job.name}::${msg.replace(/\r?\n/g, " ").slice(0, 500)}`,
        );
    },
    count: (key, by = 1) => {
      stats[key] = (Number(stats[key]) || 0) + by;
    },
    getState: async <T>(key: string) => {
      const row = await db.query.pipelineState.findFirst({
        where: eq(pipelineState.key, key),
      });
      return (row?.value as T) ?? null;
    },
    setState: async (key, value) => {
      await db
        .insert(pipelineState)
        .values({ key, value: value as object, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: pipelineState.key,
          set: { value: value as object, updatedAt: new Date() },
        });
    },
  };

  const started = Date.now();
  console.log(`[${stamp()}] ${job.name}: starting`);
  let status: "ok" | "partial" | "failed" = "ok";
  let error: string | null = null;
  const finishWatches = job.watches?.length
    ? await startWatches(db, job.watches, (m) => ctx.log(m))
    : null;
  try {
    await job.run(ctx);
  } catch (err) {
    status = err instanceof PartialFailure ? "partial" : "failed";
    error =
      err instanceof Error
        ? `${err.message}\n${err.stack ?? ""}`.slice(0, 4000)
        : String(err);
    console.error(`[${stamp()}] ${job.name}: ${status.toUpperCase()}`, err);
  }
  if (finishWatches) for (const tag of await finishWatches()) touched.add(tag);
  stats.durationMs = Date.now() - started;
  await db
    .update(pipelineRuns)
    .set({ finishedAt: new Date(), status, stats, error })
    .where(eq(pipelineRuns.id, run.id));
  console.log(`[${stamp()}] ${job.name}: ${status}`, JSON.stringify(stats));
  // On GitHub Actions, each job's outcome also shows as an annotation on the run's summary page.
  if (process.env.GITHUB_ACTIONS) {
    const level =
      status === "ok" ? "notice" : status === "partial" ? "warning" : "error";
    const detail =
      `${status}: ${JSON.stringify(stats)}${error ? ` ${error.split("\n")[0]}` : ""}`.replace(
        /\r?\n/g,
        " ",
      );
    console.log(`::${level} title=${job.name}::${detail}`);
  }
  return { status, stats };
}
