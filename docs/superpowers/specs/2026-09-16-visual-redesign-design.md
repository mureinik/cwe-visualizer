# CWE Visualizer — Visual Redesign

## Purpose

The visualizer works, but it is unpleasant to look at and unpleasant to
navigate. `src/index.css` is sixteen lines; every component renders default
browser markup, so the app is a wall of text with no visual hierarchy. This
redesign replaces that with a design system, a graph-first navigation model,
and a set of fixes to the specific things that make the corpus hard to move
through.

It also lays two small seams so that MITRE's `Category` and `View`
constructs — deferred in the original design and still deferred here — can
be added later without reworking the data pipeline.

The original design doc (`2026-08-23-cwe-visualizer-design.md`) remains
authoritative for the data pipeline, deployment, and contribution workflow.
This document supersedes only its **Frontend** section.

## What's actually wrong today

Measured against the real CWE 4.20 corpus (969 weaknesses, 1,602 edges):

- **No visual design at all.** No tokens, no spacing scale, no color, no
  layout. `App.tsx` stacks header, main, and footer in normal document flow.
- **The tree opens onto noise.** It has 35 roots, but only 10 are real (the
  Pillars). The other 25 are orphaned `DEPRECATED:` entries, and because
  roots sort by ID, the first thing on screen is `71 DEPRECATED`,
  `92 DEPRECATED`, `132 DEPRECATED`… before anything useful.
- **The hierarchy is a DAG drawn as a tree.** 279 nodes have more than one
  parent, so the same CWE appears in several branches with no indication.
- **Rich structure is invisible.** Five abstraction levels (Pillar 10,
  Class 114, Base 539, Variant 299, Compound 7), four statuses, and five
  non-hierarchy relation types are all rendered as identical plain text.
- **Search is unranked.** `searchNodes` is a bare substring match over id and
  name, so typing `79` returns CWE-79 somewhere among 179, 279, 379, 579…
- **Non-hierarchy relations are second-class.** `PeerOf`, `CanPrecede`,
  `CanFollow`, `CanAlsoBe`, `Requires`, and `StartsWith` exist only as a flat
  bullet list at the bottom of the detail panel. There is no way to see how a
  weakness sits among its neighbours.

## Scope

**In scope:** a design token system with equal light and dark themes; a
graph-first application shell; an ego-graph canvas centered on the selected
CWE; a restyled tree as a drawer; ranked search as a combobox; a card-based
detail panel; responsive behaviour down to phone width; a keyboard and
screen-reader story for all of it; and the two forward-compatibility seams
described under "Seams for views and categories".

**Out of scope:** parsing or displaying MITRE `Category` and `View` entries;
a view switcher; pan and zoom; any change to the data pipeline beyond
carrying one extra field; any new runtime dependency.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Ambition | Full rethink, including a graph view | Chosen by the repo owner over a pure restyle |
| Graph scope | Ego graph around the selection | The only scope that stays readable at 969 nodes and can show every relation type |
| Layout model | Graph-first; tree in a drawer | Chosen by the repo owner |
| Visual direction | Neutral palette, light and dark equal | Chosen by the repo owner over an opinionated dark or editorial theme |
| Small screens | Fully responsive; the graph adapts | Chosen by the repo owner |
| Graph layout engine | Hand-rolled layered SVG, no new dependency | See below |

### Why a hand-rolled layout rather than `d3-force` or a graph library

An ego graph has **semantic direction**: ancestors are more abstract,
descendants more specific, and `CanPrecede`/`CanFollow` is a sequence. A
force simulation discards exactly that — it will happily settle a parent
below its child, which is worse than useless for a hierarchy. It is also
nondeterministic, which makes it awkward to unit-test and makes it jitter
between renders.

A graph library (React Flow, Cytoscape) costs 100–400 KB to draw a picture
that is usually under a dozen nodes, and brings a styling model that fights
the token system this document introduces.

A layered layout is roughly a hundred lines, is a **pure function** of
`(graph, selectedId, stageSize)`, and therefore unit-tests exactly the way
`lib/graph.ts` already does. Because the layout always fits the stage, pan
and zoom are unnecessary and are deliberately omitted.

## Design system

### Tokens

`src/styles/tokens.css` defines every colour twice — once under `:root` for
light, and once under both `@media (prefers-color-scheme: dark)` guarded by
`:root:not([data-theme='light'])` and `:root[data-theme='dark']`. That pairing
is what lets a manual override coexist with the OS setting rather than fight
it.

| Group | Tokens |
|---|---|
| Surface | `--bg`, `--surface`, `--surface-raised`, `--border`, `--border-strong` |
| Text | `--text`, `--text-secondary`, `--text-muted` |
| Abstraction | `--abs-pillar`, `--abs-class`, `--abs-base`, `--abs-variant`, `--abs-compound` |
| Status | `--status-stable`, `--status-draft`, `--status-incomplete`, `--status-deprecated` |
| Relation | `--rel-hierarchy`, `--rel-peer`, `--rel-sequence`, `--rel-requires` |
| Scale | `--space-1`…`--space-6` (4/8/12/16/24/32), `--radius-sm`, `--radius-md`, `--radius-lg`, `--text-xs`…`--text-3xl` |
| Motion | `--dur-fast` 120ms, `--dur` 200ms, `--ease` |

A `☀/☾` control in the header writes `data-theme` onto `<html>` and persists
it to `localStorage` inside a `try/catch` — blocked or cleared storage must
degrade to the OS preference, never throw.

### Typography

System sans (`system-ui`) for prose; system mono
(`ui-monospace, SFMono-Regular, Menlo, monospace`) for `CWE-79` identifiers,
which keeps IDs scannable and column-aligned. **No web fonts.** An app that
deliberately never contacts MITRE at runtime should not contact Google Fonts
either.

### Encoding weakness metadata

Abstraction is encoded by **shape and colour together, never colour alone**:

| Abstraction | Shape | Count in 4.20 |
|---|---|---|
| Pillar | ◆ diamond | 10 |
| Class | ◉ ringed circle | 114 |
| Base | ● filled circle | 539 |
| Variant | ○ hollow circle | 299 |
| Compound | ⬡ hexagon | 7 |

Deprecated entries desaturate to `--status-deprecated` and take a dashed
outline. Shape-plus-colour is what keeps the graph legible to a colourblind
reader and what keeps it working across two themes, where hue contrast
shifts.

The shapes live in a **registry keyed by node kind**, so adding a `Category`
shape later is a data addition rather than a code change.

## Application shell

Three rows, fixed to the viewport, no page scroll:

```
┌──────────────────────────────────────────────────────┐
│ ☰   CWE Visualizer   [ search… ]      v4.20   ☀/☾   │  56px
├──────────────────────────────────────────────────────┤
│                                                      │
│   graph stage (fills)      ┌──────────────────┐      │  flex: 1
│                            │ detail card      │      │
│                            └──────────────────┘      │
├──────────────────────────────────────────────────────┤
│ CWE content © 2006–2026 The MITRE Corporation …      │  28px
└──────────────────────────────────────────────────────┘
```

- **Header:** drawer toggle, wordmark, search, a corpus-version chip reading
  `graph.meta.cweVersion` (loaded today but never displayed anywhere), and
  the theme toggle. The version chip's slot is where a view switcher would
  later go.
- **Stage:** `position: relative`. The graph SVG fills it, the detail card
  floats top-right at a max width of ~380px, and the tree drawer slides in
  over it from the left.
- **Footer:** `CLAUDE.md` requires the MITRE attribution to stay reachable
  wherever CWE data is displayed. A full-viewport graph has no document flow
  to host it, so it becomes a slim, always-visible bar pinned to the bottom
  edge — muted, one line, links intact. Spending 28px is preferable to
  hiding a legal attribution behind a disclosure.

### Responsive behaviour

Below a 900px breakpoint: the detail card becomes a bottom sheet with two
snap points (a peek showing title and badges, expanded at ~70vh); the drawer
goes full-screen; search collapses to an icon that expands over the header;
and the graph drops from two ancestor hops to one.

## The ego graph

### Model

`src/lib/ego.ts` exposes a pure
`buildEgoGraph(graph, centerId, opts) → { nodes, edges }`, where each node
carries `{ id, band, index }`.

**The radius is deliberately asymmetric.** A symmetric two-hop radius
explodes on a pillar — CWE-284 alone has 45 children. Instead:

- **ancestors: 2 hops up** — the whole corpus has at most 5 grandparents for
  any node, so this is cheap and gives real orientation
- **children: 1 hop down, capped at 10**, sorted by each child's own direct-
  child count descending, so the structurally significant ones survive the
  cap; ties break by ID for determinism
- **lateral relations: 1 hop** — `PeerOf`, `CanPrecede`, `CanFollow`,
  `CanAlsoBe`, `Requires`, `StartsWith`

Measured against the real corpus, the resulting ego graph has a median of 4
nodes, a p90 of 8, and a p99 of 22; only 37 of 969 nodes exceed 12. The child
cap engages for 37 of them. Beyond the cap, the remainder renders as a
**`+35 more` chip** in the children band, which opens the tree drawer
expanded at that node — so the graph stays bounded and the overflow still has
somewhere real to go.

### Layout

`src/lib/layout.ts` maps the ego graph onto bands. Position carries meaning:

```
band −2      ◆ 707                          ancestors, 2 up
band −1      ● 74
band  0    ○ 352 ──── ◉ 79 ──── ○ 20        ← sequence →      center row
band +1      ○ 80   ○ 81   ○ 83             children, 1 down
```

- **Vertical axis is hierarchy.** Up is more abstract.
- **Horizontal axis is sequence.** Left of center: things that can lead *to*
  this (`CanFollow`). Right: things this can lead *to* (`CanPrecede`).
- **Non-directional relations** (`PeerOf`, `CanAlsoBe`) carry no positional
  meaning, so they are placed on whichever side balances the row and are
  distinguished by edge style instead. Lateral relations have a median of 0
  and a p90 of 2 per node, so that row is rarely crowded.

Within a band, nodes distribute evenly across the stage width and sort by ID,
making layout deterministic. Band `y` values are fractions of stage height,
read from a `ResizeObserver` on the stage, so the graph always fits.

### Rendering

Plain React SVG. A node is its abstraction shape, a mono `CWE-79` label, and
a name truncated to ~24 characters, with the full name in `<title>` and in
the detail panel. The center node is larger and carries an outer selection
halo — drawn outside the glyph, so it never reads as the Class ◉ ring.

Edges are cubic Béziers, tokenized by relation group: `ChildOf` solid and
heavier, `CanPrecede` with an arrowhead marker, `PeerOf` dashed.
**Edge labels appear only on hover or focus** — rendering all of them at rest
would reproduce the text-heaviness this redesign exists to remove.

### Interaction

Clicking any node re-centers on it through the existing `selectNode`, so the
`?cwe=` URL parameter keeps working unchanged. Hovering or focusing a node
highlights its incident edges and dims the rest. Nodes are keyed by CWE ID in
React, so nodes that survive a re-center animate to their new positions
rather than hard-cutting; the transition is suppressed under
`prefers-reduced-motion`.

### The lone-node case

25 entries — the deprecated orphans — have no edges of any kind. Their ego
graph is a single node, and it renders an explicit "No related weaknesses"
state. An empty canvas would read as a bug.

## Tree drawer

The expand/collapse logic in `Tree.tsx` is kept as-is. The interplay between
its `expanded` and `collapsed` sets is subtle, correct, and well-commented,
and rewriting it would be gratuitous risk. What changes is presentation and
roots:

- **The 35 roots become 10.** Only Pillars sit at the top level; the 25
  deprecated orphans move into a `Deprecated (25)` group, collapsed, at the
  bottom.
- Rows gain indent guides, the abstraction shape, a mono ID, and a
  selected-row highlight.
- **Multi-parent nodes get an affordance.** The 279 nodes appearing in more
  than one branch carry a `⧉` marker, and the detail panel lists every
  parent.

## Search

`searchNodes` moves out of `lib/graph.ts` into `lib/search.ts` and gains
ranking: exact ID, then ID prefix, then name-start, then name-contains, with
deprecated entries last. The UI becomes a proper `role="combobox"` with
arrow-key navigation, Enter to select, Escape to dismiss, the matched
substring highlighted, and each row showing the abstraction shape and status.
Results stay capped at 20.

## Detail panel

A card (a bottom sheet on narrow screens) containing: a title row of shape +
mono ID + name; a badge row of abstraction pill, status pill, and an explicit
warning for deprecated entries; the description set at a ~60ch measure; and
relations **grouped into labelled, collapsible sections with counts** —
Parents, Children, Peers, Sequence, Requires — each entry a clickable chip
rather than another bullet. The `View on cwe.mitre.org` link stays.

## Accessibility

- **The tree drawer is the accessible equivalent of the graph**, not an
  afterthought. Its existing `role="tree"` markup stays authoritative, and
  nothing is reachable only via the canvas.
- **Graph nodes are focusable** in DOM order matching the bands (ancestors →
  center → laterals → children), so Tab order follows the picture. Each
  carries a real label: `"CWE-79 Cross-site Scripting, Base, Stable. Child of
  CWE-74. 3 children, 2 peers."`
- **Arrow keys follow the layout's own axes** — ↑ to a parent, ↓ to a child,
  ← → along the band, Enter to re-center.
- **A visually-hidden live region announces each re-center.** The whole
  canvas changing silently is invisible to a screen reader.
- Focus is trapped in the drawer and bottom sheet, with Escape closing and
  returning focus to the trigger.
- Contrast ≥ 4.5:1 for text and ≥ 3:1 for node strokes and edges, **in both
  themes**.
- `prefers-reduced-motion` disables node transitions.

## Seams for views and categories

MITRE's `Category` (422 entries) and `View` (59 entries) constructs stay out
of scope. Two small changes keep the door open, both of which this redesign
wants for its own reasons:

1. **`prepare-data.ts` preserves `View_ID` on edges.** The attribute is
   already present on every `Related_Weakness` in the XML we download;
   `RawRelatedWeakness` currently reads only `@_Nature` and `@_CWE_ID` and
   drops it. `CweEdge` gains an optional `viewId`. Nothing consumes it yet.
   Without it, adding views later means changing the pipeline and re-deriving
   the whole graph; with it, views are purely additive.
2. **`Graph` carries an explicit `roots` set** instead of deriving roots from
   "has no parent". The redesign needs this anyway to demote the deprecated
   orphans — and it is exactly the seam a view switcher needs, since a view's
   roots are its declared members.

Two facts worth recording for whoever picks views up:

- The 10 Pillars this redesign uses as tree roots **are** view 1000's ten
  members. The current tree is an unlabelled blend of seven views: of its
  1,318 hierarchy edges, 1,086 are view 1000 and 232 come from views 700,
  928, 1003, 1194, 1305, and 1340. Adding views does not merely add a
  feature; it makes the existing hierarchy correct.
- 21 of the 59 views are Implicit or Explicit slices — flat lists with no
  hierarchy, which a tree-and-graph UI has nothing to draw for. They will
  need either a list presentation or exclusion from the switcher. Categories
  also have no `Abstraction` and a differently-shaped description, so the
  detail panel will need a Category variant.

## Structure

```
src/
  styles/tokens.css       every colour twice; space, type, motion
  styles/base.css         reset, focus-visible
  lib/graph.ts            + explicit roots, + viewId on edges   ← seams
  lib/ego.ts              NEW  buildEgoGraph()      pure
  lib/layout.ts           NEW  bands → x/y          pure
  lib/search.ts           NEW  ranked search, lifted out of graph.ts
  lib/theme.ts            NEW  read/write/persist
  components/
    AppHeader.tsx  ThemeToggle.tsx  SearchBox.tsx
    GraphStage.tsx  GraphNode.tsx  GraphEdge.tsx    NEW
    TreeDrawer.tsx                                  NEW, wraps Tree
    Tree.tsx  DetailPanel.tsx  Attribution.tsx
```

Styling is **plain CSS driven by tokens, using the BEM convention already in
the codebase** (`tree-row--selected`, `search-results__empty`,
`detail-panel--empty`). No CSS framework, no CSS-in-JS, no CSS Modules —
nothing new to learn and nothing to fight when theming.

State stays where it is: `App` owns `selectedId` and mirrors it to `?cwe=`,
and `selectNode` is unchanged — which is why a graph node, a tree row, a
search result, and a relation chip all select through the same path. The ego
graph is a `useMemo` on `(graph, selectedId, hops)`; the layout a `useMemo`
on `(ego, stageSize)`.

## Testing

The pure-function layout is what makes this testable:

- **`ego.ts`** — band assignment, the asymmetric radius, the child cap and
  its overflow chip, the isolated-node case.
- **`layout.ts`** — deterministic coordinates, even distribution within a
  band, left/right placement by sequence direction.
- **`search.ts`** — ranking order, including that `79` ranks CWE-79 first and
  that deprecated entries rank last.
- **`graph.ts`** — existing tests extended for explicit roots and `viewId`
  passthrough.
- **`prepare-data.ts`** — fixture assertion that `View_ID` survives parsing.
- **Components (RTL)** — drawer focus trap and return, combobox keyboard
  navigation, graph-node click re-centering, the deprecated group starting
  collapsed, the lone-node empty state.
- **Tokens** — a test parsing `tokens.css` and asserting contrast ratios in
  both themes. An untested contrast requirement drifts the first time someone
  nudges a hue.

Verification gate, per `CLAUDE.md`:
`npm run lint && npx tsc --noEmit && npm test`.

## Delivery

This is too large for a single PR under a workflow that requires one issue
per change. The natural split, each piece shippable and each leaving the app
working:

1. Design tokens, theming, the application shell, and the restyled tree and
   detail panel — no graph yet.
2. The two view seams, the root fix, and the deprecated grouping.
3. `ego.ts`, `layout.ts`, and the graph stage.
4. Ranked search, the combobox, and the accessibility pass.
5. Responsive behaviour and the bottom sheet.

Sequencing is the implementation plan's job, not this document's.

## Explicitly not doing

- Pan and zoom. The ego graph is sized to fit the stage; fit-to-view on every
  re-center is simpler and reads better.
- A force simulation or any graph library.
- Web fonts.
- Parsing or rendering Categories and Views.
- Rewriting `Tree.tsx`'s expand/collapse state machine.
