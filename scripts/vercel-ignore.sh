#!/bin/sh
# Vercel "Ignored Build Step" (vercel.json: ignoreCommand).
# Exit 0 skips the build, exit 1 builds. Every doubt builds.
#
# A build is skipped only when every file changed since the last successful
# build of this branch is one the website's output does not depend on:
# documentation, CI workflows, tests and the pipeline's job files (except
# council-data.ts and performance.ts, which the website imports). A change
# to anything else (pages, data, migrations, config, lockfile, scripts)
# builds, on production and on previews alike.

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
[ -n "$base" ] || exit 1
git cat-file -e "$base^{commit}" 2>/dev/null || exit 1
changed=$(git diff --name-only "$base" HEAD 2>/dev/null) || exit 1
[ -n "$changed" ] || exit 1

# Job files the website imports.
if printf '%s\n' "$changed" | grep -qE '^pipeline/jobs/(council-data|performance)\.ts$'; then
  exit 1
fi
if printf '%s\n' "$changed" | grep -qvE '^(docs/|\.github/|tests/|pipeline/jobs/|pipeline/fixtures/)|\.md$|^vitest\.config\.|^\.gitignore$'; then
  exit 1
fi
echo "Only docs, CI, tests or pipeline jobs changed: skipping the build."
exit 0
