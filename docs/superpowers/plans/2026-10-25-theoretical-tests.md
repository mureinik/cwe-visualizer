# Real-World and Theoretical Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag the 28 theoretical tests with a Vitest `theoretical` tag, add
a `test:realworld` script that skips them, and write the rules for both
kinds of test into `CONTRIBUTING.md` and `CLAUDE.md`.

**Architecture:** One tag declared in `vite.config.ts`. In each test file,
the theoretical tests move into tagged `describe` blocks, nested inside
the block they're in today so they keep its fixtures and hooks. Each
block opens with a comment naming the reason. Real-world tests whose case
is absent from today's data get a comment saying why they're real. No
`src/` code changes.

**Tech Stack:** Vitest 5.0.5 (test tags), TypeScript, React Testing
Library, npm scripts.

**Spec:** [`docs/superpowers/specs/2026-10-25-theoretical-tests-design.md`](../specs/2026-10-25-theoretical-tests-design.md)

## Global Constraints

- Tag name: exactly `theoretical`. Apply it as `{ tags: ['theoretical'] }`,
  the array form, everywhere, as the second argument of `describe` (or of
  `it` for a single test).
- Script: `"test:realworld": "vitest run --tags-filter='!theoretical'"`.
- Moving a test must not change its title or what it asserts. The only
  title that changes is the one Task 5 renames.
- The suite stays at 363 tests. `npm run test:realworld` reports the
  theoretical ones as *skipped*, not missing: the end state is
  `335 passed | 28 skipped (363)`.
- Coverage thresholds in `vite.config.ts` stay as they are, and every file
  stays above them (`npm run test:coverage`).
- Commits use conventional types: `test:` for test and tooling changes,
  `docs:` for the rules. Each task's commit step gives the subject line.
  The body says why in a few lines and ends with a `Refs #223` line, then
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No Claude
  session link. Never `--no-verify`.
- Verified in a throwaway project against the installed Vitest: config
  `test.tags: [{ name, description }]`; options argument
  `{ tags: [...] }` on `describe` and `it`, inherited by nested blocks;
  `--tags-filter='!theoretical'` reports excluded tests as skipped, with
  each `it.each` case counted separately; an undeclared tag fails the run
  with `The tag "<name>" is not defined in the configuration`.

## Review Focus

- **A moved test silently changes**, for example losing a `beforeEach`
  or picking up a different fixture: the test-title snapshot taken in
  Task 1 and compared in Task 8 must differ only by the Task 5 rename.
- **A tag lands on the wrong block** and takes real-world tests with it:
  each task checks the cumulative skipped count, which only matches if
  exactly that task's tests are tagged.
- **The formatting of `describe(name, { tags }, fn)`** trips ESLint
  Stylistic: each task runs `npm run lint`.
- **A typo in the tag name**: Task 8 checks that a misspelled tag fails
  the run.
- **Someone runs `test:realworld` under coverage** and is surprised when
  thresholds fail: Task 7 documents that it's for quick local runs only.

---

### Task 1: Declare the tag and add the script

**Files:**

- Modify: `vite.config.ts` (the `test` block)
- Modify: `package.json` (`scripts`)
- Modify: `CONTRIBUTING.md` (the Scripts list)

**Interfaces:**

- Produces: the `theoretical` tag and `npm run test:realworld`, used by
  every later task to check its skipped count.

- [ ] **Step 1: Snapshot the test titles**

Run:

```bash
npx vitest run --reporter=json --outputFile="${TMPDIR:-/tmp}/theoretical-run.json" >/dev/null
node -e 'const r = require(process.argv[1]); console.log(r.testResults.flatMap((f) => f.assertionResults.map((a) => `${f.name.replace(/.*\/test\//, "test/")} | ${a.title}`)).sort().join("\n"))' "${TMPDIR:-/tmp}/theoretical-run.json" > "${TMPDIR:-/tmp}/theoretical-before.txt"
wc -l < "${TMPDIR:-/tmp}/theoretical-before.txt"
```

Expected: `363`.

- [ ] **Step 2: Run the missing script**

Run: `npm run test:realworld`
Expected: FAIL with `Missing script: "test:realworld"`.

- [ ] **Step 3: Declare the tag in `vite.config.ts`**

Add `tags` to the `test` block, with a short comment above it pointing to
`CONTRIBUTING.md`:

```ts
tags: [
  {
    name: 'theoretical',
    description:
      "Guards against input that can't happen: data MITRE's schema forbids, a MITRE mistake the schema can't express, or a state our own code never produces.",
  },
],
```

- [ ] **Step 4: Add the script to `package.json`**

After `test:coverage`, add the script exactly as in Global Constraints.

- [ ] **Step 5: List it in `CONTRIBUTING.md`**

In the Scripts list, after `npm run test:coverage`, add a line for
`npm run test:realworld`: Vitest without the tests tagged `theoretical`,
for quick local runs, and not what the hook or CI runs. Don't link to
the section Task 7 adds yet: markdownlint checks links to headings in the
same file, so the commit would fail. Task 7 adds the link.

- [ ] **Step 6: Run it**

Run: `npm run test:realworld`
Expected: PASS, `363 passed (363)`, nothing skipped yet.

- [ ] **Step 7: Lint, type-check, commit**

Run: `npm run lint && npx tsc --noEmit && npm run lint:md`
Expected: no output from the linters, exit 0.

```bash
git add vite.config.ts package.json CONTRIBUTING.md
git commit  # subject: test: add a theoretical tag and a test:realworld script
```

### Task 2: Tag the graph and ego-graph tests

**Files:**

- Modify: `test/lib/graph.test.ts`
- Modify: `test/lib/ego.test.ts`

**Interfaces:**

- Consumes: the `theoretical` tag (Task 1).

Each new block is nested in the `describe` the tests are in today. The
names below are suggestions; the comment reasons are not.

- [ ] **Step 1: `graph.test.ts`, inside `describe('buildGraph')`**

Move `has no inherited keys in nodes, so only CWE ids look up` into a
tagged block (e.g. `lookups by an object key`). Comment: ids that reach a
lookup are always numeric (`CWE_ID` is an integer in the schema, and
`App.tsx` drops a non-numeric `?cwe=`), so nothing in the app looks up a
key like `constructor`.

Move `falls back for a relation type named like an Object.prototype
member` into a second tagged block (e.g. `a relation type outside the
schema`). Comment: the schema enumerates `Nature`, and none of its values
is an `Object.prototype` member.

- [ ] **Step 2: `graph.test.ts`, the `rootIds` option**

Inside `describe('buildGraph roots')`, add a tagged block (e.g. `the
rootIds option`) holding `accepts an explicit root set, which a view would
supply`, `ignores explicit root ids that are not in the corpus`, and
`ignores object keys among the declared roots`, which moves here from
`describe('buildGraph')`. Its fixture, `sampleData`, is top-level. Comment:
nothing in `src/` passes `rootIds`. Promote all three if something starts
to.

- [ ] **Step 3: `graph.test.ts`, `countDescendants`**

Inside `describe('countDescendants')`, move `is zero for an id not in the
corpus` into a tagged block. Comment: its only caller, `LandingPanel`,
passes ids from `graph.roots`.

- [ ] **Step 4: `graph.test.ts`, the dangling-edge block and `ParentOf`**

Tag `describe('hierarchy edges with an end outside the corpus')` as it
stands. Replace its comment (it says MITRE's relations *can* name a
missing entry, which today's data never does): a hierarchy relation to an
entry that isn't in the download would be a MITRE mistake, and the schema
can't rule it out. `buildGraph` keeps such edges, so the walks must step
over the gap.

Add a "why it's real" comment to `describe('buildGraph ParentOf
direction')`: the schema allows `ParentOf`, though today's data only
states `ChildOf`.

- [ ] **Step 5: `ego.test.ts`, inside `describe('buildEgoGraph')`**

Move `skips relation targets that are not in the corpus` into a tagged
block. Comment: a relation to an entry that isn't in the download would be
a MITRE mistake. Move the `it.each` `returns an empty graph for the object
key %s` (3 cases) into a second tagged block. Comment: as for the
`graph.test.ts` lookups, the centre is always a numeric id. `returns an
empty graph for an unknown centre` stays where it is: `?cwe=99999`
reaches it.

- [ ] **Step 6: Check the count**

Run: `npm run test:realworld`
Expected: PASS, `350 passed | 13 skipped (363)`.

- [ ] **Step 7: Lint, type-check, test, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass, `363 passed (363)`.

```bash
git add test/lib/graph.test.ts test/lib/ego.test.ts
git commit  # subject: test(graph): tag the graph and ego-graph tests that can't happen
```

### Task 3: Tag the relation-type and abstraction fallbacks

**Files:**

- Modify: `test/lib/relations.test.ts`
- Modify: `test/lib/shapes.test.ts`

- [ ] **Step 1: `relations.test.ts`, inside `describe('relationGroup')`**

Move `falls back to peer for an unrecognised type rather than throwing`
and `falls back to peer for a type named like an Object.prototype member`
into one tagged block. Comment: the schema enumerates `Nature`, and every
value on it has a group.

- [ ] **Step 2: `shapes.test.ts`, inside `describe('glyphFor')`**

Move `falls back for an unknown abstraction rather than throwing` and
`falls back for an abstraction named like an Object.prototype member` into
one tagged block. Comment: the schema enumerates `Abstraction`, and every
value on it has a glyph. `keeps the registry open for future node kinds`
stays put: it pins the registry to the schema's five abstractions, which
the legend lists.

- [ ] **Step 3: Check the count**

Run: `npm run test:realworld`
Expected: PASS, `346 passed | 17 skipped (363)`.

- [ ] **Step 4: Lint, type-check, test, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass.

```bash
git add test/lib/relations.test.ts test/lib/shapes.test.ts
git commit  # subject: test: tag the fallbacks for types outside the CWE schema
```

### Task 4: Tag the tree's theoretical blocks

**Files:**

- Modify: `test/components/Tree.test.tsx`

These three blocks already exist, so this only adds tags and makes their
comments name the reason.

- [ ] **Step 1: Tag the blocks**

- `describe('Tree with a hierarchy edge to an id outside the corpus')`
  (3 tests): its comment adds that today's data has no such edge, and one
  would be a MITRE mistake.
- `describe('Tree with a graph that has no hierarchy lists')`: move the
  comment that's inside its test up to the block, saying `buildGraph`
  gives every node both lists.
- `describe('Tree with a cycle in the hierarchy')`: its comment already
  says MITRE's data has no loops, so only the tag is added.

- [ ] **Step 2: Check the count**

Run: `npm run test:realworld`
Expected: PASS, `341 passed | 22 skipped (363)`.

- [ ] **Step 3: Lint, type-check, test, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass.

```bash
git add test/components/Tree.test.tsx
git commit  # subject: test(tree): tag the tree tests for input that can't happen
```

### Task 5: Tag the data script's schema-forbidden input

**Files:**

- Modify: `test/scripts/prepare-data.test.ts`

- [ ] **Step 1: Tag and rename, inside `describe('parseCatalog')`**

Move `leaves viewId undefined when a relation declares no View_ID` and the
attribute-defaults test into one tagged block. Comment: the schema
requires `View_ID` on every `Related_Weakness`, and `Name`, `Abstraction`
and `Status` on every `Weakness`.

Rename `defaults missing optional Weakness attributes to empty strings` to
`defaults missing Weakness attributes to empty strings`. The schema
requires them, so "optional" is wrong.

- [ ] **Step 2: Comment the format checks**

Above `throws on a catalog missing the expected root element` and `throws
on a catalog whose Date is missing or not YYYY-MM-DD`, add one "why it's
real" comment: MITRE can change its download format, which isn't a
mistake and is outside our control. These checks fail the build rather
than ship data the app can't read.

- [ ] **Step 3: Check the count**

Run: `npm run test:realworld`
Expected: PASS, `339 passed | 24 skipped (363)`.

- [ ] **Step 4: Lint, type-check, test, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass.

```bash
git add test/scripts/prepare-data.test.ts
git commit  # subject: test(prepare-data): tag input the CWE schema forbids
```

### Task 6: Tag the `matchMedia` and `systemTheme()` tests

**Files:**

- Modify: `test/lib/media.test.tsx`
- Modify: `test/lib/theme.test.ts`

- [ ] **Step 1: `media.test.tsx`, inside `describe('useMediaQuery')`**

Move `returns false rather than throwing where matchMedia is unavailable`
and `assumes the wide layout when rendered on the server` into one tagged
block. Comment: every supported browser has `matchMedia` (only jsdom
lacks it), and the app only renders in the browser. Keep the guard
itself: most component tests run without a `matchMedia` stub and rely on
it.

- [ ] **Step 2: `theme.test.ts`, inside `describe('theme')`**

Move `reads the system preference from matchMedia` and `falls back to
light when matchMedia is unavailable` into one tagged block nested in
`describe('theme')`, so the `beforeEach` still applies. Comment: nothing
in `src/` calls `systemTheme()` (`ThemeToggle` reads the preference
through `useMediaQuery`). Promote both if something starts to.

- [ ] **Step 3: Check the count**

Run: `npm run test:realworld`
Expected: PASS, `335 passed | 28 skipped (363)`.

- [ ] **Step 4: Lint, type-check, test, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass.

```bash
git add test/lib/media.test.tsx test/lib/theme.test.ts
git commit  # subject: test: tag the matchMedia and systemTheme tests
```

### Task 7: Write the rules down

**Files:**

- Modify: `CONTRIBUTING.md` (new section after Scripts, before Workflow)
- Modify: `CLAUDE.md` ("Constraints nothing enforces")

- [ ] **Step 1: Add `## Real-world and theoretical tests` to
  `CONTRIBUTING.md`**

In the file's prose style, cover, from the spec's Definitions and The
rules sections:

- what makes a test theoretical (the three reasons), and that everything
  else is real-world, including what the schema allows but today's data
  doesn't use;
- the rules for changing each kind, including asking the maintainer and
  waiting for agreement before removing or rewriting a theoretical test;
- classifying new tests when they're written (real-world when in doubt),
  and promotion in the change that makes the case possible;
- the "why it's real" comment for real-world tests whose case is absent
  from today's data;
- how to tag a test: `{ tags: ['theoretical'] }` on a nested `describe`,
  with a comment naming the reason;
- `npm run test:realworld`: quick local runs only; the hook and CI run
  everything, and it isn't meant to run under coverage, since theoretical
  tests count towards each file's coverage.

Then link the `npm run test:realworld` line Task 1 added to the Scripts
list to this section.

- [ ] **Step 2: Add the `CLAUDE.md` bullet**

Under "Constraints nothing enforces", one bullet: never change a
real-world test unless the behaviour change is intended; propose, don't
make, changes to theoretical ones and wait for the maintainer; classify
new tests. Link to the new `CONTRIBUTING.md` section for the details.

- [ ] **Step 3: Lint and commit**

Run: `npm run lint:md`
Expected: no issues.

```bash
git add CONTRIBUTING.md CLAUDE.md
git commit  # subject: docs: say how real-world and theoretical tests differ
```

### Task 8: Verify the whole branch

No commit unless a check fails and needs fixing.

- [ ] **Step 1: Compare test titles with the Task 1 snapshot**

Run Task 1 Step 1's two commands again, writing to
`theoretical-after.txt`, then
`diff "${TMPDIR:-/tmp}/theoretical-before.txt" "${TMPDIR:-/tmp}/theoretical-after.txt"`.
Expected: exactly one changed line, the Task 5 rename.

- [ ] **Step 2: A typo in the tag fails the run**

Temporarily change one `'theoretical'` in `test/lib/theme.test.ts` to
`'theoretcal'`, then run `npx vitest run test/lib/theme.test.ts`.
Expected: FAIL with `The tag "theoretcal" is not defined in the
configuration`. Then restore it with `git checkout -- test/lib/theme.test.ts`
and confirm that `git status` is clean.

- [ ] **Step 3: Full checks and coverage**

Run: `npm run lint && npm run lint:md && npm run lint:css && npx tsc --noEmit && npm run test:coverage`
Expected: all pass, `363 passed (363)`, and no coverage threshold errors.

- [ ] **Step 4: Final count**

Run: `npm run test:realworld`
Expected: `335 passed | 28 skipped (363)`.

- [ ] **Step 5: Push and update the PR**

Push the branch. Update PR #224's description so "Still to come" becomes
what was done. Leave it as a draft for the maintainer to mark ready.
