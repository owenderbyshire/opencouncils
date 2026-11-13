/**
 * Change detection for cache revalidation.
 *
 * Every page that carries a cache tag is rewritten (an ISR write, which
 * Vercel bills) the next time it is visited after the tag is revalidated.
 * Jobs that re-read a source every night used to revalidate their tags every
 * night, even when the source had not changed. A job now lists the tables
 * its output comes from (`Job.watches`). The runner hashes them before and
 * after the job and revalidates the tags only when the hash moved.
 *
 * Timestamps that record when a row was written (`*_at`) and serial row ids
 * are left out of the hash, because delete-and-reinsert jobs change them
 * without changing anything a reader sees. If the hash cannot be computed,
 * the tags are revalidated, so a fault here can only cost money, never
 * leave a page stale.
 */
import { sql } from "drizzle-orm";
import type { Db } from "../../src/db/client";

export interface Watched {
  table: string;
  /** Further columns to leave out of the hash. */
  exclude?: string[];
  /** SQL filter on the table (trusted, written in code). */
  where?: string;
  /** SQL expression to hash instead of the table's columns (trusted). */
  expr?: string;
}

export interface Watch {
  /** Tags to revalidate when any watched table changed. */
  tags: string[];
  sources: Watched[];
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

async function tableHash(db: Db, w: Watched): Promise<string> {
  if (!IDENT.test(w.table)) throw new Error(`bad table name ${w.table}`);
  let hashed = w.expr;
  if (!hashed) {
    const cols = (await db.execute(sql`
      select column_name as name, column_default as dflt
      from information_schema.columns
      where table_schema = current_schema() and table_name = ${w.table}
      order by ordinal_position`)) as unknown as Array<{
      name: string;
      dflt: string | null;
    }>;
    if (!cols.length) throw new Error(`no such table ${w.table}`);
    const keep = cols
      .filter(
        (c) =>
          !/_at$/.test(c.name) &&
          !c.dflt?.startsWith("nextval(") &&
          !w.exclude?.includes(c.name),
      )
      .map((c) => `"${c.name}"`);
    hashed = `row(${keep.join(", ")})::text`;
  }
  const where = w.where ? `where ${w.where}` : "";
  const rows = (await db.execute(
    sql.raw(
      `select coalesce(md5(string_agg(h, '' order by h)), '') as h, count(*)::int as n
       from (select md5(${hashed}) as h from ${w.table} ${where}) t`,
    ),
  )) as unknown as Array<{ h: string; n: number }>;
  return `${rows[0].h}:${rows[0].n}`;
}

export async function fingerprint(db: Db, sources: Watched[]): Promise<string> {
  const parts: string[] = [];
  for (const s of sources) parts.push(await tableHash(db, s));
  return parts.join("|");
}

/** Hashes every watch now; the returned function gives the tags that moved. */
export async function startWatches(
  db: Db,
  watches: Watch[],
  log: (msg: string) => void,
): Promise<() => Promise<string[]>> {
  const before: Array<string | null> = [];
  for (const w of watches) {
    try {
      before.push(await fingerprint(db, w.sources));
    } catch (err) {
      log(`change check unavailable (${(err as Error).message})`);
      before.push(null);
    }
  }
  return async () => {
    const tags: string[] = [];
    for (const [i, w] of watches.entries()) {
      let changed = true;
      try {
        const b = before[i];
        if (b !== null) changed = b !== (await fingerprint(db, w.sources));
      } catch {
        changed = true;
      }
      if (changed) tags.push(...w.tags);
      else log(`unchanged, not refreshing: ${w.tags.join(", ")}`);
    }
    return tags;
  };
}
