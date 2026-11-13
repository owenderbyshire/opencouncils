import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>["db"];

/**
 * Creates a Drizzle client. The web app uses a small pool (serverless-friendly);
 * the pipeline asks for a larger one. `prepare: false` keeps it compatible with
 * transaction-mode poolers such as Neon's or PgBouncer.
 */
export function createDb(url: string, opts: { max?: number; idleTimeout?: number } = {}) {
  const client = postgres(url, {
    max: opts.max ?? 5,
    idle_timeout: opts.idleTimeout ?? 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema, casing: undefined });
  return { db, client };
}
