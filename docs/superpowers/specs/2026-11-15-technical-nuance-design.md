# Technical Nuance — Design

Part of [#210](https://github.com/mureinik/cwe-visualizer/issues/210), the
design for using what CWE 5.0 adds. This is the first feature chosen from it,
tracked in [#323](https://github.com/mureinik/cwe-visualizer/issues/323).

## Intent

CWE 5.0 (schema 8.0) adds `Technical_Nuance`, a section of formatted notes
that explains subtleties a weakness's one-line description can't hold. Today a
reader has to leave for cwe.mitre.org to see it. The detail panel should show
it for the CWE being viewed.

## What the data holds

Measured on the CWE 5.0 archive (`cwec_v5.0.xml`):

- 53 entries have a `Technical_Nuance`, all of them `Weakness` elements.
- Length ranges from about 100 to 2,400 characters of text; the median is
  about 350, and 7 are over 1,000 (CWE-79's is about 2,000).
- The content is XHTML in the `http://www.w3.org/1999/xhtml` namespace
  (prefix `xhtml:`). Only five tags are used: `p`, `ul`, `li`, `b` and `div`.
  There are no nested lists, links, code, images or entities. One attribute
  appears, `style="margin-left:1em;"`, on CWE-259.
- It comes in these shapes:
  - plain text with no tags (6 entries, e.g. CWE-147);
  - paragraphs and lists (most entries, e.g. CWE-1039);
  - bare text followed by tags (2 entries, e.g. CWE-1384, whose first
    sentence sits outside any `p`);
  - a `div` wrapping an `li`'s content (8 items, e.g. CWE-1384), or `p`s
    inside an `li` (CWE-79), both with `b` lead-ins;
  - an indented block: one styled `div` holding one `div` per line
    (CWE-259 only).
- The source is hand-wrapped and hand-indented, with line breaks mid-sentence
  (CWE-1059) and mixed tabs and spaces. That whitespace carries no meaning.
- Weakness descriptions have no markup in 5.0, and 4.x has no
  `Technical_Nuance` at all.

## Goals

- Show a weakness's Technical_Nuance in the detail panel.
- Keep MITRE's formatting: paragraphs, bullet lists, bold, and the line
  breaks MITRE marks with `div`.
- Fail the build on any markup the conversion doesn't know, so new markup is
  a deliberate decision rather than something passed through unseen.

## Non-goals

- Searching nuance text. That belongs with the browse/search work, the
  other #210 feature.
- Other 5.0 content: Groupings, Views, Dimensions, Custom_Phases.
- Rendering markup in descriptions (there is none in 5.0).
- Any change for the 4.x releases. They have no nuance to show.

## Anti-goals

- **Raw HTML from MITRE reaching the page.** The app must never set
  `innerHTML` (or `dangerouslySetInnerHTML`) from CWE data.
- **Lists MITRE didn't write.** A list appears only where the source uses
  `ul`/`li`. CWE-259's indented lines are not turned into one.
- **Hard wraps from the source file.** The XML's own line breaks are not line
  breaks on screen.
- **A detail panel whose relations are pushed out of sight.** CWE-79's 2,000
  characters must not bury Parents and Children, least of all on the phone's
  bottom sheet.

## Constraints

- The app reads only the prebuilt `public/data/cwe.json`; the conversion runs
  at build time in `scripts/prepare-data.ts`. The `CweNode` type in
  `src/lib/cwe-data.ts` is shared by both.
- `fast-xml-parser`'s settings as `prepare-data.ts` uses them lose the order
  of mixed content, which puts CWE-1384's opening sentence last. They also
  trim text, so `<b>Interference: </b>EMI` becomes "Interference:EMI".
  Reading nuance needs `preserveOrder` with trimming off. The rest of the
  catalog keeps its current parse, so nothing else changes.
- Packages used only by the data step stay in `devDependencies`. No new
  runtime dependency.
- New tests get classified as real-world or theoretical (CONTRIBUTING).
  Fixtures go in `test/fixtures/`.

## Approaches

1. **Convert at build time to a small fixed structure, rendered with ordinary
   React elements.** (Chosen.) The build reads the XHTML, checks it against
   the known shapes, and writes blocks of text runs into `cwe.json`. The app
   never sees markup, and unknown markup fails the build where it's caught
   once, not in every reader's browser.
2. **Ship sanitised HTML and inject it.** This keeps any future markup
   working without code changes, but it needs a sanitiser in the app (a new
   runtime dependency) and puts MITRE's HTML on the page, which is the
   anti-goal above.
3. **Flatten to plain text.** This is simplest, but it loses the lists and
   bold that make the long entries (CWE-79, CWE-1384) readable.

## Decisions

### Data

`CweNode` gains an optional field, present only for weaknesses that have a
nuance:

```ts
interface NuanceRun { text: string; bold?: true }
type NuanceLine = NuanceRun[];
type NuanceBlock =
  | { kind: 'paragraph'; lines: NuanceLine[] }
  | { kind: 'list'; items: NuanceLine[][] };

interface CweNode {
  // ...existing fields
  technicalNuance?: NuanceBlock[];
}
```

A paragraph or list item is one or more lines. Lines are shown one under
another with no gap; blocks are spaced apart.

### Conversion rules

At the top level of `Technical_Nuance`:

- Bare text becomes a paragraph of one line.
- `p` becomes a paragraph of one line.
- `div` is accepted only when it holds nothing but `div`s (CWE-259). It
  becomes one paragraph with one line per inner `div`, with no bullet and no
  indent.
- `ul` becomes a list. It may hold only `li`s, apart from whitespace.

Inside an `li`:

- Bare text and `b` form one line.
- Each `div` or `p` child becomes a line of its own.

Inside a `p`, a line `div` or an `li`: text and `b`, where `b` holds only
text, becomes a bold run.

Whitespace: every run of spaces, tabs and newlines collapses to one space, and
each line is trimmed at both ends. Empty lines and blocks are dropped.

Strictness: any other element, any element in another position, or any
attribute other than `style` on a top-level `div` fails the build. The error
names the CWE and the element's path, e.g. `CWE-123: unsupported <xhtml:a>
in Technical_Nuance > p`. The `style` value is ignored either way, since the
indent isn't rendered.

### Display

- A "Technical nuance" disclosure in the detail panel, between the
  description and the "View on cwe.mitre.org" link. CWEs without a nuance
  show nothing.
- Closed by default for every CWE, short entries included, so the panel
  behaves the same everywhere.
- Paragraphs, lists and bold rendered as `p`, `ul`/`li` and `strong`, built
  from the structure above.

```text
┌ CWE-79: Improper Neutralization of Input… ┐
│ [Base] [Stable]                            │
│ The product does not neutralize…           │
│ ▸ Technical nuance                         │
│ View on cwe.mitre.org                      │
│ Parents (2) …                              │
```

CWE-259 opened:

```text
There are two main variations of a hard-coded password:

Inbound: the product contains an authentication mechanism that checks
for a hard-coded password.
Outbound: the product connects to another system or component, and it
contains a hard-coded password for connecting to that component.
```

## Calls made in design (not the maintainer's; correct if wrong)

- Use the native `<details>`/`<summary>` for the disclosure. It is
  keyboard- and screen-reader-accessible with no extra code.
- The disclosure closes again when another CWE is selected, rather than
  carrying its open state across selections.
- `style` is allowed by attribute name on a top-level `div` only. Its value
  isn't checked, since it's discarded.
- A known tag in an unknown position (a `ul` inside a `p`, say) fails the
  build just like an unknown tag.

## Left to the builder

- How the nuance is located and parsed with `preserveOrder`: a second parse
  of the document, or of each `Technical_Nuance` element. Either way the
  existing parse's output must not change.
- Line spacing and styling, using the existing design tokens. Lines within a
  block need no gap; blocks are spaced like other panel text.
- Test fixtures: one per shape above, taken from the real entries (CWE-147,
  1039, 1384, 79, 259), plus failures for an unknown tag, a known tag out of
  place and an unknown attribute. These are real-world: they cover today's
  data, or a MITRE format change outside our control.
