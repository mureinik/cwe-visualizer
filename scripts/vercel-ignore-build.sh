#!/bin/sh
# Vercel's Ignored Build Step (ignoreCommand in vercel.json). Exit 0 skips
# the build, exit 1 runs it. Any other exit code fails the deployment, so
# every path below ends in one of those two.
#
# Only previews are ever skipped. Production always builds: the daily data
# refresh redeploys the same main commit through a deploy hook, and a diff
# there would find nothing and skip it.
#
# A preview is skipped only when none of the paths below changed. They are
# everything that feeds the deployed site; add any new build input here.

[ "$VERCEL_ENV" = preview ] || exit 1

# The branch's last successful deployment. It is missing from the clone
# when the branch was rebased since then, and git diff then fails, which
# builds.
base=${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}
echo "Comparing against: ${VERCEL_GIT_PREVIOUS_SHA:-unset, using HEAD^}"

if git diff --quiet "$base" HEAD -- \
  index.html src public scripts \
  package.json package-lock.json vite.config.ts tsconfig.json vercel.json; then
  exit 0
fi
exit 1
