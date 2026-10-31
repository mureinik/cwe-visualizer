# Releases, Part 5: Support CWE 4.21 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `main` runs on CWE 4.21 and shows its new `Overlaps` relation as
a symmetric peer relation. This is item 5 of the design's plan of work,
for [#255][i255]. It closes [#243][i243].

**Architecture:** Teach `buildGraph` that `Overlaps` is its own inverse, as
`PeerOf` is, and name it in `relations.ts`'s peer group. Then move the pin
in `cwe-version` from `4.20` to `4.21`. `v1` keeps 4.20, since it has its
own pin.

**Tech Stack:** TypeScript, Vitest, `scripts/prepare-data.ts`.

**Spec:** [`docs/superpowers/specs/2026-10-29-releases-design.md`][spec],
item 5 of "Plan of work" and "What changes between 4.20, 4.21 and 5.0, for
this app".

## What the 4.20 → 4.21 diff turned up

The spec asks for this to be read before implementing. It was read on
2026-10-31, and it turned up nothing beyond `Overlaps`, so this needs no
design of its own.

- **The parser reads** each `Weakness`'s `ID`, `Name`, `Abstraction` and
  `Status` attributes and its `Description`, and each `Related_Weakness`'s
  `Nature`, `CWE_ID` and `View_ID`.
  - Schema 7.4 doesn't change any of those attributes or elements.
  - Its new enumeration values are all in fields the parser ignores
    (languages, prevalence, reasons, taxonomies, impacts).
  - 4.21's data has no `Abstraction` or `Status` value that 4.20 lacks.
- **`Overlaps`** appears 3 times in 4.21:
  - CWE-1476 → CWE-1264, with `Ordinal="Primary"`, which the parser
    ignores;
  - CWE-788 → CWE-126;
  - CWE-788 → CWE-787.

  MITRE's 5.0 news item says "As with “PeerOf”, “Overlaps” should be
  understood as symmetric".
- **MITRE's own documents are inconsistent:**
  - Schema 7.4's `RelatedNatureEnumeration` doesn't list `Overlaps`, so
    4.21 doesn't validate against its own schema.
  - The diff report says no entries are new, but the archive has 984
    weaknesses where 4.20 has 969.

  Neither affects the app, which doesn't validate against the schema and
  reads the archive, not the report.
- **New views:** 4.21 refers to three new views, 1449, 1460 and 1468.
  The app hard-codes no view, so they need nothing.
- **A correction to the spec:** it says `relations.ts` doesn't group
  `Overlaps`, so it isn't shown with the peers. It is shown with them:
  `relationGroup` puts any unknown type in `peer`. What is actually wrong
  today is the reverse direction's label, "Overlaps (inverse)". Task 1
  fixes the spec's sentence.

## Global Constraints

- **Pin:** `cwe-version` holds exactly `4.21`.
- **Data:** `public/data/` is build output. Regenerate it with
  `npm run prepare-data`, never by hand.
- **Tests:** the new tests are real-world: the 4.21 data has `Overlaps`,
  and a pair declaring a relation from both sides is something MITRE's
  data can do. Change no existing real-world test, and leave the
  `theoretical`-tagged tests alone.
- **Verify** with `npm run lint && npx tsc --noEmit && npm test`.
- **`v1` is untouched.** It keeps CWE 4.20 at `/v1/`, and `/` keeps
  redirecting to `/v1/`.

## Review Focus

1. **A relation declared from both sides.** If both CWEs declare
   `Overlaps` on each other, each lists the other once, not twice. Task 1's
   second test pins it.
2. **The reverse direction in the UI.** CWE-787's detail panel lists
   CWE-788 under "Peers" as "Overlaps", not "Overlaps (inverse)". Task 1's
   first test pins it in `buildGraph`. The panel and the edge's label show
   that type as it is, and Task 3 checks them in a browser.
3. **Placement in the focus graph.** An `Overlaps` neighbour is placed to
   balance the row, like a `PeerOf`, and gets no arrow. `ego.ts` already
   does this for any type that isn't a synthesized inverse, so it needs no
   change.
4. **`/v1/` stays on 4.20** after `main` moves. Task 3 checks it.
5. **One entry with two `Overlaps`.** CWE-788 has two. Task 2 checks the
   regenerated data has all three relations.

---

### Task 1: `Overlaps` is a symmetric peer relation

**Files:**

- Modify: `src/lib/graph.ts` (`INVERSE_NATURES`)
- Modify: `src/lib/relations.ts` (`BY_TYPE`)
- Modify: `docs/superpowers/specs/2026-10-29-releases-design.md` (the
  sentence about `relations.ts`)
- Test: `test/lib/graph.test.ts`, `test/lib/relations.test.ts`

**Interfaces:** none new. `buildGraph`, `relationGroup` and
`INVERSE_SUFFIX` keep their signatures.

- [ ] **Step 1: Write the failing tests.** In `test/lib/graph.test.ts`,
  inside `describe('buildGraph')`, after `'labels a synthesized CanPrecede
  inverse as CanFollow'`, using the same two-node `CweData` shape:
  - `'labels a synthesized Overlaps inverse as Overlaps, since it is
    symmetric'`: edges `[{ from: '1', to: '2', type: 'Overlaps' }]`.
    `relatedTo.get('2')` equals
    `[{ from: '2', to: '1', type: 'Overlaps' }]`.
  - `'records an Overlaps declared from both sides once on each side'`:
    edges `1 → 2` and `2 → 1`, both `Overlaps`. `relatedTo.get('1')`
    equals `[{ from: '1', to: '2', type: 'Overlaps' }]` and
    `relatedTo.get('2')` equals
    `[{ from: '2', to: '1', type: 'Overlaps' }]`.

  In `test/lib/relations.test.ts`, add `['Overlaps', 'peer']` to the
  `relationGroup` `it.each` table, after `['CanAlsoBe', 'peer']`.
- [ ] **Step 2: Run them.** `npx vitest run test/lib/graph.test.ts
  test/lib/relations.test.ts`. Expected: both new `graph.test.ts` tests
  fail, with `'Overlaps (inverse)'` where `'Overlaps'` is expected. The
  first test's synthesized inverse is mislabelled. In the second, each side
  gets the mislabelled inverse as well as its own edge. `groups Overlaps as
  peer` already passes, through the fallback for unknown types. It pins
  the grouping so that it no longer depends on that fallback.
- [ ] **Step 3: Implement.** Add `['Overlaps', 'Overlaps']` to
  `INVERSE_NATURES` in `src/lib/graph.ts`, after `['CanAlsoBe',
  'CanAlsoBe']`. Add `['Overlaps', 'peer']` to `BY_TYPE` in
  `src/lib/relations.ts`, after `['CanAlsoBe', 'peer']`.
- [ ] **Step 4: Run them again.** Same command. Expected: all pass.
- [ ] **Step 5: Correct the spec.** In "What changes between 4.20, 4.21
  and 5.0, for this app", replace the claim that `relations.ts` doesn't
  group `Overlaps` with what happens:
  - `relationGroup` already shows `Overlaps` with the peers, through its
    fallback for unknown types;
  - what is wrong is the reverse direction's label.

  Run `npm run lint:md`.
- [ ] **Step 6: Verify and commit.** `npm run lint && npx tsc --noEmit &&
  npm test`, then commit `feat: treat Overlaps as a symmetric peer
  relation`.

### Task 2: Pin CWE 4.21

**Files:**

- Modify: `cwe-version`

- [ ] **Step 1: Move the pin.** `printf '4.21\n' > cwe-version`.
- [ ] **Step 2: Regenerate the data.** `npm run prepare-data`. Then, on
  `public/data/cwe.json`:
  - `jq -r .meta.cweVersion` prints `4.21`;
  - `jq '.nodes | length'` prints `984`;
  - `jq '[.edges[] | select(.type == "Overlaps")] | length'` prints `3`.
- [ ] **Step 3: Verify and commit.** `npm run lint && npx tsc --noEmit &&
  npm test`, then commit `feat: pin CWE 4.21`.
- [ ] **Step 4: Open the PR.** Tick Tasks 1 and 2's boxes, push, mark
  this plan's PR ready, and wait for the required checks: build, validate-issue-link, dependency-review,
  lint-workflows, semgrep and codecov/project. Its body says
  `Closes #255` and `Closes #243`. The owner merges it.

### Task 3: After the merge

- [ ] **Confirm the merge** with `gh pr view <n> --json state`, which
  should say `MERGED`, and check that `main` contains the PR's head.
- [ ] **Production rebuilt.** The latest production deployment is newer
  than the merge, and READY.
- [ ] **The site:**
  - `/latest/data/meta.json` reports `4.21`;
  - `/v1/data/meta.json` still reports `4.20`;
  - `/` still redirects to `/v1/`.
- [ ] **The owner checks in a browser:** on
  `https://cwe-visualizer.vercel.app/latest/?cwe=787`, the detail panel
  lists CWE-788 under "Peers" as "Overlaps", and the edge to CWE-788 is
  labelled "Overlaps".
- [ ] **The issues:** #243 and #255 closed with the merge.
- [ ] **Clean up:** run the post-merge cleanup for `releases/5-cwe-4.21`, including its
  Vercel previews. Never touch `v1`, `v1-base` or `deploy`.

<!-- Issues and PRs -->
[i243]: https://github.com/mureinik/cwe-visualizer/issues/243
[i255]: https://github.com/mureinik/cwe-visualizer/issues/255

<!-- Files in the repo -->
[spec]: ../specs/2026-10-29-releases-design.md
