# Dependabot Merge Candidate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `dependabot-rebase.yml` requests a rebase for one Dependabot PR per push to `main`, the riskiest to rebase, instead of every PR that is behind.

**Architecture:** The `--jq` filter of the existing `gh pr list` call ranks the PRs and prints only the first. The rest of the step handles that one PR, without the loop.

**Tech Stack:** GitHub Actions, bash, `gh` with its built-in jq (gojq).

**Spec:** `docs/superpowers/specs/2026-11-25-dependabot-merge-candidate-design.md`

## Global Constraints

- Ranking, each key only breaking ties in the ones before it: security fixes first, `package.json` additions (desc), `package.json` deletions (desc), `package-lock.json` additions (desc), `package-lock.json` deletions (desc), PR number (asc). An untouched file counts as 0.
- Rank before checking whether a PR is behind; never fall through to the next PR.
- A failed lookup fails the run. Token handling, environment, permissions and triggers don't change.
- Rebase command text is exactly `@dependabot rebase`.
- No test harness goes into the repo; the checks run from a scratch directory.

## Review Focus

- **No open Dependabot PR:** the run succeeds and says so.
- **Only GitHub Actions PRs open:** the lowest-numbered one is the candidate.
- **Candidate up to date, a lower-ranked PR behind:** nothing is posted on either.
- **Candidate has a pending request, a lower-ranked PR is behind:** nothing is posted on either.
- **`gh pr list` fails:** the run fails, and doesn't report "no open PRs".

---

### Task 1: Rank the PRs and request one rebase

**Files:**

- Modify: `.github/workflows/dependabot-rebase.yml` (header comment and `run`)
- Modify: `.github/workflows/dependabot-review.yml` (the "is behind" notice)
- Test: a scratch script that extracts the step's `run` and executes it with a stub `gh` first on `PATH`; the stub applies the real `--jq` filter to fixture JSON and records comments

- [ ] **Step 1: Write the scratch checks.** Each gives the PRs as `number: package.json +/-, package-lock.json +/-` and asserts which PR is commented on:
  - one case per key, with the winner listed last and losing on every later key (for the deletions keys, the winner has the higher PR number);
  - equal counts: the lowest number, listed last;
  - numeric sort: 10 added beats 9;
  - each Review Focus line;
  - a request older than a day, and one older than the head commit: both commented on again;
  - `behind_by` that isn't a number, and a missing token: exit 1, no comment.
- [ ] **Step 2: Run them against the current workflow.** Expected: the ranking cases fail, since every PR that is behind gets a comment.
- [ ] **Step 3: Implement.** Assign the `gh pr list --json number,headRefOid,files` result to `candidate` (a plain assignment, so `set -e` catches a failure); if empty, print `No open Dependabot PRs.` and exit 0; otherwise `read -r pr sha <<< "$candidate"`, log the candidate, and keep the existing steps with `continue` replaced by `exit 0`. The header comment says why there is one candidate and how it is chosen. The reviewer's notice says a rebase is requested once the PR is the merge candidate.
- [ ] **Step 4: Run the scratch checks.** Expected: all pass. Run the filter with the real `gh` on closed Dependabot PRs too; expected: [#384](https://github.com/mureinik/cwe-visualizer/pull/384) ranks above [#388](https://github.com/mureinik/cwe-visualizer/pull/388), and Actions updates come last.
- [ ] **Step 5: Lint.** `npm run lint`, plus actionlint, zizmor and shellcheck as in `lint-workflows`. Expected: no findings.
- [ ] **Step 6: Commit** as `ci: rebase only one Dependabot PR at a time`.

### Task 2: Bring the documentation in line

**Files:**

- Modify: `CONTRIBUTING.md` ("Dependabot reviewer")
- Modify: `.github/dependabot.yml` (header comment)
- Modify: `docs/superpowers/specs/2026-10-10-dependabot-review-design.md` (requirements, rebase requester, gate, error handling, testing)

- [ ] **Step 1: `CONTRIBUTING.md`.** State that one PR is the candidate, the ranking, that the candidate stays put until it is merged, fixed or closed, and that `@dependabot rebase` by hand rebases another.
- [ ] **Step 2: `dependabot.yml`.** Replace "each merge has every other PR rebase and rerun CI" with what is now true; the reason for daily runs stays.
- [ ] **Step 3: The original design.** Update what it says about rebasing every PR, linking the new design.
- [ ] **Step 4: Verify.** `npm run lint:md && npm run lint && npx tsc --noEmit && npm test`, and `grep -rn 'rebase'` over the changed files finds no claim that every PR is rebased.
- [ ] **Step 5: Commit** as `docs: describe the Dependabot merge candidate`.

### Task 3: Rank security fixes first

Added after Tasks 1 and 2, when the owner asked for it.

**Files:**

- Modify: `.github/dependabot.yml` (a `security-updates` group in both ecosystems)
- Modify: `.github/workflows/dependabot-rebase.yml` (the first sort key, on `headRefName`)
- Modify: `CONTRIBUTING.md` and both designs

- [ ] **Step 1: Add scratch checks.** A security PR beats an npm PR with more lines, including when it only changes Actions; the other keys break ties between two security PRs; an up-to-date or pending security candidate doesn't fall through; a package called `security-updates`, another group, and a longer name ending in `security-updates` aren't security fixes.
- [ ] **Step 2: Run them.** Expected: the ones where a security PR has to win fail.
- [ ] **Step 3: Implement**, matching `^dependabot/[^/]+/security-updates-[0-9a-f]{10}$`.
- [ ] **Step 4: Verify.** All scratch checks pass; `dependabot.yml` validates against its JSON schema; actionlint, zizmor, `npm run lint`, `npm run lint:md`, `npx tsc --noEmit` and `npm test` are clean.
- [ ] **Step 5: Commit** as `ci: rank Dependabot security fixes first`.
