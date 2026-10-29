# Releases, Part 1: Pin the CWE Version — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every build downloads the exact CWE version named in a
`cwe-version` file, `main` pins 4.20, and the daily
[`update-data.yml`][update-data] stops redeploying and instead opens one
issue per new CWE version, from two watchers. This is item 1 of the
design's plan of work (the user's steps 1 and 2), as one PR.

**Architecture:** [`scripts/prepare-data.ts`][prepare-data] reads the pin,
downloads `cwec_v{pin}.xml.zip` from MITRE's archive, and refuses a
catalog whose version isn't the pin. Its fast path keys on the cached
version instead of a `HEAD` request, so a matching cache needs no network.
The daily workflow becomes two jobs that compare MITRE against the pins
and call one shared script that opens an issue unless one with the same
title exists.

**Tech Stack:** Node 24 (type-stripped TypeScript), Vitest, GitHub Actions,
`gh`, POSIX shell tools (`curl`, `unzip`, `sort -V`).

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
sections "The pinned CWE version" and "Watching MITRE".

## Global Constraints

- The pin file is `cwe-version` at the repo root, one line: `4.20`.
  A valid pin matches `^\d+\.\d+(\.\d+)?$` after trimming whitespace.
- Archive URL: `https://cwe.mitre.org/data/xml/cwec_v${version}.xml.zip`.
- A build must never serve a CWE version other than the pin: no fallback
  to a cache of another version, no fallback to `cwec_latest`.
- The app still never contacts MITRE at runtime; nothing in `src/`
  changes.
- Issue title, exactly: `CWE ${version} is available`. One issue per
  title ever, open or closed.
- Watchers open issues only; they never commit, push or deploy. Workflow
  permissions: `contents: read`, `issues: write`, nothing else.
- Changed and new tests in [`test/scripts/prepare-data.test.ts`][prepare-test]
  are real-world (they cover MITRE's download and our own pin file). The
  existing `theoretical` block there is untouched.
- Per [`CLAUDE.md`][claude-md], real-world tests change only for intended
  behaviour changes. The fast-path and offline tests listed in Task 1 change
  because the design changes that behaviour; every other existing test keeps
  its title and assertions.

## Review Focus

1. A pin file with a trailing newline, CRLF or spaces (any editor) is read
   as the bare version; an empty or malformed one fails with a message
   naming `cwe-version`.
2. A developer's `public/data/` left over from another version (today's
   checkouts hold 5.0) is replaced on the next run, never served.
3. A pin MITRE never published (typo, `4.2`) fails with the HTTP status
   and the URL; it doesn't fall back to any cache.
4. A watcher rerun, or a run after the issue was closed, opens no second
   issue for the same version.
5. MITRE unreachable, or a zip with no readable version, makes the watcher
   run fail visibly rather than open an issue titled `CWE  is available`.

---

### Task 1: Download the pinned version

**Files:**

- Create: `cwe-version`
- Modify: `scripts/prepare-data.ts` (the `SOURCE_URL` constant, `RunOptions`, `run`)
- Modify: `.github/scripts/vercel-ignore-build.sh` (the path list in the final `git diff`)
- Modify: `CONTRIBUTING.md` ("Running locally", the `predev` paragraph)
- Test: `test/scripts/prepare-data.test.ts`

**Interfaces:**

- Produces (all exported from `scripts/prepare-data.ts`):
  - `PIN_FILE = 'cwe-version'`
  - `archiveUrl(version: string): string`
  - `readPinnedVersion(file?: string): Promise<string>`. The default is
    `path.join(process.cwd(), PIN_FILE)`. It returns the trimmed version
    and throws `Error` with a message containing the file path when the
    file is missing or invalid.
  - `run(options?: { version?: string; outDir?: string; fetchImpl?: typeof fetch }): Promise<{ updated: boolean; meta: CweMeta }>`.
    `version` defaults to `await readPinnedVersion()`. `sourceUrl` is
    removed from the options.
- Task 2's workflow reads the same file with `cat cwe-version` (and via
  the GitHub contents API for other branches).

- [ ] **Step 1: Create `cwe-version` containing `4.20` and a trailing newline.**

- [ ] **Step 2: Write the failing tests**

In `test/scripts/prepare-data.test.ts`:

- `fakeFetch` loses its `HEAD` branch. Its options become
  `{ lastModified?: string | null; getStatus?: number }`, applied to the
  GET response's `headers.get('last-modified')`.
- Every `run(...)` call passes `version: '4.15'` (the fixture's version).

New `describe('archiveUrl')`:

```ts
it('names the archive file for a version', () => {
  expect(archiveUrl('4.20')).toBe('https://cwe.mitre.org/data/xml/cwec_v4.20.xml.zip');
  expect(archiveUrl('4.19.1')).toBe('https://cwe.mitre.org/data/xml/cwec_v4.19.1.xml.zip');
});
```

New `describe('readPinnedVersion')`, writing files into a temp dir:

- `'reads the version, ignoring surrounding whitespace'`: the contents
  `' 4.20\r\n'` give `'4.20'`, and `'4.19.1\n'` gives `'4.19.1'`.
- `'rejects an empty or malformed pin, naming the file'`: for each of
  `''`, `'latest'`, `'4'`, `'v4.20'` and `'4.20 4.21'`, it rejects with a
  message containing the file path.
- `'rejects a missing pin file, naming it'`.

In `describe('run')`:

- `'downloads the pinned version from the archive'`: the fetch spy's only
  call is to `archiveUrl('4.15')`, and `result.meta.cweVersion` is
  `'4.15'`.
- `'throws when the archive holds a different version than the pin'`:
  `run({ version: '4.16', … })` rejects with `/4\.15.*4\.16|4\.16.*4\.15/`,
  and `cwe.json` is not written.
- Rename `'skips the download when the cached last-modified matches'` to
  `'skips the download, without any request, when the cached version matches the pin'`.
  It asserts `fetchSpy` was never called.
- Replace `'re-downloads when the last-modified has changed'` with
  `'re-downloads when the cached data is another version'`. Cache with
  `version: '4.15'`, then edit `meta.json`'s `cweVersion` to `'5.0'`.
  The second run returns `updated: true` with `cweVersion` `'4.15'`.
- Replace `'reuses cached data when the source is unreachable and a cache exists'`
  with `'throws, rather than reuse it, when the cache is another version and the source is unreachable'`.
  It rejects with `/network down/`.
- Keep `'throws when the source is unreachable and there is no cache'`,
  now asserting `/Could not download CWE 4\.15/` (the message from Step 4).
- Replace `'downloads when the HEAD response has no Last-Modified header'`
  with `'records the download\'s Last-Modified, or empty when absent'`.
  `lastModified: '"v1"'` gives `'"v1"'`, and `null` gives `''`.
- Rename `'throws when the GET returns a non-OK response after a successful HEAD'`
  to `'throws, naming the URL, when the archive returns a non-OK response'`.
  It asserts `/HTTP 404.*cwec_v4\.15\.xml\.zip/` with `getStatus: 404`.
- Rename `'throws when the GET itself throws after a successful HEAD'` to
  `'throws when the download itself throws'`.
- The `catalogDate`, missing-`cwe.json` and truncated-`cwe.json` tests
  keep their titles. Only their `run` calls change, as above.

- [ ] **Step 3: Run them and watch them fail**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: FAIL. `archiveUrl` and `readPinnedVersion` are not exported, and
the `run` tests fail on the version and request assertions.

- [ ] **Step 4: Implement**

In `scripts/prepare-data.ts`, replace `SOURCE_URL` with `archiveUrl` and
add `PIN_FILE` and `readPinnedVersion`. Then rework `run` in this order:

1. Resolve `version`.
2. `readLocalMeta`. If it returns meta whose `cweVersion === version`,
   log and return `{ updated: false }` with no request at all.
3. GET `archiveUrl(version)`. A non-OK response throws
   `Failed to download CWE data (HTTP ${status}): ${url}`. A rejected
   fetch throws `Could not download CWE ${version}: ${message}` with
   `cause`.
4. Extract and parse, passing the response's `last-modified`.
5. If `data.meta.cweVersion !== version`, throw
   `${url} contains CWE ${actual}, but cwe-version pins ${version}`,
   before writing anything.
6. `writeOutput`, then log the version.

Keep `readLocalMeta`'s integrity checks as they are.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: PASS.

- [ ] **Step 6: Make `cwe-version` a build input and update the docs**

- In `.github/scripts/vercel-ignore-build.sh`, add `cwe-version` to the
  path list after `vercel.json`.
- In `CONTRIBUTING.md`, rewrite the `predev` paragraph under "Running
  locally". It now says the data step downloads the CWE version pinned in
  `cwe-version` from MITRE's archive, and skips the download when
  `public/data/` already holds that version. Add one sentence: moving the
  pin is a normal PR, and the build fails if the archive's version doesn't
  match it.

- [ ] **Step 7: Check against the real archive**

Run: `rm -rf public/data && npm run prepare-data && jq .meta public/data/meta.json && npm run prepare-data`
Expected: the first run logs version 4.20, and `meta.cweVersion` is
`"4.20"`. The second run logs that the data is up to date and skips the
download.

- [ ] **Step 8: Full checks**

Run: `npm run lint && npm run lint:md && npx tsc --noEmit && npm run test:coverage`
Expected: all pass, with no coverage threshold errors.

- [ ] **Step 9: Commit**

Commit `cwe-version`, `scripts/prepare-data.ts`, the test file, the
ignore-build script and `CONTRIBUTING.md`:
`feat: download the CWE version pinned in cwe-version`, with the body
explaining that production moves from 5.0 to 4.20, and why.

### Task 2: Turn the daily refresh into two watchers

**Files:**

- Create: `.github/scripts/open-cwe-issue.sh`
- Modify (rewrite): `.github/workflows/update-data.yml`
- Modify: `CONTRIBUTING.md` (the "Workflow" passage on the daily
  data-freshness check, and the Vercel paragraph's "including the daily
  data refresh")

**Interfaces:**

- Consumes: `cwe-version` (Task 1).
- Produces: `open-cwe-issue.sh <version> <body>`. If an issue (any state)
  is titled exactly `CWE <version> is available`, it prints its URL and
  exits 0. Otherwise it creates the issue and prints the new URL. It
  needs `GH_TOKEN` and `GH_REPO` in the environment.

- [ ] **Step 1: Write `open-cwe-issue.sh`**

It's a Bash script in the style of
[`dependabot-review-usage.sh`][usage-script], with `set -euo pipefail`. It
rejects a `<version>` that doesn't match the pin pattern, so an empty
version can never become an issue title. Find existing issues with
`gh issue list --state all --search "\"CWE $version is available\" in:title" --json title,url`,
then filter for an exact title match with `jq`, because search is fuzzy.

- [ ] **Step 2: Rewrite `update-data.yml`**

Keep the name `Update CWE Data`, the cron, `workflow_dispatch`, the
concurrency group and top-level `permissions: {}`. Drop the
deploy-configuration check and the deploy hook. Both jobs get
`contents: read`, `issues: write`, check out the repo with
`persist-credentials: false`, and run on `ubuntu-24.04`, with actions
pinned by SHA as in [`ci.yml`][ci].

- **`latest`:**
  1. Download `https://cwe.mitre.org/data/xml/cwec_latest.xml.zip`
     (`curl -sfL`).
  2. Read the version from the `Version` attribute of the root
     `<Weakness_Catalog …>` tag:
     `unzip -p latest.zip '*.xml' | head -c 4096 | grep -oE '<Weakness_Catalog[^>]*'`,
     then extract `Version="…"`.
  3. Fail the step with `::error::` if that version is empty.
  4. Compare it with `cat cwe-version`. If they differ, run
     `open-cwe-issue.sh` with a body saying MITRE's latest is that version,
     `main` pins the other, and asking whether to move `main` and whether
     to cut a release.
- **`four-x`:**
  1. Find MITRE's highest 4.x: `curl -sfL https://cwe.mitre.org/data/archive.html`,
     `grep -oE 'cwec_v4\.[0-9]+(\.[0-9]+)?\.xml\.zip'`, strip to the
     version, `sort -V | tail -1`. Fail with `::error::` if there is none.
  2. Find our highest 4.x pin: `main`'s `cwe-version`, plus each
     `v[0-9]*` branch's (list them with
     `gh api repos/{owner}/{repo}/branches --paginate`, read each with
     `gh api repos/{owner}/{repo}/contents/cwe-version?ref=<branch> --jq .content | base64 -d`;
     no branch has one yet). Keep only the `4.` ones and `sort -V | tail -1`.
  3. If MITRE's is higher (`sort -V`), run `open-cwe-issue.sh` with a body
     saying a new 4.x release exists that no branch pins, and noting that
     this job can be deleted once MITRE stops publishing 4.x.
  4. Put a comment on the job saying it exists because 4.x releases no
     longer become `cwec_latest`.

- [ ] **Step 3: Check the scripts locally against MITRE**

Run the version-extraction pipelines from Step 2 by hand.
Expected: `5.0` for latest and `4.21` for the highest 4.x. Run
`shellcheck .github/scripts/open-cwe-issue.sh` if it's installed. CI's
`lint-workflows` runs actionlint, zizmor and shellcheck regardless.

- [ ] **Step 4: Update `CONTRIBUTING.md`**

Replace the description of the daily check as a data refresh that
redeploys. It's now two watchers that compare MITRE's latest and newest
4.x versions with the pins and open one `CWE X is available` issue per
version. The rationale for exempting it from the PR flow still holds,
since it never commits or pushes. In the Vercel paragraph, drop
"including the daily data refresh".

- [ ] **Step 5: Full checks, then commit**

Run: `npm run lint && npm run lint:md && npx tsc --noEmit && npm test`
Expected: all pass.
Commit message: `ci: watch MITRE for new CWE versions instead of redeploying`.

### Task 3: Open the PR and verify after merge

- [ ] **Step 1:** Push the implementation commits onto this plan's draft
  PR (it closes [#241][i241], a sub-issue of [#238][i238]). Update the
  description to cover the implementation, including that production moves
  from CWE 5.0 to 4.20 on merge, intentionally. Retarget it to `main` once
  the design PR has merged, then mark it ready.
- [ ] **Step 2:** Wait for CI to pass: `build`, `lint-workflows`,
  `semgrep`, `dependency-review`, `validate-issue-link` and
  `codecov/project`.
- [ ] **Step 3 (after the owner merges):** Check that
  `https://cwe-visualizer.vercel.app/data/meta.json` reports `"cweVersion": "4.20"`.
  Run the workflow by hand (`gh workflow run update-data.yml`) and check
  that it opens exactly two issues: `CWE 5.0 is available` (from
  `latest`) and `CWE 4.21 is available` (from `four-x`, since 4.21 is
  above the 4.20 pin). Run it again and check that no new issue appears.

<!-- Issues and PRs -->
[i238]: https://github.com/mureinik/cwe-visualizer/issues/238
[i241]: https://github.com/mureinik/cwe-visualizer/issues/241

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
[claude-md]: ../../../CLAUDE.md
[prepare-data]: ../../../scripts/prepare-data.ts
[prepare-test]: ../../../test/scripts/prepare-data.test.ts
[update-data]: ../../../.github/workflows/update-data.yml
[ci]: ../../../.github/workflows/ci.yml
[usage-script]: ../../../.github/scripts/dependabot-review-usage.sh
