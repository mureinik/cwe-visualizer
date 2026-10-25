# Real-World and Theoretical Tests — Design

## Purpose

Some tests in this repo guard against input that can't actually happen:
a loop in the CWE hierarchy, a relation to an entry that doesn't exist, a
state our own code never produces. They're worth having, since they keep a
mistake on MITRE's side or a future refactor from crashing the site. But
they don't describe anything a user of the deployed site sees, so they
shouldn't carry the same weight as the tests that do.

Today nothing tells the two kinds apart. A refactor that would, say,
speed up the tree at the cost of the cycle guard looks just as forbidden
as one that breaks search ranking. This design separates them, in the code
and in the contribution rules, so that:

- a **real-world** test is never broken unless the change explicitly sets
  out to change that behaviour, and
- a **theoretical** test is a legitimate candidate for removal or
  rewriting, which Claude (or anyone) may propose with a reason, and the
  maintainer decides.

## Definitions

### Theoretical

A test is theoretical when its input can't happen, for one of these
reasons:

1. **MITRE's schema forbids it.** "The schema" means the rules the CWE XML
   schema (`cwe_schema_latest.xsd`, v7.3 at the time of writing) actually
   states: required attributes and enumerated values. Examples: a
   `Related_Weakness` with no `View_ID`, a weakness with no `Name`, a
   relation `Nature` or an `Abstraction` that isn't on its enumeration.
2. **It would be a MITRE mistake the schema can't express.** The schema
   checks the form of a relation, not whether it makes sense. A relation
   whose `CWE_ID` names an entry that doesn't exist, or `ChildOf` links
   that form a loop, are mistakes, even though the schema has no rule
   against them.
3. **Our own code never produces it.** Examples: a `Graph` whose
   `childrenOf` map lacks an entry for a node (`buildGraph` always creates
   one), an option or function nothing in `src/` calls, a fallback only the
   test environment reaches (jsdom has no `matchMedia`; every supported
   browser does). For uncalled code, every test of it is theoretical, not
   only its edge cases, and all of them are promoted together once
   something in `src/` calls it.

### Real-world

Everything else, including:

- **Anything the schema allows, even if today's data never uses it**, such
  as a `ParentOf` relation, or the `Obsolete` and `Usable` statuses (#219).
- **Changes outside our control that aren't mistakes**, such as MITRE
  changing its download format. The data script's checks that fail the
  build on an unexpected format are real-world.
- **User input**, such as anything typed into `?cwe=`, and browser
  conditions like blocked storage.

### Promotion

A theoretical test isn't permanently theoretical. If the code that rules
out its case changes so the case can happen, or the schema starts
allowing it, the test becomes real-world in that same change. For
example, if `buildGraph` stopped creating a child list for every node,
the empty-maps tree test would be promoted.

## The rules

These go into `CONTRIBUTING.md`, with a pointer from `CLAUDE.md` (see
[Documentation](#documentation)):

- **Real-world tests** may only change when the change explicitly sets out
  to alter the behaviour they cover. A real-world test failing otherwise
  means the change is wrong.
- **Theoretical tests** may be proposed for removal or rewriting when they
  stand in the way of something worthwhile, like a performance gain or
  simpler code. The proposal says what the site would lose: nothing
  visible, only some resilience to bad data or to a future refactor. It is
  never done unilaterally: Claude asks the maintainer and waits for
  agreement, as it does for a coverage exception.
- **New tests are classified when written**, using the definitions above.
  When in doubt, a test is real-world.
- **Promotion happens in the change that makes the case possible.**
- **A real-world test whose case is absent from today's data says why it's
  real**, in a comment: either the schema allows the case, or it's outside
  our control. Without that comment, a reader who checks the data would
  take it for a theoretical test. This applies only to tests whose point
  is that case, not to fixtures that use an unusual value incidentally.

## Marking theoretical tests

Vitest 5.0.3, the version the repo uses, supports test tags:

- tags are declared in the Vitest config (`test.tags`, each with a name
  and a description);
- a `describe` block or a single test is given tags through its options
  argument;
- `vitest run --tags-filter=<expression>` selects by tag and supports
  `!` (not);
- by default (`strictTags`), a tag that isn't declared in the config is an
  error, so a typo can't silently leave a test in the wrong group.

The design uses one tag, `theoretical`, declared in `vite.config.ts` with a
description that summarises the definition above. Real-world tests carry
no tag: that's the default.

**My call: group, then tag the group.** In each file, the theoretical tests
move into their own `describe` block (or blocks, one per case), and the
tag goes on the block rather than on each test. That puts them together
where a reader sees them, which was the original idea. A test can carry
the tag directly when moving it would split a fixture awkwardly; the
builder judges that case by case.

**Each theoretical block says why** in a short comment, naming which of
the three reasons applies (for example "the schema requires `View_ID`",
"MITRE's data has no hierarchy loops", "nothing in `src/` calls
`rootIds`"). Several such comments already exist and can be reworded
rather than duplicated.

## `test:realworld` script

Add to `package.json`:

```json
"test:realworld": "vitest run --tags-filter='!theoretical'"
```

The exact quoting is the builder's call. It must work in npm scripts on
Linux and macOS; Windows support isn't required, since CI runs Linux.

It exists for quick local runs only. It changes nothing else:

- the pre-commit hook still runs the full `npm test`;
- CI still runs `npm run test:coverage` over everything;
- coverage thresholds still apply to the full run, since theoretical tests
  are part of what keeps per-file coverage above the floor. Running only
  real-world tests under coverage is expected to fail thresholds and isn't
  supported.

List it in `CONTRIBUTING.md`'s Scripts section, with the note that it's
for local development and isn't what the hook or CI runs.

## Classification of the existing suite

The suite has 363 tests in 27 files. I checked each borderline case
against the real data (CWE 4.20: 969 weaknesses, 1,602 relations) and the
schema (v7.3). Line numbers are as of `a27e800`.

### Theoretical today

| File | Test(s) | Reason |
| --- | --- | --- |
| `test/components/Tree.test.tsx` | `describe` at 86: missing child, only child missing, missing parent (3 tests) | MITRE mistake: the data has no hierarchy link to a missing entry |
| `test/components/Tree.test.tsx` | `describe` at 126: graph with no hierarchy lists | Our code: `buildGraph` gives every node both lists |
| `test/components/Tree.test.tsx` | `describe` at 137: cycle in the hierarchy | MITRE mistake: the data has no loops |
| `test/lib/graph.test.ts` | `describe` at 290: hierarchy edges with an end outside the corpus (3 tests) | MITRE mistake, as above |
| `test/lib/graph.test.ts` | 28: no inherited keys in `nodes` | Our code: ids reaching a lookup are numeric (schema `CWE_ID` is an integer; `App.tsx` rejects non-numeric `?cwe=`) |
| `test/lib/graph.test.ts` | 92: relation type named like an `Object.prototype` member | Schema: `Nature` is enumerated |
| `test/lib/graph.test.ts` | 36, 227, 233: `rootIds` option (object keys among roots, explicit root set, unknown root ids) | Our code: nothing in `src/` passes `rootIds` |
| `test/lib/graph.test.ts` | 251: `countDescendants` of an id not in the corpus | Our code: its only caller (`LandingPanel`) passes ids from `graph.roots` |
| `test/lib/ego.test.ts` | 100: relation targets not in the corpus | MITRE mistake, as above |
| `test/lib/ego.test.ts` | 114: object keys as the centre (3 cases) | Our code: as for `graph.test.ts:28` |
| `test/lib/relations.test.ts` | 43, 47: unrecognised type, type named like an `Object.prototype` member | Schema: `Nature` is enumerated, and every value is mapped |
| `test/lib/shapes.test.ts` | 22, 27: unknown abstraction, abstraction named like an `Object.prototype` member | Schema: `Abstraction` is enumerated, and every value has a glyph |
| `test/scripts/prepare-data.test.ts` | 72: relation with no `View_ID` | Schema: `View_ID` is required |
| `test/scripts/prepare-data.test.ts` | 84: weakness missing `Name`/`Abstraction`/`Status` | Schema: all three are required |
| `test/lib/media.test.tsx` | 51: `matchMedia` unavailable | Our code: only jsdom lacks it |
| `test/lib/media.test.tsx` | 73: rendered on the server | Our code: the app only renders in the browser |
| `test/lib/theme.test.ts` | 52, 60: `systemTheme()`, with and without `matchMedia` | Our code: nothing in `src/` calls `systemTheme()` (and only jsdom lacks `matchMedia`) |

That's 28 test cases, counting each `it.each` case separately.

### Real-world, though they look defensive

Recorded so they aren't moved by mistake:

- `graph.test.ts:79`, the generic "(inverse)" label: the data has 3
  `StartsWith` relations, which have no named inverse.
- `shapes.test.ts:32`, the glyph registry: it pins the registry to exactly
  the schema's five abstractions, which the legend lists.
- `graph.test.ts:256` block, relations recorded once: 16 relations are
  stated from both ends; 118 weaknesses repeat a `ChildOf` (once per
  view).
- `graph.test.ts:118` block, `ParentOf`: allowed by the schema, absent
  from the data. **Needs the "why it's real" comment.**
- `prepare-data.test.ts:89`, `:93`, the format checks: MITRE may change
  its format. **Need the "why it's real" comment.**
- Unknown numeric ids: `App.test.tsx:95`, `DetailPanel.test.tsx:32`,
  `ego.test.ts:108`, `graph.test.ts:191` (`ancestorsOf`, which the tree
  calls with the selected id), `layout.test.ts:91` (an unknown id
  produces an empty ego graph, which is laid out). All reachable by
  typing `?cwe=99999`.
- `App.test.tsx:101`, junk in `?cwe=`: user input.
- `theme.test.ts:26`, `:31`, `:38`, unknown stored value and blocked
  storage: user-controlled or browser conditions.
- Fixtures that use `CanFollow` or `RequiredBy`: `buildGraph` synthesises
  both as the inverses of `CanPrecede` (143) and `Requires` (13), so the
  site shows them. No comment needed.

### Corrections made along the way

- `graph.test.ts:291`'s comment says MITRE's relations can name an entry
  the download doesn't include. Today's data has none; reword it to say
  this would be a MITRE mistake.
- `prepare-data.test.ts:84` calls `Name`, `Abstraction` and `Status`
  "optional"; the schema requires them. Fix the test name.

## Documentation

- **`CONTRIBUTING.md`**: a new section (placement is the builder's call;
  near the coverage text is natural, since both are about test rules)
  with the definitions, the rules, the promotion rule, the comment rule,
  how to tag a test, and the `test:realworld` script. Keep the repo's
  prose style: plain sentences, no marketing.
- **`CLAUDE.md`**: one bullet under "Constraints nothing enforces", since
  nothing checks that a test is in the right group: never change a
  real-world test unless the behaviour change is intended; propose, don't
  perform, changes to theoretical ones; classify new tests. Point to
  `CONTRIBUTING.md` for the details.

## Delivery

One GitHub issue and one PR that closes it, following the usual workflow.
The PR contains this document, the config and script, the regrouped and
tagged tests, the new comments, and the documentation. Moving tests
between `describe` blocks must not change what they assert: the test count
stays at 363, and coverage must not drop.

Verification: `npm run lint && npx tsc --noEmit && npm test`, plus
`npm run test:realworld` passing and running exactly 28 fewer tests than
`npm test`, and a deliberate typo in a tag failing the run.

## Out of scope

- Handling the `Obsolete` and `Usable` statuses (#219).
- Removing any theoretical test or guard. This design only labels them;
  removal is a per-case proposal under the new rules. That includes the
  uncalled code itself (`buildGraph`'s `rootIds` option and
  `systemTheme()`): whether to delete it is a separate question.
- Enforcing classification automatically (e.g. a lint rule). The rule is
  documented, not checked.
- Other tags (for example "slow" or "integration").
