import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";

export { getDb };

/**
 * Runs a raw SQL query and returns typed rows. Use `::int`, `::float8` and
 * `::text` casts in the SQL so counts, numerics and dates arrive as plain
 * numbers and strings (postgres.js returns bigint and numeric as strings and
 * dates as Date objects otherwise).
 */
export async function rows<T>(query: SQL): Promise<T[]> {
  const result = await getDb().execute(query);
  return Array.from(result as unknown as T[]);
}

export async function one<T>(query: SQL): Promise<T | null> {
  const r = await rows<T>(query);
  return r[0] ?? null;
}

export { sql };

export const PAGE_SIZE = 30;

export function offsetFor(page: number, size = PAGE_SIZE) {
  return Math.max(0, (Math.max(1, Math.floor(page)) - 1) * size);
}
