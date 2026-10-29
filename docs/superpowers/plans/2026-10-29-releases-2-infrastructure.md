# Releases, Part 2: Release Infrastructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production serves `/` (a redirect to the newest release, or to
`/latest/` while there is none), `/latest/` (`main`) and `/vX/`, `/vX.Y/`
for each release. Releases are built once by a workflow into an orphan
`deploy` branch and copied into every production build. This is item 2 of
the design's plan of work, for [#245][i245].

**Architecture:** A new build entry point, `scripts/build-site.ts`, replaces
`npm run build` as Vercel's build command. In previews it builds the app at
`/`, exactly as today. In production it builds `main` under `/latest/`,
downloads the `deploy` branch as a zip from GitHub, copies its `v*/`
directories in, and writes a root `index.html` that redirects to the newest
one. Two workflows publish releases. A dispatcher runs on pushes to `v*`
branches and starts a publisher, which runs from `main`, builds the release
branch, commits the output to `deploy` and calls the Vercel deploy hook.

**Tech Stack:** Node 24 (type-stripped TypeScript), Vite's `build()` API,
`adm-zip` (already a dev dependency), Vitest, GitHub Actions, Vercel
(`vercel.json` `buildCommand` and `git.deploymentEnabled`).

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
sections "Versioning", "Site layout and deployment" (including Flow 1,
Flow 2, "Vercel previews and cleanup"), "Branch protection for release
branches" and "The release process".

## Global Constraints

- **Release names:** a release directory and branch name matches
  `^v(\d+)(?:\.(\d+))?$`: `v1` is 1.0, `v1.1` is 1.1. "Newest" compares
  major, then minor, numerically, so `v1.10` beats `v1.9` and `v2` beats
  `v1.10`.
- **Paths:** `/latest/` is `main`, `/<branch>/` is a release, and `/`
  redirects to `/<newest>/`, or to `/latest/` when no release exists. The
  redirect keeps the query string and hash (`/?cwe=79` → `/v1/?cwe=79`).
- **Deploy branch zip:**
  `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/deploy`.
  The owner and repo come from `VERCEL_GIT_REPO_OWNER` and
  `VERCEL_GIT_REPO_SLUG`, falling back to `mureinik` and `cwe-visualizer`.
  A failed download fails the production build; there is no partial site.
- **Production layout** runs when `VERCEL_ENV === 'production'`, or when
  `SITE_LAYOUT === 'releases'` (for local runs). Every other build is
  today's single app at `/`.
- **Publishing gate:** a release branch publishes only when its
  `package.json` version is `X.Y.0` for branch `vX.Y`, or `X.0.0` for
  `vX`. Otherwise the publisher logs a notice and exits successfully.
- **`deploy` commits:** one per publish, with the message
  `<branch>: built from <branch>@<short sha>`. The publisher only adds
  commits; it never force-pushes.
- **Vercel deployments:** pushes to `v*` and `deploy` branches create none.
  PRs into release branches still get previews, since their head branches
  aren't `v*`.
- **The app still never contacts MITRE or GitHub at runtime.** All of the
  above happens at build time or in workflows; nothing in `src/` changes.
- **Workflows:** actions pinned by SHA, reusing the pins in
  [`ci.yml`][ci]. Top-level `permissions: {}`, per-job grants. No `${{ }}`
  inside `run:`.
- **Tests:** new tests are real-world (no tag). They cover our own build
  and GitHub's download format.

## Review Focus

1. The `deploy` branch can't be downloaded (404 before it exists, a GitHub
   outage). The production build must fail, never deploy a site without
   its releases.
2. The `deploy` zip holds things that aren't releases (its README,
   `vercel.json`, a stray directory, a `..` path). Only `v*/` directories
   are copied, and nothing is written outside the output directory.
3. Version ordering with two-digit minors: `v1.10` must beat `v1.9`.
4. Old shared links: `/?cwe=79#x` must land on `/<newest>/?cwe=79#x`.
5. A release branch pushed before its version bump (the normal cut) must
   publish nothing and must not fail.

---

### Task 1: The production site build

**Files:**

- Create: `scripts/build-site.ts`
- Create: `test/scripts/build-site.test.ts`
- Modify: `package.json` (scripts)
- Modify: `vercel.json`

**Interfaces:**

- Produces (all exported from `scripts/build-site.ts`):
  - `parseRelease(name: string): { major: number; minor: number } | null`
  - `newestRelease(names: string[]): string | null`. It ignores names
    that aren't releases.
  - `redirectPage(target: string): string`, the root `index.html`.
  - `deployArchiveUrl(owner: string, repo: string): string`
  - `extractReleases(zip: Buffer, outDir: string): string[]`. It copies
    each top-level `v*/` directory under the archive's single root folder
    into `outDir`, and returns the names sorted oldest to newest.
  - `run(options?: { env?: NodeJS.ProcessEnv; outDir?: string; fetchImpl?: typeof fetch; buildApp?: (base: string, outDir: string) => Promise<void> }): Promise<{ layout: 'single' | 'releases'; releases: string[]; redirect: string | null }>`.
    The defaults are `process.env`, `path.join(process.cwd(), 'dist')`,
    `fetch`, and a `buildApp` that calls Vite's
    `build({ base, build: { outDir, emptyOutDir: true } })`.
- Task 2's publisher builds a release with that release branch's own
  `npm run build -- --base=/<branch>/`, so it doesn't use this file.

- [ ] **Step 1: Write the failing tests** in `test/scripts/build-site.test.ts`
  (`// @vitest-environment node`, following
  [`prepare-data.test.ts`][prepare-test]). Build zips with `AdmZip` under a
  root folder `cwe-visualizer-0123abc/`, as GitHub's zipballs are.
  - `parseRelease`:
    - `'parses major and optional minor'`: `v1` gives `{1,0}`, `v1.1`
      gives `{1,1}`, and `v10.2` gives `{10,2}`.
    - `'rejects anything else'`: `latest`, `v1.1.1`, `v`, `1.0`, `v1.`,
      `V1` and `v01x` all give `null`.
  - `newestRelease`:
    - `'compares major then minor numerically'`:
      `['v1', 'v1.9', 'v1.10', 'v1.2']` gives `'v1.10'`, and
      `['v1.10', 'v2']` gives `'v2'`.
    - `'ignores non-release names and returns null when none'`:
      `['latest', 'README.md']` gives `null`, and `[]` gives `null`.
  - `redirectPage`:
    - `'redirects with the query string and hash'`: the output contains
      `location.replace("/v1.1/" + location.search + location.hash)`.
    - `'falls back without JavaScript'`: it contains
      `<meta http-equiv="refresh" content="0; url=/v1.1/">` and
      `href="/v1.1/"`.
  - `deployArchiveUrl('o', 'r')` is
    `https://codeload.github.com/o/r/zip/refs/heads/deploy`.
  - `extractReleases`:
    - `'copies only release directories'`: a zip with `v1/index.html`,
      `v1.1/assets/a.js`, `README.md`, `vercel.json` and `notes/x.txt`
      returns `['v1', 'v1.1']`. Both files exist under `outDir`, and
      `README.md`, `vercel.json` and `notes` don't.
    - `'never writes outside outDir'`: an entry named
      `cwe-visualizer-0123abc/v1/../../escape.txt`, added with a raw name,
      leaves no `escape.txt` anywhere above `outDir`.
  - `run`:
    - `'builds a single app at / outside production'`: `env: {}` calls
      `buildApp` once with `('/', outDir)`, never calls fetch, and returns
      `layout: 'single'`.
    - `'assembles releases in production'`: `VERCEL_ENV: 'production'`
      with a fake fetch returning a zip of `v1/` and `v1.1/`. `buildApp`
      is called with `('/latest/', outDir/latest)`, fetch with
      `deployArchiveUrl('mureinik', 'cwe-visualizer')`, the output has
      `v1/index.html`, and the root `index.html` redirects to `/v1.1/`.
    - `'uses the Vercel repository variables'`: `VERCEL_GIT_REPO_OWNER: 'o'`
      and `VERCEL_GIT_REPO_SLUG: 'r'` fetch `deployArchiveUrl('o', 'r')`.
    - `'redirects to /latest/ when there is no release'`: the zip holds
      only `README.md`, so `redirect` is `'/latest/'`.
    - `'assembles releases when SITE_LAYOUT is releases'`.
    - `'fails when the deploy branch can't be downloaded'`: an HTTP 404
      rejects with `/deploy branch.*HTTP 404/`, a rejected fetch rejects,
      and in both cases no root `index.html` is written.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run test/scripts/build-site.test.ts`
Expected: FAIL, because the module doesn't exist yet.

- [ ] **Step 3: Implement `scripts/build-site.ts`**

- **Production order:** empty `outDir`, `buildApp('/latest/', …)`,
  download, `extractReleases`, then write `index.html`.
- **Zip safety:** compute each target path and refuse any that resolves
  outside `outDir` (`path.relative` starting with `..`) before writing.
- **Escaping:** embed the redirect target in the script with
  `JSON.stringify`, and escape it in the HTML attributes.
- **CLI:** use the same `import.meta.main` block as
  [`prepare-data.ts`][prepare-data], including its eslint comment.
- **Logging:** log the layout, the releases found and the redirect.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx vitest run test/scripts/build-site.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into the build**

- **`package.json`:** add `"build:site": "tsc --noEmit && node scripts/build-site.ts"`
  and `"prebuild:site": "npm run prepare-data"`. Leave `build` as it is,
  since CI and release branches use it.
- **`vercel.json`:** add `"buildCommand": "npm run build:site"` and
  `"git": { "deploymentEnabled": { "v[0-9]*": false, "deploy": false } }`.

- [ ] **Step 6: Run the production layout locally against today's GitHub**

`deploy` doesn't exist until Task 2, so first confirm the failure path.

Run: `SITE_LAYOUT=releases npm run build:site`
Expected: it fails with the `deploy branch … HTTP 404` message.

After Task 2 Step 1 creates `deploy`, rerun it.
Expected: success, `dist/latest/index.html` exists, and `dist/index.html`
redirects to `/latest/`. Then serve it (`npx vite preview --outDir dist`)
and load `/latest/?cwe=79`.

- [ ] **Step 7: Full checks, then commit**

Run: `npm run lint && npm run lint:md && npx tsc --noEmit && npm run test:coverage`
Commit message: `feat: build production as /latest/ plus published releases`.

### Task 2: The `deploy` branch and the publish workflows

**Files:**

- Create (on a new orphan branch `deploy`, not this PR's branch):
  `README.md`, `vercel.json`
- Create: `.github/workflows/release-dispatch.yml`
- Create: `.github/workflows/release-publish.yml`

**Interfaces:**

- Consumes: Task 1's layout. Each `deploy` directory is the
  `npm run build -- --base=/<branch>/` output of that branch. The
  `VERCEL_DEPLOY_HOOK_URL` repository secret already exists.
- Produces: `release-publish.yml`, run by `workflow_dispatch` with input
  `branch`, which can also be run by hand
  (`gh workflow run release-publish.yml -f branch=v1`).

- [ ] **Step 1: Create `deploy`**

Create an orphan branch in a temporary worktree, not in the main checkout.
Commit two files:

- `README.md`: two sentences saying this branch holds built release
  output written by `release-publish.yml`, must never be edited by hand,
  and pointing to CONTRIBUTING's "Releases" section.
- `vercel.json`: `{"git": {"deploymentEnabled": false}}`.

Push it, and confirm in Vercel that the push created no deployment.

- [ ] **Step 2: Write `release-publish.yml`**

- **Trigger:** `workflow_dispatch` with input `branch` (string, required).
- **Concurrency:** group `release-publish`, `cancel-in-progress: false`.
- **Permissions:** top-level `permissions: {}`. One job on
  `ubuntu-24.04` with `contents: write`.
- **Steps:**
  1. Fail with `::error::` unless `branch` matches the release pattern.
     Pass it through `env:`.
  2. Check out the branch into `release/` with
     `persist-credentials: false`.
  3. Run setup-node with the same pin, version and npm cache as
     `ci.yml`, with `cache-dependency-path: release/package-lock.json`.
  4. Compute the expected version (`vX` → `X.0.0`, `vX.Y` → `X.Y.0`) and
     compare it with `jq -r .version release/package.json`. If they
     differ, emit `::notice::` and skip every later step through a step
     output. Don't fail.
  5. In `release/`, run `npm ci`, then `npm run build -- --base=/<branch>/`.
  6. Check out `deploy` into `deploy/`. This checkout keeps the job token
     so it can push.
  7. Replace `deploy/<branch>/` with `release/dist/`
     (`rsync -a --delete`). If `git status --porcelain` shows no change,
     emit a notice and skip the commit. Otherwise commit as
     `github-actions[bot]` with the message
     `<branch>: built from <branch>@<short sha of release HEAD>`. Push,
     and on rejection `git pull --rebase` and retry, up to 3 attempts.
  8. Run `curl -sf -X POST "$VERCEL_DEPLOY_HOOK_URL"` (secret via `env:`).
- **Header comment:** explain why publishing runs from `main` (the spec's
  "frozen app, not frozen pipeline").

- [ ] **Step 3: Write `release-dispatch.yml`**

- **Trigger:** `push` to branches `v[0-9]*`.
- **Permissions:** `actions: write` only.
- **Step:** one step that runs
  `gh workflow run release-publish.yml --repo "$GITHUB_REPOSITORY" --ref main -f branch="$BRANCH"`,
  with `BRANCH` taken from `github.ref_name` and `GH_TOKEN` from
  `github.token`, both through `env:`.
- **Header comment:** say every release branch carries a copy of this
  file from its cut, so it must stay this small.

- [ ] **Step 4: Check and commit**

Run: `npm run lint` (ESLint also lints YAML).
Expected: PASS. CI's `lint-workflows` runs actionlint, zizmor and
shellcheck.
Commit message: `ci: publish release branches to the deploy branch`.

### Task 3: Documentation

**Files:**

- Modify: `CONTRIBUTING.md`
- Modify: `README.md`

- [ ] **Step 1: Add a "Releases" section to `CONTRIBUTING.md`**, after
  "Workflow". Cover:
  - **The layout**, and the versioning rule from the spec's "Versioning"
    section.
  - **The release process** from the spec's "The release process", steps
    1–5. The cut is `git push origin main:refs/heads/vX.Y`, and the
    version-bump PR closes the release issue.
  - **The `deploy` branch:** never edit it by hand, and republish with
    `gh workflow run release-publish.yml -f branch=vX.Y`.
  - **The owner's one-time ruleset step:** add `refs/heads/v*` to
    `main-merge-owner-only`, or a ruleset with the same rules, before the
    first cut.
  - **No deployments:** `v*` and `deploy` pushes create no Vercel
    deployments.
- [ ] **Step 2: Update the passages this changes**
  - The `scripts/` paragraph now names `build-site.ts` too.
  - The Vercel paragraph: production builds `main` under `/latest/` and
    copies releases from `deploy`. PR previews are still a single copy at
    `/`.
- [ ] **Step 3: Add a short note to `README.md`:** `/` is the newest
  release, `/latest/` follows development, and older releases stay at
  `/vX.Y/`.
- [ ] **Step 4:** Run `npm run lint:md`, then commit:
  `docs: describe releases and the release process`.

### Task 4: PR and post-merge checks

- [ ] **Step 1:** Push onto this plan's draft PR (it closes
  [#245][i245], part of [#238][i238]). Update the description, and mark
  the PR ready once CI passes.
- [ ] **Step 2 (owner, before merge or at the latest before the v1
  cut):** create the release-branch ruleset.
- [ ] **Step 3 (controller):** update the post-merge cleanup memory so
  that it never deletes `v*` or `deploy` branches or their deployments.
- [ ] **Step 4 (after the owner merges):** check that:
  - `https://cwe-visualizer.vercel.app/` serves the redirect page to
    `/latest/`.
  - `/latest/` and `/latest` both serve the app.
  - `/latest/data/meta.json` reports `4.20`.
  - Opening `/?cwe=79` in a browser lands on `/latest/?cwe=79`.
  - The next PR's preview still serves the app at `/`.

<!-- Issues and PRs -->
[i238]: https://github.com/mureinik/cwe-visualizer/issues/238
[i245]: https://github.com/mureinik/cwe-visualizer/issues/245

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
[ci]: ../../../.github/workflows/ci.yml
[prepare-data]: ../../../scripts/prepare-data.ts
[prepare-test]: ../../../test/scripts/prepare-data.test.ts
