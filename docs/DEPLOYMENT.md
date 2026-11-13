# Deployment

OpenCouncil runs on three services, all separate from OpenSenedd.

## GitHub

Repository `owenderbyshire/localrecord`.

Actions secrets (Settings, Secrets and variables, Actions):

- `DATABASE_URL_DIRECT`: the Neon direct (unpooled) connection string.
- `REVALIDATE_SECRET`: any long random string; the same value as in Vercel.
- `ANTHROPIC_API_KEY`: for meeting summaries. Without it the pipeline skips summaries.
- `RESEND_API_KEY` (optional): emails the owner when the AI account runs out of credit.

Actions variables:

- `SITE_URL`: the production URL, so the pipeline can refresh cached pages.
- `ADMIN_EMAIL`, `ALERTS_FROM` (optional).

The `Data pipeline` workflow runs daily at 05:15 UTC and can be run by hand with a job and arguments, for example a backfill:

- job `meetings`, args `--council cardiff --from 2022-05-01`
- then job `meeting-details`, args `--council cardiff --from 2022-05-01`
- then job `summaries`, args `--council cardiff --limit 200`

## Vercel

Project `localrecord`, linked to the repository, region `lhr1` (`vercel.json`). The build command is `pnpm vercel-build`, which applies migrations on production builds before building.

Environment variables:

- `DATABASE_URL`: the Neon pooled connection string. Added automatically when the Neon database is created from the project's Storage tab.
- `DATABASE_URL_DIRECT`: the unpooled string (Neon via Vercel provides it as `DATABASE_URL_UNPOOLED`; copy it across).
- `NEXT_PUBLIC_SITE_URL`: the production URL.
- `REVALIDATE_SECRET`: as above.

## Neon

One Neon project for OpenCouncil, region London (aws-eu-west-2), created from the Vercel project's Storage tab.
