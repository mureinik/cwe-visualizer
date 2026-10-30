# Releases, Part 3: Security Backports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every security fix that lands on `main` reaches each release
branch it applies to, as an issue plus a PR that closes it. When the
update can't be made cleanly, only the issue is opened, saying why. This
is item 3 of the design's plan of work, for [#248][i248].

**Architecture:** One workflow, `backport-security.yml`, has two
triggers. The first is a Dependabot PR merged into `main` that
[`dependabot/fetch-metadata`][fetch-metadata] ties to a security alert.
The second is a manual run given a GHSA ID. A `resolve` job works out the
GHSA ID and lists the release branches. A matrix job then handles each
branch. It runs `npm audit` against the branch's lockfile to decide
whether the advisory affects the branch and which packages carry it. It
runs `npm update` on those packages, audits again, and runs CI's checks.
Then it pushes a `backport/…` branch and opens the issue and PR with a
fine-grained token, so CI runs on the PR. A small TypeScript script reads
the audit report. Two shell scripts handle the issues and the PR.

**Tech Stack:** Node 24 (type-stripped TypeScript, no dependencies),
Vitest, Bash with `gh` and `jq`, GitHub Actions, npm 11 (`npm audit`,
`npm update`).

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
section "Security backports", plus the Goals and Non-goals that mention
backports, and "The release process" (the docs it asks for).

## Global Constraints

- **Every security fix is backported, dev dependencies included.** No
  filtering by severity or dependency type.
- **"Affected" means npm says so.** A branch is affected when
  `npm audit --json --package-lock-only`, run on that branch, reports a
  vulnerability whose advisory URL is
  `https://github.com/advisories/<GHSA ID>`. This is a ruling against the
  spec, which says to compare the lockfile with the advisory's version
  ranges: npm applies its own matching to its own lockfile, so no
  version-range parsing is written here. The advisory API is still used
  for the manual trigger, to reject a GHSA ID that isn't an npm advisory.
- **A failed audit is never "not affected".** If `npm audit` fails
  (network, registry, malformed lockfile), the branch's job fails and no
  issue or PR is made.
- **GHSA IDs** must match `^GHSA(-[23456789cfghjmpqrvwx]{4}){3}$`, the
  exact form GitHub uses. **Release branches** must match
  `^v[0-9]+(\.[0-9]+)?$`, as in `release-publish.yml`. Both are checked
  as whole strings (`[[ =~ ]]`), never with `grep`.
- **Names:**
  - Issue: `Backport <GHSA ID> to <branch>`.
  - PR: the same title, into `<branch>`, with the body starting
    `Closes #<issue>`.
  - Head branch: `backport/<branch>/<GHSA ID>`.
  - Commit: `fix(deps): backport <GHSA ID> to <branch>`, authored by
    `github-actions[bot]`.
- **Dedupe:** an issue with exactly the backport title, in any state,
  means the advisory is already handled on that branch. The branch is
  skipped with a notice.
- **Tokens:**
  - The job token only reads (`contents: read`).
  - Everything that writes (pushing the head branch, issues, the PR) and
    the Dependabot alert lookup use the `BACKPORT_TOKEN` secret, a
    fine-grained PAT that the owner creates (Task 3).
  - Steps that run release-branch code (`npm update`, `npm ci`, lint,
    tests, build) never see `BACKPORT_TOKEN`.
- **Trigger on the merge, not on Dependabot:** `pull_request` `closed`
  into `main`, guarded by `merged == true` and the PR author being
  `dependabot[bot]`. The run's actor is then the owner who merged, so
  Actions secrets are available.
- **Checks run on the backport:** the same commands as `ci.yml`'s build
  job, in order: `npm ci`, `npm run lint`, `npm run lint:md`,
  `npm run lint:css`, `npm test`, `npm run build`.
- **Workflows:**
  - Actions are pinned by SHA, reusing the pins in [`ci.yml`][ci].
    `dependabot/fetch-metadata` is pinned to
    `25dd0e34f4fe68f24cc83900b1fe3fe149efef98 # v3.1.0`.
  - Top-level `permissions: {}`, with per-job grants.
  - No `${{ }}` inside `run:`.
  - Every checkout uses `persist-credentials: false`.
  - The push authenticates with the same credential-helper pattern as
    `release-publish.yml`, with `BACKPORT_TOKEN`.
- **Tests:** new tests are real-world (no tag). The fixture is a trimmed
  copy of a real `npm audit` report.

## Review Focus

1. **`npm audit` fails or prints an error object**
   (`{"error": {...}}`). The branch must fail loudly. It must not be
   skipped as unaffected. *Pinned by Task 1's error tests and Task 2's
   step order.*
2. **No patched version fits the branch's ranges.** This is today's
   `re2js` case: `markdownlint` pins a vulnerable range. `npm update`
   then changes nothing useful, and the second audit still reports the
   GHSA. The result must be an issue saying so, never a PR. *Pinned by
   Task 2's re-audit step.*
3. **The advisory appears only as a propagated `via`.** Entries like
   `markdownlint`'s `via: ["re2js"]` are strings and name no advisory.
   The packages to update are the vulnerable ones (`re2js`), deduplicated.
   *Pinned by Task 1's tests.*
4. **A rerun, or a manual run after the automatic one.** No second issue
   or PR may appear for the same advisory and branch. *Pinned by the
   dedupe check and a per-branch, per-advisory `concurrency` group.*
5. **The Dependabot PR isn't tied to an alert** (an ordinary version
   update, or a lookup that finds nothing). The run must do nothing,
   quietly. When a security PR's lookup returns no GHSA, there must be a
   warning that tells the owner to run the workflow by hand. *Pinned in
   Task 2's `resolve` job.*

---

### Task 1: Read the audit report

**Files:**

- Create: `scripts/advisory-packages.ts`
- Create: `test/scripts/advisory-packages.test.ts`
- Create: `test/fixtures/npm-audit.json`

**Interfaces:**

- Produces (exported from `scripts/advisory-packages.ts`):
  - `isGhsaId(value: string): boolean`, using the Global Constraints
    pattern.
  - `advisoryPackages(report: unknown, ghsa: string): string[]`. It
    returns the sorted, deduplicated `name` of every object entry in any
    `vulnerabilities[*].via` whose `url` is exactly
    `https://github.com/advisories/<ghsa>`, compared case-insensitively.
    It throws if the report has an `error` key, or if it has no
    `vulnerabilities` object.
  - CLI: `node scripts/advisory-packages.ts <GHSA ID> < report.json`
    prints one package per line. It exits 2 on a bad GHSA ID and 1 on an
    unreadable report, with the reason on stderr. When the advisory
    doesn't apply, it prints nothing and exits 0. It uses `import.meta.main`
    as [`build-site.ts`][build-site] does. It has no imports beyond
    `node:` modules, because the workflow runs it before any `npm ci`.

- [ ] **Step 1: Create the fixture.** `test/fixtures/npm-audit.json` is
  this repo's real report (`npm audit --json --package-lock-only` on
  `main` at `e05328a`), trimmed to two entries.
  - `re2js`, with its one advisory object: `name: "re2js"` and
    `url: "https://github.com/advisories/GHSA-gg6h-894w-4m9c"`.
  - `markdownlint`, with `via: ["micromark-extension-math", "re2js"]`.
  - `auditReportVersion: 2`, plus the `metadata` block.

- [ ] **Step 2: Write the failing tests** in
  `test/scripts/advisory-packages.test.ts` (`// @vitest-environment node`).
  - `isGhsaId`:
    - `'accepts GitHub's form'`: `GHSA-gg6h-894w-4m9c` and
      `GHSA-mrhx-c7xc-m3w5` are true.
    - `'rejects anything else'`: these are all false:
      - `ghsa-gg6h-894w-4m9c`
      - `GHSA-gg6h-894w`
      - `GHSA-gg6h-894w-4m9c-x`
      - `GHSA-gg6h-894w-4m9c\nx`
      - `CVE-2026-1234`
      - an empty string
  - `advisoryPackages`:
    - `'names the vulnerable package, not the packages it propagates to'`:
      the fixture with `GHSA-gg6h-894w-4m9c` gives `['re2js']`.
    - `'matches the GHSA ID case-insensitively'`: the fixture with the ID
      in upper case after the prefix (`GHSA-GG6H-894W-4M9C`) gives
      `['re2js']`.
    - `'returns nothing for an advisory the report lacks'`: the fixture
      with `GHSA-mrhx-c7xc-m3w5` gives `[]`.
    - `'returns nothing for a clean report'`:
      `{ auditReportVersion: 2, vulnerabilities: {} }` gives `[]`.
    - `'deduplicates and sorts'`: two vulnerabilities whose vias name `b`
      and `a`, `a` twice, all with the same advisory URL, give
      `['a', 'b']`.
    - `'refuses an npm error report'`:
      `{ error: { code: 'ENOLOCK', summary: 'x' } }` throws.
    - `'refuses something that is not an audit report'`: `null`, `[]`
      and `{}` each throw.

- [ ] **Step 3: Run them to verify they fail.**
  Run: `npx vitest run test/scripts/advisory-packages.test.ts`.
  Expected: FAIL, because the module doesn't exist.

- [ ] **Step 4: Implement `scripts/advisory-packages.ts`** to the
  interface above. Narrow `unknown` with type guards, not casts.

- [ ] **Step 5: Verify.** Run
  `npm run lint && npx tsc --noEmit && npm test`. Expected: PASS. Then
  run `npm audit --json --package-lock-only | node scripts/advisory-packages.ts GHSA-gg6h-894w-4m9c`.
  Expected: prints `re2js`. This applies only while the advisory is still
  open on `main`. If it has since been fixed, expect empty output and
  note that in the report.

- [ ] **Step 6: Commit.** `feat: find the packages an advisory affects in an npm audit report`

### Task 2: The backport workflow and its scripts

**Files:**

- Create: `.github/scripts/issue-by-title.sh`
- Modify: `.github/scripts/open-cwe-issue.sh` (use the new helper)
- Create: `.github/scripts/open-backport.sh`
- Create: `.github/workflows/backport-security.yml`

**Interfaces:**

- Consumes: Task 1's CLI. The `BACKPORT_TOKEN` secret, which Task 3's
  docs tell the owner to create.
- Produces:
  - `.github/scripts/issue-by-title.sh <title>` prints the URL of an
    issue with exactly that title, in any state, or nothing. It needs
    `GH_TOKEN` and `GH_REPO`. This is the search-and-filter logic now in
    `open-cwe-issue.sh`, moved here unchanged, and `open-cwe-issue.sh`
    calls it.
  - `.github/scripts/open-backport.sh <ghsa> <branch> <packages> [<failure>]`.
    `<packages>` is space-separated. It needs `GH_TOKEN`, `GH_REPO`, and
    `RUN_URL` (a link to the run's log). It validates `<ghsa>` and
    `<branch>` with the Global Constraints patterns (exit 2 otherwise).
    - Without `<failure>`, it creates the issue, then
      `gh pr create --base <branch> --head backport/<branch>/<ghsa>` with
      the backport title. The body is `Closes #<issue>`, then the
      advisory link, the updated packages, and a note that the issue must
      be closed by hand after merging, since only `main` auto-closes
      issues.
    - With `<failure>`, it creates only the issue. The body gives the
      advisory link, the packages, `<failure>`, and `RUN_URL`.
    - It prints the URLs it created.
  - `backport-security.yml`, also runnable by hand:
    `gh workflow run backport-security.yml -f ghsa=GHSA-…`.

- [ ] **Step 1: Write `issue-by-title.sh`** and switch `open-cwe-issue.sh`
  to it. `open-cwe-issue.sh`'s behaviour doesn't change.

- [ ] **Step 2: Write `open-backport.sh`** to the interface above.

- [ ] **Step 3: Write `backport-security.yml`.**
  - **Header comment:**
    - Why release branches need this: Dependabot targets only the default
      branch.
    - Why it triggers on the merge and not on Dependabot's events.
    - Why it uses its own token.
    - Point to CONTRIBUTING's "Releases".
  - **Triggers:**
    - `pull_request` with `types: [closed]` and `branches: [main]`.
    - `workflow_dispatch` with input `ghsa` (string, required).
  - **`resolve` job** (`contents: read`). Its outputs are `ghsa` and
    `branches` (a JSON array).
    1. For `pull_request`, the job's `if:` requires
       `github.event.pull_request.merged` and
       `github.event.pull_request.user.login == 'dependabot[bot]'`.
       - Run fetch-metadata with `alert-lookup: true` and
         `github-token: ${{ secrets.BACKPORT_TOKEN }}`.
       - An empty `ghsa-id` with an empty `alert-state` is a version
         update: emit a notice and leave `branches` as `[]`.
       - An empty `ghsa-id` with a non-empty `alert-state` is a security
         PR whose lookup failed: emit a `::warning::` that names the
         command to run by hand, and leave `branches` as `[]`.
    2. For `workflow_dispatch`, take `inputs.ghsa`. Then check with
       `gh api advisories/<ghsa>` (job token) that some
       `vulnerabilities[].package.ecosystem` is `npm`. If none is, fail
       with `::error::`.
    3. For either trigger, validate the GHSA ID (fail with `::error::`,
       without echoing the value). List branches with
       `gh api --paginate repos/<repo>/branches --jq '.[].name'`, keep
       those matching the release pattern, and output them as a JSON
       array. If there are none, emit a notice.
  - **`backport` job:**
    - `needs: resolve`, and `if: needs.resolve.outputs.branches != '[]'`.
    - Matrix over `fromJSON(needs.resolve.outputs.branches)`, with
      `fail-fast: false`.
    - Permissions: `contents: read`.
    - `concurrency: backport-<ghsa>-<branch>`, with
      `cancel-in-progress: false`.
    - Steps:
      1. Check out `main` into `tools/`, and the matrix branch into
         `release/`.
      2. Run setup-node with `ci.yml`'s pin and version, and
         `cache-dependency-path: release/package-lock.json`.
      3. **Audit (`id: audit`).** In `release/`, run
         `npm audit --json --package-lock-only > "$RUNNER_TEMP/audit.json" || true`,
         then
         `node ../tools/scripts/advisory-packages.ts "$GHSA" < "$RUNNER_TEMP/audit.json"`
         (errors fail the step). Output `packages`, space-joined. If it's
         empty, emit a notice that the branch isn't affected, and skip
         every later step.
      4. **Dedupe (`id: dedupe`)**, with `BACKPORT_TOKEN`. If
         `issue-by-title.sh "Backport $GHSA to $BRANCH"` prints a URL,
         emit a notice with it and skip every later step.
      5. **Update (`id: update`, `continue-on-error: true`).** In
         `release/`, run `npm update $PACKAGES` (intentionally unquoted,
         with a shellcheck directive saying so). Then repeat step 3's
         audit, and fail if the advisory is still reported.
      6. **Checks (`id: checks`, `continue-on-error: true`, only if
         update succeeded).** Run the Global Constraints check commands
         in `release/`.
      7. **Push (only if checks succeeded)**, with `BACKPORT_TOKEN`. In
         `release/`:
         - Run `git switch -c "backport/$BRANCH/$GHSA"`.
         - Commit `package.json` and `package-lock.json` with the Global
           Constraints message. Set `HUSKY=0` for the commit: `npm ci`
           installed the branch's pre-commit hook, which would otherwise
           run release-branch code (lint-staged, the tests) with
           `BACKPORT_TOKEN` in its environment. Step 6 already ran those
           checks.
         - Push with the credential helper.
      8. **Report (`if: always()` and the dedupe step ran without
         skipping)**, with `BACKPORT_TOKEN`. Call `open-backport.sh`
         from `tools/`, with `<failure>` set by outcome:
         - Update failed: `No patched version fits <branch>'s dependency
           ranges, or npm update failed.`
         - Checks failed: `npm update succeeded, but CI's checks failed
           on the result.`
         - Push failed: `Could not push backport/<branch>/<ghsa>; it may
           exist from an earlier run.`
         - Otherwise, no `<failure>`.
    - Pass every value through `env:`, including the matrix branch,
      GHSA, packages and `RUN_URL`. `RUN_URL` is built from
      `github.server_url`, `github.repository` and `github.run_id`.

- [ ] **Step 4: Verify.**
  - Run `npm run lint`. Expected: PASS.
  - Run `shellcheck .github/scripts/*.sh`. Expected: no findings.
  - Run `.github/scripts/issue-by-title.sh "CWE 4.21 is available"` with
    the local `gh` token. Expected: it prints #243's URL.
  - Run `open-backport.sh` with `GHSA-nope` as the GHSA ID. Expected:
    exit 2, with nothing created.
  - CI's `lint-workflows` (actionlint, zizmor, shellcheck) and `semgrep`
    must pass on the PR.

- [ ] **Step 5: Commit.** `ci: backport security fixes to release branches`

### Task 3: Documentation

**Files:**

- Modify: `CONTRIBUTING.md` ("Releases" section)

- [ ] **Step 1: Add a "Security backports" subsection to "Releases".**
  - What triggers a backport.
  - What it opens: one issue plus PR per advisory per branch, or only an
    issue on failure.
  - That merging the PR republishes the release, and that the issue is
    closed by hand.
  - After any security fix made by hand on `main`, run
    `gh workflow run backport-security.yml -f ghsa=GHSA-…`.
  - The known blind spot from the spec: a package `main` no longer uses.
- [ ] **Step 2: Add the owner's one-time token step**, next to the
  ruleset step. Create a fine-grained PAT:
  - Repository: this one only.
  - Permissions: Contents read/write, Issues read/write, Pull requests
    read/write, Dependabot alerts read. Metadata read is implied.
  - Expiry: the longest allowed, with a note to rotate it before it
    expires.

  Store it as the repository secret `BACKPORT_TOKEN`. Say why it can't be
  the job token: PRs opened with the job token don't trigger CI, and the
  alert lookup needs it.
- [ ] **Step 3:** Run `npm run lint:md`, then commit:
  `docs: describe security backports`.

### Task 4: PR and post-merge checks

- [ ] **Step 1:** Push to this plan's draft PR (it closes [#248][i248],
  part of [#238][i238]). Update the description, and mark it ready once
  CI passes.
- [ ] **Step 2 (owner, before merge):** create `BACKPORT_TOKEN` as
  Task 3 describes.
- [ ] **Step 3 (after the owner merges):**
  - Run `gh workflow run backport-security.yml -f ghsa=GHSA-mrhx-c7xc-m3w5`.
    Expected: `resolve` passes and notes there are no release branches,
    and `backport` is skipped.
  - Run it with `-f ghsa=nope`. Expected: `resolve` fails on validation.
- **Verification gap, accepted:** the per-branch job can't run until a
  release branch exists. Release 1.0's plan runs it against `v1` with
  `GHSA-gg6h-894w-4m9c` (`re2js`), if that advisory is still open then.
  That should take the failure path (an issue only) and exercise the
  rest of the job. It also deletes that test issue afterwards, if the
  owner agrees.

<!-- Issues and PRs -->
[i238]: https://github.com/mureinik/cwe-visualizer/issues/238
[i248]: https://github.com/mureinik/cwe-visualizer/issues/248

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
[ci]: ../../../.github/workflows/ci.yml
[build-site]: ../../../scripts/build-site.ts

<!-- External -->
[fetch-metadata]: https://github.com/dependabot/fetch-metadata
