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

# Compare against the branch's last successful deployment. Vercel leaves
# VERCEL_GIT_PREVIOUS_SHA unset until the branch has one, and the commit is
# missing from the clone when the branch was rebased since. In both cases,
# compare against where the branch forked from main instead. Vercel's clone
# is shallow and may not have main, so fetch it, with full history so the
# merge base is reachable. If none of this works, build.
if [ -n "$VERCEL_GIT_PREVIOUS_SHA" ] &&
  git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA^{commit}" 2>/dev/null; then
  base=$VERCEL_GIT_PREVIOUS_SHA
  echo "Comparing against the last deployment: $base"
else
  echo "No usable last deployment (${VERCEL_GIT_PREVIOUS_SHA:-unset}); comparing against main"
  unshallow=
  [ "$(git rev-parse --is-shallow-repository)" = true ] && unshallow=--unshallow
  repo=https://github.com/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG.git
  # $unshallow is deliberately unquoted: when empty, it must vanish.
  # shellcheck disable=SC2086
  if ! git fetch --quiet $unshallow "$repo" main ||
    ! base=$(git merge-base FETCH_HEAD HEAD); then
    echo "Could not find where the branch forked from main; building"
    exit 1
  fi
  echo "Comparing against the merge base with main: $base"
fi

if git diff --quiet "$base" HEAD -- \
  index.html src public scripts \
  package.json package-lock.json vite.config.ts tsconfig.json vercel.json; then
  echo "No changes that affect the site; skipping"
  exit 0
fi
exit 1
