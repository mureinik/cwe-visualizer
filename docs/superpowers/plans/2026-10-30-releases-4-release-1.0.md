# Releases, Part 4: Release 1.0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release 1.0, on CWE 4.20, is published at `/v1/`, and `/`
redirects to it. This is item 4 of the design's plan of work, for
[#252][i252]. It closes [#162][i162].

**Architecture:** No code changes. This is the first run of the release
process in CONTRIBUTING's "Releases" section:

1. Tag `main` as `v1-base` and cut `v1` from that tag.
2. Open a version-bump PR into `v1`.
3. When the owner merges it, the publish pipeline from [#246][pr246] builds
   `v1` into the `deploy` branch, and production rebuilds.

A release is its branch, as the spec decides. The `v1-base` tag only marks
where `v1` diverged from `main`; nothing reads it.

**Tech Stack:** git, `gh`, `npm version`, the existing workflows
(`release-dispatch.yml`, `release-publish.yml`, `ci.yml`), Vercel.

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
sections "Versioning", "Flow 1", "Flow 2" and "The release process".

## Global Constraints

- **Branch:** `v1` is cut from `main` at the commit this plan starts from. `main` pins CWE `4.20` in `cwe-version`.
- **Tag:** an annotated tag `v1-base` on that same commit, message
  `v1 branches from main here`, pushed atomically with the branch.
- **Version:** on `v1`, `package.json` and the root of `package-lock.json`
  say `1.0.0`. Set it with `npm version 1.0.0 --no-git-tag-version`.
  `main` stays at `0.0.0`.
- **Version-bump PR:**
  - Head branch `release/1.0.0`. It doesn't match `v[0-9]*`, so it gets a
    Vercel preview like any other PR.
  - Base `v1`, title `chore: release 1.0.0`, and a body that starts
    `Closes #162`.
  - The owner merges it. Close #162 by hand afterwards, since GitHub only
    closes issues automatically for merges into `main`.
- **Never delete or force-push `v1` or `deploy`, and never move or delete
  `v1-base`.**
- **No subagents.** Every step is an operation the controller runs; there
  is nothing to implement.

## Review Focus

1. **The cut creates a Vercel deployment or publishes.** It must do
   neither. `vercel.json` disables Git deployments for `v[0-9]*`, and the
   publisher skips, with a notice, a branch whose version doesn't match.
2. **The ruleset rejects the cut.** CONTRIBUTING's "If the cut is
   rejected" covers it. That route changes a ruleset, so it needs the
   owner.
3. **Publishing fails.** The deploy hook can fail, or the build on `v1`
   can break. Production must keep serving the previous deployment. Fix it
   by rerunning `gh workflow run release-publish.yml -f branch=v1`, never
   by touching `deploy`.
4. **Paths under `/v1/`.** The app must load its assets and data from
   under `/v1/`, not from `/`. Old links such as `/?cwe=79` must land on
   `/v1/?cwe=79`.
5. **`/latest/` keeps working** after `/` moves to `/v1/`.

---

### Task 1: Preflight

- [x] Run `git checkout main && git pull --ff-only` and record the SHA to
  cut from. `cat cwe-version` prints `4.20`, and
  `jq -r .version package.json` prints `0.0.0`.
- [x] `main`'s latest CI run on that SHA passed:
  `gh run list --branch main --workflow ci.yml --limit 1`.
- [x] Release-branch protection is in place:
  `gh api repos/mureinik/cwe-visualizer/rules/branches/v1 --jq '.[].type'`
  prints the eight types CONTRIBUTING lists.
- [x] `gh secret list` shows `BACKPORT_TOKEN` and `VERCEL_DEPLOY_HOOK_URL`.
- [x] `git ls-remote origin v1 v1-base` prints nothing, and
  `git ls-remote --heads origin deploy` prints one line.
- [x] Production is still on the old layout:
  `https://cwe-visualizer.vercel.app/` serves the redirect page to
  `/latest/`.

### Task 2: Cut `v1`

- [x] Run CONTRIBUTING's step 3 for `v1`:
  `git tag -a v1-base -m "v1 branches from main here" main`, then
  `git push --atomic origin v1-base 'v1-base^{commit}:refs/heads/v1'`.
  `git ls-remote origin v1 'v1-base^{}'` prints the SHA from Task 1 for
  both refs.
- [x] The tag push started no workflow run and no Vercel deployment.
- [x] `release-dispatch.yml` ran for `v1` and started
  `release-publish.yml` (`gh run list --workflow release-publish.yml --limit 1`).
  That run is green, with the notice `Not publishing v1: package.json
  version is 0.0.0, expected 1.0.0.`, and `deploy` has no new commit.
- [x] Vercel made no deployment for `v1`: no deployment in
  `npx -y vercel@latest api '/v6/deployments?projectId=prj_7JHAJ34QiFwuY7QSXCP4STd1ou7R&limit=20'`
  has `meta.githubCommitRef == "v1"`.

### Task 3: The version-bump PR

- [x] Run `git fetch origin && git checkout -b release/1.0.0 origin/v1`,
  then `npm version 1.0.0 --no-git-tag-version`. `git diff` changes only
  the version, from `0.0.0` to `1.0.0`: once in `package.json`, twice in
  `package-lock.json`.
- [x] Run `npm run lint && npx tsc --noEmit && npm test`, then commit
  `chore: release 1.0.0` with the trailer.
- [x] Push and open the PR to the Global Constraints. Wait for CI. The
  checks the `release-branches` ruleset requires must pass: `build`,
  `validate-issue-link`, `dependency-review`, `lint-workflows` and
  `semgrep`.
- [x] Ask the owner to merge it.

### Task 4: Publish and check (after the owner merges)

- [x] Confirm the merge: `gh pr view <n> --json state` says `MERGED`.
- [x] The merge's push to `v1` started `release-publish.yml`, and it
  passed. `deploy` has a new commit `v1: built from v1@<sha>`, and
  `git ls-tree --name-only origin/deploy` lists `v1`.
- [x] Production rebuilt: the latest production deployment is newer than
  the merge, and READY.
- [x] The site:
  - `curl -s https://cwe-visualizer.vercel.app/` is the redirect page to
    `/v1/`.
  - `https://cwe-visualizer.vercel.app/v1/` returns 200, and its HTML
    loads assets from `/v1/assets/`.
  - `https://cwe-visualizer.vercel.app/v1/data/meta.json` reports `4.20`.
  - `/latest/` returns 200, and `/latest/data/meta.json` reports `4.20`.
- [x] Ask the owner to open `https://cwe-visualizer.vercel.app/?cwe=79` in
  a browser. It lands on `/v1/?cwe=79` with CWE-79 selected.
- [x] Close #162 with a comment linking the merged PR.

### Task 5: Finish

- [x] If the run turned up anything that CONTRIBUTING's "To cut a
  release" gets wrong or leaves out, fix it here. Run `npm run lint:md`,
  then commit `docs: correct the release steps`. If the steps were right,
  skip this.
- [x] Push to this plan's PR, tick the boxes above, and mark it ready. It
  closes [#252][i252].
- [ ] After the owner merges, confirm with `gh pr view` that it merged.
  Then do the post-merge cleanup for `releases/4-release-1.0` and
  `release/1.0.0`, including their Vercel previews. Never touch `v1` or
  `deploy`.

**Not tested here:** the backport workflow's per-branch jobs. They first
run when a merge into `main` fixes an advisory that also affects `v1`.
Today's open `re2js` alert ([#21][alert21]) is a likely first case. Its fix
needs a major `markdownlint-cli2` bump on `main`, and `v1` can't take that
within its ranges, so the backport should open an issue only.

<!-- Issues and PRs -->
[i162]: https://github.com/mureinik/cwe-visualizer/issues/162
[i252]: https://github.com/mureinik/cwe-visualizer/issues/252
[pr246]: https://github.com/mureinik/cwe-visualizer/pull/246
[alert21]: https://github.com/mureinik/cwe-visualizer/security/dependabot/21

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
