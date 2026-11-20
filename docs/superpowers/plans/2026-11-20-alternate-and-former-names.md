# Alternate Terms and Former Names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search, the View picker and the detail panel know a weakness's
alternate terms and former names, and a view's former names
([#345](https://github.com/mureinik/cwe-visualizer/issues/345),
[#358](https://github.com/mureinik/cwe-visualizer/issues/358)).

**Architecture:** `scripts/prepare-data.ts` reads `Alternate_Terms` and
`Content_History/Previous_Entry_Name` into new optional fields on `CweNode`
and `CweView`, stored once as MITRE gives them. `src/lib/search.ts` ranks
on them at runtime, from lowercased copies built once per graph, and tells
`SearchBox` which other name matched. `Picker` matches former view names;
two new disclosures show the lists in `DetailPanel`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest + Testing Library,
fast-xml-parser (build only).

**Spec:** `docs/superpowers/specs/2026-11-20-alternate-and-former-names-design.md`

## Global Constraints

- The app never contacts MITRE at runtime; everything is read at build time.
- `public/data/` is build output: regenerate with `npm run prepare-data`,
  never edit it. Fixtures go in `test/fixtures/`.
- No new dependency.
- Terms, descriptions and former names are MITRE's, verbatim apart from
  whitespace (every run collapsed to one space, ends trimmed). Nothing is
  de-duplicated at build time.
- Each field is present only when non-empty.
- `DATA_FORMAT` goes from 2 to 3.
- The build stays strict and names the CWE or view in every error.
- It must also build CWE 4.x catalogs (schema 7.x, no `Role`).
- Keep the MITRE attribution untouched.
- Classify every new test real-world or theoretical (CONTRIBUTING); when in
  doubt, real-world. Never change an existing real-world test unless the
  task sets out to change that behaviour.
- Every `#N` issue or PR reference in Markdown is a link.
- Run commands under Node 26: prefix with `source ~/.nvm/nvm.sh && nvm use 26 &&`.
- Never `--no-verify`. Each commit ends with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Leave no uncovered or partial line in the changed code (Codecov's patch
  comment, read after each push).

## Review Focus

1. **A term with `Role` elements (all of 5.0's roles).** The reader must
   ignore `Role`, not fail on it — Task 2 and the fixture in Task 3.
2. **Case in terms and names** ("AuthZ", "SQLi"): matching is
   case-insensitive and the row shows MITRE's casing — Task 4.
3. **Search within an active filter**: a term match outside the filter is
   not found, and the rest rank as usual — Task 4.
4. **A former name equal to the current name** (CWE-256): the row never
   says "formerly" — Task 4.
5. **Selecting another CWE** closes both new disclosures, as Technical
   nuance does — Task 7.

---

### Task 1: Data types and a generalised structured-text converter

**Files:**

- Modify: `src/lib/cwe-data.ts`
- Modify: `scripts/nuance.ts`
- Test: `test/scripts/nuance.test.ts`

**Interfaces:**

- Produces, in `src/lib/cwe-data.ts`, exactly the spec's types:
  `CweAlternateTerm { term: string; description?: NuanceBlock[] }`,
  `CwePreviousName { name: string; date: string }`,
  `CweNode.alternateTerms?: CweAlternateTerm[]`,
  `CweNode.previousNames?: CwePreviousName[]`,
  `CweView.previousNames?: string[]`, and `DATA_FORMAT = 3`. Doc comments
  as in the spec; `NuanceBlock`'s comment says it is MITRE structured text
  in general.
- Produces `parseNuance(raw: string, cweId: string, element = 'Technical_Nuance'): NuanceBlock[]`.
  `element` names the source in errors only. The wrapper tag the parser
  puts around `raw` becomes a fixed internal name, so `element` may hold a
  space.

- [ ] **Step 1: Write the failing test** in `test/scripts/nuance.test.ts`
  (real-world: a future description could carry markup the converter
  doesn't know):

```ts
it('names the element it converts in an error', () => {
  expect(() => parseNuance('<xhtml:table/>', '191', 'Alternate_Term Description'))
    .toThrow('CWE-191: unsupported <xhtml:table> in Alternate_Term Description');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run test/scripts/nuance.test.ts`
Expected: FAIL, the message says `Technical_Nuance`.

- [ ] **Step 3: Implement** the parameter and the types above. Existing
  nuance tests must pass unchanged.

- [ ] **Step 4: Run** `npx vitest run test/scripts/nuance.test.ts && npx tsc --noEmit`
  Expected: PASS, no type errors.

- [ ] **Step 5: Commit** `feat(data): add alternate term and former name types`

### Task 2: Readers for alternate terms and former names

**Files:**

- Create: `scripts/names.ts`
- Test: `test/scripts/names.test.ts` (`// @vitest-environment node`)

**Interfaces:**

- Consumes: `parseNuance` (Task 1), the types from Task 1.
- Produces:
  - `readAlternateTerms(raw: unknown, cweId: string): CweAlternateTerm[]`.
    `raw` is the weakness's `Alternate_Terms` as fast-xml-parser gives it,
    with `Description` already a stop node, so a raw inner-XML string.
  - `readPreviousNames(raw: unknown, where: string): CwePreviousName[]`.
    `raw` is the entry's `Content_History`. `where` is `CWE-79` or
    `View 1000`, for errors.
- Both return `[]` for `undefined`. Order: MITRE's. A description that
  converts to no blocks is omitted. `Role` and `Version` are ignored.
  Collapse whitespace with the same rule as `scripts/dimensions.ts`'s
  `collapse` (copy it, or move it into a shared helper both import).
- Errors, each starting with `where` (`CWE-<id>` for terms):
  `more than one Alternate_Terms element`,
  `Alternate_Terms has no Alternate_Term`,
  `Alternate_Term has no Term`, `empty Alternate_Term`,
  `Previous_Entry_Name has no Date`,
  `Previous_Entry_Name Date is not YYYY-MM-DD: "<date>"`,
  `empty Previous_Entry_Name`.

- [ ] **Step 1: Write the failing tests.** Real-world:
  - CWE-79-like input with three terms, one with two `Role` elements and
    no description, one with a description, one with a two-`xhtml:p`
    description, gives three terms in order. The second has a one-paragraph
    `description` and the third has two paragraphs.
  - A `Term` of `"  Cross-site\n\t Scripting "` becomes `"Cross-site Scripting"`.
  - Two `Previous_Entry_Name` with `@_Date` and one with `@_Version` too
    give `[{ name, date }, …]` oldest first, with no `version` key.
  - `Content_History` without `Previous_Entry_Name` gives `[]`.
  - An empty `Term`, empty name text, and a `Date` of `2008-04-11Z` each
    throw the message above. Add a comment that `xs:string` and `xs:date`
    allow these, so the tests are real-world although 5.0 and 4.21 have
    none.

  Theoretical, in a nested `describe(…, { tags: ['theoretical'] })` with a
  comment that MITRE's schema forbids them: a missing `Term`, a missing
  `Date`, two `Alternate_Terms` (an array), and an `Alternate_Terms`
  without `Alternate_Term`.

- [ ] **Step 2: Run** `npx vitest run test/scripts/names.test.ts`
  Expected: FAIL, the module isn't found.

- [ ] **Step 3: Implement** `scripts/names.ts`, with a header comment in the
  style of `scripts/dimensions.ts` (strict on purpose).

- [ ] **Step 4: Run** the test file. Expected: PASS.

- [ ] **Step 5: Commit** `feat(data): read alternate terms and former names`

### Task 3: Write the names into cwe.json

**Files:**

- Modify: `scripts/prepare-data.ts` (`RawWeakness`, parser `stopNodes`,
  the weakness loop)
- Modify: `scripts/views.ts` (`RawView`, `readViews`)
- Modify: `test/fixtures/cwec-sample.xml`
- Test: `test/scripts/prepare-data.test.ts`, `test/scripts/views.test.ts`

**Interfaces:**

- Consumes: `readAlternateTerms`, `readPreviousNames` (Task 2).
- Produces: `CweNode.alternateTerms`, `CweNode.previousNames`, and
  `CweView.previousNames` (names only, MITRE order) in parsed data, each
  set only when non-empty.
- Add the stop node
  `Weakness_Catalog.Weaknesses.Weakness.Alternate_Terms.Alternate_Term.Description`.
  `RawWeakness` gains `Alternate_Terms?: unknown; Content_History?: unknown`,
  and `RawView` gains `Content_History?: unknown`.

- [ ] **Step 1: Extend the fixture.** Keep every existing `Name` as it is.
  Changes:
  - CWE-79 gets `Alternate_Terms`:
    - "XSS" with `<Role>Acronym</Role>` and the description "A common
      abbreviation/acronym for Cross-Site Scripting.";
    - "CSS" with two roles (`Acronym`, `Legacy`) and a two-`xhtml:p`
      description;
    - "Cross-site Scripting", with no description.
  - CWE-79 gets `Content_History` with `Previous_Entry_Name Date="2008-04-11"`
    "Cross-site Scripting (XSS)".
  - CWE-89 gets the term "SQLi" and two former names, the later one with a
    `Version` attribute.
  - View 1000 gets the former name "Natural Hierarchy" (2008-09-09), and
    view 699 gets "Development Concepts" (2020-02-24).
  - Put `Content_History` where the schema does, last in its entry.

- [ ] **Step 2: Write the failing tests** (real-world).
  - `parseCatalog` gives CWE-79 its three terms, with "CSS" having two
    paragraphs, and its one former name.
  - CWE-89 gets `previousNames` oldest first.
  - CWE-74 has neither key (`not.toHaveProperty`).
  - `data.views` gives 1000 `previousNames: ['Natural Hierarchy']`, and a
    view without former names has no key.
  - `dataFormat` is 3. Update an existing assertion only if one pins 2.

- [ ] **Step 3: Run** `npx vitest run test/scripts`. Expected: the new
  tests FAIL.

- [ ] **Step 4: Implement** the wiring, assigning conditionally as the loop
  does for `dimensions`.

- [ ] **Step 5: Run** `npx vitest run test/scripts`. Expected: PASS. Then
  run `npm run prepare-data` and check:
  `node -e 'const d=require("./public/data/cwe.json");console.log(d.dataFormat, d.nodes["79"].alternateTerms.length, d.nodes["89"].previousNames.length, d.views.find(v=>v.id==="1000").previousNames)'`.
  Expected: `3 7 7 [ 'Natural Hierarchy', 'Research Concepts' ]`.

- [ ] **Step 6: Commit** `feat(data): write alternate terms and former names to cwe.json`

### Task 4: Rank alternate terms and former names in search

**Files:**

- Modify: `src/lib/search.ts`
- Test: `test/lib/search.test.ts`

**Interfaces:**

- Produces:

```ts
export interface SearchHit {
  node: CweNode;
  /** The other name that gave the best rank; absent for an ID or name match. */
  via?: { kind: 'term' | 'former'; name: string };
}
export function searchNodes(graph: Graph, query: string, matches?: Set<string> | null): SearchHit[];
```

- The ranks are the spec's table, 0 to 9. An entry's rank is its best
  match. Deprecated entries come last, then rank, then `compareIds`.
- The rank-3 rule carries a code comment that states the decision and
  why: an exact term is how people name the weakness, and the
  "xss"/"injection" examples.
- `via` at the best rank:
  - a term: the first in MITRE order;
  - a former name: the one with the latest `date`, and the later in
    MITRE's list on a tie.
- Lowercased copies of the terms and former names are built once per
  graph, in a module-level `WeakMap<Graph, …>`.

- [ ] **Step 1: Write the failing tests** (real-world). Extend `node()` to
  take optional `alternateTerms` and `previousNames`. Add these nodes,
  with names and terms from 5.0:
  - 79 "Improper Neutralization of Input During Web Page Generation", with
    terms XSS, HTML Injection, and "Reflected XSS / Non-Persistent XSS /
    Type 1 XSS";
  - 85 "Doubled Character XSS Manipulations";
  - 87 "Improper Neutralization of Alternate XSS Syntax";
  - 74 "Improper Neutralization of Special Elements in Output Used by a
    Downstream Component", with the term Injection;
  - 91 "XML Injection";
  - 352 "Cross-Site Request Forgery", with the terms CSRF and XSRF;
  - 285 "Improper Authorization", with the term AuthZ;
  - 256 "Plaintext Storage of a Password", with the former name
    "Plaintext Storage of a Password" (2018-03-27);
  - 1001 "Failure-Prone Example", made up;
  - 1002 "Unrelated Name", made up, with former names "Failure to
    Sanitize X" (2008-09-09) and "Failure to Preserve X" (2009-07-27).

  Put these in a new `describe('searchNodes with other names')` that
  builds its own graph, with its own `ids` helper, from only these nodes.
  The existing `data` holds a different `79` and an `89` "SQL Injection",
  which would put 89 between 74 and 91 for "injection".

```ts
it('ranks an exact alternate term above names that merely contain the query', () => {
  expect(ids('xss')).toEqual(['79', '85', '87']);
  expect(ids('injection').slice(0, 2)).toEqual(['74', '91']);
});
it('ranks a partial term match below every name match', () => {
  expect(ids('xs').indexOf('79')).toBeGreaterThan(ids('xs').indexOf('87'));
});
it('ranks former names below names', () => {
  expect(ids('failure')).toEqual(['1001', '1002']);
});
it('matches terms case-insensitively and reports MITRE casing', () => {
  expect(searchNodes(graph, 'authz')[0]).toEqual({ node: graph.nodes['285'], via: { kind: 'term', name: 'AuthZ' } });
});
it('reports the term at the best rank, not the first that contains the query', () => {
  expect(searchNodes(graph, 'xss')[0].via).toEqual({ kind: 'term', name: 'XSS' });
});
it('reports the newest matching former name', () => {
  expect(searchNodes(graph, 'failure to')[0].via).toEqual({ kind: 'former', name: 'Failure to Preserve X' });
});
it('reports nothing when the name itself matched', () => {
  expect(searchNodes(graph, 'plaintext')[0].via).toBeUndefined();
});
it('finds no term match outside the filter', () => {
  expect(searchNodes(graph, 'xss', new Set(['85', '87'])).map((h) => h.node.id)).toEqual(['85', '87']);
});
```

  Existing tests change only by mapping hits to nodes (`ids` uses
  `.map((h) => h.node.id)`). That is a change of return type, not of
  behaviour.

- [ ] **Step 2: Run** `npx vitest run test/lib/search.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Update `SearchBox.tsx` only enough to compile
  (`results[index].node`). Task 5 does its display.

- [ ] **Step 4: Run** `npx vitest run test/lib/search.test.ts test/components/SearchBox.test.tsx && npx tsc --noEmit`.
  Expected: PASS.

- [ ] **Step 5: Commit** `feat(search): match alternate terms and former names`

### Task 5: Show the matched name in the search row

**Files:**

- Modify: `src/components/SearchBox.tsx`, `src/styles/search.css`
- Test: `test/components/SearchBox.test.tsx`

**Interfaces:**

- Consumes: `SearchHit` (Task 4).
- The row wraps `search-result__name` and a new `search-result__via` in a
  `search-result__text` column. `search-result__via` reads
  `also called: <name>` for a term and `formerly: <name>` for a former
  name. It is smaller and muted (`--text-xs`, `--text-muted`), one line,
  with an ellipsis, like the name.
- The option's `aria-label` is `CWE-79: <name>, also called XSS` or
  `…, formerly <name>`, and stays unchanged without `via`.

- [ ] **Step 1: Write the failing tests** (real-world), with a graph whose
  79 has the term XSS and whose 89 has a former name:
  - typing "xss" shows "also called: XSS" in 79's option, with that
    accessible name;
  - typing a former name shows "formerly: …";
  - typing "79" shows no via line.

- [ ] **Step 2: Run** `npx vitest run test/components/SearchBox.test.tsx`.
  Expected: FAIL.

- [ ] **Step 3: Implement** the component and the CSS. Then run
  `npm run lint:css`.

- [ ] **Step 4: Run** the test file and `npm run lint:css`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(search): show which other name matched`

### Task 6: Former view names in the View picker

**Files:**

- Modify: `src/components/Picker.tsx`, `src/components/FilterPanel.tsx`,
  `src/styles/filter.css`
- Test: `test/components/Picker.test.tsx`, `test/components/FilterPanel.test.tsx`

**Interfaces:**

- Consumes: `CweView.previousNames` (Task 1).
- `PickerOption` gains `formerLabels?: string[]`. An option matches when its
  label, its id or a former label contains the trimmed, lowercased query.
  The order is unchanged.
- An option that matched only through a former label shows
  `formerly: <name>` in a `picker__option-via` line. When several match,
  it shows the last one in the list, which is the newest. Its
  `aria-label` becomes `<label>, formerly <name>`, followed by
  `, deprecated` when that applies.
- `FilterPanel` passes `formerLabels: view.previousNames` for views, and
  nothing for groups.

- [ ] **Step 1: Write the failing tests** (real-world).
  - Picker: with an option
    `{ id: '1000', label: 'Complete Weakness Hierarchy (1000)', formerLabels: ['Natural Hierarchy', 'Research Concepts'] }`,
    typing "research" lists it with "formerly: Research Concepts" and that
    accessible name.
  - Typing "hierarchy" lists it with no via line.
  - Typing "nothing" shows "No matches".
  - FilterPanel: a view with `previousNames` is found in the View picker
    by its former name.

- [ ] **Step 2: Run** the two test files. Expected: FAIL.

- [ ] **Step 3: Implement** the change, styling the via line as in Task 5.

- [ ] **Step 4: Run** the test files and `npm run lint:css`. Expected: PASS.

- [ ] **Step 5: Commit** `feat(filter): find views by former names`

### Task 7: Alternate terms and former names in the detail panel

**Files:**

- Create: `src/components/AlternateTerms.tsx`, `src/components/FormerNames.tsx`
- Modify: `src/components/TechnicalNuance.tsx` (export its block rendering
  as `NuanceBlocks({ blocks }: { blocks: NuanceBlock[] })`, which
  `TechnicalNuance` uses)
- Modify: `src/components/DetailPanel.tsx`, `src/styles/detail.css`
- Test: `test/components/AlternateTerms.test.tsx`,
  `test/components/FormerNames.test.tsx`,
  `test/components/DetailPanel.test.tsx`

**Interfaces:**

- `AlternateTerms({ terms }: { terms: CweAlternateTerm[] })`:
  - a closed `<details className="alternate-terms">` with the summary
    `Alternate terms (N)`;
  - a `<dl>` with one `<dt>` per term, in MITRE order, bold in CSS, and
    a `<dd>` with `<NuanceBlocks>` only when the term has a description.
- `FormerNames({ names }: { names: CwePreviousName[] })`:
  - a closed `<details className="former-names">` with the summary
    `Former names (N)`;
  - one `<li>` per name, newest first by `date` (MITRE's order reversed on
    a tie), holding the name and `until <date>` in a muted second line.
- In `DetailPanel` the order is: description, `AlternateTerms`,
  `Dimensions`, `TechnicalNuance`, `FormerNames`, then the MITRE link.
  Each new disclosure is keyed by the node id
  (`key={`alternate-terms-${node.id}`}`, `key={`former-names-${node.id}`}`)
  so it closes when another CWE is selected.
- The CSS follows the `.dimensions` rules: same margins, `max-width: 60ch`
  and summary style.

- [ ] **Step 1: Write the failing tests** (real-world).
  - AlternateTerms: the summary reads "Alternate terms (3)"; the terms
    appear in order; a term without a description has no `dd`; a
    two-paragraph description renders two `p`.
  - FormerNames: with names dated 2008-04-11 and 2026-10-28, the 2026 one
    comes first, with "until 2026-10-28".
  - DetailPanel:
    - the five parts appear in the order above;
    - a node without the fields shows neither summary;
    - after opening both and selecting another CWE that has them, both are
      closed.

- [ ] **Step 2: Run** the three test files. Expected: FAIL.

- [ ] **Step 3: Implement** the components, the panel order and the CSS.

- [ ] **Step 4: Run** the three test files plus
  `test/components/TechnicalNuance.test.tsx` and `npm run lint:css`.
  Expected: PASS.

- [ ] **Step 5: Commit** `feat(detail): show alternate terms and former names`

### Task 8: Verify end to end and finish the PR

- [ ] **Step 1:** Run `npm run lint && npm run lint:md && npm run lint:css && npx tsc --noEmit && npm run test:coverage`.
  Expected: all pass, coverage thresholds met.
- [ ] **Step 2:** Run the app (`npm run dev`) at a 412×680 viewport and
  check each of these with the real 5.0 data:
  - "xss" lists CWE-79 first with "also called: XSS";
  - "csrf" finds 352;
  - "failure to sanitize" shows "formerly: …";
  - "research" in the View picker finds 1000;
  - CWE-89's panel shows both disclosures, in the spec's order, with no
    horizontal overflow.
- [ ] **Step 3:** Push. Confirm PR
  [#379](https://github.com/mureinik/cwe-visualizer/pull/379) is still
  open first. Read Codecov's patch comment and cover every missed or
  partial line in the changed code. Once CI is green, mark the PR ready
  (`gh pr ready 379`).
