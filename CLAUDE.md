# CLAUDE.md

**Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before your first commit in a
session.** It is the source of truth for setup, scripts, and the
contribution workflow, and that workflow is not the one you would guess:
work starts from a GitHub issue, and CI rejects any PR that doesn't link an
open one. Finding that out when CI fails means redoing the PR.

What follows is only the set of constraints that nothing in the repo
enforces on its own, so breaking them fails silently.

## Constraints nothing enforces

- **The app must never contact MITRE at runtime.** It reads the prebuilt
  `public/data/cwe.json` and nothing else. Data is fetched at build time by
  `scripts/prepare-data.ts`; a live fetch would look like a feature and
  break the design.
- **`public/data/` is build output.** It is gitignored, so editing or
  hand-authoring it produces changes that silently never land. Regenerate
  with `npm run prepare-data`. Fixtures go in `test/fixtures/`.
- **Keep the MITRE attribution.** The CWE corpus is copied verbatim and is
  not ours. `NOTICE.md`, the attribution sections of `README.md` and
  `LICENSE.md`, and the `<Attribution>` footer in `src/App.tsx` say so.
  Don't drop them in a refactor, and keep the footer reachable if you move
  where CWE data is displayed.
- **Never use `--no-verify`.** The pre-commit hook runs `lint-staged` and the
  full test suite. Bypassing it is the one way to get unlinted, failing code
  into a commit. If it blocks you, fix the cause.
- **Don't merge your own PR unless asked.** Opening it is where the job
  normally ends.

## Verifying

`npm run lint && npx tsc --noEmit && npm test` before claiming anything
works. Prefer this over `npm run build`, which type-checks but re-downloads
the CWE corpus first.
