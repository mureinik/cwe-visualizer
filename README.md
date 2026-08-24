# CWE Visualizer

A visual explorer for the full [CWE](https://cwe.mitre.org/) (Common Weakness
Enumeration) corpus published by MITRE.

The design rationale lives in
[`docs/superpowers/specs/2026-08-23-cwe-visualizer-design.md`](docs/superpowers/specs/2026-08-23-cwe-visualizer-design.md).

## Running locally

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
references it (`Closes #N`). CI (lint, test, build) must pass, and the PR
needs a manual review before merge — `main` is a protected branch with no
bypass. See the design doc for the full rationale, including why the daily
data-freshness check (`.github/workflows/update-data.yml`) is exempt from
this flow: it never commits or pushes anything, so there's nothing for it
to bypass.
