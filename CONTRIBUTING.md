# Contributing

## Running locally

Requires Node.js `>=24` (see the `engines` field in `package.json`). This
project relies on Node 24's stable, unflagged TypeScript type-stripping to
run `scripts/prepare-data.ts` directly with no build step — on an older
Node version, `predev`/`prebuild` will fail.

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
- `npm test` — Vitest

## Contributing

Every change starts as a GitHub issue, then a branch and a PR that
references it (`Closes #N`). `main` is a protected branch with no bypass,
admins included: changes land only through a PR, the PR must be up to date
with `main`, and both CI checks must pass — `build` (lint, test, build) and
`validate-issue-link` (the PR links an open issue). No approving review is
required, since GitHub doesn't let authors approve their own PRs and that
would lock out a sole maintainer; read the diff yourself before merging.
See the design doc for the full rationale, including why the daily
data-freshness check (`.github/workflows/update-data.yml`) is exempt from
this flow: it never commits or pushes anything, so there's nothing for it
to bypass.

## Working with the Superpowers skillset

This project's design, planning, and implementation history
(`docs/superpowers/specs/`, `docs/superpowers/plans/`) was produced using
the [Superpowers](https://github.com/obra/superpowers) skillset for Claude
Code — skills like `brainstorming`, `writing-plans`,
`subagent-driven-development`, and `finishing-a-development-branch` shape
how work here gets designed, planned, and merged. If you're contributing
with Claude Code, install the plugin so your workflow matches:

```
/plugin marketplace add anthropics/claude-plugins-official
/plugin install superpowers@claude-plugins-official
```

You don't need Claude Code or Superpowers to contribute — human-authored
PRs are welcome too — but if you use Claude Code, installing it keeps your
agent's workflow consistent with the docs already in this repo.
