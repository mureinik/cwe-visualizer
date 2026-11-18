# Dimensions — Design

Part of [#210](https://github.com/mureinik/cwe-visualizer/issues/210), the
design for using what CWE 5.0 adds, tracked in
[#339](https://github.com/mureinik/cwe-visualizer/issues/339).

## Intent

CWE 5.0 (schema 8.0) adds `Dimensions`: labelled parts that a weakness's
name is built from, such as a behaviour, a property or a resource. Some
relations carry them too, saying what differs between the two weaknesses.
Today the app drops them. The reader should see them as extra data:

- on the weakness, in the detail panel;
- on the relation, in the detail panel's relation chip and in the graph
  edge's tooltip.

Dimensions are display only. They are not a filter.

## What the data holds

Measured on the CWE 5.0 archive (`cwec_v5.0.xml`) and schema
(`cwe_schema_v8.0.xsd`):

- 124 `Dimensions` elements: 107 on `Weakness` elements and 17 on
  `Related_Weakness` elements. Nothing else carries them.
- The schema describes them as follows:
  - on a weakness: "the dimensions around which this entry is based, such
    as behavior type, resource property, etc.";
  - on a relation: "the dimensions that are different between this CWE
    entry and the related CWE entry".
- Each `Dimension` has a required `Type` from a closed list of 18, in
  this schema order: Behavior-Type, Behavior-Property, Resource-Type,
  Resource-Property, Input-Type, Input-Property, Info-Type, Info-Property,
  Code-Type, Code-Property, Technology, Language-Type, Language-Property,
  Framework, Common-Name, Attack, Acronym, Other. The value is free text.
- A weakness has 1 to 7 dimensions. Behavior-Type is the most common, with
  124 uses and 71 distinct values, and Behavior-Property comes next with
  87 uses, 43 of them "Improper".
- The source XML may list the same Type more than once, as CWE-1037 does
  with "Optimization" and "Removal or Modification". It doesn't list
  dimensions in schema order: CWE-79's relation puts Technology before
  Behavior-Type.
- The 107 weaknesses include one Deprecated entry.
- The values are uneven:
  - stray quotes in `"Asymmetric` (CWE-405) and
    `PHP Remote File Inclusion"` (CWE-98);
  - "Improper" as a Resource-Type (CWE-653);
  - near-duplicates such as "Resource" and "Resources".
- The source is hand-indented with mixed tabs and spaces around each
  `Dimension`.
- The 17 relations with dimensions are all in view 1000, except two
  ChildOf 284 relations in view 1340, from CWE-862 and CWE-863. They span
  ChildOf (12), CanAlsoBe (2), Overlaps (2) and PeerOf (1).
- One pair of CWEs can have several relations, and only one of them may
  carry dimensions:
  - CWE-285 is ChildOf 284 in view 1000, with dimensions, and again in
    view 1340, without. The same holds for 77 → 74, 78 → 77 and 79 → 74.
  - CWE-788 Overlaps 126, with dimensions, while CWE-126 is ChildOf 788,
    without. This is a different relation between the same pair.
- 4.x has no `Dimensions` at all.

## Goals

- Show a weakness's dimensions in the detail panel.
- Show a relation's dimensions on its chip in the detail panel and in the
  tooltip of its edge in the graph, from whichever end is selected.
- Fail the build on a Type outside the schema's list, so new types are a
  deliberate decision rather than something passed through unseen.

## Non-goals

- Filtering or searching by dimension.
- Showing relation dimensions on the graph's edge labels (the edge-labels
  toggle). Labels stay as short as they are today.
- Cleaning up MITRE's values.
- Any change for the 4.x releases. They have no dimensions to show.

## Anti-goals

- **Values we corrected.** The values are MITRE's, shown verbatim apart
  from whitespace. `"Asymmetric` keeps its quote. Fixing the data quietly
  would make ours disagree with MITRE's.
- **Dimensions on the wrong relation.** CWE-788's Overlaps dimensions must
  not show on CWE-126's ChildOf chip for 788, which is a different
  relation between the same pair.
- **Noise for the 89% without dimensions.** A weakness or relation without
  dimensions shows nothing, not an empty heading.
- **Duplicated data.** `cwe.json` holds each relation's dimensions once, on
  the edge MITRE states them on.

## Constraints

- The app reads only the prebuilt `public/data/cwe.json`. Dimensions are
  read at build time in `scripts/prepare-data.ts`. The `CweNode` and
  `CweEdge` types in `src/lib/cwe-data.ts` are shared by both sides.
- No new dependency.
- The build stays strict, as it is for nuance, phases, views and
  languages. Data it doesn't understand fails the build.
- New tests get classified as real-world or theoretical (CONTRIBUTING).
  Fixtures go in `test/fixtures/`.

## Approaches

Both options read dimensions at build time and put a weakness's own
dimensions on `CweNode`. They differ in where a relation's dimensions live.

1. **On the edge, where MITRE states them.** (Chosen.) `CweEdge` gains an
   optional `dimensions` field. `buildGraph` collects them into a lookup
   that the detail panel and the tooltip both read. The lookup is needed
   either way, because parents and children are stored as bare ID lists,
   so a chip can't see the edge it came from.
2. **A separate top-level list in `cwe.json`,** shaped as
   `{ from, to, type, dimensions }[]`. This leaves `CweEdge` alone, but it
   repeats each relation's ends and type, so two places describe one
   relation. Rejected: the maintainer doesn't want to duplicate
   information, and the lookup is still needed.

Display was settled in the same conversation:

- **Relation dimensions:** chosen, the detail panel plus the edge's
  tooltip. Rejected: the detail panel alone, which leaves the graph silent;
  and the edge's text label as well, which would crowd the graph (201 →
  209 has four dimensions).
- **A weakness's dimensions:** chosen, a closed disclosure like Technical
  nuance. Rejected: an always-open list; and a row of chips, which loses
  the types or grows longer than the list.

## Decisions

### Data

```ts
interface CweDimension {
  /** One of the schema's 18 types, verbatim, e.g. "Behavior-Type". */
  type: string;
  /** MITRE's text, whitespace-collapsed and trimmed, otherwise verbatim. */
  value: string;
}

interface CweNode {
  // ...existing fields
  /** Present only when non-empty. In schema type order. */
  dimensions?: CweDimension[];
}

interface CweEdge {
  // ...existing fields
  /** Present only when non-empty. In schema type order. */
  dimensions?: CweDimension[];
}
```

- Ordering:
  - entries are sorted by their Type's position in the schema list;
  - entries of one Type keep MITRE's order.
- Source form: `<Dimension Type="Behavior-Type">Comparison</Dimension>`.
  The type is the `Type` attribute and the value is the element's text.
- Whitespace: every run of spaces, tabs and newlines collapses to one
  space, and the value is trimmed at both ends. Nothing else is changed.
- The value must reach `cwe.json` as the source's string. With
  `parseCatalog`'s current settings, `fast-xml-parser` would turn a
  numeric-looking text such as "3" or "1e5" into a number. Dimension
  values must be read without that conversion. No 5.0 value looks numeric,
  so this is a guard, and the test for it is theoretical.

### Build checks

The build fails, naming the CWE (and, for a relation, its nature and
target), on any of these:

- a `Type` outside the schema's 18;
- a value that is empty after trimming;
- the same Type and value twice in one `Dimensions` element.

The last two never happen in 5.0. They are guards, for consistency with
the build's other strict checks.

A cached `public/data/cwe.json` written before this change must count as
stale and be regenerated, as one written before `languages` existed is
today.

### The graph's lookup

`Graph` gains a way to ask "the dimensions of the relation that CWE A has
to CWE B, of type T", where T is named from A's side as the detail panel
and graph name it. Examples: ChildOf for a parent chip, the parent-side
type for a child chip, `Overlaps` for a peer, or a synthesized inverse
such as `CanFollow`.

- It returns the dimensions of the relation stated as A → B with type T,
  or of the relation stated as B → A with T's inverse. For a child chip,
  that is the child's ChildOf.
- When MITRE states one relation (same ends, same type) in several views,
  their dimensions are merged: de-duplicated by type and value, in schema
  type order. In 5.0 only one statement of each such relation has
  dimensions, so this never actually merges anything.
- It is keyed by type, so CWE-126's ChildOf to 788 has none, while
  CWE-126's Overlaps with 788 has 788's.
- `buildGraph`'s synthesized inverse edges in `relatedTo` stay free of
  dimensions. The lookup alone resolves the other end.
- CanAlsoBe is not reciprocal and gets no synthesized inverse
  (`graph.ts`). Its dimensions therefore show only from the stating end,
  such as 201's chip for 209.

### Display

**A weakness's dimensions**:

- **Placement:** a "Dimensions" disclosure (native `<details>`) in the
  detail panel, after the description and before Technical nuance. The
  maintainer's call: the short dimension rows ask less of the reader than
  the nuance's prose, so they come first. It is closed by default and
  closes again when another CWE is selected, as Technical nuance does.
- **Explanation:** the first line inside it reads "The parts MITRE built
  this weakness's name from."
- **Rows:** one row per Type, in schema order. A Type with several values
  shows them on one row, joined with "; ". A semicolon, because values
  contain commas ("Specified Index, Position, or Offset").
- **Type labels:** the hyphen becomes a space and the second word is
  lowercased. "Behavior-Type" becomes "Behavior type", and "Other" stays
  "Other". Values stay verbatim.
- **No dimensions:** no disclosure.

CWE-1037 opened:

```text
▾ Dimensions
  The parts MITRE built this weakness's name from.
  Behavior type   Optimization; Removal or Modification
  Code type       Code
  Code property   Security-critical
  Technology      Processor
```

**A relation chip with dimensions:**

- **Visible line:** a second line under the CWE name with the values
  only, joined with " · ".
- **Accessible name and hover title:** both give the types as well, e.g.
  "Differs by: Behavior type Exposure; Other to an Unauthorized Actor".
  This adds to the chip's existing label and its "outside the filter"
  suffix; it doesn't replace them.
- **No dimensions:** the chip is unchanged.
- **A chip that names two types:** the dimensions are those of whichever
  types have them. If both do, the visible line lists them all, and the
  accessible name and title group them by type, as the tooltip does. 5.0
  has no such chip.

CWE-201's Parents section:

```text
Parents (1)
  [▲ CWE-200 Exposure of Sensitive Information to an Unauthorized Actor]
     Exposure · to an Unauthorized Actor
```

**A graph edge with dimensions:**

- **Tooltip:** the relation line it shows today, then one line per Type,
  e.g.:

  ```text
  ChildOf
  Behavior type: Exposure
  Other: to an Unauthorized Actor
  ```

- **An edge standing for several types:** the first line names all of
  them, as today. Then each type with dimensions gets a block led by its
  name, e.g. "CanAlsoBe:". This doesn't happen in 5.0.
- **Edges between two CWEs that aren't the centre,** such as a parent's
  own parent: covered too.
- **Which end is selected:** doesn't matter. The ego graph may draw a
  lateral edge reversed, so that its arrow runs left to right, while its
  `types` are still named from the centre's side. The lookup has to use
  the side the types are named from. So `EgoEdge` gains a field naming
  that end, set for every edge: the child for hierarchy edges, the centre
  for laterals. The ego and layout tests are extended to cover it.

## Calls made in design (not the maintainer's; correct if wrong)

- The chip line shows values only. The types are in its accessible name
  and title, because the chip has no room for a type column.
- Values are joined with "; " in the disclosure and " · " on the chip.
- Duplicate entries and empty values fail the build rather than being
  dropped.
- Statements of the same relation in different views are merged rather
  than treated as an error.
- Dimensions are not indexed by search.
- `EgoEdge` records which end its types are named from, rather than
  `GraphEdge` working that out from the centre's ID.
- Synthesized inverse edges carry no dimensions; only the lookup resolves
  them.
- When a chip's two types both have dimensions, its title groups them by
  type.

## Left to the builder

- **Code layout:** where the dimension reading lives, for example a
  `scripts/dimensions.ts` like `scripts/phases.ts`, and the shape of the
  lookup on `Graph`.
- **Staleness:** how a cached `cwe.json` from before this change is
  recognised as stale. It must not depend on a weakness having dimensions,
  since 4.x data has none.
- **Styling:** use the existing design tokens. The disclosure matches
  Technical nuance. The chip's second line is smaller and secondary, and
  the phone layout must not overflow sideways.
- **Tooltip line breaks:** how the multi-line tooltip is written in the
  SVG `<title>`.
- **Test fixtures:** taken from the real entries:
  - CWE-1037: several values of one Type, and source order differing
    from schema order;
  - CWE-201 → 200: a ChildOf with dimensions, seen from both ends;
  - CWE-201 → 209: CanAlsoBe, from the stating end only;
  - CWE-788 / 126: Overlaps with dimensions next to a ChildOf without;
  - CWE-285 → 284: the same relation in two views, one with dimensions;
  - CWE-405: a stray quote, kept;
  - build failures for an unknown Type, an empty value and a duplicate
    entry.

  These are real-world tests: they cover today's data, or a MITRE format
  change outside our control. The numeric-looking value test is the
  exception, and is theoretical.
- **The chip's markup:** how the second line fits inside the chip's
  `<button>`.
