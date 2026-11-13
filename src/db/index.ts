import { createDb, type Db } from "./client";

export * as schema from "./schema";
export type { Db };

const globalForDb = globalThis as unknown as { __osDb?: ReturnType<typeof createDb> };

/** Lazily-created shared client for the web app. */
export function getDb(): Db {
  if (!globalForDb.__osDb) {
    // Neon via Vercel names its variables with a STORAGE_ prefix.
    const url = process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.__osDb = createDb(url, { max: Number(process.env.DB_POOL_MAX ?? 5) });
  }
  return globalForDb.__osDb.db;
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL);
}
