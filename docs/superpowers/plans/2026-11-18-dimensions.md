# Dimensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show CWE 5.0's `Dimensions` on weaknesses (a closed disclosure in
the detail panel) and on relations (the relation chip and the graph edge's
tooltip), as display-only data.

**Architecture:**

- The build reads `Dimensions` into `cwe.json`, on `CweNode` and on the
  `CweEdge` where MITRE states them, sorted and checked strictly.
- `buildGraph` indexes the stated edges' dimensions. A lookup resolves a
  relation from either end.
- Shared, pure helpers in `src/lib/dimensions.ts` order and format them
  for the panel, the chip and the tooltip.

**Tech Stack:** TypeScript, React, Vitest with Testing Library, and
`fast-xml-parser`, which is already a dependency.

**Spec:** `docs/superpowers/specs/2026-11-18-dimensions-design.md`

## Global Constraints

- **The schema's 18 types, in this order:** Behavior-Type,
  Behavior-Property, Resource-Type, Resource-Property, Input-Type,
  Input-Property, Info-Type, Info-Property, Code-Type, Code-Property,
  Technology, Language-Type, Language-Property, Framework, Common-Name,
  Attack, Acronym, Other.
- **Values:** verbatim apart from whitespace. Every run of spaces, tabs
  and newlines becomes one space, and the value is trimmed. `"Asymmetric`
  keeps its quote.
- **Ordering:** sorted by the type's schema position. Entries of one type
  keep MITRE's order.
- **Absent, not empty:** `dimensions` is present only when non-empty, on
  both nodes and edges.
- **Stored once:** dimensions live only on the edge MITRE states them on.
  Synthesized inverse edges in `relatedTo` carry none.
- **Exact copy:**
  - the disclosure's summary is "Dimensions";
  - its first line is "The parts MITRE built this weakness's name from.";
  - values of one type are joined with "; " in the disclosure and " · "
    on the chip;
  - the chip's accessible name and title begin "Differs by: ";
  - type labels: the hyphen becomes a space and the second word is
    lowercased ("Behavior type", "Common name", "Other").
- **Placement:** the disclosure goes after the description and before
  Technical nuance. It closes when another CWE is selected.
- **Not a filter:** no change to search, the filter, the URL or edge
  labels.
- **No new dependency.** The app never contacts MITRE. `public/data/` is
  build output.
- **Tests:** every new test is classified real-world or theoretical
  (`{ tags: ['theoretical'] }`). Real-world is the default when in doubt.
  Existing real-world tests change only where this plan says so.
- **Verify:** `source ~/.nvm/nvm.sh && nvm use 26`, then
  `npm run lint && npx tsc --noEmit && npm test`.

## Review Focus

- **Data with no dimensions at all** (4.x releases, and 89% of 5.0's
  weaknesses): the panel, chips and tooltips are exactly as today. Owned
  by Tasks 4, 5 and 6.
- **A long chip line on a phone,** such as CWE-201 → 209 with four
  values: it wraps inside the chip, with no sideways overflow at 412 px.
  Owned by Task 7's visual check.
- **A chip outside the filter that has dimensions:** its accessible name
  keeps ", outside the filter" and adds the dimensions. Owned by Task 5.
- **A flashed chip that has dimensions:** the flash still finds, focuses
  and scrolls to it. Owned by Task 5.
- **A directional lateral drawn reversed** (CanFollow / CanPrecede): the
  tooltip finds the dimensions from either end. Owned by Task 6.

---

### Task 1: Shared types and helpers

**Files:**

- Modify: `src/lib/cwe-data.ts`
- Create: `src/lib/dimensions.ts`
- Test: `test/lib/dimensions.test.ts`

**Interfaces:**

- Produces, in `src/lib/cwe-data.ts`:
  - `interface CweDimension { type: string; value: string }`;
  - `CweNode.dimensions?: CweDimension[]` and
    `CweEdge.dimensions?: CweDimension[]`, documented as in the spec's
    Data section;
  - `CweData.dataFormat?: number`;
  - `export const DATA_FORMAT = 2`, the version of `cwe.json`'s shape.
    Its comment says to bump it whenever the build starts writing
    something a cached file would lack.
- Produces, in `src/lib/dimensions.ts`:
  - `DIMENSION_TYPES: readonly string[]`, the 18 in schema order;
  - `isDimensionType(type: string): boolean`;
  - `dimensionTypeLabel(type: string): string`;
  - `mergeDimensions(...lists: readonly (readonly CweDimension[])[]): CweDimension[]`:
    concatenates the lists, keeps the first of each type and value pair,
    then stable-sorts by schema position;
  - `interface DimensionRow { label: string; values: string[] }` and
    `dimensionRows(dims: readonly CweDimension[]): DimensionRow[]`: one
    row per type, in the order of the input;
  - `interface TypedDimensions { type: string; dimensions: CweDimension[] }`,
    where `type` is a relation type such as "ChildOf";
  - `chipDimensionLine(groups: readonly TypedDimensions[]): string`;
  - `differsBy(groups: readonly TypedDimensions[]): string`;
  - `edgeTitle(types: readonly string[], groups: readonly TypedDimensions[]): string`.

- [ ] **Step 1: Write the failing tests** (all real-world) in
  `test/lib/dimensions.test.ts`:
  - `DIMENSION_TYPES` equals the 18 from Global Constraints, in order.
    `isDimensionType('Behavior-Type')` is true. `isDimensionType('Behaviour-Type')`
    and `isDimensionType('')` are false.
  - `dimensionTypeLabel` gives:
    - `'Behavior-Type'` → `'Behavior type'`;
    - `'Common-Name'` → `'Common name'`;
    - `'Info-Property'` → `'Info property'`;
    - `'Other'` → `'Other'`;
    - `'Technology'` → `'Technology'`.
  - `mergeDimensions` on CWE-1037's source order, which is Technology
    Processor, Behavior-Type Optimization, Behavior-Type Removal or
    Modification, Code-Type Code, Code-Property Security-critical, gives
    Behavior-Type Optimization, Behavior-Type Removal or Modification,
    Code-Type Code, Code-Property Security-critical, Technology Processor.
  - `mergeDimensions([a, b], [b, c])` keeps one `b`.
    `mergeDimensions()` and `mergeDimensions([])` are `[]`.
  - `dimensionRows` on that merged CWE-1037 list gives
    `[{ label: 'Behavior type', values: ['Optimization', 'Removal or Modification'] }, { label: 'Code type', values: ['Code'] }, { label: 'Code property', values: ['Security-critical'] }, { label: 'Technology', values: ['Processor'] }]`.
  - With CWE-201's ChildOf 200, which is Behavior-Type Exposure and Other
    to an Unauthorized Actor, as the group `[{ type: 'ChildOf', dimensions }]`:
    - `chipDimensionLine` is `'Exposure · to an Unauthorized Actor'`;
    - `differsBy` is `'Differs by: Behavior type Exposure; Other to an Unauthorized Actor'`;
    - `edgeTitle(['ChildOf'], group)` is
      `'ChildOf\nBehavior type: Exposure\nOther: to an Unauthorized Actor'`.
  - `edgeTitle(['ChildOf'], [])` is `'ChildOf'`.
    `edgeTitle(['Overlaps', 'PeerOf'], [])` is `'Overlaps, PeerOf'`. These
    are today's tooltips.
  - Two groups, each with one dimension: `[{ type: 'CanAlsoBe', dimensions: [Behavior-Type Generation] }, { type: 'PeerOf', dimensions: [Other Output] }]`.
    - `chipDimensionLine` is `'Generation · Output'`;
    - `differsBy` is `'Differs by: CanAlsoBe: Behavior type Generation. PeerOf: Other Output'`;
    - `edgeTitle(['CanAlsoBe', 'PeerOf'], …)` is
      `'CanAlsoBe, PeerOf\nCanAlsoBe:\n  Behavior type: Generation\nPeerOf:\n  Other: Output'`.
  - A type with two values in the tooltip shows them on one line joined
    with "; ": `'Behavior type: Optimization; Removal or Modification'`.

- [ ] **Step 2:** Run `npx vitest run test/lib/dimensions.test.ts`.
  Expected: FAIL, since the module doesn't exist.

- [ ] **Step 3:** Add the types to `cwe-data.ts` and implement
  `dimensions.ts` as specified under Interfaces. Each `differsBy` entry is
  `${label} ${value}`. For a single group, the entries are joined with
  "; ". For several, each group reads `${type}: ${entries}`, and the
  groups are joined with ". ".

- [ ] **Step 4:** Run the tests and the full verify command. Expected:
  PASS.

- [ ] **Step 5: Commit** `feat: add dimension types and formatting helpers`.

### Task 2: Read dimensions at build time

**Files:**

- Create: `scripts/dimensions.ts`
- Modify: `scripts/prepare-data.ts`, `test/fixtures/cwec-sample.xml`,
  `CONTRIBUTING.md` (the `scripts/` list near line 68)
- Test: `test/scripts/dimensions.test.ts`, `test/scripts/prepare-data.test.ts`

**Interfaces:**

- Consumes: `DIMENSION_TYPES`, `isDimensionType`, `mergeDimensions` and
  `DATA_FORMAT` from Task 1.
- Produces:
  - `readDimensions(raw: unknown, where: string): CweDimension[]` in
    `scripts/dimensions.ts`. `raw` is a `Dimensions` element as
    `fast-xml-parser` gives it: `undefined`, an empty string, or
    `{ Dimension: one | many }`, where each `Dimension` is
    `{ '@_Type': string, '#text'?: string }`. `where` is "CWE-1024" for a
    weakness, or "CWE-201 ChildOf CWE-200" for a relation. Returns `[]`
    when there are none.
  - `cwe.json` gains `dataFormat: DATA_FORMAT`, plus `dimensions` on nodes
    and edges.
- Error messages, exact:
  - `${where}: unknown Dimension Type "${type}"`;
  - `${where}: empty Dimension of Type ${type}`;
  - `${where}: duplicate Dimension ${type} "${value}"`.

- [ ] **Step 1: Write the failing unit tests** in
  `test/scripts/dimensions.test.ts`. All are real-world unless marked.
  - It reads CWE-1037's five dimensions, given in source order, and
    returns them in schema order. This is the same expectation as Task 1.
  - It reads a single `Dimension` given as an object, not an array.
  - `readDimensions(undefined, 'CWE-1')` and `readDimensions('', 'CWE-1')`
    are `[]`.
  - Whitespace: `'\n\t   Removal   or\n Modification\t'` becomes
    `'Removal or Modification'`.
  - `'"Asymmetric'` (CWE-405) is kept as `'"Asymmetric'`.
  - It throws, with the exact messages above:
    - for Type `'Behaviour-Type'`: `CWE-1: unknown Dimension Type "Behaviour-Type"`;
    - for a missing Type: `CWE-1: unknown Dimension Type ""`;
    - for a whitespace-only value: `CWE-1: empty Dimension of Type Other`;
    - for an element with no text: the same empty error;
    - for Behavior-Type Comparison twice: `CWE-1: duplicate Dimension Behavior-Type "Comparison"`.
  - A relation's `where` appears in its message, e.g.
    `CWE-201 ChildOf CWE-200: unknown Dimension Type "X"`.

- [ ] **Step 2: Extend the fixture** `test/fixtures/cwec-sample.xml` with
  real 5.0 data, indented with tabs as MITRE's source is. Change nothing
  else in it.
  - On weakness 74, after its `Description`, add `<Dimensions>` with, in
    this source order: Behavior-Property Improper, Behavior-Type
    Neutralization, Input-Type Special Elements, Other Output, Other Used
    by a Downstream Component, Common-Name Injection.
  - Turn 79's `<Related_Weakness Nature="ChildOf" CWE_ID="74" View_ID="1000"/>`
    into an element holding `<Dimensions>` with, in this source order:
    Input-Type Input, Technology Web, Resource-Type Page, Behavior-Type
    Generation, Common-Name Cross-site Scripting.
  - Add a second relation to 79,
    `<Related_Weakness Nature="ChildOf" CWE_ID="74" View_ID="1003"/>`,
    with no dimensions. This mirrors 5.0, where the same relation is
    stated in another view.

- [ ] **Step 3: Write the failing `parseCatalog` and `run` tests** in
  `test/scripts/prepare-data.test.ts`, all real-world except the last:
  - "reads a weakness's dimensions in schema order":
    `data.nodes['74'].dimensions` equals Behavior-Type Neutralization,
    Behavior-Property Improper, Input-Type Special Elements, Common-Name
    Injection, Other Output, Other Used by a Downstream Component.
  - "leaves dimensions absent when a weakness has none":
    `'dimensions' in data.nodes['80']` is false.
  - "reads a relation's dimensions onto its edge": the edge
    `{ from: '79', to: '74', type: 'ChildOf', viewId: '1000' }` has
    `dimensions` equal to Behavior-Type Generation, Resource-Type Page,
    Input-Type Input, Technology Web, Common-Name Cross-site Scripting. The
    view-1003 edge has no `dimensions` key.
  - "writes the data format": `data.dataFormat` is `DATA_FORMAT`.
  - "re-downloads data cached before the data format existed": copy the
    languages staleness test, deleting `cached.dataFormat` instead.
  - Tagged theoretical: "keeps a numeric-looking dimension value as
    text". Use an inline catalog string with one weakness whose
    `Dimension Type="Other"` holds `1e5`. The value is the string `'1e5'`.

- [ ] **Step 4:** Run `npx vitest run test/scripts`. Expected: the new
  tests FAIL. Every existing test still passes, except where the fixture
  edit changes an expectation. Note any that do. Only the edge-count or
  edge-list expectations for 79 may change, to include the view-1003
  edge.

- [ ] **Step 5: Implement.**
  - `readDimensions`: validate each entry, collapse whitespace and check
    for duplicates, then return `mergeDimensions(entries)` to sort.
  - In `parseCatalog`:
    - add `parseTagValue: false` to the `XMLParser` options, so that no
      element text is coerced to a number;
    - add `Dimensions?: unknown` to `RawWeakness` and
      `RawRelatedWeakness`;
    - set `nodes[id].dimensions` and `edge.dimensions` only when
      non-empty, as `technicalNuance` is set;
    - write `dataFormat: DATA_FORMAT` first in the returned object.
  - In `readLocalMeta`, replace the `languages` check with
    `cached.dataFormat !== DATA_FORMAT → null`, keeping the comment's
    intent ("data written before … is stale").
  - In `CONTRIBUTING.md`, add `dimensions.ts` to the `scripts/` list, the
    same way `languages.ts` is listed.

- [ ] **Step 6:** Run the full verify command. Expected: PASS, with every
  pre-existing test unchanged apart from Step 4's note. If
  `parseTagValue: false` changes any other existing expectation, stop and
  report it rather than editing that test.

- [ ] **Step 7: Commit** `feat: read CWE dimensions into cwe.json`.

### Task 3: The graph's relation lookup

**Files:**

- Modify: `src/lib/graph.ts`
- Test: `test/lib/graph.test.ts`

**Interfaces:**

- Consumes: `CweDimension` and `mergeDimensions` from Task 1.
- Produces:
  - `Graph.relationDimensions: Map<string, CweDimension[]>`, keyed
    `${from}|${to}|${type}` over the stated edges in `data.edges` that
    have dimensions. Statements of one key in several views are merged
    with `mergeDimensions`.
  - `relationDimensions(graph: Graph, id: string, otherId: string, type: string): CweDimension[]`.
    `type` is named from `id`'s side, as in `relatedTo`. The function
    returns `mergeDimensions` of the entry for `id|otherId|type` and the
    entry for `otherId|id|stated`, where `stated` is:
    - `ChildOf` ↔ `ParentOf`;
    - else the `INVERSE_NATURES` entry (PeerOf, Overlaps, CanPrecede ↔
      CanFollow, Requires ↔ RequiredBy);
    - else, for an `isInverse` type, the type without `INVERSE_SUFFIX`;
    - else nothing.

    Returns `[]` when neither entry exists.

- [ ] **Step 1: Write the failing tests** (real-world) in a
  `describe('relation dimensions')` block, using a small hand-built
  `CweData` with real 5.0 relations:
  - `201 ChildOf 200` with Behavior-Type Exposure and Other to an
    Unauthorized Actor:
    - `relationDimensions(g, '201', '200', 'ChildOf')` gives the two;
    - `relationDimensions(g, '200', '201', 'ParentOf')` gives the same
      two. This is the child chip on the parent.
  - `201 CanAlsoBe 209` with Behavior-Type Generation, Resource-Type
    Error Message, Info-Type Information, Info-Property Sensitive:
    - found from 201 with `'CanAlsoBe'`;
    - found from 209 with `'CanAlsoBe (inverse)'`, which is the type
      `relatedTo` gives 209.
  - `788 Overlaps 126` with Behavior-Type Read and Behavior-Property Over,
    plus `126 ChildOf 788` without:
    - found from 126 with `'Overlaps'`;
    - `relationDimensions(g, '126', '788', 'ChildOf')` is `[]`;
    - `relationDimensions(g, '788', '126', 'ParentOf')` is `[]`.
  - `285 ChildOf 284` stated twice, view 1000 with Behavior-Type Access
    Control and view 1340 without: the result is the one dimension, once.
  - `89 CanFollow 20` with Behavior-Type Validation: found from 20 with
    `'CanPrecede'`.
  - `buildGraph`'s synthesized inverse in `relatedTo.get('209')` has no
    `dimensions` key.
  - A relation with no dimensions anywhere gives `[]`, and a graph built
    from data without any has an empty `relationDimensions` map.

- [ ] **Step 2:** Run `npx vitest run test/lib/graph.test.ts`. Expected:
  FAIL.

- [ ] **Step 3:** Implement as specified under Interfaces. The
  synthesized inverse `CweEdge` keeps copying only `viewId`.

- [ ] **Step 4:** Run the full verify command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: look up a relation's dimensions from either end`.

### Task 4: The Dimensions disclosure

**Files:**

- Create: `src/components/Dimensions.tsx`
- Modify: `src/components/DetailPanel.tsx`, `src/styles/detail.css`
- Test: `test/components/Dimensions.test.tsx`, `test/components/DetailPanel.test.tsx`

**Interfaces:**

- Consumes: `dimensionRows` and `CweDimension` from Task 1.
- Produces: `Dimensions({ dimensions }: { dimensions: CweDimension[] })`.
  It renders `<details className="dimensions">` containing:
  - `<summary className="dimensions__summary">Dimensions</summary>`;
  - `<p className="dimensions__note">The parts MITRE built this weakness's name from.</p>`;
  - a `<dl className="dimensions__list">` with a `dt` (the label) and a
    `dd` (the values joined with "; ") per row.

- [ ] **Step 1: Write the failing tests** (real-world):
  - In `Dimensions.test.tsx`, with CWE-1037's list:
    - it starts closed;
    - after clicking "Dimensions", it shows the note text and the terms
      "Behavior type", "Code type", "Code property" and "Technology", in
      that order;
    - the Behavior type row's definition is
      "Optimization; Removal or Modification".
  - In `DetailPanel.test.tsx`, add a new `describe` with its own copy of
    `data`, where node 74 has CWE-1037's dimensions. The shared `data`
    stays as it is, so the existing tests are untouched.
    - "shows dimensions after the description and before technical
      nuance": give 74 a `technicalNuance` too. In document order, the
      description precedes the "Dimensions" summary, which precedes the
      "Technical nuance" summary.
    - "shows no dimensions for a CWE without them": with 79 selected,
      `queryByText('Dimensions')` is null.
    - "closes the dimensions again when another CWE is selected": open it
      on 74, rerender with 20 and then with 74. It is closed.

- [ ] **Step 2:** Run `npx vitest run test/components/Dimensions.test.tsx test/components/DetailPanel.test.tsx`.
  Expected: FAIL.

- [ ] **Step 3: Implement.** In `DetailPanel`, render
  `{node.dimensions && <Dimensions key={node.id} dimensions={node.dimensions} />}`
  between the description and `TechnicalNuance`. The `key` is how
  Technical nuance closes on a new selection. Style it in `detail.css`
  with the `.technical-nuance` rules' tokens and spacing. Lay the `dl` out
  as two columns (label, values) that stack on narrow widths. Values
  wrap, and the note is secondary text.

- [ ] **Step 4:** Run the full verify command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: show a weakness's dimensions in the detail panel`.

### Task 5: Dimensions on relation chips

**Files:**

- Modify: `src/components/DetailPanel.tsx`, `src/styles/detail.css`
- Test: `test/components/DetailPanel.test.tsx`

**Interfaces:**

- Consumes:
  - `relationDimensions` from Task 3;
  - `TypedDimensions`, `chipDimensionLine` and `differsBy` from Task 1.
- Produces: `Entry` gains `dimensions?: TypedDimensions[]`, set only when
  some type has dimensions. The types used are:
  - a parent chip: `ChildOf`;
  - a child chip: `ParentOf`;
  - a lateral chip: each of `entry.types`.

  Every group with dimensions is kept, in `entry.types` order.

- [ ] **Step 1: Write the failing tests** (real-world). Add a new
  `describe` with its own copy of the test `data`, so the existing tests
  and their accessible names are untouched. In the copy, give the edge
  `79 ChildOf 74` Behavior-Type Generation and Common-Name Cross-site
  Scripting, and the edge `79 PeerOf 80` Other Output.
  - With 79 selected, the Parents chip for 74:
    - shows the text "Generation · Cross-site Scripting";
    - has the accessible name
      "CWE-74: Injection. Differs by: Behavior type Generation; Common name Cross-site Scripting";
    - has the `title` "Differs by: Behavior type Generation; Common name Cross-site Scripting".
  - With 74 selected, the Children chip for 79 shows the same line, since
    it's the same relation.
  - With 80 selected, the peer chip for 79 shows "Output". This is the
    stated PeerOf, seen from its target.
  - With 79 selected and `matches` not containing 74, the chip's
    accessible name is
    "CWE-74: Injection, outside the filter. Differs by: Behavior type Generation; Common name Cross-site Scripting".
  - A flash on 80's PeerOf, with 79 selected, still focuses that chip,
    which has dimensions. Follow the existing flash test.
  - The chip for 20, which has no dimensions, has no `title` and no
    second line, and keeps its accessible name unchanged.

- [ ] **Step 2:** Run `npx vitest run test/components/DetailPanel.test.tsx`.
  Expected: FAIL.

- [ ] **Step 3: Implement.**
  - Set `dimensions` in `relationSections`.
  - In `RelationChip`, when `dimensions` is set:
    - append `. ${differsBy(dimensions)}` to the accessible name, after
      the outside suffix;
    - set `title={differsBy(dimensions)}`;
    - render `<span className="relation-chip__dimensions">{chipDimensionLine(dimensions)}</span>`
      as the last child.
  - In CSS:
    - let `.relation-chip` wrap, with `flex-wrap: wrap`;
    - give `.relation-chip__dimensions` `flex-basis: 100%`, smaller
      secondary text and normal wrapping (`white-space: normal`), so that
      a long line wraps inside the chip rather than widening it;
    - keep the chip's existing single-line look when the line is absent.

- [ ] **Step 4:** Run the full verify command. Expected: PASS.

- [ ] **Step 5: Commit** `feat: show a relation's dimensions on its chip`.

### Task 6: Dimensions in the graph edge's tooltip

**Files:**

- Modify: `src/lib/ego.ts`, `src/components/GraphEdge.tsx`,
  `src/components/GraphStage.tsx`
- Test: `test/lib/ego.test.ts`, `test/lib/layout.test.ts`,
  `test/components/GraphStage.test.tsx`

**Interfaces:**

- Consumes:
  - `relationDimensions` from Task 3;
  - `TypedDimensions` and `edgeTitle` from Task 1.
- Produces:
  - `EgoEdge.namedFrom: string`, required. It is the end the edge's
    `types` are named from: the child for hierarchy edges (equal to
    `from`), and the centre for laterals, including a lateral drawn
    reversed.
  - `edgeDimensions(graph: Graph, edge: EgoEdge): TypedDimensions[]` in
    `ego.ts`. For each type in `edge.types`, it calls
    `relationDimensions(graph, edge.namedFrom, other, type)`, where
    `other` is whichever of `from` and `to` isn't `namedFrom`. It keeps
    only the non-empty groups.
  - `GraphEdge` gains a `dimensions?: TypedDimensions[]` prop. Its
    `<title>` is `edgeTitle(edge.types, dimensions ?? [])`.
    `GraphEdgeLabel` is unchanged.

- [ ] **Step 1: Update existing expectations.** Adding a required field
  to `EgoEdge` is an intended change of shape. Add `namedFrom` to the
  `EgoEdge` literals in `test/lib/ego.test.ts`, including the `childOf`
  helper, and in `test/lib/layout.test.ts`. Change nothing else in those
  tests.

- [ ] **Step 2: Write the failing tests** (real-world):
  - In `ego.test.ts`:
    - the 126/788 test's edges carry `namedFrom: '126'` (hierarchy) and
      `namedFrom: '788'` (lateral);
    - with data `89 CanFollow 20` and 89 as the centre, the lateral is
      drawn `{ from: '20', to: '89' }` with `namedFrom: '89'`;
    - `edgeDimensions` on that edge, with the relation carrying
      Behavior-Type Validation, gives
      `[{ type: 'CanFollow', dimensions: [Behavior-Type Validation] }]`;
    - with 20 as the centre, the same dimensions come back under
      `'CanPrecede'`.
  - In `GraphStage.test.tsx`:
    - with `201 ChildOf 200` carrying Behavior-Type Exposure and Other to
      an Unauthorized Actor, and 201 selected, the edge's `title` text is
      "ChildOf\nBehavior type: Exposure\nOther: to an Unauthorized Actor";
    - with 200 selected, it is the same;
    - an edge without dimensions keeps the title "ChildOf". The existing
      "Overlaps, PeerOf" test must still pass unchanged.

- [ ] **Step 3:** Run `npx vitest run test/lib/ego.test.ts test/lib/layout.test.ts test/components/GraphStage.test.tsx`.
  Expected: the new tests FAIL.

- [ ] **Step 4: Implement.**
  - Set `namedFrom` at each `edges.push` in `buildEgoGraph`: `childId`
    for both hierarchy pushes, `centerId` for `drawn`.
  - In `GraphStage`, pass `dimensions={edgeDimensions(graph, edge)}` to
    `GraphEdge`.
  - Check in Chromium that the `\n` in an SVG `<title>` shows as line
    breaks. If it doesn't, report it, and keep the text, since the tests
    pin it.

- [ ] **Step 5:** Run the full verify command. Expected: PASS.

- [ ] **Step 6: Commit** `feat: show a relation's dimensions in the edge tooltip`.

### Task 7: Check against the real catalog and in a browser

**Files:** none, unless the checks find a defect. A fix goes in the task
that owns the code, as its own commit.

- [ ] **Step 1:** Run `npm run prepare-data` (pinned 5.0), then check
  `public/data/cwe.json`:
  - 107 nodes have `dimensions`;
  - 17 edges have `dimensions`;
  - `dataFormat` is 2;
  - CWE-405's Behavior-Property is `"Asymmetric`;
  - CWE-1037's order matches Task 1.
- [ ] **Step 2:** Run the dev server and check it in Chromium, using
  Playwright (`playwright-core` with the cached chromium headless shell),
  at 1280×800 and 412×680, light and dark:
  - CWE-1037's Dimensions disclosure opens and shows four rows;
  - CWE-201's Parents chip shows "Exposure · to an Unauthorized Actor";
  - its CanAlsoBe chip for 209 wraps on the phone width without
    sideways page overflow
    (`document.documentElement.scrollWidth <= innerWidth`);
  - CWE-209's "CanAlsoBe (inverse)" chip for 201 shows the same four
    values;
  - the 201 → 200 edge's tooltip shows the dimensions on separate lines.

  Save the screenshots to the scratchpad.
- [ ] **Step 3:** Run the full verify command one last time. Expected:
  PASS.
