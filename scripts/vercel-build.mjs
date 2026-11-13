// Vercel runs this instead of "build" (the "vercel-build" script). On
// production builds it applies database migrations first, so new pages never
// go live before the columns and tables they read exist.
import { spawnSync } from "node:child_process";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.VERCEL_ENV === "production" && (process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.STORAGE_DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.STORAGE_DATABASE_URL)) {
  run("pnpm", ["exec", "tsx", "pipeline/migrate.ts"]);
}
run("pnpm", ["exec", "next", "build"]);
