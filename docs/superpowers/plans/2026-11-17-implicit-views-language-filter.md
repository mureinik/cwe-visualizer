# Implicit Views and Language Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer five of CWE's implicit (XPath-filter) views in the View picker, and add a Language filter with an opt-in "any language" checkbox and a note saying the class mapping is ours.

**Architecture:**

- **Build time:** `scripts/implicit-views.ts` parses the XML a second time with `@xmldom/xmldom`, removes the default namespace, and runs each offered view's `Filter` with `xpath`; `readViews` takes the result as members. `scripts/languages.ts` reads `Applicable_Platforms/Language` from the existing fast-xml-parser pass and applies our class-to-language mapping. Both fail the build on anything unexpected.
- **App:** `Filter` gains `language` and `anyLanguage`. `matchingIds` ANDs the language set with view, group and phase. The panel gets a Language row, the bar a chip, the URL two parameters.

**Tech Stack:** TypeScript, fast-xml-parser 5.12, `xpath` 0.0.36 and `@xmldom/xmldom` 0.9.12 (new dev dependencies, build time only), React, Vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-17-implicit-views-language-filter-design.md`

## Global Constraints

- The app reads only `public/data/cwe.json`; no XPath and no new dependency at runtime. `xpath` and `@xmldom/xmldom` go in `devDependencies`, exact versions above.
- Offered implicit views: `919`, `1424`, `678`, `709`, `1040`. Skipped: `658`, `659`, `660`, `661`, `701`, `702`, `677`, `2000`, `604`, `1081`, each with its reason from the spec's table.
- Class-to-language mapping, verbatim from the spec: Memory-Unsafe → C, C++; Compiled → C, C++, Go, Rust; Interpreted → Python, PHP, Perl, Ruby, JavaScript; Object-Oriented → C++, Java, C#, Python, PHP, Ruby, VB.NET, JavaScript; Hardware Description Language → Verilog, VHDL; Not Language-Specific → none (the checkbox); Assembly → none.
- Known language names: C, C++, Java, Python, Go, PHP, C#, Verilog, VHDL, Perl, JavaScript, ASP.NET, SQL, Ruby, XML, Rust, VB.NET, Other. "Other" is never offered.
- A language is offered only when it has members. Languages are sorted by name.
- URL parameters `language=<name>` and `anyLanguage=1`, written with `replaceState` like the others.
- Copy, exact: picker label `Language`, empty option `Any language`, clear button `Clear language`, checkbox `Also show weaknesses that apply to any language (+N)`, note `Weaknesses MITRE ties to <name>, or to <classes> languages. Which languages count as which is our call, not MITRE's.` (no classes: `Weaknesses MITRE ties to <name>.`), chip `<name>` or `<name> + any language`.
- Adding `language: null, anyLanguage: false` to existing `Filter` literals in tests is a type-only edit, not a behaviour change; make no other change to an existing real-world test unless a task says so.
- Every new test is classified (CONTRIBUTING, "Real-world and theoretical tests"), real-world when in doubt. Fixtures go in `test/fixtures/`.
- Verify with `npm run lint && npx tsc --noEmit && npm test`, plus `npm run lint:css` for CSS and `npm run lint:md` for Markdown. Run on Node 26: `source ~/.nvm/nvm.sh && nvm use 26 >/dev/null && …`.
- Commits are conventional and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never use `--no-verify`. After each task, push the branch `feat/implicit-views-language-filter` (draft PR #338) after checking the PR is still open.

## Review Focus

1. **`C++` and `C#` in the URL.** Picking C++ and reloading must restore C++; `writeFilter` must encode `+` and `#`. Test in Task 4.
2. **Changing the view or removing the view chip keeps the language.** Only the group belongs to the view. Tests in Tasks 4 and 6.
3. **The real catalog's default namespace.** A filter must still match when the root has `xmlns="http://cwe.mitre.org/cwe-8"`. The fixture carries it, tested in Tasks 1 and 3.
4. **`?anyLanguage=1` with no or an unknown language** is dropped and named, never silently kept. Test in Task 4.
5. **The checkbox count when every agnostic weakness is already a member** reads `(+0)` and the checkbox still works. Test in Task 5.

---

### Task 1: Evaluate implicit views

**Files:**

- Modify: `package.json`, `package-lock.json` (via `npm install -D -E xpath@0.0.36 @xmldom/xmldom@0.9.12`)
- Create: `scripts/implicit-views.ts`
- Modify: `scripts/views.ts` (`RawView` gains `Filter?: string`)
- Test: `test/scripts/implicit-views.test.ts`

**Interfaces:**

- Produces:
  - `OFFERED_IMPLICIT_VIEWS: ReadonlySet<string>`
  - `SKIPPED_IMPLICIT_VIEWS: Readonly<Record<string, string>>`: id → reason
  - `evaluateImplicitViews(xmlText: string, views: RawView[], weaknessIds: Set<string>, lists?: { offered: ReadonlySet<string>; skipped: Readonly<Record<string, string>> }): Map<string, string[]>`: offered view id → member ids sorted numerically. `lists` defaults to the two constants.

- [ ] **Step 1: Install the dependencies** and confirm `package.json` lists both under `devDependencies` with exact versions.

- [ ] **Step 2: Write the failing tests** (real-world; build small XML strings in the test, with the root `<Weakness_Catalog xmlns="http://cwe.mitre.org/cwe-8">`):
  - `matches weaknesses through a namespaced catalog`: a view with filter `/Weakness_Catalog/Weaknesses/Weakness[./Applicable_Platforms/Technology/@Class='Mobile']` over weaknesses 1 (Mobile) and 2 (not) → `Map { '919' => ['1'] }`.
  - `sorts members numerically`: matches 100, 20, 3 → `['3', '20', '100']`.
  - `ignores skipped and retired implicit views`: a skipped live view and a Deprecated one with `/Weakness_Catalog[false()]` are absent from the result.
  - `fails on a live implicit view on neither list` → throws `/View 9999: implicit view is neither offered nor skipped/`.
  - `fails on an offered view missing from the catalog` → `/View 919: offered implicit view is missing/`.
  - `fails on an offered view that is retired or no longer implicit` → `/View 919: offered implicit view is Deprecated/` and `/View 919: offered implicit view is Graph/`.
  - `fails on a filter that does not evaluate` (`/Weakness_Catalog[`) → `/View 919: filter does not evaluate/`.
  - `fails on a filter that matches nothing` → `/View 919: filter matches no weaknesses/`.
  - `fails on a match that is not a known weakness` (a filter selecting `/Weakness_Catalog/Categories/Category`) → `/View 919: filter matches .* which is not a weakness/`.

  Pass `lists` to keep each case to one or two views.

- [ ] **Step 3: Run** `npx vitest run test/scripts/implicit-views.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `scripts/implicit-views.ts`.** Remove only the root element's default `xmlns="…"` declaration from the text, parse with `new DOMParser().parseFromString(text, 'text/xml')`, and run each filter with `xpath.select`. A match counts when it is an element named `Weakness` whose `ID` is in `weaknessIds`. Write the skip reasons as the values of `SKIPPED_IMPLICIT_VIEWS`, matching the spec's table. Retired means `Status` `Deprecated` or `Obsolete`.

- [ ] **Step 5: Run** the test file again. Expected: PASS. Then run the full verification.

- [ ] **Step 6: Commit** `feat: evaluate CWE implicit views at build time`, and push.

### Task 2: Read languages

**Files:**

- Create: `scripts/languages.ts`
- Modify: `src/lib/cwe-data.ts`
- Test: `test/scripts/languages.test.ts`

**Interfaces:**

- Produces:
  - In `cwe-data.ts`: `export interface CweLanguage { name: string; classes: string[]; memberIds: string[] }`. `CweData` gains the optional fields `languages?: CweLanguage[]` and `languageAgnosticIds?: string[]`, each with a doc comment like `views`.
  - In `languages.ts`:
    - `export interface RawLanguage { '@_Name'?: string; '@_Class'?: string; '@_Prevalence'?: string }`;
    - `export const LANGUAGE_CLASSES: Readonly<Record<string, readonly string[]>>`, the mapping, in the order of Global Constraints;
    - `export const KNOWN_LANGUAGES: ReadonlySet<string>`;
    - `export function readLanguages(weaknesses: { id: string; languages: RawLanguage[] }[]): { languages: CweLanguage[]; languageAgnosticIds: string[] }`.
  - A language's `classes` lists the classes mapped to it, in mapping order, e.g. C → `['Memory-Unsafe', 'Compiled']`. Member ids are sorted numerically.

- [ ] **Step 1: Write the failing tests** (real-world):
  - `matches a language by name and through its classes`: 1 names C, 2 has class Memory-Unsafe, 3 has class Interpreted. C → `memberIds ['1', '2']`, `classes ['Memory-Unsafe', 'Compiled']`. C++ → `['2']`. Python → `['3']`.
  - `lists Not Language-Specific weaknesses as agnostic, not as members`.
  - `offers only languages with members, sorted by name, never Other`: with only `Other` and `SQL` named, it offers just SQL, with `classes []`.
  - `counts a weakness once per language`: a weakness naming C that also has Memory-Unsafe appears once in C.
  - `fails on an unknown language name` → `/CWE-1: unknown language "Kotlin"/`.
  - `fails on an unknown class` → `/CWE-1: unknown language class "Functional"/`.
  - `fails on a Language with neither Name nor Class` → `/CWE-1: a Language has no Name or Class/`.
  - `maps only to known languages`: every value in `LANGUAGE_CLASSES` is in `KNOWN_LANGUAGES`.

- [ ] **Step 2: Run** `npx vitest run test/scripts/languages.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `readLanguages` in `scripts/languages.ts`, strict like `phases.ts`.

- [ ] **Step 4: Run** the test file, then the full verification. Expected: PASS.

- [ ] **Step 5: Commit** `feat: read programming languages from Applicable_Platforms`, and push.

### Task 3: Wire both into the build

**Files:**

- Modify: `scripts/views.ts` (`readViews` gains a 4th parameter, `implicitMembers: Map<string, string[]> = new Map()`)
- Modify: `scripts/prepare-data.ts` (`RawWeakness` gains `Applicable_Platforms?: { Language?: RawLanguage | RawLanguage[] }`; `parseCatalog`; `readLocalMeta`)
- Modify: `test/fixtures/cwec-sample.xml`
- Modify: `CONTRIBUTING.md` (add `implicit-views.ts` and `languages.ts` to the list of what `scripts/` holds)
- Test: `test/scripts/views.test.ts`, `test/scripts/prepare-data.test.ts`

**Interfaces:**

- Consumes: `evaluateImplicitViews` (Task 1), `readLanguages` (Task 2).
- Produces: `cwe.json` with the offered implicit views in `views`, plus `languages` and `languageAgnosticIds`.

- [ ] **Step 1: Update the fixture.**
  - Root element gains `xmlns="http://cwe.mitre.org/cwe-8"`.
  - Rewrite view 658's filter to the real shape: `/Weakness_Catalog/Weaknesses/Weakness[./Applicable_Platforms/Language/@Name='C']`.
  - Add the five offered views, with Status `Draft`, their real names and the real filters from the spec's measurements. Make each match one weakness:
    - 74: `Structure="Chain"` (709), class Not Language-Specific;
    - 80: `Structure="Composite"` (678), class Compiled;
    - 79: named C, class Not Language-Specific, Technology `Class="Mobile"` (919);
    - 89: named SQL, class Memory-Unsafe, a `Taxonomy_Mapping Taxonomy_Name="ISA/IEC 62443"` (1424), `Weakness_Ordinality` `Indirect` (1040).

- [ ] **Step 2: Write the failing tests.**
  - `views.test.ts` (real-world): `offers an implicit view with the members it is given`. Implicit view 919 with `implicitMembers` `{ '919' => ['79'] }` → `{ id: '919', name: 'View 919', groupIds: [], memberIds: ['79'] }`. The existing "leaves out implicit…" test stays unchanged, since it passes no members.
  - `prepare-data.test.ts`:
    - Update `lists the included views, 1000 first and the rest by name`, an intended change. It now expects `['1000', '678', '884', '709', '1040', '699', '1424', '919', '1435']`.
    - New: `offers the implicit views with the members their filters match`: 919 → `['79']`, 1424 → `['89']`, 678 → `['80']`, 709 → `['74']`, 1040 → `['89']`.
    - New: `reads languages`. Expect C `['79', '80', '89']`, C++ `['80', '89']`, Go `['80']`, Rust `['80']` and SQL `['89']`, in that order, and `languageAgnosticIds` `['74', '79']`.
    - New: `re-downloads data cached before languages existed`, modelled on the `catalogDate` test at line 280. Delete `languages` from the cached `cwe.json` and expect a download.
    - `leaves out an implicit view and an obsolete one` stays unchanged: 658 is skipped.

- [ ] **Step 3: Run** `npx vitest run test/scripts`. Expected: the new tests FAIL.

- [ ] **Step 4: Implement.**
  - `readViews`: an Implicit view with an entry in `implicitMembers` is included, with those members and no groups. Without an entry it stays excluded.
  - `parseCatalog`: call `evaluateImplicitViews(xmlText, …)` and `readLanguages(…)`, and write `languages` and `languageAgnosticIds`.
  - `readLocalMeta`: return `null` when the parsed `cwe.json` has no `languages` array.

- [ ] **Step 5: Run** the full verification, and `npm run lint:md`. Then check against the real catalog: `rm -rf public/data && npm run prepare-data`. It must succeed. Then check with `node -e` that `public/data/cwe.json` has the five offered views with 21, 39, 4, 3 and 114 members (919, 1424, 678, 709, 1040), and that C has 106 members, with 849 once the agnostic weaknesses are added.

- [ ] **Step 6: Commit** `feat: write implicit views and languages into cwe.json`, and push.

### Task 4: Matching and the URL

**Files:**

- Modify: `src/lib/graph.ts` (`Graph` gains `languages: CweLanguage[]` and `languageAgnosticIds: string[]`, defaulting to `[]`)
- Modify: `src/lib/filter.ts`, `src/lib/filter-url.ts`
- Modify: `test/fixtures/filter-data.ts`, `test/fixtures/views-data.ts`
- Test: `test/lib/filter.test.ts`, `test/lib/filter-url.test.ts`, `test/lib/graph.test.ts`

**Interfaces:**

- Produces:
  - `Filter` gains `language: string | null` and `anyLanguage: boolean`. `DEFAULT_FILTER` has `language: null` and `anyLanguage: false`.
  - `filterCount` counts a set language as 1.
  - `export function agnosticExtra(graph: Graph, language: string): number`: how many agnostic ids are not already the language's members.
  - `writeFilter` writes `language`, and `anyLanguage=1` only when `anyLanguage` is true with a language set.

- [ ] **Step 1: Extend the fixtures and the existing `Filter` literals** (type-only).
  - `filter-data.ts`: `languages: [{ name: 'C', classes: ['Memory-Unsafe', 'Compiled'], memberIds: ['2', '3'] }, { name: 'C++', classes: ['Memory-Unsafe'], memberIds: ['5'] }]` and `languageAgnosticIds: ['1', '2', '4']`.
  - `views-data.ts`: `languages: [{ name: 'C', classes: ['Memory-Unsafe', 'Compiled'], memberIds: ['79'] }, { name: 'SQL', classes: [], memberIds: ['89'] }]` and `languageAgnosticIds: ['79', '321']`.

- [ ] **Step 2: Write the failing tests** (all real-world).
  - `filter.test.ts`:
    - `keeps a language's members`: C → `{2, 3}`.
    - `adds agnostic weaknesses with anyLanguage`: C → `{1, 2, 3, 4}`.
    - `ANDs the language with the view`: view 10 + C → `{3}`.
    - `ignores anyLanguage without a language`: returns `null`.
    - `counts the language as one filter, with or without the checkbox`.
    - `agnosticExtra counts only weaknesses not already members`: C → 2.
  - `filter-url.test.ts`:
    - `reads a language and anyLanguage`.
    - `round-trips C++ and C#`: write, then read back from `params.toString()`.
    - `drops an unknown language, naming it`: `language Kotlin`.
    - `names an unusual language only generically`: with the safe pattern `/^[A-Za-z0-9 +#.]{1,20}$/`.
    - `drops anyLanguage without a known language`: the dropped list contains `any language`.
    - `drops an anyLanguage other than 1`.
    - `keeps the language when the view is unknown`.
  - `graph.test.ts`: `defaults languages and languageAgnosticIds to empty`. This is theoretical (reason 3: prepare-data always writes them), in a nested tagged `describe`.

- [ ] **Step 3: Run** `npx vitest run test/lib`. Expected: the new tests FAIL.

- [ ] **Step 4: Implement** the Interfaces above in `graph.ts`, `filter.ts` and `filter-url.ts`.

- [ ] **Step 5: Run** the full verification. Expected: PASS.

- [ ] **Step 6: Commit** `feat: filter by language`, and push.

### Task 5: Language row in the filter panel

**Files:**

- Create: `src/lib/languages.ts`
- Modify: `src/components/FilterPanel.tsx`, `src/styles/filter.css`
- Test: `test/lib/languages.test.ts`, `test/components/FilterPanel.test.tsx`

**Interfaces:**

- Consumes: `Filter`, `agnosticExtra` (Task 4).
- Produces: `export function languageNote(language: CweLanguage): string`. Each class's phrase is the class lowercased, with a trailing `language` removed: `memory-unsafe`, `compiled`, `object-oriented`, `hardware description`. The phrases are joined `a`, `a or b`, or `a, b or c`.

- [ ] **Step 1: Write the failing tests** (real-world).
  - `languages.test.ts`:
    - C → `Weaknesses MITRE ties to C, or to memory-unsafe or compiled languages. Which languages count as which is our call, not MITRE's.`
    - C++ with Memory-Unsafe, Compiled and Object-Oriented → `…or to memory-unsafe, compiled or object-oriented languages.…`
    - Verilog → `…or to hardware description languages.…`
    - SQL → `Weaknesses MITRE ties to SQL.`
  - `FilterPanel.test.tsx`:
    - `offers Any language, then each language by name, between Group and Phase`.
    - `sets the language and keeps the view and group`.
    - `clears the language and anyLanguage when Any language is chosen`.
    - `shows the checkbox and the note only once a language is chosen`: the checkbox's accessible name is `Also show weaknesses that apply to any language (+1)` for C on `views-data`, and the select is described by the note (`toHaveAccessibleDescription`).
    - `ticks anyLanguage`.
    - `keeps anyLanguage when the language changes`.
    - `shows (+0) when every agnostic weakness is already a member`: use a graph built from `views-data` with `languageAgnosticIds: ['79']`.
    - `Clear language clears both and focuses the language list`.
    - Extend `clears everything with Clear all`, an intended change: the expected `DEFAULT_FILTER` now includes the language fields, and the test starts from a filter with a language set.

- [ ] **Step 2: Run** the two test files. Expected: FAIL.

- [ ] **Step 3: Implement.**
  - The row is a plain `<select>` built the same way as Phase, with a Clear button that uses the existing `clear` helper.
  - The checkbox and the note sit under it, inside the same `.filter-panel__field`. The note's `id` goes on the select's `aria-describedby`.
  - Style the note as secondary text with the existing tokens. Don't add a fallback in `var()`.

- [ ] **Step 4: Run** the full verification plus `npm run lint:css`. Then run `npm run dev` and check the panel at 1280×800 and at 412×680 (the phone sheet scrolls, so the requirement is no horizontal overflow), in both themes.

- [ ] **Step 5: Commit** `feat: add a language picker to the filter panel`, and push.

### Task 6: Language chip in the filter bar

**Files:**

- Modify: `src/components/FilterBar.tsx`
- Test: `test/components/FilterBar.test.tsx`

**Interfaces:**

- Consumes: `Filter` (Task 4).

- [ ] **Step 1: Write the failing tests** (real-world):
  - `shows a language chip`: `C`, or `C + any language` when `anyLanguage` is set. It sits after the group chip and before the phase chip.
  - `clears the language and anyLanguage when the language chip is removed`.
  - `keeps the language when the view chip is removed`.

- [ ] **Step 2: Run** the test file. Expected: FAIL.

- [ ] **Step 3: Implement** the chip in `chipsFor`, with key `language`.

- [ ] **Step 4: Run** the full verification. Then check in `npm run dev` that a C++ link survives a reload, and that switching release to v1.1 ignores the language.

- [ ] **Step 5: Commit** `feat: show the language filter in the filter bar`. Push, then mark PR #338 ready with `gh pr ready 338`, after checking it is still open.
