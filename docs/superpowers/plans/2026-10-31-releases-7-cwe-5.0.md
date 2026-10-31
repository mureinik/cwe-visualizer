# Releases, Part 7: Move `main` to CWE 5.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` pins CWE 5.0, so `/latest/` serves it at least as well
as `/v1.1/` serves 4.21. This is item 7 of the design's plan of work, for
[#268][i268]. It closes [#244][i244].

**Architecture:** No code changes: move the pin in `cwe-version` from
`4.21` to `5.0` and regenerate the data. No release is cut, so `/` stays
on `/v1.1/`.

**Tech Stack:** `scripts/prepare-data.ts`, Vercel.

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
item 7 of "Plan of work" and "What changes between 4.20, 4.21 and 5.0, for
this app".

## What the 4.21 → 5.0 check turned up

The spec asks for a check that nothing in the 4.21 → 5.0 changes affects
what the parser reads. It was done on 2026-10-31 against MITRE's archives
and schemas, and found nothing to change.

- **The app's own parser on both archives:** `parseCatalog` gives the
  same 984 weakness IDs and the same 1,622 relations, every one identical
  in source, target, type and view. No weakness's name, abstraction or
  status differs. 49 descriptions differ in wording. No field parses
  empty on 5.0.
- **Schema 8.0 against 7.4:**
  - The weakness attributes the parser reads are unchanged, as are
    `Related_Weakness`'s `Nature`, `CWE_ID` and `View_ID`.
  - `Description` is still a plain string.
  - `RelatedNatureEnumeration` now lists `Overlaps`, which 7.4 left out
    although 4.21 used it.
  - `Abstraction` and `Status` gain no values.
- **What 5.0 adds that the parser ignores:**
  - 124 `Dimensions` elements;
  - the namespace, `cwe-8` instead of `cwe-7`. MITRE writes no namespace
    prefixes, and the parser matches element names without the
    namespace, so neither matters;
  - the rest of 5.0's changes the spec lists (Groupings, Custom_Phases,
    Technical_Nuance and the like). These are part 8's design.
- **Archive name:** `cwec_v5.0.xml.zip` matches `archiveUrl`, and `5.0`
  passes `readPinnedVersion`'s check.
- **The `update-data.yml` watchers need no change.** The "latest" job
  will find `main`'s pin equal to MITRE's latest. The 4.x job still finds
  4.21, now on `v1.1`.

## Global Constraints

- **Pin:** `cwe-version` holds exactly `5.0`.
- **Data:** `public/data/` is build output. Regenerate it with
  `npm run prepare-data`, never by hand.
- **No release, and no change to `v1`, `v1.1` or `deploy`.** `/` keeps
  redirecting to `/v1.1/`.
- **Verify** with `npm run lint && npx tsc --noEmit && npm test`.

## Review Focus

1. **`/latest/` reports 5.0, while `/v1.1/` keeps 4.21 and `/v1/` keeps
   4.20.** Task 2 checks all three.
2. **The 4.21 features still work on 5.0:** `Overlaps` shows under
   "Peers", and CWE-787 has no "+1 more" chip. The data is identical, so
   the code from parts 5 and #261 applies unchanged. Task 2's browser
   check confirms it.
3. **The footer:** its copyright range ends in the catalog's year, which
   is 2026 for both releases. It shows CWE 5.0. Task 2's browser check
   covers it.
4. **No "CWE 5.0 is available" issue reopens.** The `latest` job opens an
   issue only when MITRE's latest differs from `main`'s pin. Task 2 checks
   the next run.
5. **A preview of this PR builds 5.0.** Vercel's ignore step treats
   `cwe-version` as a site input, so this PR gets a preview. Task 1
   checks its `data/meta.json`.

---

### Task 1: Pin CWE 5.0

**Files:**

- Modify: `cwe-version`

- [x] **Step 1: Move the pin.** `printf '5.0\n' > cwe-version`.
- [x] **Step 2: Regenerate the data.** `npm run prepare-data`. Then, on
  `public/data/cwe.json`:
  - `jq -r .meta.cweVersion` prints `5.0`;
  - `jq '.nodes | length'` prints `984`;
  - `jq '[.edges[] | select(.type == "Overlaps")] | length'` prints `3`.
- [x] **Step 3: Verify and commit.** `npm run lint && npx tsc --noEmit &&
  npm test`, then commit `feat: pin CWE 5.0`.
- [x] **Step 4: Open the PR.** Tick Task 1's boxes, push, mark this
  plan's PR ready, and wait for the required checks: build,
  validate-issue-link, dependency-review, lint-workflows, semgrep and
  codecov/project. Its body says `Closes #268` and `Closes #244`. The
  preview's `data/meta.json` reports `5.0`. The owner merges it.

### Task 2: After the merge

- [ ] **Confirm the merge** with `gh pr view <n> --json state`, which
  should say `MERGED`, and check that `main` contains the PR's head.
  #244 and #268 closed with it.
- [ ] **Production rebuilt:** the latest production deployment is newer
  than the merge, and READY.
- [ ] **The site:**
  - `/latest/data/meta.json` reports `5.0`;
  - `/v1.1/data/meta.json` reports `4.21`;
  - `/v1/data/meta.json` reports `4.20`;
  - `/` still redirects to `/v1.1/`.
- [ ] **The owner checks in a browser:** on
  `https://cwe-visualizer.vercel.app/latest/?cwe=787`:
  - the header or footer shows CWE 5.0;
  - CWE-788 is under "Peers" as "Overlaps";
  - there is no "+1 more" chip.
- [ ] **The watcher:** run `gh workflow run update-data.yml`. When it
  finishes, it has passed and opened no "CWE 5.0 is available" issue.
- [ ] **Clean up:** run the post-merge cleanup for `releases/7-cwe-5.0`,
  including its Vercel previews. Never touch `v1`, `v1.1`, their base
  tags, or `deploy`.

<!-- Issues and PRs -->
[i244]: https://github.com/mureinik/cwe-visualizer/issues/244
[i268]: https://github.com/mureinik/cwe-visualizer/issues/268

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
