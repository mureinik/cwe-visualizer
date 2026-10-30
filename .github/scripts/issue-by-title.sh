#!/usr/bin/env bash
# Prints the URL of the issue titled exactly <title>, in any state, or
# nothing if there is none. Used to report something once ever, even after
# its issue is closed: by open-cwe-issue.sh and by
# .github/workflows/backport-security.yml.
#
# Usage: .github/scripts/issue-by-title.sh <title>
# Needs GH_TOKEN and GH_REPO in the environment.
set -euo pipefail

if [ $# -ne 1 ] || [ -z "$1" ]; then
  echo "Usage: $0 <title>" >&2
  exit 2
fi
title=$1

# Search is fuzzy, so keep only the issues whose title matches exactly.
gh issue list --state all --search "\"$title\" in:title" \
  --limit 100 --json title,url |
  jq -r --arg title "$title" '[.[] | select(.title == $title)][0].url // empty'
