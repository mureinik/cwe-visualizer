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
See the design doc for the full rationale, including why the daily
data-freshness check (`.github/workflows/update-data.yml`) is exempt from
this flow: it never commits or pushes anything, so there's nothing for it
to bypass.

A Husky hook has no shebang, since Husky runs it with `sh`, so give a new
one a `# shellcheck shell=sh` directive, or shellcheck can't tell its shell.

Advisories published against dependencies already in the lockfile never
show up in `dependency-review`. Dependabot security updates open fix PRs
for them, and `.github/workflows/audit.yml` runs `npm audit` daily (and
whenever `package-lock.json` changes on `main`) so they also show as a
failed run in Actions. It isn't a PR check, so a new advisory never blocks
unrelated work.

Vercel builds a preview deployment for a PR only when it changes a path
that feeds the deployed site. The paths are listed in
`scripts/vercel-ignore-build.sh`, which `vercel.json` runs as its
`ignoreCommand`. If you add a new build input outside them (a new top-level
config file Vite reads, say), add it to that list, or its PRs will get no
preview. Production deployments, including the daily data refresh, always
build.

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
