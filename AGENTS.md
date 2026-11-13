<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OpenCouncils: working on this codebase

OpenCouncils covers every principal council in the UK (382 in November 2026): who runs each council, what it is deciding and what the watchdogs say. English only. Published by DC Group. The brief is `docs/SPEC.md`: check work against it and bring any change of direction to Owen first.

The code was copied from opencouncil.wales (repo owenderbyshire/localrecord) on 13 November 2026 and is now separate: changes here never go back there. The Welsh site stays standalone; OpenCouncils may reuse its data for Wales. Much of what follows describes the inherited Welsh codebase. Differences:

- The council list is UK-wide: `data/curated/register.json` (built by `scripts/build-register.mjs` from mySociety's register in `data/sources/`) plus `data/curated/reorganisation.json` for changes the register doesn't hold yet. `data/curated/councils.ts` merges the register, the Welsh councils' checked addresses and `data/curated/platforms.json` (the platform census).
- The census (`pnpm pipeline census`, weekly in `.github/workflows/census.yml`) finds each council's committee system and checks its ModernGov data service; `scripts/export-platforms.mjs` writes the result to platforms.json. Councils outside Wales are switched on for full pages by adding their id to `active` in platforms.json.
- Councils without full pages have a register page at `/councils/<id>`. `src/lib/register.ts` holds the helpers; `src/i18n/messages/uk.ts` the strings.
- Welsh-only sections (planning, LDPs, consultations, StatsWales performance, the postcode finder, Welsh elections, cabinets, issues) stay in the code but are unrouted (`WALES_ONLY` in `src/proxy.ts`) and out of the nightly run (`pipeline/sequences.ts`). `/cy` addresses redirect to English.
- Summaries cap: £60 a month (`SUMMARY_MONTHLY_BUDGET_GBP`).
- Accent: yellow, for fills only; `--accent-strong` (amber) for the few accent marks that sit like text.

## Layout

- `data/curated/councils.ts` lists the 22 councils, their ModernGov addresses and rollout phase. A council goes live by setting `moderngovBase` (after checking its `mgWebService.asmx` answers) and `active: true`.
- `pipeline/` fetches each council's ModernGov web service into Postgres. Jobs are idempotent and take `--council <id>`; see `pipeline/cli.ts` and `pipeline/sequences.ts`. `pipeline/sources/moderngov.ts` holds the parsers.
- StatsWales figures (`council-data`, `performance`) come through Edau's feed when `EDAU_FEED_URL` and `EDAU_FEED_KEY` are set (`pipeline/sources/edau.ts`), otherwise from StatsWales directly. Edau keeps each read under a slice key worked out from the labels here; if you change a measure's labels, change its slice in Edau's `data/curated/statistics.ts` too, or the read finds no rows and the previous figures stay.
- `src/db/schema.ts` is the schema (Drizzle). Every council table is keyed by `(council_id, upstream id)`, so all councils share one database and, later, one search index. Migrations live in `drizzle/`.
- `src/data/*.ts` is the website's data layer: server-only functions with `"use cache"`, `cacheLife(...)` and `cacheTag(...)`. Pages never query the database directly.
- `src/app/[lang]/[council]/...` holds a council's pages. `lang` is `en` or `cy`. English is served at `/`, Welsh at `/cy` (see `src/proxy.ts`).
- `src/i18n/` has locale helpers; `src/i18n/messages/<area>.ts` holds each area's strings in both languages.

## Conventions

- Data functions: `"use cache"` first line, then `cacheLife("pipeline")` for data only the pipeline changes (a week, refreshed by tag) or `"days"` / `"hours"` for anything that depends on today's date, then `cacheTag(...)` with the tags the pipeline sends: `meetings`, `meeting:<council>:<id>`, `councillors`, `committees`, `reference`. Compute today with `ukToday()` inside the cached function. Write SQL with `rows<T>(sql`...`)` from `src/data/db.ts`, cast counts `::int`, numerics `::float8` and dates `::text`. Arguments and return values must be serialisable.
- Pages: get the locale with `await getLocale()`. Anything that reads `params` or `searchParams` must sit inside `<Suspense>` with a skeleton fallback; resolve the council with `councilFrom(params)` from `src/lib/route.ts`. Unknown IDs call `notFound()`. Give dynamic routes a small `generateStaticParams` wrapped in `atLeastOne`.
- Metadata: `generateMetadata` returns `pageMetadata({ locale, path, title, description })` from `src/lib/metadata.ts`.
- Strings: never hard-code user-facing text in a page; add it to the area's messages module with `defineMessages({ en: {...}, cy: {...} })`. Use `<Rich>` for sentences with emphasis or links, and `pickText` / `<Bi>` for bilingual database fields. Council agenda titles and minutes are usually English only: mark them `lang="en"` on Welsh pages.
- Formatting: `formatDate`, `formatNumber`, `formatPercent`, `formatList` from `src/i18n/format.ts`. Never format calendar dates with `new Date()` directly.
- Links: internal links go through `href(locale, path)`. Links to council sites come from `src/lib/official-urls.ts`.
- Parties: `partyColour(id)` and `partyName(locale, id, label)` from `src/lib/parties.ts`. Local groups keep the council's own label. Party colours are for data marks only.

## Writing and design

- Plain language is the rule for the whole site. Write for someone who knows nothing about councils. Explain any term where it appears (Cabinet, scrutiny, call-in, prejudicial interest), say what something means and what happens next.
- British English. Plain, direct sentences. No em dashes, no "not X but Y" constructions, no rhetorical signposting, no marketing tone.
- Welsh strings are written for Welsh readers, not word-for-word translations. Use the terms councils use: Cyngor llawn, Cabinet, craffu, cynllunio, cynghorydd, datganiad o fuddiant. Mind mutations when joining text (`softMutate` in `src/i18n/welsh.ts`).
- The design is the Open family's (docs/family-design.md), taken from OpenSenedd: colourless chrome (`--ink`, `--rule`, `--surface`), Newsreader headings, IBM Plex Sans for interface and data, `.prose-read` for long reading text, `.rows` for lists, `.data-table` for tables, `.chip` filter links so every view has a URL.
- Avoid: all-caps labels, eyebrow labels, middle-dot metadata, arrows on links, decorative gradients or shadows, identical card grids.
- Accessibility: one `h1` per page; colour is never the only signal; everything reachable by keyboard.

## Checking your work

- `pnpm typecheck`, `pnpm test`, `pnpm lint`.
- Parser tests use ModernGov fixtures in `pipeline/fixtures/moderngov/` (currently the Senedd's, which share the format). Add a council's real replies there when you touch its parsing.
- With the site running: `CHROMIUM_PATH=... node scripts/screenshot.mjs http://localhost:3000 <out-dir> /cardiff /cy/cardiff [--mobile] [--dark] [--full]` and look at the images, in both languages and at phone width.
