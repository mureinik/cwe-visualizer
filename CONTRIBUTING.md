# Contributing

## Running locally

Requires Node.js `>=24.2` (see the `engines` field in `package.json`). This
project relies on Node 24's stable, unflagged TypeScript type-stripping to
run `scripts/prepare-data.ts` directly with no build step — on an older
Node version, `predev`/`prebuild` will fail. The script also detects that it
is the entry point with `import.meta.main`, which Node added in 24.2.

`@types/node` is pinned to exactly the `engines` minimum (24.2.0), and
Dependabot ignores it, so the types never offer an API the oldest supported
Node lacks. Raise both together when the minimum Node version changes.

```bash
npm install
npm run dev
```

`predev` downloads and parses the CWE version pinned in `cwe-version` from
MITRE's archive into `public/data/` before Vite starts, and skips the
download when `public/data/` already holds that version. The app itself only
ever reads that prebuilt JSON — it never talks to MITRE at runtime. Moving
the pin is a normal PR, and the build fails if the archive's version doesn't
match it.

## Scripts

- `npm run dev` — local dev server (Vite)
- `npm run build` — type-check, prepare data, and build for production
- `npm run preview` — serve the production build locally
- `npm run build:site` — what Vercel runs: builds the site, in the
  production layout (`/latest/`, the releases and a root redirect) only
  when `VERCEL_ENV=production` or `SITE_LAYOUT=releases`, which lets you
  build that layout locally
- `npm run lint` — ESLint, which also checks formatting (see below)
- `npm run lint:md` — markdownlint
- `npm run lint:css` — Stylelint, which checks CSS formatting
- `npm test` — Vitest
- `npm run test:coverage` — Vitest with coverage; fails below the thresholds
  in `vite.config.ts` (CI runs this one)
- `npm run test:realworld` — Vitest without the tests tagged `theoretical`
  (see [Real-world and theoretical tests](#real-world-and-theoretical-tests)),
  for quick local runs; neither the pre-commit hook nor CI runs this one

Formatting is enforced by linters, not by a separate formatter. ESLint
checks it for JavaScript and TypeScript ([ESLint
Stylistic](https://eslint.style/)), JSON, YAML and HTML, and Stylelint, with
ESLint Stylistic's Stylelint config, checks it for CSS, which ESLint can't
format. markdownlint covers Markdown. All of them run with `--fix` on the
files a commit stages, so most formatting is corrected for you, and CI
fails on anything left. The options in `eslint.config.js` follow the style
the code already had; change them there, not file by file.

`scripts/` holds only what the build runs, which today is
`prepare-data.ts` and `build-site.ts`. Helpers that only serve CI,
deployment config or maintainers live in `.github/scripts/` instead.
Coverage measures the app, `src/`, only: both scripts have tests, but
neither kind of script ships.

The coverage thresholds in `vite.config.ts` apply to the total and to every
file on its own. An entry in `COVERAGE_EXCEPTIONS` can hold a file under
them at its current coverage, with an issue to bring it up to the floor; no
file has one today. An entry is the lowest coverage its file may drop to,
so it only works if every PR keeps it current:

- **Don't add an entry without asking.** Make a new change pass by adding
  tests. If an entry really is needed, ask the maintainer first and add it
  only with their explicit OK. That goes for agents too: ask the human in
  the loop rather than deciding alone.
- **Tighten an entry that coverage has passed.** If a PR raises a listed
  file's coverage, raise that file's numbers in its entry to the new
  coverage, rounded down. Otherwise the file can lose the gain again.
- **Remove an entry once its file reaches the floor**, in the PR that gets
  it there, and close the entry's issue with that PR.

Since an entry can change when its file is touched for any reason, check
the coverage report for the files a PR changes, not only for those it
tests.

The floor can't tell when a PR lowers coverage while staying above it, so
CI also uploads the report to [Codecov](https://about.codecov.io/), which
compares it with the PR's base. It comments on the PR with the change, and
its `codecov/project` check fails when total coverage drops by more than 1
point. It also reports coverage of the lines the PR changed
(`codecov/patch`), for information only. The settings are in
`codecov.yml`. The upload needs a `CODECOV_TOKEN` secret, the repository's
upload token from Codecov, stored both as an Actions secret and as a
Dependabot secret, since Dependabot's runs can't see Actions secrets.

## Real-world and theoretical tests

Some tests guard against input that can't happen, such as a loop in the CWE
hierarchy. They are worth keeping, but they describe nothing a user of the
site sees, so they don't carry the same weight as the tests that do. A test
is theoretical when its input can't happen, for one of these reasons:

1. **MITRE's schema forbids it.** The schema is the rules
   [`cwe_schema_latest.xsd`](https://cwe.mitre.org/data/xsd/cwe_schema_latest.xsd)
   states: required attributes and enumerated values, such as a
   `Related_Weakness` with no `View_ID`.
2. **It would be a mistake in MITRE's data that the schema can't express.**
   The schema checks the form of a relation, not whether it makes sense, so
   `ChildOf` links that form a loop, or a relation to an entry that doesn't
   exist, are mistakes.
3. **Our own code never produces it.** That covers a state `buildGraph`
   never builds, a function or option nothing in `src/` calls, and a
   fallback only the test environment reaches, like jsdom's missing
   `matchMedia`. Every test of code nothing in `src/` calls is theoretical,
   and they're all promoted together once something in `src/` calls it.

Every other test is real-world. That includes what the schema allows but
today's data doesn't use (a `ParentOf` relation), changes outside our
control that aren't mistakes (MITRE changing its download format, or a
future schema adding a relation type), user input such as anything typed
into `?cwe=`, and browser conditions such as blocked storage.

How to treat each kind, and how to classify one:

- **A real-world test changes only when the change sets out to alter the
  behaviour it covers.** If one fails otherwise, the change is wrong.
- **A theoretical test may be proposed for removal or rewriting** when it
  stands in the way of something worthwhile, like a performance gain or
  simpler code. Say what the site would lose, which is some resilience to
  bad data or a future refactor, not anything visible. Then ask the
  maintainer and wait for agreement. That goes for agents too.
- **Classify a new test when you write it**, using the definitions above.
  When in doubt, it's real-world.
- **Promote a theoretical test in the change that makes its case possible**,
  whether the code stops ruling it out or the schema starts allowing it.
  If `buildGraph` stopped giving every node a child list, the tree test for
  a graph with no hierarchy lists would become real-world: the
  `describe('Tree with a graph that has no hierarchy lists')` block in
  `test/components/Tree.test.tsx`.
- **Say why a real-world test is real when its case is absent from today's
  data**, in a comment: the schema allows it, or it's outside our control.
  Otherwise a reader who checks the data takes it for a theoretical test.
  This is for tests whose point is that case, not for fixtures that use an
  unusual value incidentally.

Mark a theoretical test by tagging it `theoretical`, which `vite.config.ts`
declares, since Vitest rejects a tag it doesn't know. Group such tests in
a `describe` block nested inside the block they were in, so they keep its
hooks and fixtures, and put the tag on that block, with a comment that
names the reason in the terms above. The `systemTheme` block in
`test/lib/theme.test.ts` is an example: it sits inside `describe('theme')`,
whose `beforeEach` still runs for it.

```ts
describe('theme', () => {
  beforeEach(() => {
    // ...
  });

  // Nothing in src/ calls systemTheme() (ThemeToggle reads the preference
  // through useMediaQuery). Promote both tests if something starts to.
  describe('systemTheme', { tags: ['theoretical'] }, () => {
```

A single `it` can carry the tag instead, when moving it would split a
fixture. Real-world tests carry no tag.

`npm run test:realworld` skips the tagged tests, which Vitest reports as
skipped. Use it for quick local runs only. The pre-commit hook and CI run
everything, and the coverage thresholds assume it: theoretical tests count
towards each file's coverage, so don't run `test:realworld` with coverage.

## Workflow

Every change starts as a GitHub issue, then a branch and a PR that
references it (`Closes #N`). `main` is a protected branch with no bypass,
admins included: changes land only through a PR, the PR must be up to date
with `main`, and all CI checks must pass: `build` (lint, Markdown and CSS lint, test with coverage, build),
`lint-workflows` (actionlint and zizmor over `.github/workflows/`, and
shellcheck over `*.sh` files and Husky hooks),
`semgrep` (no new Semgrep SAST finding in the files the PR changes),
`dependency-review` (no new dependency with a known moderate-or-worse
vulnerability), `validate-issue-link` (the PR links an open issue), and
`codecov/project` (the PR doesn't lower total coverage by more than 1
point; see below).
Dependabot's PRs are the one exemption from the issue link, since a bot
can't open issues for its own updates. No approving review is
required, since GitHub doesn't let authors approve their own PRs and that
would lock out a sole maintainer; read the diff yourself before merging.
On top of that, the `main-merge-owner-only` ruleset lets only the repo
owner update `main`, so bots and automation, the Claude agent below
included, can open PRs but never merge them or push to `main`.
The Dependabot reviewer described below may also approve Dependabot's
PRs, but approval is only a signal: no review is required, and merging is
still the owner's.
See the design doc for the full rationale, including why the daily
watchers in `.github/workflows/update-data.yml` are exempt from this flow.
They compare MITRE's latest and newest 4.x versions with the ones we pin
and open one `CWE X is available` issue per version, and they never commit
or push anything, so there's nothing for them to bypass.

A Husky hook has no shebang, since Husky runs it with `sh`, so give a new
one a `# shellcheck shell=sh` directive, or shellcheck can't tell its shell.

Advisories published against dependencies already in the lockfile never
show up in `dependency-review`. Dependabot security updates open fix PRs
for them, and `.github/workflows/audit.yml` runs `npm audit --omit=dev`
daily (and whenever `package-lock.json` changes on `main`) so those
against production dependencies also show as a failed run in Actions.
Advisories against dev dependencies get the Dependabot PR but no failed
run, since none of them ship in the app. The audit isn't a PR check, so a
new advisory never blocks unrelated work.

"Production" here means what the deployed site runs, which is only React.
Updating the CWE data is a build phase, not a production one:
`scripts/prepare-data.ts` runs at build time, and the site only serves the
JSON it writes. So its packages, `adm-zip` and `fast-xml-parser`, are dev
dependencies, and the audit deliberately doesn't cover them, even though
they parse MITRE's download rather than our own inputs. Keep any future
package used only by the data step in `devDependencies` too.

Vercel builds a preview deployment for a PR only when it changes a path
that feeds the deployed site. The paths are listed in
`.github/scripts/vercel-ignore-build.sh`, which `vercel.json` runs as its
`ignoreCommand`. If you add a new build input outside them (a new top-level
config file Vite reads, say), add it to that list, or its PRs will get no
preview. Production deployments always build.

Vercel runs `npm run build:site` (`scripts/build-site.ts`), not `npm run
build`. A production build compiles `main` under `/latest/`, copies every
release from the `deploy` branch next to it, and writes a root
`index.html` that redirects to the newest release (see
[Releases](#releases)). A PR preview is still a single copy of the app at
`/`.

## Releases

The production site serves several releases side by side. Until the
first release is cut, `/` redirects to `/latest/`. Afterwards the layout
is, with placeholders for the releases:

```text
/          redirects to the newest release, or to /latest/ if there is none
/latest/   main, built from source on every production build
/vX/       release X.0, copied from the deploy branch
/vX.Y/     release X.Y, copied from the deploy branch
```

A release `X.Y` lives on a branch named `vX` for `X.0` or `vX.Y`
otherwise, and its path matches the branch. A release that moves to a new
CWE schema line (4.x to 5.x) is a new major, one that moves to a new CWE
version within a line (4.20 to 4.21) is a new minor, and one with no CWE
change is either, depending on its content. On a release branch,
`package.json`'s `version` is `X.Y.0` and never changes after the cut. On
`main` it stays `0.0.0`, meaning unreleased. The newest release, the one
`/` redirects to, is the highest by comparing `X`, then `Y`, not the most
recent by date. The redirect keeps the query string and the hash, so an
old link such as `/?cwe=79` still opens CWE-79.

To cut a release:

1. Decide what goes in, usually `main` as it is, on the CWE version it
   pins. If the release should use a different CWE version, move the pin
   on `main` first, in a normal PR.
2. Open an issue for the release.
3. Tag the commit on `main` the release branches from, and create the
   branch from that tag in the same push, for example for `v1.1`:

   ```sh
   git switch main && git pull --ff-only
   git tag -a v1.1-base -m "v1.1 branches from main here" main
   git push --atomic origin v1.1-base 'v1.1-base^{commit}:refs/heads/v1.1'
   ```

   Nothing is published yet, since the branch's version is still `0.0.0`.
   Check that the push succeeded with
   `git ls-remote origin v1.1 'v1.1-base^{}'`, which prints the same SHA
   for `refs/heads/v1.1` and `refs/tags/v1.1-base^{}`. `--atomic` pushes
   both refs or neither, so a rejected push leaves no stray tag on GitHub.
   If GitHub rejects the push because of the `release-branches` ruleset,
   see [If the cut is rejected](#if-the-cut-is-rejected).
4. Open a PR into the branch that sets `package.json`'s version to `X.Y.0`,
   best done with `npm version X.Y.0 --no-git-tag-version` so
   `package-lock.json`'s root version matches. The PR still says
   `Closes #N` for the release issue, since `validate-issue-link` reads the
   body, but GitHub only closes issues automatically when a PR merges into
   the default branch, so close the issue by hand after merging. Merging
   publishes the release, and `/` moves to it if it is the newest.
5. Fix a release later with a PR into its branch, with an issue, as for
   `main`. Merging it republishes that release in place. The same applies
   to the issue: close it by hand after the merge.

The `vX.Y-base` tag only records where the release diverged from `main`,
so `git log vX.Y-base..vX.Y` lists what the release changed since, and
`git describe main` counts `main`'s commits since the latest cut. Nothing
reads it: no workflow runs on a tag, Vercel doesn't build tags, and
publishing always uses the branch, after its version bump. It is not named
`vX.Y.0`, because the commit it marks is still version `0.0.0`, nor
`vX.Y`, which would make the branch's name ambiguous. Never move or delete
it.

Pushing to a `v[0-9]*` branch starts `release-dispatch.yml`, which starts
`release-publish.yml` on `main`. The publisher checks out the release
branch and publishes only when its `package.json` version matches the
branch, `vX` with `X.0.0` and `vX.Y` with `X.Y.0`, which is why the cut in
step 3 publishes nothing. It builds the branch with its base set to
`/vX.Y/`, commits the output to the `deploy` branch as
`<branch>: built from <branch>@<sha>`, and then calls the Vercel deploy
hook so production rebuilds. Publishes of one branch are queued, never
cancelled, though a newer request for the same branch may replace a
pending one, which is harmless since a run builds the branch's head when it
starts; different branches don't wait for each other. If a publish
fails or needs repeating, run it again by hand:

```bash
gh workflow run release-publish.yml -f branch=vX.Y
```

Never edit the `deploy` branch by hand. It is built output, one directory
per release, and only `release-publish.yml` writes to it. A production
build downloads it, and fails if it can't, so a deployment never goes out
missing its releases; Vercel keeps serving the previous one. A release
whose own build breaks later keeps serving its last good output.

Release branches need the same protection as `main`: changes only
through a PR, CI checks required, the PR up to date, and only the owner
merging. Rulesets are repository settings, not files, so before the first
cut the owner sets up `refs/heads/v[0-9]*` in two places, since `main`'s
protection is split between them: the `main-merge-owner-only` ruleset
(who may update the branch) and a ruleset of its own (PR and checks). Do
both once, in this order.

Add the pattern to `main-merge-owner-only`, which holds only the `update`
restriction and the owner's bypass:

1. Open <https://github.com/mureinik/cwe-visualizer/settings/rules>. By
   hand: the repository's **Settings** tab, then **Rules** → **Rulesets**
   in the left sidebar.
2. Click **main-merge-owner-only**.
3. Under **Target branches**, click **Add target** and then **Include by
   pattern**. Enter `v[0-9]*` and click **Add Inclusion pattern**. The list
   now shows the default branch and `v[0-9]*`. (GitHub's documentation calls the
   first button **Add a target**; use whichever your page shows.)
4. Click **Save changes** at the bottom of the page.

Then create a ruleset that requires a PR and the checks. On `main` those
come from classic branch protection, but a ruleset targeting `v[0-9]*` does
the same for the release branches, and classic protection for them would be a
third place to look:

1. Open <https://github.com/mureinik/cwe-visualizer/settings/rules/new?target=branch>.
   By hand: **Settings** → **Rules** → **Rulesets** → **New ruleset** →
   **New branch ruleset**.
2. **Ruleset Name**: `release-branches`.
3. **Enforcement status**: **Active**.
4. **Bypass list**: leave it empty. `main` has no bypass either, admins
   included, so the owner opens a PR into a release branch like anyone.
5. Under **Target branches**, click **Add target**, then **Include by
   pattern**, enter `v[0-9]*` and click **Add Inclusion pattern**. Leave
   `deploy` out, since the publish workflow must be able to push to it.
6. Under **Branch rules** (called **Branch protections** on some pages),
   leave **Restrict deletions** and **Block force pushes** ticked, as a new
   ruleset has them, then tick **Require a pull request before merging**
   and set **Required approvals** to `0`. GitHub doesn't let authors approve their own PRs,
   so a required approval would lock out a sole maintainer.
7. Tick **Require status checks to pass** (also worded **Require status
   checks to pass before merging**) and, under it, **Require branches to
   be up to date before merging**. That is the "strict" setting.
8. Click **Add checks**. Search for each of these, select it and add it:
   `build`, `validate-issue-link`, `dependency-review`, `lint-workflows`
   and `semgrep`. If a name doesn't show up in the search, type it in
   exactly and add it anyway, since the search lists only checks that have
   run recently. Leave `codecov/project` out: `ci.yml` uploads coverage on
   pushes to `main` only, so a PR into a release branch may have no base to compare
   against. Strict checks do nothing without at least one check, so don't
   skip this step.
9. Still under the status checks rule, tick **Do not require status
   checks on creation**. Creating the branch is a push of a commit that
   `validate-issue-link` and `dependency-review` never run on, since they
   run only on PRs, so without this the cut in the release steps could be
   rejected. (This is the API's `do_not_enforce_on_create`. GitHub's rules
   page doesn't list it, so if your page words it differently, pick the
   option about creation.)
10. Click **Create** at the bottom of the page.

Check the result from your shell:

```sh
# Three rulesets are listed, all "active": main-merge-owner-only,
# release-branches, and review, which applies to every branch. After the
# tag ruleset below there is a fourth, release-base-tags.
gh api repos/mureinik/cwe-visualizer/rulesets \
  --jq '.[] | {id, name, target, enforcement}'

# main-merge-owner-only now includes v[0-9]*. Expect
# ["~DEFAULT_BRANCH","refs/heads/v[0-9]*"].
gh api repos/mureinik/cwe-visualizer/rulesets \
  --jq '.[] | select(.name == "main-merge-owner-only") | .id' \
  | xargs -I{} gh api repos/mureinik/cwe-visualizer/rulesets/{} \
      --jq '.conditions.ref_name.include'

# The rules that apply to a branch named v1, whether or not it exists yet.
gh api repos/mureinik/cwe-visualizer/rules/branches/v1 --jq '.[].type'
```

The last command prints eight lines, in some order: `update` from
`main-merge-owner-only`; `deletion`, `non_fast_forward`, `pull_request`
and `required_status_checks` from `release-branches`; and `deletion`,
`non_fast_forward` and `copilot_code_review` from `review`. `deletion`
and `non_fast_forward` appear twice, which is harmless. Add
`ruleset_id` to see where each comes from:
`--jq '.[] | "\(.type) \(.ruleset_id)"'`. Before the setup it prints
only `review`'s three. `deploy` is left out of both rulesets, since the
workflow must be able to push to it. CI runs on PRs into any branch, and
`validate-issue-link` applies to them too.

Pushes to `v[0-9]*` branches and to `deploy` create no Vercel deployments
(`vercel.json` turns them off), since releases are published through
`deploy`. PRs into a release branch still get a preview, like any other
PR.

The `vX.Y-base` tags get a ruleset of their own, so nobody can move or
delete one. It leaves creating them open, so the cut needs no bypass,
and its bypass list is empty, as for `release-branches`: to fix a wrong
tag, switch the ruleset off, fix the tag and switch it back on, as in
[If the cut is rejected](#if-the-cut-is-rejected). Set it up once:

1. Open <https://github.com/mureinik/cwe-visualizer/settings/rules>. By
   hand: the repository's **Settings** tab, then **Rules** → **Rulesets**
   in the left sidebar.
2. Click **New ruleset**, then **New tag ruleset**.
3. Under **Ruleset name**, enter `release-base-tags`.
4. Set **Enforcement status**, which starts as **Disabled**, to
   **Active**.
5. Leave the **Bypass list** empty.
6. Under **Target tags**, click **Add a target** and then **Include by
   pattern**. Enter `v[0-9]*-base` and add it, with the button the dialog
   shows (**Add Inclusion pattern** for branches; GitHub's documentation
   doesn't name it for tags).
7. Under **Tag protections**, tick **Restrict updates**, and keep
   **Restrict deletions** and **Block force pushes** ticked, as they are by
   default. Leave **Restrict creations** unticked, or the cut would be
   rejected.
8. Click **Create**.

Check it from your shell:

```sh
gh api repos/mureinik/cwe-visualizer/rulesets \
  --jq '.[] | select(.name == "release-base-tags") | .id' \
  | xargs -I{} gh api repos/mureinik/cwe-visualizer/rulesets/{} \
      --jq '{target, enforcement, bypass: .bypass_actors,
             include: .conditions.ref_name.include,
             rules: [.rules[].type]}'
```

It prints one line of JSON, with `"target":"tag"`,
`"enforcement":"active"`, `"bypass":[]`,
`"include":["refs/tags/v[0-9]*-base"]`, and `rules` holding `update`,
`deletion` and `non_fast_forward` in some order, without `creation`.

### If the cut is rejected

If the push in step 3 fails with a rule violation despite that option,
switch the ruleset off for the push, then back on:

1. Open <https://github.com/mureinik/cwe-visualizer/settings/rules>
   and click **release-branches**.
2. Set **Enforcement status** to **Disabled** and click **Save changes**.
3. Push the cut and check it:

   ```sh
   git push --atomic origin vX.Y-base 'vX.Y-base^{commit}:refs/heads/vX.Y'
   git ls-remote origin vX.Y 'vX.Y-base^{}'
   ```

4. Reopen the ruleset, set **Enforcement status** back to **Active** and
   click **Save changes**.
5. Check that it is active again; this prints `active`:

   ```sh
   gh api repos/mureinik/cwe-visualizer/rulesets \
     --jq '.[] | select(.name == "release-branches") | .enforcement'
   ```

Until step 4 the release branches are unprotected, so do it right away.

### Security backports

Dependabot opens security updates only against `main`, so a fixed advisory
would stay open on every release branch. `backport-security.yml` carries
the fix over. It starts whenever a PR, anyone's, is merged into `main`. It
runs `npm audit` on `main`'s lockfile before and after the merge, and every
advisory that the merge made disappear counts as fixed: a Dependabot
security update, a parent package's bump that fixes an advisory against a
dependency of it, or a fix made by hand. A merge that fixes nothing ends
the run with a notice. Each fixed advisory then gets two jobs per release
branch (every branch named `vN` or `vN.M`):

1. `backport` runs `npm audit` on the branch. If the advisory doesn't
   affect it, the run says so and stops. Otherwise it runs `npm update` on
   the affected packages, audits again and runs CI's checks.
2. `open` pushes `backport/<branch>/<GHSA>` and opens an issue,
   `Backport <GHSA> to <branch>`, and a PR into the release branch whose
   body starts `Closes #<issue>`. If no update fits the branch's ranges, or
   CI's checks fail on the result, it opens only the issue, with the
   reason, and you fix the branch by hand with a PR, as in step 5 of the
   steps to cut a release.

There is one issue and one PR per advisory per branch, and a rerun never
opens a second one. Merging the PR republishes the release, like any fix to
it. The issue isn't closed by the merge, since GitHub closes issues
automatically only for the default branch, so close it by hand. A failed
`npm audit`, on `main` or on a branch, turns the run red and opens nothing;
read the log and rerun.

There are no manual runs: the workflow runs only on merges into `main`. A
manual run would execute the release branch's code with write access to
`main`'s Actions cache, which a merge's run doesn't have.

**A retry after a failure that opened an issue,** such as a transient
failure of the checks or the push. The issue means the advisory is
handled, so a rerun skips the branch until it's gone. Delete the issue,
and the backport branch if the failed run pushed one, then rerun the
original run. You can delete the branch despite the `review` ruleset's
deletion rule, since you can bypass it:

```sh
gh issue delete <number> --yes
git push origin --delete backport/<branch>/<GHSA>
gh run rerun <run-id>
```

Or click **Re-run all jobs** on the run's page. The issue's body links to
the run, and the run ID ends that link; `gh run list --workflow
backport-security.yml --limit 10` lists the recent runs too. GitHub allows
a rerun only within 30 days of the original run.

If only the PR failed to open, the run's error gives the `gh pr create`
command that opens it; run that instead.

Fix the release branch by hand, like any other fix to it, in two cases the
workflow can't handle:

- **An advisory against a package `main` no longer uses.** It is the one
  known blind spot: the audit on `main` never reports it, so no merge
  fixes it, and only a release branch still has it. Watch for such
  advisories (`npm audit` on the branch shows them).
- **A merge from a fork.** Its run gets no secrets, so `open` fails without
  `BACKPORT_TOKEN`, though `resolve` names the advisories it fixed.

Open an issue for the advisory, then, on a branch off `vX.Y`, run
`npm update <package>`, check that `npm audit` no longer lists the
advisory, and open a PR into `vX.Y` that closes the issue.

#### One-time setup: the `BACKPORT_TOKEN` secret

The workflow opens its pushes, issues and PRs with a personal access token
of yours, stored as the repository secret `BACKPORT_TOKEN`. The job token
can't do it: pushes and PRs made with it don't trigger other workflows, so
CI would never run on the backport PR. Only the `open` job gets the token,
and it never runs code from a release branch.

1. Open <https://github.com/settings/personal-access-tokens/new>. By hand:
   click your profile picture in the upper-right corner of any GitHub
   page, then **Settings** → **Developer settings** (left sidebar) →
   **Personal access tokens** → **Fine-grained tokens** → **Generate new
   token**.
2. **Token name**: `cwe-visualizer backport`.
3. **Description**: `Opens backport branches, issues and PRs for security
   fixes (backport-security.yml)`.
4. **Resource owner**: `mureinik`.
5. **Expiration**: choose **Custom** and pick the date one year from today,
   the longest the page accepts. Don't choose **No expiration**: a token
   that never expires stays valid if it leaks.
6. **Repository access**: select **Only select repositories**, open the
   **Select repositories** dropdown and pick `mureinik/cwe-visualizer`.
7. Under **Permissions**, click **Add permissions** if the repository
   permissions aren't listed, and set each of these in **Repository
   permissions**, leaving the rest at **No access**:
   - **Contents**: **Read and write**, to push the backport branch
   - **Issues**: **Read and write**, to find and open the issue
   - **Pull requests**: **Read and write**, to open the PR

   **Metadata** is set to **Read-only** for you, and can't be turned off.
8. Click **Generate token**, then copy the token that starts with
   `github_pat_`. GitHub shows it once.
9. Check the token before storing it. In bash, this reads it without
   echoing it or putting it in your shell history: run the first line,
   paste the token and press Enter, then run the rest. The second line
   prints `1`, the number of issues it read; an error such as `Bad
   credentials` means the token was mistyped or isn't valid. The
   repository is public, so this proves the token works, not what it may
   write; checking that would take a write. The first backport run uses
   all three permissions.

   ```bash
   read -rs GH_TOKEN && export GH_TOKEN
   gh api 'repos/mureinik/cwe-visualizer/issues?per_page=1' --jq length
   unset GH_TOKEN
   ```

10. Store it as the repository secret. This command prompts for the value,
    so paste the token and press Enter; it is never typed on the command
    line, so it stays out of your shell history:

    ```sh
    gh secret set BACKPORT_TOKEN --repo mureinik/cwe-visualizer
    ```

11. Check that the secret exists. The list shows names and update times,
    never values:

    ```sh
    gh secret list --repo mureinik/cwe-visualizer
    ```

    `BACKPORT_TOKEN` should be listed under today's date.

The token expires, and until it is renewed the workflow's `open` job fails,
so the backports stop. Its expiry date is on the
token's page: <https://github.com/settings/personal-access-tokens>, under
**Fine-grained tokens**, next to its name. GitHub also emails you before it
expires. To rotate it, shortly before that date:

1. Open that page and click `cwe-visualizer backport`.
2. Click **Regenerate token**, pick a new expiration, as in step 5, and
   confirm. Copy the new token. (If your page has no such button, generate
   a new token with the steps above and delete the old one.)
3. Check it as in step 9, run
   `gh secret set BACKPORT_TOKEN --repo mureinik/cwe-visualizer` again,
   paste the new token, and check with `gh secret list` as before.

## Working with the Claude agent

`.github/workflows/claude.yml` runs
[Claude Code](https://github.com/anthropics/claude-code-action) on issues
and PRs. Labeling an issue `claude` has it implement the issue on a
`claude/` branch and open a PR for it, and an `@claude` comment on an
issue or PR asks it a question or for a follow-up change.
Only the repo owner can trigger it. Its commits go through the same Husky
hook and its PRs through the same required checks as anyone else's, and the
ruleset above keeps it from merging, whatever it's asked to do.

It needs two things set up once, outside the repo: the
[Claude GitHub App](https://github.com/apps/claude) installed on the
repository, and a `CLAUDE_CODE_OAUTH_TOKEN` repository secret holding the
token `claude setup-token` prints. Runs draw on that Claude subscription's
usage limits.

### Dependabot reviewer

Two workflows look after Dependabot's PRs. `dependabot-rebase.yml` runs on
every push to `main` and comments `@dependabot rebase` on each one that
fell behind, since branch protection's strict status checks won't let a PR
that is behind merge, and Dependabot rebases on its own only when there is
a conflict. It asks again if a request is still unanswered a day later.
Dependabot only obeys users with push access, so the comment is posted
with `DEPENDABOT_REBASE_TOKEN`, a secret of the `dependabot-rebase`
environment (which only `main` may use) holding a fine-grained
personal access token of the repo owner's: this repository only, Pull
requests read and write, with an expiry. Renew it when it expires; until
then the workflow fails, and you can comment `@dependabot rebase` by hand.
Once every check on an up-to-date Dependabot PR passes, `ci.yml` calls
`dependabot-review.yml`. There, Claude reads the release notes in the PR
body, opens an issue (at most 3 per PR) for each new feature worth adopting
and each deprecation that affects our code, and approves the PR, tagging
the repo owner. It never merges; the owner still does.

A rebase alone doesn't trigger a second review: the reviewer skips a PR
whose changed lines match ones it already approved. It also skips PRs that
change `.github/workflows/` (every GitHub Actions update does), since the
Claude App won't act on those. For those, a separate job comments on the
PR once, tagging the owner to review it by hand; it is the only part of
the reviewer whose job token can write, and only to pull requests.

The release notes are third-party text, so the reviewer only ever sees
`main`'s code, never runs the update, and is limited to reading, opening
issues and approving.

It authenticates with a Claude subscription token, so runs draw on that
subscription's usage limits rather than API credit. It needs that set up
once, outside the repo: run `claude setup-token` and store the token it
prints as the `DEPENDABOT_CLAUDE_CODE_OAUTH_TOKEN` **Dependabot** secret
(Settings → Secrets and variables → Dependabot), since runs Dependabot
triggers can't see Actions secrets. Use a token of its own rather than a
copy of the agent's `CLAUDE_CODE_OAUTH_TOKEN`, so either can be revoked
without the other. The token is long-lived, so the workflow scrubs
Anthropic credentials from the environment Claude's tools run in, and
only the reviewer job is given it.

A subscription token has no per-key usage report, so each review run
records its own: token counts, turns, duration and the API-equivalent
cost (an estimate; the run counts against the subscription's limits, not
a bill) appear in the run's summary and are uploaded as a
`dependabot-review-usage-<attempt>` artifact. Only those numbers are
taken from Claude's output. `.github/scripts/dependabot-review-usage.sh` totals
them by month (`--raw` prints each run's record). Artifacts expire after
the repository's retention period, 90 days by default, so save the
`--raw` output if you want a longer history.

## Working with the Superpowers skillset

This project's design, planning, and implementation history
(`docs/superpowers/specs/`, `docs/superpowers/plans/`) was produced using
the [Superpowers](https://github.com/obra/superpowers) skillset for Claude
Code — skills like `brainstorming`, `writing-plans`,
`subagent-driven-development`, and `finishing-a-development-branch` shape
how work here gets designed, planned, and merged. If you're contributing
with Claude Code, install the plugin so your workflow matches:

```text
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```

You don't need Claude Code or Superpowers to contribute — human-authored
PRs are welcome too — but if you use Claude Code, installing it keeps your
agent's workflow consistent with the docs already in this repo.
