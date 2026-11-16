# View, Group and Phase Filter — Design

Part of [#210](https://github.com/mureinik/cwe-visualizer/issues/210), the
design for using what CWE 5.0 adds. This is the second feature chosen from it,
tracked in [#327](https://github.com/mureinik/cwe-visualizer/issues/327).

## Intent

The app shows MITRE's weakness hierarchy and nothing else. CWE 5.0 (schema 8.0)
also sorts weaknesses into curated views, such as the yearly Top 25 or the
OWASP Top Ten, and into groupings within those views. It also records the
lifecycle phases in which each weakness is introduced. A reader should be able
to narrow everything on screen to one of these sets and keep exploring the
hierarchy and the graph inside it.

## What the data holds

Measured on the CWE 5.0 archive (`cwec_v5.0.xml`):

- **Views:** 62 in all, 46 of them live (not Deprecated or Obsolete). They
  come in three types:
  - **Graph** (27 live): the view lists groupings, weaknesses, or both, under
    `Members/Has_Member`. 16 list only groupings, 10 only weaknesses and
    one both. Examples: Software Development (699), with 40 groupings; the
    2025 Top 25 (1435), with 25 weaknesses; and OWASP Top Ten 2021 (1344).
  - **Explicit** (4 live): a fixed list of weaknesses, e.g. CWE Cross-section
    (884), with 157 weaknesses.
  - **Implicit** (15 live): no member list, only an XPath `Filter`. These are
    out of scope here and tracked in
    [#326](https://github.com/mureinik/cwe-visualizer/issues/326).
- **View 1000**, "Complete Weakness Hierarchy", is a Graph view whose members
  are just the 10 pillars. The rest of it is the `ChildOf` hierarchy the app
  already draws.
- **Groupings:** 431, 310 of them live.
  - A grouping lists its members under `Relationships/Has_Member`, each
    with a `CWE_ID` and a `View_ID`.
  - Members are weaknesses (3,658 links, 27 of them to deprecated
    weaknesses) or other groupings (101 links).
  - Groupings have no `Member_Of`. Which view a grouping belongs to is
    given only by the view listing it and by the `View_ID` on its own
    member links.
  - A grouping can sit in more than one view: 290 distinct groupings fill 308
    view slots. Some reach a live view only through a dead one.
  - Some live views reach groupings that MITRE has deprecated (11).
  - 5 live groupings belong to no view at all.
- Following groupings from each live Graph or Explicit view (other than 1000)
  through `Has_Member` links with that view's `View_ID` covers every member.
  No link points at an ID missing from the catalog. Examples:
  - 699: 40 groupings, 405 weaknesses (2 deprecated).
  - 888 (SFP Clusters): 83 groupings, 614 weaknesses.
  - 1400 (Comprehensive Categorization): 22 groupings, 958 weaknesses.
  - 1435: 25 weaknesses.
- **Phases:** each weakness's `Modes_Of_Introduction/Introduction` holds
  `Phase` elements (`PhaseEnumeration`), `Custom_Phase` elements, or both.
  Every live weakness (956) has at least one introduction phase. No
  deprecated weakness has any.
- **Phase counts:** 16 standard phases are in use, very unevenly. Weaknesses
  per phase:

  | Phase | Weaknesses |
  | --- | --- |
  | Implementation | 844 |
  | Architecture and Design | 367 |
  | Operation | 108 |
  | System Configuration | 19 |
  | Requirements | 12 |
  | Documentation | 10 |
  | Build and Compilation, Installation | 8 each |
  | Porting, Manufacturing, Integration | 7 each |
  | Distribution | 6 |
  | Policy, Testing, Patching and Maintenance, Bundling | 2 each |

- **Custom phases** (new in 5.0) carry a required `Domain` attribute, `AI`
  or `Hardware`, and a value from `AIPhaseEnumeration` or
  `HardwarePhaseEnumeration`. Some names overlap with the standard phases:
  AI has its own "Testing". Of the 14 `Custom_Phase` elements in 5.0, only
  three weaknesses have one as an introduction phase:
  - CWE-1427: AI, Training;
  - CWE-1461: Hardware, Implementation & Physical Design;
  - CWE-1476: Hardware, Hardware Requirements.

  The other custom phases appear in mitigations and detection methods.
- Mitigations and detection methods carry phases too. That is "fixed or
  found in", a different question from "introduced in".

## Goals

- Filter by one view, optionally narrowed to one grouping within it, and by
  one introduction phase, standard or custom. When both are set, a CWE has to
  match both.
- Apply the filter everywhere CWEs are listed or drawn: the landing panel,
  the tree drawer, the graph and search.
- Keep the hierarchy readable while filtered. Context that doesn't match
  stays visible but subdued, so a match is never shown cut off from where it
  sits.
- Set the filter from controls on the page. Carry it in the URL so a filtered
  page can be shared.
- Fail the build on membership data the conversion doesn't expect.

## Non-goals

- **Implicit views**, tracked in
  [#326](https://github.com/mureinik/cwe-visualizer/issues/326).
- **Mitigation and detection phases.** They could be a separate filter later.
- **More than one value per filter.** That rules out "C or Java" and
  "Top 25 2025 or OWASP 2021". It could come later.
- **Showing a CWE's views, groups or phases in the detail panel.**
- **Filtering the detail panel's Parents and Children lists.** They describe
  one CWE and stay complete.
- **Any change for the 4.x releases.** They are never rebuilt, so they won't
  get the filter.
- **Dimensions** and the rest of #210.

## Anti-goals

- **An empty or orphaned hierarchy.** Most views list CWEs deep in the tree;
  none of the 2025 Top 25 is a pillar. Hiding everything that doesn't match
  would empty the landing panel and cut every match off from its parent.
- **A filter that's on but not visible.** A reader must always be able to
  see that the screen is filtered, and clear it.
- **Losing your place.** Changing the filter never deselects or hides the
  selected CWE.
- **The URL as the control.** It records the filter, but no one should have to
  edit it.

## Constraints

- The app reads only the prebuilt `public/data/cwe.json`. All extraction runs
  at build time in `scripts/prepare-data.ts`, and the `CweData` and
  `CweNode` types in `src/lib/cwe-data.ts` are shared by both sides.
- The rest of the catalog parses as before. The parser has to see
  `Groupings` and `Views` in addition to `Weaknesses`, but the existing
  fields and edges come out unchanged.
- Deprecated and obsolete CWEs stay in the data and are shown marked, as
  today: after live ones in search, and in the tree's Deprecated section.
- The phone layout (412×680) has to fit. The header already wraps there.
- No new runtime dependency.
- New tests get classified as real-world or theoretical (CONTRIBUTING).
  Fixtures go in `test/fixtures/`.

## Approaches

1. **Dim the context, keep the hierarchy.** (Chosen.) What matches looks
   normal. Ancestors that lead to a match stay, subdued. Branches with no
   match are hidden in the lists and faded in the graph.
2. **Show only matches.** This is the simplest rule, but it fails the first
   anti-goal: the landing panel and tree become flat lists, and the graph
   loses the edges between a match and its parents.
3. **Highlight matches, hide nothing.** Nothing moves, but a selective filter
   leaves 25 marked rows somewhere among 950 in the tree, which doesn't help
   anyone find them.

For the controls:

1. **A Filter button next to search, opening a panel, plus a bar of active
   filters.** (Chosen.)
2. **Three dropdowns in the header.** They don't fit on the phone and would
   crowd the desktop header.
3. **A section at the top of the tree drawer.** The filter also changes the
   landing panel and the graph, and the drawer is usually closed.

## Decisions

### Data

`CweData` gains two lists, and `CweNode` gains phases:

```ts
interface CwePhase {
  /** The standard phase, or the custom phase's value. */
  name: string;
  /** Set only for a Custom_Phase: 'AI' or 'Hardware'. */
  domain?: string;
}

interface CweNode {
  // ...existing fields
  /** Distinct introduction phases. Present only when non-empty. */
  phases?: CwePhase[];
}

interface CweView {
  id: string;
  name: string;
  /** The groupings reachable from this view, in any order. */
  groupIds: string[];
  /** Every weakness in the view, directly or through its groupings. */
  memberIds: string[];
}

interface CweGroup {
  id: string;
  name: string;
  status: string;
  /** Per view, since a grouping can sit in several: weakness IDs. */
  membersByView: Record<string, string[]>;
}

interface CweData {
  // ...existing fields
  views: CweView[];
  groups: Record<string, CweGroup>;
}
```

Membership is resolved at build time, so the app does set lookups and no
traversal.

### Which views and groupings

- A view is included when it is live, its type is Graph or Explicit, and it
  isn't view 1000.
- A view's members are found by starting from its `Members/Has_Member`
  links and following groupings through `Has_Member` links whose `View_ID`
  is that view's. A weakness reached this way is a member, deprecated or
  not. A grouping reached this way belongs to the view.
- A deprecated or obsolete grouping that a live view reaches still counts:
  its members count toward the view, and it is offered in the Group picker,
  marked as deprecated, after the live ones. MITRE still lists it in a view
  it maintains, so it is handled the way deprecated CWEs are.
- A grouping that no included view reaches isn't in the data.

### Phases

- A phase is identified by its domain and name, so AI "Testing" and the
  standard "Testing" are separate entries.
- The picker lists only phases that at least one weakness is introduced in.
  - The standard phases come first, in `PhaseEnumeration` order, which is
    lifecycle order (Policy, Requirements, Architecture and Design, …).
  - The custom phases follow, under their domain, in their enumeration's
    order. Each shows as its name with the domain, e.g. "Training (AI)".
- A weakness matches a phase if any of its introductions names it.

### Strictness

These fail the build, with an error naming the entry:

- A `Has_Member` that points at an ID that is neither a weakness nor a
  grouping, from an included view or from a grouping it reaches.
- A `Custom_Phase` with no `Domain`, or with an empty value.
- An empty `Phase`.

Phase names are taken as written and aren't checked against the
enumerations, since the schema already constrains them. The domain is
likewise taken as written, so a new domain appears under its own name.

### Matching

A weakness matches when both hold:

- **View:** no view is chosen; or, with no group chosen, it is in the view's
  `memberIds`; or, with a group chosen, it is in that group's
  `membersByView` for the chosen view.
- **Phase:** no phase is chosen, or one of its phases is the chosen one.

With no filter set, everything behaves as it does today.

### Landing panel

- Only pillars with a match beneath them are listed (the pillar itself, or
  any descendant).
- Each pillar shows its match count next to its total beneath, e.g. "6 of
  113".
- A pillar that doesn't match itself is subdued, like other non-matching
  context.
- With no matches at all, the panel says no CWEs match the filter and offers
  a button that clears it.

### Tree drawer

- It shows only the branches that lead to a match.
- Those branches open when the filter changes, so the matches are in view
  without clicking through.
- Rows that don't match but lead to a match are subdued, and can still be
  selected.
- The Deprecated section lists only deprecated roots that match. It is
  hidden when none do.

### Graph

- Nodes that don't match are faded, with their labels and the edges that
  touch them. The selected CWE stays at full strength either way, so it is
  always readable.
- Where a band is capped (children at 10, laterals at 4), matching CWEs are
  placed first, so a match isn't pushed into the overflow chip by ones that
  don't match.

### Search

- Only matches are listed, in the existing order.
- When the filter removes every result, the empty state says the filter is
  on, so "no results" isn't mistaken for "no such CWE".

### Controls

- **Filter button:** next to search, labelled "Filter". It shows how many
  filters are set when any are.
- **Panel:** the button opens a panel. On desktop it drops down like the
  release switcher; on the phone it is a bottom sheet like the detail panel.
  It holds:
  - **View:** a list you can type into to narrow it, like CWE search, showing
    each view's name and ID;
  - **Group:** the same kind of list, enabled once a view is chosen, offering
    only that view's groupings;
  - **Phase:** a plain list in the order above;
  - a way to clear each picker, and a "Clear all".
- **Filter bar:** while any filter is set, a bar under the header shows one
  chip per setting, each removable on its own, e.g.
  `Top 25 (2025) ×` `Implementation ×`, followed by the number of matching
  CWEs.
- Changing the view clears the group.
- All of this is reachable by keyboard and has accessible names, like the
  existing pickers.

```text
┌ ☰ CWE Visualizer [Search…        ] [⚲ Filter 2] … ┐
│ Top 25 (2025) ×   Implementation ×   · 19 CWEs     │
└────────────────────────────────────────────────────┘
```

### URL

- `?view=<id>`, `&group=<id>` and `&phase=<name>` sit next to `?cwe=`, all
  updated in place with `replaceState`, the way `?cwe=` is today. A custom
  phase is written as `<domain>:<name>`, e.g. `phase=AI:Training`.
- The filter is read once on load.
- A value this release doesn't have, a group outside the chosen view, or a
  group with no view, is dropped from the URL. The filter bar says what was
  dropped, so a stale link doesn't fail silently.
- The release switcher already carries the query string to another release,
  so the filter goes along with it. A release without the filter ignores
  the parameters.

## Calls made in design (not the maintainer's; correct if wrong)

- View 1000 is left out. It is the hierarchy the app already shows, and as a
  filter it would list only its 10 pillars.
- Deprecated groupings in a live view are offered, marked, rather than left
  out. This goes further than "leave out deprecated views and groups" from
  the discussion, because their members are in the view either way.
- Phase is "introduced in". Custom phases are included under the same
  filter.
- The selected CWE stays at full strength in the graph even when it doesn't
  match.
- Matching CWEs are placed first in capped graph bands.
- The detail panel's relation lists aren't filtered.
- The URL is updated with `replaceState`, as `?cwe=` is, so filter changes
  don't add Back-button history.

## Left to the builder

- Exact styling of subdued and faded CWEs, the Filter button, the panel and
  the chips, using the existing design tokens. Faded must stay readable at
  the theme's contrast floor.
- How the pickers are built: shared with `SearchBox`, or a new component in
  the same style.
- Splitting the work into tasks, e.g. data step, matching logic, each
  surface, controls, URL.
- Test fixtures: extend `test/fixtures/cwec-sample.xml` with a Graph view
  over groupings (including a nested and a deprecated grouping), a Graph
  view listing weaknesses, an Explicit view, view 1000, an Implicit view, a
  Deprecated view, and weaknesses with standard and custom introduction
  phases. Add failures for an unknown member ID and for a custom phase with
  no domain. These are real-world: they cover today's data, or a MITRE
  format change outside our control.
