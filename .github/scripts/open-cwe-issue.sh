#!/usr/bin/env bash
# Opens an issue titled "CWE <version> is available", unless one with that
# exact title already exists in any state, so a version is reported once ever,
# even after its issue is closed. Prints the issue's URL either way. Used by
# the watchers in .github/workflows/update-data.yml.
#
# Usage: .github/scripts/open-cwe-issue.sh <version> <body>
# Needs GH_TOKEN and GH_REPO in the environment.
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <version> <body>" >&2
  exit 2
fi
version=$1
body=$2

# The same pattern as the pins in cwe-version, so an empty version can never
# become an issue title.
if ! [[ "$version" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "Not a CWE version: '$version'" >&2
  exit 2
fi

title="CWE $version is available"

existing=$("$(dirname "$0")/issue-by-title.sh" "$title")

if [ -n "$existing" ]; then
  echo "$existing"
  exit 0
fi

gh issue create --title "$title" --body "$body"
