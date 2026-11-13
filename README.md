# OpenCouncils

Every council in the UK in one place: who runs it, what it is deciding and what the watchdogs say. English only. Published by DC Group. Brief: `docs/SPEC.md`.

Copied from [OpenCouncil](https://opencouncil.wales) (Welsh councils, owenderbyshire/localrecord) and widened to the UK. Separate repository, Vercel project and database.

## Stack

Next.js 16 (Cache Components), Drizzle and Postgres (Neon), a daily data pipeline in GitHub Actions. See `AGENTS.md` for conventions and `docs/DEPLOYMENT.md` for setup.

## Local development

```sh
pnpm install
cp .env.example .env.local   # set DATABASE_URL
pnpm db:migrate
pnpm pipeline daily --council cardiff
pnpm dev
```

## Councils

`data/curated/register.json` lists every UK council (from mySociety's register; rebuild with `node scripts/build-register.mjs`). `pnpm pipeline census` finds each council's committee system; `node scripts/export-platforms.mjs` writes it to `data/curated/platforms.json`. A council outside Wales gets full pages when its ModernGov feed answers and its id is in platforms.json's `active` list.
