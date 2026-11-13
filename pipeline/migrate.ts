/**
 * Applies database migrations (drizzle/*.sql). Safe to run repeatedly.
 * Usage: pnpm db:migrate
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const url =
    process.env.DATABASE_URL_DIRECT ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.STORAGE_DATABASE_URL_UNPOOLED ||
    process.env.DATABASE_URL ||
    process.env.STORAGE_DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const { db, client } = createDb(url, { max: 1 });
  await migrate(db, { migrationsFolder: "drizzle" });
  await client.end();
  console.log("migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
