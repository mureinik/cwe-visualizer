# Technical Nuance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each weakness's CWE 5.0 `Technical_Nuance` in the detail panel, converted at build time from MITRE's XHTML into a fixed structure, with any unknown markup failing the build.

**Architecture:** `prepare-data.ts` marks `Technical_Nuance` as a `fast-xml-parser` stop node, so the catalog parse is otherwise unchanged and each nuance arrives as its raw inner XML. A new `scripts/nuance.ts` parses that fragment with `preserveOrder` and converts it to `NuanceBlock[]`, throwing on anything outside the known shapes. The app renders the blocks in a new `TechnicalNuance` component inside a native `<details>`.

**Tech Stack:** TypeScript, `fast-xml-parser` 5.12 (dev dependency, build time only), React, Vitest with Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-15-technical-nuance-design.md`

## Global Constraints

- The app never sets `innerHTML` or `dangerouslySetInnerHTML` from CWE data. Rendering uses React elements only.
- A list appears only where the source uses `ul`/`li`.
- Whitespace runs (spaces, tabs, newlines) collapse to one space; each line is trimmed at both ends; empty lines and blocks are dropped.
- Any element, position or attribute outside the conversion rules fails the build, naming the CWE and the element's path.
- No new dependency. The existing catalog fields must parse exactly as today.
- Every new test is classified (CONTRIBUTING, "Real-world and theoretical tests"); fixtures go in `test/fixtures/`.
- Verify with `npm run lint && npx tsc --noEmit && npm test` (and `npm run lint:css` for CSS, `npm run lint:md` for Markdown).
- Commit messages are conventional (`feat:`, `test:`, `docs:`) and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never `--no-verify`.

## Review Focus

1. **Text that looks like a number** (an `li` reading `2026`): `fast-xml-parser` turns it into a number unless `parseTagValue` is off. It must stay the string `"2026"`. The test goes in Task 1.
2. **A space that sits only at a run boundary** (`<b>Interference: </b>EMI`, `see <b>this</b> note`): it must survive as exactly one space, never doubled and never lost. The test goes in Task 1.
3. **An entity in the text** (`&amp;`, `&lt;`), which the schema allows though 5.0 has none: it must show as `&` and `<` and never become markup. The test goes in Task 1.
4. **A self-closed or empty element** (`<xhtml:p/>`, `<Technical_Nuance/>`): it is dropped, with no empty paragraph and no `technicalNuance` field. The tests go in Tasks 1 and 2.
5. **Switching from a CWE with an open nuance to another CWE:** the next CWE's nuance starts closed. The test goes in Task 3.

---

### Task 1: Convert a nuance fragment to blocks

**Files:**

- Modify: `src/lib/cwe-data.ts` (types only)
- Create: `scripts/nuance.ts`
- Test: `test/scripts/nuance.test.ts` (`// @vitest-environment node`, like `prepare-data.test.ts`)

**Interfaces:**

- Produces, in `src/lib/cwe-data.ts`:

  ```ts
  export interface NuanceRun { text: string; bold?: true }
  export type NuanceLine = NuanceRun[];
  export type NuanceBlock =
    | { kind: 'paragraph'; lines: NuanceLine[] }
    | { kind: 'list'; items: NuanceLine[][] };
  // CweNode gains:
  technicalNuance?: NuanceBlock[];
  ```

  Document `technicalNuance` with a comment: present only when the weakness has a non-empty nuance; built by `scripts/nuance.ts`.
- Produces, in `scripts/nuance.ts`: `export function parseNuance(raw: string, cweId: string): NuanceBlock[]`. `raw` is the element's inner XML exactly as the stop node returns it (the `xhtml:` prefix kept, whitespace intact).

- [ ] **Step 1: Write the failing tests**

  Inputs are trimmed copies of the real 5.0 entries (an inline `xhtml:` prefix with no namespace declaration is what the stop node returns). Real-world unless marked. Each `it` asserts `parseNuance(input, '<id>')` with `toEqual`:

  - `'keeps plain text as one paragraph'`: CWE-147's text with its tab and newline padding → `[{ kind: 'paragraph', lines: [[{ text: 'For example, a "." in SMTP signifies the end of mail message data, whereas a null character can be used for the end of a string.' }]] }]`.
  - `'turns paragraphs and lists into blocks, in order'`: CWE-1039's `p` and a 2-item `ul` → paragraph then `{ kind: 'list', items: [[[{ text: 'automated speech recognition' }]], [[{ text: 'automated image recognition' }]]] }`.
  - `'keeps bare text before a paragraph first'`: CWE-1384's opening sentence, then its `p`, then a `ul` whose `li` wraps a `div` holding `<xhtml:b>Interference: </xhtml:b>electromagnetic interference (EMI), etc.` → three blocks in source order; the item's one line is `[{ text: 'Interference: ', bold: true }, { text: 'electromagnetic interference (EMI), etc.' }]`.
  - `'makes each p inside a list item a line of it'`: CWE-79's shape, one `li` holding two `p`s each starting with a `b` → one item with two lines.
  - `'gives each div of an indented block its own line, without a list'`: CWE-259 verbatim, including `style="margin-left:1em;"` → `[paragraph('There are two main variations of a hard-coded password:'), { kind: 'paragraph', lines: [[{ text: 'Inbound: …' }], [{ text: 'Outbound: …' }]] }]`, full sentences as in the spec.
  - `'treats the source's line breaks as spaces'`: CWE-1059's hand-wrapped `p` → one line reading `Documentation elements might include the product's usage, structure, architectural components, interfaces, design, implementation, configuration, operation, etc.`
  - Review Focus 1, `'keeps text that looks like a number as a string'`: `<xhtml:ul><xhtml:li>2026</xhtml:li></xhtml:ul>` → item text `'2026'` (a string).
  - Review Focus 2, `'keeps exactly one space across a bold boundary'`: `<xhtml:p>see  <xhtml:b> this </xhtml:b>  note</xhtml:p>` → `[{ text: 'see ' }, { text: 'this ', bold: true }, { text: 'note' }]`; and `<xhtml:p><xhtml:b>A:</xhtml:b>b</xhtml:p>` → `[{ text: 'A:', bold: true }, { text: 'b' }]`, with no space invented.
  - Review Focus 3, `'decodes entities as text'`: `<xhtml:p>a &amp; b &lt;c&gt;</xhtml:p>` → `'a & b <c>'`.
  - Review Focus 4, `'drops empty elements'`: `<xhtml:p/><xhtml:p>  </xhtml:p>` → `[]`; `''` → `[]`.
  - `'fails on markup it does not know'` (real-world: schema 8.0 allows any XHTML, so this is a MITRE format change, not a mistake). Use `toThrow` with the exact messages:
    - `<xhtml:p>a<xhtml:br/>b</xhtml:p>` with id `'123'` → `CWE-123: unsupported <xhtml:br> in Technical_Nuance > p`
    - `<xhtml:ol><xhtml:li>x</xhtml:li></xhtml:ol>` → `CWE-123: unsupported <xhtml:ol> in Technical_Nuance`
    - a known tag out of place, `<xhtml:p><xhtml:ul><xhtml:li>x</xhtml:li></xhtml:ul></xhtml:p>` → `CWE-123: unsupported <xhtml:ul> in Technical_Nuance > p`
    - `<xhtml:b>x</xhtml:b>` at the top level → `CWE-123: unsupported <xhtml:b> in Technical_Nuance`
    - a top-level `div` holding text → `CWE-123: unexpected text in Technical_Nuance > div`
    - text directly in a `ul` → `CWE-123: unexpected text in Technical_Nuance > ul`
    - `<xhtml:p class="x">y</xhtml:p>` → `CWE-123: unsupported attribute class on <xhtml:p> in Technical_Nuance`
    - `style` on an inner `div` (inside a top-level `div` or an `li`) → `CWE-123: unsupported attribute style on <xhtml:div> in Technical_Nuance > div`, and `… in Technical_Nuance > ul > li`.
  - Theoretical (schema forbids non-XHTML elements in `StructuredTextType`), in a nested `describe` tagged `theoretical` with that reason in a comment: `'fails on an element outside the XHTML namespace'`, `<Note>x</Note>` → `CWE-123: unsupported <Note> in Technical_Nuance`.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run test/scripts/nuance.test.ts`
  Expected: FAIL, because `scripts/nuance.ts` doesn't exist.

- [ ] **Step 3: Add the types to `src/lib/cwe-data.ts` and implement `parseNuance` in `scripts/nuance.ts`**

  Parse `` `<Technical_Nuance>${raw}</Technical_Nuance>` `` with `new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false, parseTagValue: false })`. Each element node is `{ [tagName]: children[], ':@'?: { '@_name': value } }`, and each text node is `{ '#text': string }`.

  Walk with the context-specific rules from the spec ("Conversion rules"): top level (bare text, `p`, `div` of `div`s, `ul`), `ul` (only `li` plus whitespace), `li` (inline content forms one line; each `div` or `p` child is its own line), and inline (text plus `b`, where `b` holds only text). Paths in errors use the names without the `xhtml:` prefix, joined with `>`, starting at `Technical_Nuance`. The offending element keeps its full tag name. Allow only the `style` attribute, and only on a top-level `div`.

  Whitespace, applied per line: collapse each run's whitespace to one space; when a run starts with a space and the previous run ends with one, drop the leading space; trim the start of the first run and the end of the last run; drop empty runs. Then drop empty lines, and blocks left with no lines or items.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npx vitest run test/scripts/nuance.test.ts`
  Expected: PASS.

- [ ] **Step 5: Lint, type-check, commit**

  Run: `npm run lint && npx tsc --noEmit`. Expected: no errors.

  ```bash
  git add src/lib/cwe-data.ts scripts/nuance.ts test/scripts/nuance.test.ts
  git commit -m "feat: convert Technical_Nuance XHTML into blocks"
  ```

### Task 2: Read nuance in the catalog parse

**Files:**

- Modify: `scripts/prepare-data.ts` (`RawWeakness`, the `XMLParser` options in `parseCatalog`, node building)
- Modify: `test/fixtures/cwec-sample.xml` (add a `Technical_Nuance` to CWE-79, and an empty `<Technical_Nuance/>` to CWE-80)
- Test: `test/scripts/prepare-data.test.ts`

**Interfaces:**

- Consumes: `parseNuance(raw: string, cweId: string): NuanceBlock[]` from Task 1.
- Produces: `cwe.json` nodes carrying `technicalNuance` when non-empty.

- [ ] **Step 1: Write the failing tests** in the `parseCatalog` block

  The fixture's CWE-79 nuance has an `xhtml:p` and a 2-item `xhtml:ul`, uses the `xhtml:` prefix, and declares `xmlns:xhtml="http://www.w3.org/1999/xhtml"` on `Weakness_Catalog` as 5.0 does.

  - `'converts a weakness's Technical_Nuance into blocks'`: `data.nodes['79'].technicalNuance` equals the expected paragraph and list.
  - `'omits technicalNuance when a weakness has none or an empty one'` (Review Focus 4): `'technicalNuance' in data.nodes['74']` and `… in data.nodes['80']` are both `false`.
  - `'fails the parse on unsupported nuance markup, naming the CWE'`: `parseCatalog` on the fixture text with CWE-79's `xhtml:p` replaced by `xhtml:ol` throws `/^CWE-79: unsupported <xhtml:ol>/`.
  - The existing `'parses every weakness into a node'` and edge tests must pass unchanged.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run test/scripts/prepare-data.test.ts`
  Expected: the three new tests FAIL; the rest PASS.

- [ ] **Step 3: Implement**

  Add `stopNodes: ['Weakness_Catalog.Weaknesses.Weakness.Technical_Nuance']` to the existing parser options. Type `Technical_Nuance?: string` on `RawWeakness`; an empty element arrives as `''`. When the result of `parseNuance(w.Technical_Nuance, id)` is non-empty, assign `technicalNuance` conditionally, as the code already does for `viewId`, so the key is absent otherwise.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npx vitest run test/scripts/prepare-data.test.ts`
  Expected: PASS.

- [ ] **Step 5: Run against the real 5.0 catalog**

  Run: `npm run prepare-data` (delete `public/data/` first so it re-downloads), then
  `node -e "const d=require('./public/data/cwe.json');const n=Object.values(d.nodes).filter(x=>x.technicalNuance);console.log(n.length, JSON.stringify(d.nodes['259'].technicalNuance))"`.
  Expected: no error, and `53`, with CWE-259 as one paragraph plus one two-line paragraph. Spot-check CWE-79, CWE-147, CWE-1059 and CWE-1384 against the spec's shapes.

- [ ] **Step 6: Commit**

  ```bash
  git add scripts/prepare-data.ts test/fixtures/cwec-sample.xml test/scripts/prepare-data.test.ts
  git commit -m "feat: read Technical_Nuance from the CWE catalog"
  ```

### Task 3: Show the nuance in the detail panel

**Files:**

- Create: `src/components/TechnicalNuance.tsx`
- Modify: `src/components/DetailPanel.tsx` (between the description and the MITRE link)
- Modify: `src/styles/detail.css`
- Test: `test/components/TechnicalNuance.test.tsx`, `test/components/DetailPanel.test.tsx`

**Interfaces:**

- Consumes: `NuanceBlock` and `CweNode.technicalNuance` from Task 1.
- Produces: `export function TechnicalNuance({ blocks }: { blocks: NuanceBlock[] })`.

- [ ] **Step 1: Write the failing tests**

  `TechnicalNuance.test.tsx`:

  - `'is a closed disclosure titled Technical nuance'`: the `group` named `Technical nuance`, a `<details>`, has no `open` attribute, and its summary text is `Technical nuance`.
  - `'opens to show paragraphs, lists and bold'`: after `userEvent.click` on the summary, `details` is open; a `paragraph` block renders a `<p>`; a `list` block renders a `list` with one `listitem` per item; a bold run renders as `<strong>`.
  - `'puts each line of a block on its own line'`: a two-line paragraph renders two `.technical-nuance__line` elements inside one `<p>`.
  - `'shows markup in the text as text'`: a run of `'<img src=x onerror=alert(1)>'` is found with `getByText`, and the container has no `img`.

  `DetailPanel.test.tsx`: give fixture node `'79'` a `technicalNuance` of one paragraph.

  - `'shows Technical nuance between the description and the MITRE link'`: the disclosure exists, and `compareDocumentPosition` puts it after the description and before the link.
  - `'shows no Technical nuance for a CWE without one'`: `queryByText('Technical nuance')` is null for `'74'`.
  - Review Focus 5, `'starts the next CWE's nuance closed'`: give `'20'` a nuance too, open `'79'`'s, `rerender` with `selectedId="20"`, and the disclosure is closed.

- [ ] **Step 2: Run the tests and confirm they fail**

  Run: `npx vitest run test/components/TechnicalNuance.test.tsx test/components/DetailPanel.test.tsx`
  Expected: the new tests FAIL.

- [ ] **Step 3: Implement**

  `TechnicalNuance` renders `<details className="technical-nuance">` with `<summary className="technical-nuance__summary">Technical nuance</summary>`. Paragraphs become `<p className="technical-nuance__paragraph">`, lists become `<ul className="technical-nuance__list">` with one `<li>` per item, each line becomes `<span className="technical-nuance__line">`, and bold runs become `<strong>`. Keys may be array indices, since the content is static per CWE. In `DetailPanel`, render `<TechnicalNuance key={node.id} blocks={node.technicalNuance} />` when the field is present. The `key` gives each CWE a fresh, closed disclosure.

  CSS in `detail.css`, using only existing tokens: `.technical-nuance` with `margin: 0 0 var(--space-3)` and `max-width: 60ch`. The summary takes the `.detail-panel__link` size (`var(--text-sm)`) and `cursor: pointer`. The body text takes `.detail-panel__description`'s colour and size. `.technical-nuance__line` is `display: block` with no margin between lines, and paragraphs and lists are spaced `var(--space-2)` apart.

- [ ] **Step 4: Run the tests and confirm they pass**

  Run: `npx vitest run test/components/TechnicalNuance.test.tsx test/components/DetailPanel.test.tsx`
  Expected: PASS.

- [ ] **Step 5: Check it in the browser**

  With `npm run dev`, open `?cwe=79`, `?cwe=259` and `?cwe=1384` at 1280×800 and at 412×680 in both themes. Expect the disclosure closed by default and readable when opened. On the phone sheet, expect Parents and Children reachable by scrolling. Also open `?cwe=74` and expect no disclosure.

- [ ] **Step 6: Full verification and commit**

  Run: `npm run lint && npm run lint:css && npx tsc --noEmit && npm test`. Expected: all pass.

  ```bash
  git add src/components/TechnicalNuance.tsx src/components/DetailPanel.tsx src/styles/detail.css test/components/TechnicalNuance.test.tsx test/components/DetailPanel.test.tsx
  git commit -m "feat: show Technical_Nuance in the detail panel"
  ```

### Task 4: Hand over the PR

- [ ] **Step 1:** Push the branch. Then update PR #325's title to `feat: show Technical_Nuance in the detail panel` and its body: `Closes #323`, `Closes #324`, what each commit does, and verification (the test count, the real-catalog count of 53, the browser check), keeping the design's decisions and the calls made. Leave it a draft for the owner to review. Once Vercel posts the PR's preview URL, give it.
