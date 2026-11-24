# Dependabot merge candidate — Design

Issue: [#392](https://github.com/mureinik/cwe-visualizer/issues/392). Changes
the rebase requester of the
[Dependabot PR reviewer](2026-10-10-dependabot-review-design.md).

## Intent

`dependabot-rebase.yml` asks Dependabot to rebase every PR that fell behind
`main`, so that each is always ready to merge. Only one can merge, though:
the merge leaves the others behind again, and their rebases and CI runs were
wasted. Keep one PR ready instead, the riskiest to rebase, so that it merges
as soon as possible.

## Goals

- On each push to `main` (and on manual dispatch), choose one merge candidate
  among the open Dependabot PRs against `main`, and request a rebase for it
  alone.
- The candidate ranks first by these keys, each only breaking ties in the ones
  before it:
  1. lines added to `package.json`, most first
  2. lines removed from `package.json`, most first
  3. lines added to `package-lock.json`, most first
  4. lines removed from `package-lock.json`, most first
  5. PR number, lowest first
- A file the PR doesn't touch counts as 0 added and 0 removed, so GitHub
  Actions updates rank after every npm one.
- Only the root `package.json` and `package-lock.json` count, the only ones
  in the repo.
- Rank before looking at whether a PR is behind. An up-to-date candidate
  means there is nothing to do, not that the next PR gets its turn.
- Keep the rules for a repeated request: none while the last one is newer
  than the PR's head commit and less than a day old.

## Non-goals

- Skipping a candidate that can't be merged (failing CI, say). It stays the
  candidate until it is fixed or closed; the owner's pick, below. The owner
  can comment `@dependabot rebase` on another PR by hand.
- Stopping Dependabot's own rebases of PRs that conflict
  (`rebase-strategy`). They go on as before, whatever the PR's rank.
- Running on anything other than pushes to `main` and manual dispatch. A new
  Dependabot PR starts up to date, so it needs no rebase until the next push.

## Constraints

- The token handling, environment, permissions and triggers don't change.
- No PR may be chosen on missing data: a failed lookup fails the run.

## Approaches

What happens when the candidate can't be merged:

- **A. It stays the candidate (picked by the owner).** Simple and
  predictable; the others wait, or the owner asks for a rebase by hand. The
  longest a closed, unmerged Dependabot PR stayed open was two days
  ([#64](https://github.com/mureinik/cwe-visualizer/pull/64)).
- **B. Skip it when its required checks fail.** The queue keeps moving, but
  the workflow would have to read check results, and would need another rule
  to rebase the skipped PR once `main` fixes it.

How to choose the candidate (my call): a `sort_by` in the `--jq` filter of
the `gh pr list` call that already lists the PRs, with `files` added to its
fields. It needs no extra request or permission, and the line counts are
those of the PR's own diff, so being behind `main` doesn't distort them. A
separate script in `.github/scripts/` would be more code for a sort, and
fetching each PR's files one by one would be more requests.

## Design

`gh pr list` prints at most one PR, the first by the keys above. With none,
the run says so and ends. Otherwise the existing steps (compare with `main`,
check for a pending request, comment) run once, without the loop, and log
which PR is the candidate.

Documentation to bring in line:

- `CONTRIBUTING.md`, "Dependabot reviewer": the candidate, its ranking, that
  it stays put when it can't be merged, and the manual comment.
- The header comments of `dependabot-rebase.yml` and `dependabot.yml` (which
  says each merge rebases every other PR).
- The reviewer's notice for a PR that is behind, in `dependabot-review.yml`:
  a rebase is requested once the PR is the candidate.
- The rebase requester in the
  [original design](2026-10-10-dependabot-review-design.md).

## Testing

There is no unit-test harness for workflow shell, as before. The ranking
filter is run locally on past Dependabot PRs and on made-up ties, one per key;
the whole step is run against a stubbed `gh`; and `lint-workflows`
(actionlint, zizmor, shellcheck) covers the files.
