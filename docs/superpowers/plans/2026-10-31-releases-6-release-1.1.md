# Releases, Part 6: Release 1.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release 1.1, on CWE 4.21, is published at `/v1.1/`, `/`
redirects to it, and `/v1/` keeps serving 1.0 on CWE 4.20. This is item 6
of the design's plan of work, for [#262][i262].

**Architecture:** No code changes. This is the second run of the release
process in CONTRIBUTING's "Releases" section, after [part 4][plan4] cut
1.0:

1. Tag `main` as `v1.1-base`, and cut `v1.1` from that tag.
2. Open a version-bump PR into `v1.1`.
3. When the owner merges it, the publish pipeline builds `v1.1` into the
   `deploy` branch next to `v1`, and production rebuilds.

What this run adds over part 4:

- the first minor branch, `vX.Y` rather than `vX`;
- the first time two releases are served side by side;
- the first time `/` moves from one release to another.

**Tech Stack:** git, `gh`, `npm version`, the existing workflows
(`release-dispatch.yml`, `release-publish.yml`, `ci.yml`), Vercel.

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
sections "Versioning", "Flow 1", "Flow 2" and "The release process", and
item 6 of "Plan of work".

## Global Constraints

- **Branch:** `v1.1` is cut from `main` at the commit this plan starts
  from. `main` pins CWE `4.21` in `cwe-version`, and includes the
  focus-graph fix from [#261][pr261].
- **Tag:** an annotated tag `v1.1-base` on that same commit, with the
  message `v1.1 branches from main here`, pushed atomically with the
  branch.
- **Version:** on `v1.1`, `package.json` and the root of
  `package-lock.json` say `1.1.0`. Set it with
  `npm version 1.1.0 --no-git-tag-version`. `main` stays at `0.0.0`.
- **Version-bump PR:**
  - Head branch `release/1.1.0`.
  - Base `v1.1`, title `chore: release 1.1.0`, and a body that starts
    `Closes #262`.
  - The owner merges it. #262 stays open until this plan's own PR merges
    into `main` and closes it.
- **Never delete or force-push `v1`, `v1.1` or `deploy`, and never move or
  delete `v1-base` or `v1.1-base`.**
- **No subagents.** Every step is an operation the controller runs; there
  is nothing to implement.

## Review Focus

1. **`/` must move to `/v1.1/`, not stay on `/v1/`.** The newest release
   is chosen by comparing `X`, then `Y` (`compareReleases` in
   `scripts/build-site.ts`), so 1.1 beats 1.0. Task 4 checks the redirect.
2. **`/v1/` must keep serving 1.0 on CWE 4.20.** Publishing `v1.1` adds a
   directory to `deploy`; it must not replace `v1`'s. Task 4 checks
   `deploy`'s tree and `/v1/data/meta.json`.
3. **A dot in the path.** The app must load its assets and data from
   under `/v1.1/`, not from `/v1/` or `/`. Task 4 checks the HTML and
   fetches the assets.
4. **The cut must not publish or deploy.** It's as for 1.0: the publisher
   skips, with a notice, a branch whose version doesn't match, and
   `vercel.json` turns off Git deployments for `v[0-9]*`.
5. **Publishing fails.** Production must keep serving the previous
   deployment. Fix it by rerunning
   `gh workflow run release-publish.yml -f branch=v1.1`, never by touching
   `deploy`.

---

### Task 1: Preflight

- [x] Run `git checkout main && git pull --ff-only` and record the SHA to
  cut from. `cat cwe-version` prints `4.21`, and
  `jq -r .version package.json` prints `0.0.0`.
- [x] `main`'s latest CI run on that SHA passed:
  `gh run list --branch main --workflow ci.yml --limit 1`.
- [x] Release-branch protection applies to the new branch:
  `gh api repos/mureinik/cwe-visualizer/rules/branches/v1.1 --jq '.[].type'`
  prints the eight types CONTRIBUTING lists.
- [x] The `release-base-tags` ruleset is active, as CONTRIBUTING's check
  for it shows.
- [x] `gh secret list` shows `BACKPORT_TOKEN` and `VERCEL_DEPLOY_HOOK_URL`.
- [x] `git ls-remote origin v1.1 v1.1-base` prints nothing.
  `git ls-tree --name-only origin/deploy` lists `v1` and no `v1.1`.
- [x] Production: `/` redirects to `/v1/`, which reports CWE `4.20`, and
  `/latest/` reports `4.21`.

### Task 2: Cut `v1.1`

- [x] Run CONTRIBUTING's step 3 for `v1.1`:
  `git tag -a v1.1-base -m "v1.1 branches from main here" main`, then
  `git push --atomic origin v1.1-base 'v1.1-base^{commit}:refs/heads/v1.1'`.
  `git ls-remote origin v1.1 'v1.1-base^{}'` prints the SHA from Task 1
  for both refs.
- [x] `release-dispatch.yml` ran for `v1.1` and started
  `release-publish.yml`. That run passed, with the notice `Not publishing
  v1.1: package.json version is 0.0.0, expected 1.1.0.`, and `deploy` has
  no new commit.
- [x] No workflow ran for the tag, and Vercel made no deployment for
  `v1.1` or the tag.

### Task 3: The version-bump PR

- [x] Run `git fetch origin && git checkout -b release/1.1.0 origin/v1.1`,
  then `npm version 1.1.0 --no-git-tag-version`. `git diff` changes only
  the version, from `0.0.0` to `1.1.0`: once in `package.json`, twice in
  `package-lock.json`.
- [x] Run `npm run lint && npx tsc --noEmit && npm test`, then commit
  `chore: release 1.1.0` with the trailer.
- [x] Push and open the PR to the Global Constraints. Wait for CI. The
  checks the `release-branches` ruleset requires must pass: `build`,
  `validate-issue-link`, `dependency-review`, `lint-workflows` and
  `semgrep`.
- [x] Ask the owner to merge it.

### Task 4: Publish and check (after the owner merges)

- [x] Confirm the merge: `gh pr view <n> --json state` says `MERGED`, and
  `origin/v1.1` contains the PR's head.
- [x] The merge's push to `v1.1` started `release-publish.yml`, and it
  passed. `deploy` has a new commit `v1.1: built from v1.1@<sha>`, and
  `git ls-tree --name-only origin/deploy` lists both `v1` and `v1.1`.
- [x] Production rebuilt: the latest production deployment is newer than
  the merge, and READY.
- [x] The site:
  - `curl -s https://cwe-visualizer.vercel.app/` is the redirect page to
    `/v1.1/`.
  - `/v1.1/` returns 200. Its HTML loads assets from `/v1.1/assets/`, and
    they return 200.
  - `/v1.1/data/meta.json` reports `4.21`.
  - `/v1/data/meta.json` still reports `4.20`.
  - `/latest/data/meta.json` reports `4.21`.
- [x] Ask the owner to open `https://cwe-visualizer.vercel.app/?cwe=787`
  in a browser. It lands on `/v1.1/?cwe=787`, which lists CWE-788 under
  "Peers" as "Overlaps", with no "+1 more" chip. Then
  `https://cwe-visualizer.vercel.app/v1/?cwe=787` still shows 1.0 on CWE
  4.20, without CWE-788.

### Task 5: Finish

- [x] If the run turned up anything CONTRIBUTING's "To cut a release"
  gets wrong or leaves out, fix it here. Run `npm run lint:md`, then
  commit `docs: correct the release steps`. If the steps were right, skip
  this.
- [x] Push to this plan's PR, tick the boxes above, and mark it ready. It
  closes [#262][i262].
- [ ] After the owner merges, confirm with `gh pr view` that it merged.
  Then do the post-merge cleanup for `releases/6-release-1.1` and
  `release/1.1.0`, including their Vercel previews. Never touch `v1`,
  `v1.1`, their base tags, or `deploy`.

<!-- Issues and PRs -->
[i262]: https://github.com/mureinik/cwe-visualizer/issues/262
[pr261]: https://github.com/mureinik/cwe-visualizer/pull/261

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
[plan4]: 2026-10-30-releases-4-release-1.0.md
