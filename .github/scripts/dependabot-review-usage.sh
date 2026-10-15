#!/usr/bin/env bash
# Totals the Dependabot reviewer's token usage, by month, from the usage
# artifacts its runs upload (see "Record token usage" in
# .github/workflows/dependabot-review.yml). Artifacts expire after the repo's
# retention period, so for a longer history, save the --raw output now and
# then.
#
# Usage: .github/scripts/dependabot-review-usage.sh [--raw]
#   --raw  print each run's record as a JSON line instead of the totals
set -euo pipefail

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

gh api --paginate "repos/$repo/actions/artifacts?per_page=100" \
  --jq '.artifacts[] | select((.expired | not) and (.name | startswith("dependabot-review-usage-"))) | .id' |
  while read -r id; do
    gh api "repos/$repo/actions/artifacts/$id/zip" > "$tmp/$id.zip"
    unzip -p "$tmp/$id.zip" usage.json > "$tmp/$id.json"
  done

shopt -s nullglob
records=("$tmp"/*.json)
if [ ${#records[@]} -eq 0 ]; then
  echo "No usage records found." >&2
  exit 0
fi

if [ "${1:-}" = "--raw" ]; then
  jq -c . "${records[@]}"
  exit 0
fi

jq -s -r '
  ["month", "runs", "input", "output", "cache write", "cache read", "API-equivalent $"],
  (group_by(.date[0:7])[] |
    [.[0].date[0:7], length,
     (map(.usage.input_tokens) | add),
     (map(.usage.output_tokens) | add),
     (map(.usage.cache_creation_input_tokens) | add),
     (map(.usage.cache_read_input_tokens) | add),
     (map(.total_cost_usd) | add * 100 | round / 100)])
  | @tsv
' "${records[@]}" | column -t -s $'\t'
