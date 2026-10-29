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
`prepare-data.ts`. Helpers that only serve CI, deployment config or
maintainers live in `.github/scripts/` instead. Coverage measures the app,
`src/`, only: `prepare-data.ts` has tests, but neither kind of script
ships.

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
data-freshness check (`.github/workflows/update-data.yml`) is exempt from
this flow: it never commits or pushes anything, so there's nothing for it
to bypass.

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
preview. Production deployments, including the daily data refresh, always
build.

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
