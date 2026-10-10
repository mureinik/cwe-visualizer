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

`predev` downloads and parses the current CWE data into `public/data/`
before Vite starts (fast-pathing on repeat runs if the data hasn't changed
upstream). The app itself only ever reads that prebuilt JSON — it never
talks to MITRE at runtime.

## Scripts

- `npm run dev` — local dev server (Vite)
- `npm run build` — type-check, prepare data, and build for production
- `npm run preview` — serve the production build locally
- `npm run lint` — ESLint
- `npm run lint:md` — markdownlint
- `npm test` — Vitest
- `npm run test:coverage` — Vitest with coverage; fails below the thresholds
  in `vite.config.ts` (CI runs this one)

## Workflow

Every change starts as a GitHub issue, then a branch and a PR that
references it (`Closes #N`). `main` is a protected branch with no bypass,
admins included: changes land only through a PR, the PR must be up to date
with `main`, and all CI checks must pass: `build` (lint, Markdown lint, test with coverage, build),
`lint-workflows` (actionlint and zizmor over `.github/workflows/`, and
shellcheck over `*.sh` files and Husky hooks),
`dependency-review` (no new dependency with a known moderate-or-worse
vulnerability), and `validate-issue-link` (the PR links an open issue).
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
Advisories against dev-only tooling get the Dependabot PR but no failed
run, since that tooling never ships and only sees our own inputs. The
audit isn't a PR check, so a new advisory never blocks unrelated work.

Vercel builds a preview deployment for a PR only when it changes a path
that feeds the deployed site. The paths are listed in
`scripts/vercel-ignore-build.sh`, which `vercel.json` runs as its
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
Once every check on an up-to-date Dependabot PR passes, `ci.yml` calls
`dependabot-review.yml`. There, Claude reads the release notes in the PR
body, opens an issue (at most 3 per PR) for each new feature worth adopting
and each deprecation that affects our code, and approves the PR, tagging
the repo owner. It never merges; the owner still does.

A rebase alone doesn't trigger a second review: the reviewer skips a PR
whose changed lines match ones it already approved. It also skips PRs that
change `.github/workflows/` (every GitHub Actions update does), since the
Claude App won't act on those; the job notes it, and the owner reviews
them by hand.

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
