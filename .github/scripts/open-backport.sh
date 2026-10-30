#!/usr/bin/env bash
# Reports a security backport to a release branch, for
# .github/workflows/backport-security.yml. Without <failure>, the backport
# was pushed to backport/<branch>/<ghsa>: opens the issue and a PR from that
# branch that closes it. With <failure>, opens only the issue, saying what
# went wrong. Prints the URLs it created.
#
# Usage: .github/scripts/open-backport.sh <ghsa> <branch> <packages> [<failure>]
# <packages> is space-separated. Needs GH_TOKEN, GH_REPO and RUN_URL (the
# run's log) in the environment.
set -euo pipefail

if [ $# -lt 3 ] || [ $# -gt 4 ] || [ -z "$3" ] || { [ $# -eq 4 ] && [ -z "$4" ]; }; then
  echo "Usage: $0 <ghsa> <branch> <packages> [<failure>]" >&2
  exit 2
fi
ghsa=$1
branch=$2
read -ra packages <<< "$3"
: "${RUN_URL:?RUN_URL must be set}"

# Whole-string matches, the same patterns as the workflow's. Both values
# become parts of titles and branch names, so nothing else gets that far.
if ! [[ "$ghsa" =~ ^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$ ]]; then
  echo "Not a GHSA ID: '$ghsa'" >&2
  exit 2
fi
if ! [[ "$branch" =~ ^v[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Not a release branch: '$branch'" >&2
  exit 2
fi

title="Backport $ghsa to $branch"
advisory="[$ghsa](https://github.com/advisories/$ghsa)"
# shellcheck disable=SC2016 # Markdown code spans, not command substitutions
listed=$(printf '`%s`, ' "${packages[@]}")
listed=${listed%, }

if [ $# -eq 4 ]; then
  gh issue create --title "$title" --body "$advisory affects \`$branch\` through $listed, but the backport failed: $4

The run's log: $RUN_URL"
  exit 0
fi

issue=$(gh issue create --title "$title" --body "$advisory affects \`$branch\` through $listed. The same run opens a PR that updates them; close this issue by hand once it merges.")
echo "$issue"
# If this fails, the issue is already open, and a rerun skips the branch (an
# issue means the advisory is handled), so the run fails and the PR has to be
# opened by hand.
gh pr create --base "$branch" --head "backport/$branch/$ghsa" --title "$title" \
  --body "Closes #${issue##*/}

Backports $advisory to \`$branch\` by updating $listed with \`npm update\`.

GitHub closes issues automatically only for PRs into \`main\`, so close #${issue##*/} by hand after merging this one.

Opened by $RUN_URL"
