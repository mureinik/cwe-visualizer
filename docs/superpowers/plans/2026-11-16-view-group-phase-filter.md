# View, Group and Phase Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reader narrow the landing panel, tree drawer, graph and search to one CWE view (optionally one of its groupings) and one introduction phase, set from a Filter panel and carried in the URL.

**Architecture:**

- **Build time:** `prepare-data.ts` extracts each weakness's introduction phases (`scripts/phases.ts`). It also resolves view and grouping membership (`scripts/views.ts`) into `cwe.json`, failing on data it doesn't expect.
- **App:** a pure filter module (`src/lib/filter.ts`) turns a `Filter` into a set of matching IDs, or `null` when nothing is filtered. Each surface takes that set as a prop. The filter's state lives in `App`, mirrored to the URL by `src/lib/filter-url.ts`.

**Tech Stack:** TypeScript, `fast-xml-parser` 5.12 (dev dependency, build time only), React, Vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-view-group-phase-filter-design.md`

## Global Constraints

- The app reads only `public/data/cwe.json`. No runtime fetch of anything else, and no MITRE contact.
- The existing catalog fields (nodes, edges, meta) parse exactly as today. Existing real-world tests must keep passing unchanged.
- The default filter: view `1000` ("Complete Weakness Hierarchy"), no group, no phase. With it, every surface renders exactly as today.
- A view is included when it is live (`Status` not `Deprecated` or `Obsolete`) and its `Type` is `Graph` or `Explicit`.
- Deprecated and obsolete weaknesses count as members and show marked, as today.
- A phase is identified by domain and name: standard `Testing` and AI `Testing` are distinct.
- One value per filter. Changing the view clears the group.
- The selected CWE is never hidden or faded by the filter.
- URL parameters `view`, `group` and `phase` sit next to `cwe` and are written with `replaceState`. The default view is never written.
- No new dependency.
- Every new test is classified (CONTRIBUTING, "Real-world and theoretical tests"), real-world when in doubt. Fixtures go in `test/fixtures/`.
- Verify with `npm run lint && npx tsc --noEmit && npm test`, plus `npm run lint:css` for CSS and `npm run lint:md` for Markdown. Run every command on Node 26: `source ~/.nvm/nvm.sh && nvm use 26 >/dev/null && …`.
- Commit messages are conventional (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never use `--no-verify`.

## Review Focus

1. **An entity in a custom phase** (`Implementation &amp; Physical Design`, CWE-1461) must read `Implementation & Physical Design` in the data, the picker and the URL round trip. The test goes in Task 1.
2. **A phase repeated across a weakness's introductions** (CWE-1461 lists the same custom phase twice) must appear once on the weakness and once in the picker. The test goes in Task 1.
3. **A filter with zero matches**, e.g. 2025 Top 25 plus Manufacturing. The landing panel says so and offers Clear; search says the filter is on; the tree drawer shows a message, not a blank. Tests go in Tasks 5 and 6.
4. **A selected CWE outside the filter.** It stays in the tree drawer with its ancestors, at full strength in the graph, and selected. Tests go in Tasks 6 and 7.
5. **A stale link**: `?view=9999&group=5&phase=Nope`. The bad values are dropped from the URL and named in the filter bar; a valid `cwe` in the same link still selects. The test goes in Task 5.

---

### Task 1: Read introduction phases at build time

**Files:**

- Modify: `src/lib/cwe-data.ts`, `scripts/prepare-data.ts`, `test/fixtures/cwec-sample.xml`
- Create: `src/lib/phases.ts`, `scripts/phases.ts`
- Test: `test/scripts/phases.test.ts` (`// @vitest-environment node`), `test/scripts/prepare-data.test.ts`, `test/lib/phases.test.ts`

**Interfaces:**

- Produces, in `src/lib/cwe-data.ts`:

  ```ts
  export interface CwePhase { name: string; domain?: string }
  // CweNode gains: phases?: CwePhase[]   (present only when non-empty)
  // CweData gains: phases?: CwePhase[]   (every phase some weakness is introduced in, in picker order)
  ```

  `CweData.phases` is optional so hand-built test data stays valid. `prepare-data` always writes it.
- Produces, in `src/lib/phases.ts`:
  - `phaseKey(p: CwePhase): string`. Returns `name`, or `` `${domain}:${name}` `` for a custom phase.
  - `phaseLabel(p: CwePhase): string`. Returns `name`, or `` `${name} (${domain})` ``.
- Produces, in `scripts/phases.ts`:
  - `readPhases(introductions: RawIntroduction[], cweId: string): CwePhase[]`. Returns the distinct phases (by `phaseKey`) in source order.
  - `orderPhases(phases: CwePhase[]): CwePhase[]`. Returns them distinct, in this order:
    1. standard phases first, in `PhaseEnumeration` order: Policy, Requirements, Architecture and Design, Implementation, Build and Compilation, Testing, Documentation, Bundling, Distribution, Installation, System Configuration, Operation, Patching and Maintenance, Porting, Integration, Manufacturing, Decommissioning and End-of-Life;
    2. then domain `AI`, in `AIPhaseEnumeration` order: Data Collection, Training, Fine-tuning, Testing, Tokenization, Prompting, Output Processing, Component Interaction, Re-training / Feedback;
    3. then `Hardware`, in `HardwarePhaseEnumeration` order: Hardware Requirements, Hardware Architecture, Hardware Microarchitecture, Implementation & Physical Design, Pre-Manufacturing Verification, Hardware Manufacturing, Post-Manufacturing Validation, Device Configuration & Personalization, Device / System Integration, Field Operations & Sustainment, Reuse, Decommissioning.

    A name not in its list goes after the known ones of its domain, alphabetically. An unknown domain goes after Hardware, ordered by domain then name.
  - `RawIntroduction` is `{ Phase?: unknown; Custom_Phase?: unknown }`, as `fast-xml-parser` gives it. A `Phase` is a string. A `Custom_Phase` is `{ '#text': string; '@_Domain': string }`, or a bare string when it has no attribute.

- [ ] **Step 1: Write the failing tests** (all real-world)

  `test/scripts/phases.test.ts`:

  - `'reads standard phases in source order'`: two introductions, `Phase: 'Implementation'` then `Phase: ['Architecture and Design', 'Operation']` → `[{ name: 'Implementation' }, { name: 'Architecture and Design' }, { name: 'Operation' }]`.
  - `'reads a custom phase with its domain'`: `Custom_Phase: { '#text': 'Training', '@_Domain': 'AI' }` → `[{ name: 'Training', domain: 'AI' }]`.
  - Review Focus 2, `'lists a repeated phase once'`: CWE-1461's shape, two introductions each with `Custom_Phase` Hardware `Implementation & Physical Design` → one entry.
  - `'keeps standard and AI Testing apart'`: `Phase: 'Testing'` plus AI `Testing` → two entries.
  - `'trims whitespace'`: `Phase: '  Implementation\n'` → `'Implementation'`.
  - Failures, with exact messages, for id `'123'`:
    - `Phase: ''` → `CWE-123: empty Phase in Modes_Of_Introduction`.
    - `Custom_Phase: 'Training'` → `CWE-123: Custom_Phase Training has no Domain`.
    - `Custom_Phase: { '@_Domain': 'AI' }` → `CWE-123: empty Custom_Phase in Modes_Of_Introduction`.
  - `'orders phases for the picker'`: input `[AI Training, Operation, Hardware Hardware Requirements, Policy, Implementation]` → `[Policy, Implementation, Operation, Training (AI), Hardware Requirements (Hardware)]`. An unknown standard name `Zeta` lands after Decommissioning and End-of-Life. Domain `Quantum` lands last.

  `test/lib/phases.test.ts`: `phaseKey` and `phaseLabel` for `{ name: 'Implementation' }` and `{ name: 'Training', domain: 'AI' }`.

  `test/scripts/prepare-data.test.ts`, against the fixture:

  - `'reads each weakness's introduction phases'`: CWE-79 gets `[{ name: 'Implementation' }, { name: 'Architecture and Design' }]`.
  - Review Focus 1, `'decodes an entity in a custom phase'`: CWE-80 gets `{ name: 'Implementation & Physical Design', domain: 'Hardware' }`, once (its two introductions repeat it).
  - `'lists every phase in use, in picker order'`: `data.phases` equals `[Architecture and Design, Implementation, Implementation & Physical Design (Hardware)]`.
  - `'leaves phases off a weakness with none'`: `'phases' in data.nodes['74']` is `false`.

- [ ] **Step 2: Extend the fixture**

  In `test/fixtures/cwec-sample.xml`, add `Modes_Of_Introduction` to:

  - CWE-79: two `Introduction`s, with `Phase`s `Implementation` and `Architecture and Design`;
  - CWE-80: two `Introduction`s, each `<Custom_Phase Domain="Hardware">Implementation &amp; Physical Design</Custom_Phase>`;
  - CWE-89: `Implementation`.

  Leave CWE-74 without any.

- [ ] **Step 3: Run the tests and confirm they fail**

  Run: `npx vitest run test/scripts/phases.test.ts test/lib/phases.test.ts test/scripts/prepare-data.test.ts`
  Expected: FAIL. The modules don't exist, and the phase assertions fail.

- [ ] **Step 4: Implement**

  - Write `src/lib/phases.ts` and `scripts/phases.ts`.
  - In `prepare-data.ts`, add `Modes_Of_Introduction?: { Introduction?: RawIntroduction | RawIntroduction[] }` to `RawWeakness`.
  - Assign `phases` conditionally, the way `technicalNuance` is.
  - Set `phases: orderPhases(all weaknesses' phases)` on the result.

- [ ] **Step 5: Run the tests and confirm they pass**

  Run: `npm run lint && npx tsc --noEmit && npm test`
  Expected: PASS, with the existing tests unchanged.

- [ ] **Step 6: Commit** — `feat: read introduction phases from the CWE catalog`

### Task 2: Resolve views and groupings at build time

**Files:**

- Modify: `src/lib/cwe-data.ts`, `scripts/prepare-data.ts`, `test/fixtures/cwec-sample.xml`, `CONTRIBUTING.md` (the `scripts/` list gains `phases.ts` and `views.ts`), `NOTICE.md` (the MITRE content list gains views and groupings)
- Create: `scripts/views.ts`
- Test: `test/scripts/views.test.ts` (`// @vitest-environment node`), `test/scripts/prepare-data.test.ts`

**Interfaces:**

- Produces, in `src/lib/cwe-data.ts`:

  ```ts
  export interface CweView { id: string; name: string; groupIds: string[]; memberIds: string[] }
  export interface CweGroup { id: string; name: string; status: string; membersByView: Record<string, string[]> }
  // CweData gains: views?: CweView[]; groups?: Record<string, CweGroup>
  ```

  Both are optional for hand-built test data. `prepare-data` always writes both.
- Produces, in `scripts/views.ts`:

  ```ts
  export interface RawHasMember { '@_CWE_ID'?: string; '@_View_ID'?: string }
  export interface RawGrouping { '@_ID': string; '@_Name'?: string; '@_Status'?: string; Relationships?: { Has_Member?: RawHasMember | RawHasMember[] } }
  export interface RawView { '@_ID': string; '@_Name'?: string; '@_Type'?: string; '@_Status'?: string; Members?: { Has_Member?: RawHasMember | RawHasMember[] } }
  export const DEFAULT_VIEW_ID = '1000';
  export function readViews(views: RawView[], groupings: RawGrouping[], weaknessIds: Set<string>): { views: CweView[]; groups: Record<string, CweGroup> };
  ```

- Rules (from the spec):
  - **Included views:** live, with `Type` `Graph` or `Explicit`.
  - **View 1000** is written with `groupIds: []` and `memberIds: []`. Ruling: the app treats the default view as "no view constraint", so its members (every weakness) aren't listed. That keeps the file small and the default identical to today.
  - **Any other included view:** start from its `Members/Has_Member` and walk.
    - A weakness ID is a member.
    - A grouping ID joins the view's `groupIds`, and the walk follows that grouping's `Relationships/Has_Member` links whose `@_View_ID` equals the view's ID. Links with another view ID are ignored.
    - A visited set guards against cycles.
    - `group.membersByView[viewId]` holds the weaknesses reached beneath that grouping, at any depth, within that view.
  - **Ordering and output:**
    - `memberIds` and each `membersByView` list are sorted numerically.
    - `groupIds` is ordered with live groupings first, then deprecated or obsolete ones, each by name (case-insensitive).
    - Views are ordered with 1000 first, then by name.
    - `groups` holds only groupings some included view reaches.
  - **Failures:**
    - A followed `Has_Member` whose ID is neither a weakness nor a grouping fails with `View 699: member CWE-12345 is not in the catalog`, or `Grouping 100 (view 699): member CWE-12345 is not in the catalog`.
    - One with no `CWE_ID` fails with `View 699: a member has no CWE_ID`, or the same with the `Grouping … (view …)` prefix.

- [ ] **Step 1: Write the failing tests** (all real-world)

  `test/scripts/views.test.ts`, with inline raw objects:

  - `'lists a view's weaknesses directly'`: a Top 25-shaped Graph view listing 79 and 89 → `memberIds ['79', '89']`, `groupIds []`.
  - `'resolves a view through nested groupings within that view only'`: view 699 → grouping 100. 100 has 79 (`View_ID 699`), grouping 101 (`699`) and 89 (`888`). 101 has 80 (`699`). Expect:
    - view 699: `memberIds ['79', '80']`, `groupIds` containing 100 and 101;
    - `groups['100'].membersByView['699']`: `['79', '80']`;
    - `groups['101'].membersByView['699']`: `['80']`.
  - `'keeps a grouping that sits in two views, per view'`: grouping 100 listed by views 699 and 1344, with different members per `View_ID` → two `membersByView` entries.
  - `'offers deprecated groupings after live ones'`: groupings named `B` (Draft) and `A` (Deprecated) → `groupIds` order B, A.
  - `'counts deprecated weaknesses as members'`: the walk doesn't filter on weakness status, since it gets IDs only. Assert a member listed in `weaknessIds` is kept.
  - `'leaves out implicit, deprecated and obsolete views, and groupings only they reach'`: an Implicit view, a Deprecated Graph view and an Obsolete Graph view → absent; their only grouping is absent from `groups`.
  - `'writes view 1000 first, without members'`: → `{ id: '1000', name: 'Complete Weakness Hierarchy', groupIds: [], memberIds: [] }` at index 0.
  - `'survives a cycle of groupings'`: 100 → 101 → 100 terminates.
  - Failures: the two exact messages above, for an unknown ID and for a missing `CWE_ID`, from both a view and a grouping.

  `test/scripts/prepare-data.test.ts`, against the fixture:
  - `data.views.map(v => v.id)` equals `['1000', '884', '699', '1435']`: 1000 first, then by name (CWE Cross-section, Software Development, Weaknesses in the 2025 CWE Top 25…). Use those names in the fixture.
  - `data.groups['100'].membersByView['699']` equals `['79', '80']`.
  - The implicit view `658` and the obsolete view `635` are absent.

- [ ] **Step 2: Extend the fixture**

  After `</Weaknesses>`, add `<Groupings>` and `<Views>` sections in the shapes the tests above need:

  - **Views:**
    - 1000 Graph, listing 74;
    - 699 Graph, listing grouping 100;
    - 1435 Graph, listing 79 and 89;
    - 884 Explicit, listing 74;
    - 658 Implicit, with a `<Filter>`;
    - 635 Obsolete Graph, listing grouping 102.
  - **Groupings:**
    - 100 Draft, as in the unit test;
    - 101 Deprecated, holding 80;
    - 102 Draft, holding 89 with `View_ID 635`.

  Every `Has_Member` carries `CWE_ID` and `View_ID`, as MITRE's do.

- [ ] **Step 3: Run the tests and confirm they fail**

  Run: `npx vitest run test/scripts/views.test.ts test/scripts/prepare-data.test.ts`
  Expected: FAIL.

- [ ] **Step 4: Implement**

  - Write `scripts/views.ts`.
  - In `prepare-data.ts`, add `Groupings?: { Grouping?: … }` and `Views?: { View?: … }` to `RawDocument`.
  - Call `readViews` with the weakness IDs, and write `views` and `groups`.
  - Update `CONTRIBUTING.md` and `NOTICE.md` as listed.

- [ ] **Step 5: Run the tests and confirm they pass**

  Run: `npm run lint && npx tsc --noEmit && npm test && npm run lint:md`
  Expected: PASS.

- [ ] **Step 6: Check against the real data**

  Run `npm run prepare-data`, then read `public/data/cwe.json`:
  - There are 31 views, with 1000 first.
  - View 1435 has 25 members.
  - View 699 has 40 `groupIds` and 405 members.
  - The phases list has 16 standard phases, then `Training (AI)`, then 2 Hardware phases.

  Report the numbers.

- [ ] **Step 7: Commit** — `feat: read views and groupings from the CWE catalog`

### Task 3: Filter model and URL

**Files:**

- Modify: `src/lib/graph.ts`
- Create: `src/lib/filter.ts`, `src/lib/filter-url.ts`
- Test: `test/lib/filter.test.ts`, `test/lib/filter-url.test.ts`, `test/lib/graph.test.ts`

**Interfaces:**

- Consumes: `CweView`, `CweGroup` and `CwePhase` (Tasks 1–2); `phaseKey` and `phaseLabel` (Task 1).
- Produces, in `graph.ts`: `Graph` gains `views: CweView[]`, `groups: Record<string, CweGroup>` and `phases: CwePhase[]`, copied by `buildGraph`. They default to `[]`, `{}` (null prototype) and `[]` when the data has none.
- Produces, in `src/lib/filter.ts`:

  ```ts
  export const DEFAULT_VIEW_ID = '1000';
  export interface Filter { viewId: string; groupId: string | null; phase: string | null } // phase is a phaseKey
  export const DEFAULT_FILTER: Filter;            // { viewId: '1000', groupId: null, phase: null }
  export function filterCount(filter: Filter): number;   // view (if not default) + group + phase
  export function matchingIds(graph: Graph, filter: Filter): Set<string> | null; // null when filterCount is 0
  export function withMatchPaths(graph: Graph, matches: Set<string>): Set<string>; // matches plus all their ancestors
  export function countMatchesBeneath(graph: Graph, id: string, matches: Set<string>): number; // distinct matching descendants, excluding id
  ```

  `matchingIds` works as follows:
  - **View:** the default view imposes nothing. With no group, a node must be in the view's `memberIds`. With a group, it must be in `groups[groupId].membersByView[viewId]`.
  - **Phase:** a node must have a phase whose `phaseKey` equals `phase`.
  - **Result:** `graph.all` filtered by both.
- Produces, in `src/lib/filter-url.ts`:

  ```ts
  export function readFilter(search: string, graph: Graph): { filter: Filter; dropped: string[] };
  export function writeFilter(params: URLSearchParams, filter: Filter): void;
  ```

  - `readFilter` drops values this graph doesn't know:
    - a `view` not in `graph.views`;
    - a `group` with no valid non-default view, or not in that view's `groupIds`;
    - a `phase` that is no key in `graph.phases`.

    Each one dropped adds `view 9999`, `group 5` or `phase Nope` to `dropped`. `view=1000` is accepted silently.
  - `writeFilter` sets or deletes `view`, `group` and `phase`, and never writes the default view. It leaves `cwe` alone.

- [ ] **Step 1: Write the failing tests** (all real-world)

  Build a small `Graph` from hand-made `CweData` with:
  - weaknesses 1 (pillar), 2 (child of 1, Implementation), 3 (child of 2, AI Testing), 4 (pillar), 5 (child of 4, Testing);
  - view 1000;
  - view 10 with members 3 and 5 and a group 20 (`membersByView { '10': ['3'] }`);
  - phases `[Implementation, Testing, Testing (AI)]`.

  Assert:

  - `matchingIds` is `null` for `DEFAULT_FILTER`.
  - View 10 → {3, 5}; view 10 with group 20 → {3}.
  - Phase `'Testing'` → {5}; `'AI:Testing'` → {3}. Review Focus: standard and AI Testing kept apart.
  - View 10 plus phase `'Implementation'` → empty set, not `null`.
  - View 1000 plus phase `'Implementation'` → {2}.
  - `filterCount`: 0 for the default; 2 for view 10 plus phase; 1 for view 1000 plus phase.
  - `withMatchPaths({3})` → {1, 2, 3}.
  - `countMatchesBeneath(1, {3, 5})` → 1; `countMatchesBeneath(4, {3, 5})` → 1.
  - `buildGraph` of data without views, groups or phases gives `views []`, `groups {}` and `phases []`.
  - `readFilter('?cwe=79&view=10&group=20&phase=AI%3ATesting')` → that filter, `dropped []`.
  - Review Focus 5:
    - `readFilter('?view=9999&group=5&phase=Nope')` → `DEFAULT_FILTER`, `dropped ['view 9999', 'group 5', 'phase Nope']`.
    - `'?group=20'` with no view → dropped `group 20`.
    - `'?view=1000'` → default, `dropped []`.
  - Round trip: `writeFilter` then `readFilter` gives back the same filter for `phase: 'Hardware:Implementation & Physical Design'`.
  - `writeFilter(DEFAULT_FILTER)` deletes all three parameters and keeps `cwe`.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run test/lib/filter.test.ts test/lib/filter-url.test.ts test/lib/graph.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement** the signatures above. Ruling: the app keeps its own `DEFAULT_VIEW_ID` in `filter.ts` rather than importing from `scripts/`, so `src/` doesn't depend on build scripts. Both say `'1000'`.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npm run lint && npx tsc --noEmit && npm test`
  Expected: PASS.

- [ ] **Step 5: Commit** — `feat: model the view, group and phase filter`

### Task 4: Filter-aware search and graph caps

**Files:**

- Modify: `src/lib/search.ts`, `src/lib/ego.ts`
- Test: `test/lib/search.test.ts`, `test/lib/ego.test.ts` (new cases only; existing ones unchanged)

**Interfaces:**

- Produces:
  - `searchNodes(graph, query, matches?: Set<string> | null)`. With a set, only matches are returned, in the existing order.
  - `EgoOptions.preferred?: Set<string>`. When given:
    - **Children:** preferred ones sort ahead of the rest before the cap, keeping the existing fan-out-then-ID order within each class.
    - **Laterals:** they sort by preferred first, then the existing direction-first rule, then ID.

    Without `preferred`, the output is identical to today.

- [ ] **Step 1: Write the failing tests** (real-world)
  - Search: with `matches {89}`, `searchNodes(graph, '9', matches)` returns only `89`. With `null`, the result is unchanged.
  - Ego:
    - A centre with 12 children and `childCap 10`, where the two lowest-ranked children are preferred → both are on the canvas, and `overflow.hiddenCount` is 2.
    - A centre with 6 non-directional laterals and `lateralCap 2`, with ID 6 preferred → 6 is placed.
    - Without `preferred`, a snapshot of the existing cases' output is unchanged. The existing tests already cover this; add none.

- [ ] **Step 2: Run the tests and confirm they fail.** Then **Step 3: implement**, and **Step 4: run `npm run lint && npx tsc --noEmit && npm test`** and confirm it passes.

- [ ] **Step 5: Commit** — `feat: let search and the graph's caps favour filter matches`

### Task 5: Filter state, URL, filter bar, landing panel and search

**Files:**

- Modify: `src/App.tsx`, `src/components/LandingPanel.tsx`, `src/components/SearchBox.tsx`, `src/components/AppHeader.tsx`, `src/styles/landing.css`, `src/styles/search.css`
- Create: `src/components/FilterBar.tsx`, `src/styles/filter.css` (imported where the other styles are)
- Test: `test/components/FilterBar.test.tsx`, `test/components/LandingPanel.test.tsx`, `test/components/SearchBox.test.tsx`, `test/App.test.tsx` (new cases)

**Interfaces:**

- Consumes: Task 3's filter model and URL functions; Task 4's `searchNodes(…, matches)`.
- **`App`:**
  - Once data loads, it reads `readFilter(window.location.search, graph)` into state. It rewrites the URL with `writeFilter` plus `replaceState`, so dropped values leave it.
  - It keeps `dropped` until the filter next changes.
  - It derives `matches = useMemo(() => matchingIds(graph, filter))`.
  - `setFilter(next)` updates state and the URL the same way.
  - It passes `filter`, `matches` and `setFilter` down. Task 8 adds the panel.
- **`FilterBar({ graph, filter, matchCount, dropped, onChange })`:**
  - **Visibility:** it renders nothing when `filterCount(filter) === 0` and `dropped` is empty.
  - **Chips:** one per set value, in the order view, group, phase:
    - The view chip shows the view's full name, truncated by CSS, with `title` set to the full name.
    - The group chip shows the grouping's name.
    - The phase chip shows its `phaseLabel`.
  - **Removing:**
    - Each chip has a remove button with `aria-label` `` `Remove filter: ${label}` ``.
    - Removing the view returns it to 1000 and clears the group. Removing the group or phase clears only that one.
  - **Count:** `` `${n} CWE${n === 1 ? '' : 's'}` ``, in a polite live region.
  - **Dropped values:** when `dropped` is non-empty, `` `Not in CWE ${graph.meta.cweVersion}, so ignored: ${dropped.join(', ')}` ``.
  - It renders inside `AppHeader`, under the header row.
- **`LandingPanel` gains `matches: Set<string> | null` and `onClearFilter: () => void`.** When `matches` is set:
  - It lists only roots `r` where `matches.has(r)` or `countMatchesBeneath(graph, r, matches) > 0`.
  - Each card's count reads `` `${m} of ${total}` ``, and the `aria-label` reads `…, ${m} of ${total} weaknesses beneath it match the filter`.
  - A root that isn't itself a match gets the class `pillar-card--context`, which subdues it.
  - With no matches at all, it replaces the list with `No CWEs match the filter.` and a `Clear filter` button that calls `onClearFilter`.
- **`SearchBox` gains `matches: Set<string> | null`.** It passes `matches` to `searchNodes`. When `matches` is set and there are no results, the empty row reads `No matches within the filter`.

- [ ] **Step 1: Write the failing tests** (real-world)
  - **FilterBar:** see the interface above.
    - It renders nothing for the default filter.
    - It shows the view and phase chips and `19 CWEs` for a view-plus-phase filter.
    - Removing the view chip calls `onChange` with `{ viewId: '1000', groupId: null, phase: <unchanged> }`.
    - For a filter of view 1000 plus a phase, it shows the phase chip only.
    - It shows the dropped text.
  - **LandingPanel:**
    - With `matches {79}`, only pillar 284 is listed, reading `1 of 2`, and it is subdued.
    - With an empty set, the panel shows the empty state, and its button calls `onClearFilter` (Review Focus 3).
    - With `null`, the existing tests pass unchanged.
  - **SearchBox:** with `matches {89}`, typing `79` shows `No matches within the filter`.
  - **App**, with a mocked `fetch` of a small dataset, as the existing App tests do:
    - Review Focus 5: `?cwe=79&view=9999` → CWE-79 is selected, the URL no longer has `view`, and the bar names `view 9999`.
    - `?view=10` → the bar shows the view chip.

- [ ] **Step 2: Run the tests and confirm they fail.** Then **Step 3: implement**, styling chips and the bar with existing tokens. Then **Step 4: run `npm run lint && npm run lint:css && npx tsc --noEmit && npm test`** and confirm it passes.

- [ ] **Step 5: Commit** — `feat: filter the landing panel and search, with a filter bar`

### Task 6: Filter the tree drawer

**Files:**

- Modify: `src/components/Tree.tsx`, `src/components/TreeDrawer.tsx`, `src/App.tsx`, `src/styles/tree.css`
- Test: `test/components/Tree.test.tsx`, `test/components/TreeDrawer.test.tsx` (new cases)

**Interfaces:**

- `Tree` and `TreeDrawer` gain `matches: Set<string> | null`. `App` passes it, and gives `Tree` a `key` derived from the filter (`` `${viewId}|${groupId}|${phase}` ``), so a filter change resets manual expand and collapse.
- When `matches` is set:
  - **Visible rows:** `withMatchPaths(graph, matches)`, plus the selected CWE and its ancestors (Review Focus 4). Roots, children and deprecated roots are all filtered to that set.
  - **Expansion:** every visible node with visible children starts expanded. The existing toggle still collapses it.
  - **Subdued rows:** a visible row that isn't a match gets the class `tree-label--context`, and its `aria-label` gains `, outside the filter`.
  - **Deprecated section:** it lists only matching deprecated roots and starts open. It is hidden when there are none.
  - **No matches:** the tree shows `No CWEs match the filter.`, plus the selected CWE's path if there is one.
- With `null`, behaviour is unchanged.

- [ ] **Step 1: Write the failing tests** (real-world)
  - With `matches {79}`, the tree shows 284 › 285 › 79 already open. Rows 284 and 285 have `, outside the filter` in their names; 707 is absent.
  - With `matches {79}` and `selectedId '707'`, 707 is present (Review Focus 4).
  - With `matches {71}` (deprecated orphan), the Deprecated section is open and shows 71. With `{79}`, the section is absent.
  - With an empty set, the tree shows `No CWEs match the filter.` (Review Focus 3).
  - Collapsing an auto-opened row works.

- [ ] **Step 2: Run the tests and confirm they fail.** Then **Step 3: implement**. Then **Step 4: run `npm run lint && npm run lint:css && npx tsc --noEmit && npm test`** and confirm it passes.

- [ ] **Step 5: Commit** — `feat: filter the tree drawer`

### Task 7: Fade non-matching CWEs in the graph

**Files:**

- Modify: `src/components/GraphStage.tsx`, `src/components/GraphNode.tsx`, `src/components/GraphEdge.tsx`, `src/App.tsx`, `src/styles/graph.css`
- Test: `test/components/GraphStage.test.tsx` (new cases)

**Interfaces:**

- `GraphStage` gains `matches: Set<string> | null`, and passes `preferred: matches ?? undefined` to `buildEgoGraph`.
- **Unmatched nodes:** a node is unmatched when `matches` is set, it isn't in `matches`, and it isn't the selected CWE.
  - `GraphNode` gains `unmatched: boolean`, which adds the class `graph-node--unmatched`.
  - Its `aria-label` gains `, outside the filter`.
- **Unmatched edges:** an edge is unmatched when either end is an unmatched node. `GraphEdge` and `GraphEdgeLabel` gain `unmatched: boolean`, which adds `graph-edge-group--unmatched`.
- **Styling:** the fade is its own opacity, distinct from the hover `--dimmed` one (0.25). It must stay distinguishable when both apply: the builder picks values, and both classes may stack.

- [ ] **Step 1: Write the failing tests** (real-world)
  - With `matches {80}` and CWE-79 selected:
    - the node for 80 has no `--unmatched` class;
    - 74 has `graph-node--unmatched` and an aria-label ending `, outside the filter`;
    - 79 (selected, not a match) has no `--unmatched` (Review Focus 4);
    - the 79–74 edge group has `--unmatched`.
  - With `null`, no `--unmatched` class appears anywhere.

- [ ] **Step 2: Run the tests and confirm they fail.** Then **Step 3: implement**. Then **Step 4: run `npm run lint && npm run lint:css && npx tsc --noEmit && npm test`** and confirm it passes.

- [ ] **Step 5: Commit** — `feat: fade CWEs outside the filter in the graph`

### Task 8: Filter button and panel

**Files:**

- Modify: `src/components/AppHeader.tsx`, `src/App.tsx`, `src/styles/filter.css`
- Create: `src/components/FilterPanel.tsx`, `src/components/Picker.tsx`
- Test: `test/components/FilterPanel.test.tsx`, `test/components/Picker.test.tsx`, `test/components/AppHeader.test.tsx` (new cases)

**Interfaces:**

- **`Picker({ label, options, value, onChange, disabled? })`:**
  - `options` is `{ id: string; label: string; deprecated?: boolean }[]`.
  - It is a combobox in the style and keyboard model of `SearchBox`:
    - typing narrows the options by case-insensitive substring of `label` or `id`;
    - arrows move the active option, Enter picks it, and Escape closes.
  - It shows the current option's label when closed.
  - Deprecated options render with the deprecated styling `SearchBox` uses for deprecated CWEs, and keep their given order.
- **`FilterPanel({ graph, filter, onChange, narrow })`:**
  - **View:** a `Picker` labelled `View`. Its options are `graph.views`, labelled `` `${name} (${id})` ``, with 1000 first, as the data orders them. Choosing a view sets `viewId` and clears `groupId`.
  - **Group:** a `Picker` labelled `Group`. Its options are the chosen view's `groupIds`, mapped through `graph.groups`, with `deprecated` set from status. It is disabled when the view has no groups.
  - **Phase:** a native `<select>` labelled `Phase`. Its first option is `Any phase` (value `''`); then come `graph.phases`, by `phaseLabel`, with values from `phaseKey`.
  - **Clearing:** each of group and phase has a clear button, the view has `Show all CWEs` (back to 1000), and there is a `Clear all`.
  - **No Apply button:** every change calls `onChange` immediately.
- **Filter button:** in `AppHeader`, after the search box.
  - Its text is `Filter`, plus a badge showing `filterCount` when it is non-zero.
  - `aria-label`: `Filter` when nothing is set, otherwise `` `Filter, ${n} set` ``.
  - It has `aria-expanded` and `aria-controls`.
- **Opening and closing:**
  - It toggles the panel. Outside click and Escape close it, returning focus to the button, the same way `ReleaseSwitcher` does.
  - Wide, the panel drops down under the button.
  - Narrow (`NARROW_QUERY`), it is a bottom sheet styled like the detail panel's phone sheet, with a close button.

- [ ] **Step 1: Write the failing tests** (real-world)
  - **Picker:**
    - Typing `top` narrows the options to the Top 25 option.
    - ArrowDown then Enter calls `onChange` with its id.
    - Escape closes it.
    - When disabled, the input is disabled.
  - **FilterPanel:**
    - Choosing a view calls `onChange` with that view and `groupId: null`.
    - The Group picker is disabled for view 1000 and lists view 699's groupings with the deprecated one last.
    - Choosing `Testing (AI)` gives `phase: 'AI:Testing'`.
    - `Clear all` gives `DEFAULT_FILTER`.
  - **AppHeader:**
    - The button reads `Filter` with no badge for the default filter, and `Filter, 2 set` for view plus phase.
    - Clicking opens the panel; Escape closes it and focuses the button.

- [ ] **Step 2: Run the tests and confirm they fail.** Then **Step 3: implement**.

- [ ] **Step 4: Verify**
  - Run `npm run lint && npm run lint:css && npx tsc --noEmit && npm test` and confirm it passes.
  - Run `npm run test:coverage`. The new components must be fully covered.

- [ ] **Step 5: Check in the browser.** Run `npm run prepare-data`, then the dev server, at 1280×800 and 412×680, in light and dark. Check each of these:
  - Choose 2025 Top 25 plus Implementation. The landing panel lists only the pillars that have a match. The tree opens on the matches. Search finds only matches. The graph fades CWEs that don't match, and the selected CWE stays at full strength.
  - Choose a group of view 699.
  - Clear the filter from a chip and from `Clear all`.
  - Reload a filtered URL; the filter comes back.
  - On the phone, the sheet fits, and the header and filter bar don't overflow.

  Report what you saw.

- [ ] **Step 6: Commit** — `feat: add the filter button and panel`
