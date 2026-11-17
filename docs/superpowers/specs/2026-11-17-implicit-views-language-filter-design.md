# Implicit Views and Language Filter — Design

Tracked in [#326](https://github.com/mureinik/cwe-visualizer/issues/326).
It builds on the view, group and phase filter
([design](2026-11-16-view-group-phase-filter-design.md), #327), which left
implicit views out.

## Intent

The filter offers only views that list their members (Graph and Explicit).
CWE 5.0 has 15 live **implicit** views, whose members are whatever matches an
XPath `Filter`, and some of them group weaknesses no other filter can reach,
such as Mobile or ISA/IEC 62443. Four of them are per programming language
(C, C++, Java, PHP), and the language is one of the most obvious things a
reader wants to filter by. So this change does two things:

1. Evaluate implicit views at build time and offer the ones that add
   something to the View picker.
2. Add a **Language** filter, built from each weakness's
   `Applicable_Platforms`, that answers "what should I worry about in my C
   code?" rather than "what does MITRE tie to C by name?". That answer takes
   an opinion of ours, so the UI says so.

## What the data holds

Measured on `cwec_v5.0.xml`. The root element is in the
`http://cwe.mitre.org/cwe-8` default namespace. MITRE's filters are written
without a prefix, so an XPath 1.0 engine matches nothing unless the
namespace is removed first.

**Implicit views (17, 15 live):**

| View | Filter (abridged) | Matches | Decision |
| --- | --- | --- | --- |
| 1040 Quality Weaknesses with Indirect Security Impacts | `Weakness[…Ordinality='Indirect']` | 114 | offer |
| 1424 ISA/IEC 62443 | `Weakness[…@Taxonomy_Name='ISA/IEC 62443']` | 39 | offer |
| 919 Mobile Applications | `Weakness[…Technology/@Class='Mobile']` | 21 | offer |
| 678 Composites | `Weakness[@Structure='Composite'][not(@Status='Deprecated')]` | 4 | offer |
| 709 Named Chains | `Weakness[@Structure='Chain']` | 3 | offer |
| 658, 659, 660, 661 C, C++, Java, PHP | `Weakness[…Language/@Name='C']` | | skip: the Language filter |
| 701 Introduced During Design | Base or Class, and phase Architecture and Design | | skip: the Phase filter |
| 702 Introduced During Implementation | phase Implementation | | skip: the Phase filter |
| 677 Weakness Base Elements | `@Abstraction='Base'` | | skip: an abstraction, not a set |
| 2000 Comprehensive CWE Dictionary | `/Weakness_Catalog/*[…]/*` | | skip: everything |
| 604 Deprecated Entries | `/Weakness_Catalog/*/*[@Status='Deprecated']` | | skip: the tree's Deprecated section |
| 1081 Entries with Maintenance Notes | `/Weakness_Catalog/*/*[Notes/…]` | | skip: an editorial list |
| 679, 999 | `/Weakness_Catalog[false()]` | | Deprecated, already excluded |

None of the five offered views matches a deprecated weakness in 5.0.

**Languages** (`Applicable_Platforms/Language`, 956 live weaknesses, 9 with
no `Language` element):

- 18 names are in use, by weaknesses naming each: C 103, C++ 97, Java 84,
  Python 60, Go 28, PHP 26,
  C# 23, Verilog 16, VHDL 15, Perl 12, JavaScript 10, ASP.NET 10, SQL 5,
  Ruby 3, XML 3, Rust 2, VB.NET 1, Other 1.
- Others are given by class instead: Not Language-Specific 770,
  Memory-Unsafe 31, Object-Oriented 10, Interpreted 8, Compiled 5,
  Assembly 5, Hardware Description Language 3.
- 276 weaknesses name at least one language. 103 of them are also marked
  Not Language-Specific.
- Taking "applies to C" literally, with Not Language-Specific included,
  matches 849 of 956, about 89%, which narrows almost nothing:

  | C filter includes | Weaknesses |
  | --- | --- |
  | Entries that name C | 103 |
  | + classes mapped to C (Memory-Unsafe, Compiled) | 106 |
  | + Not Language-Specific | 849 |

  Python goes 60 → 75 → 798 and Java 84 → 93 → 856. 48 of the Not
  Language-Specific entries are hardware weaknesses.

## Goals

- Offer the five implicit views above in the View picker, with their members
  worked out at build time.
- Filter by one language, combined with view, group and phase: a CWE has to
  match all of them.
- By default, a language matches the weaknesses that name it, plus those
  whose language class we map to it. A checkbox adds the Not
  Language-Specific ones.
- Say in the UI, next to the control, which classes a language includes
  and that the mapping is ours.
- Fail the build on anything the conversion doesn't expect, as `nuance.ts`,
  `phases.ts` and `views.ts` do.

## Non-goals

- More than one language at a time ("C or C++").
- Filtering by technology (Web, ICS/OT, AI/ML…) beyond what view 919 gives.
- Implicit views over categories or views (2000, 604, 1081).
- Showing a CWE's languages in the detail panel.
- Any change for the 4.x releases.

## Anti-goals

- **Running XPath at runtime.** The app reads only `cwe.json`; everything is
  worked out at build time.
- **Passing our mapping off as MITRE's.** A reader must be able to see that
  "C includes memory-unsafe languages" is our call.
- **A language filter that filters nothing by default.** That is why Not
  Language-Specific is opt-in.
- **Telling readers how a view is defined.** Implicit and explicit views sit
  in one list with no marker. The reader cares what is in a view, not how
  MITRE works it out.

## Constraints

- Everything from the earlier design still holds: the app never contacts
  MITRE, `public/data/` is build output, fixtures go in `test/fixtures/`,
  and new tests get classified as real-world or theoretical.
- New packages for the data step are dev dependencies (CONTRIBUTING).
- No new runtime dependency.
- The phone layout (412×680) has to fit the extra control and note.

## Approaches

For evaluating the filters:

1. **`xpath` + `@xmldom/xmldom` as dev dependencies.** (Chosen.) Parse the
   XML a second time into a DOM, with the default namespace removed, and run
   each filter. fast-xml-parser keeps doing everything else. Both libraries
   are mature, pure JS and widely used, and XPath 1.0 covers every filter in
   5.0. The cost is two dev dependencies and a second parse of a 19 MB file,
   a few seconds at build time.
2. **jsdom's `document.evaluate`.** No new package, but the build would
   depend on a test library, jsdom's XPath is old and slow, and loading the
   catalog into it takes a lot of memory.
3. **fontoxpath + slimdom.** XPath 3.1, far more than needed, from a heavier
   dependency.

Hand-coding the few filter shapes in use, from the issue, was set aside in
favour of a library.

For what a language matches (decided with the maintainer):

1. Everything that applies, including Not Language-Specific: faithful, but
   about 89% of the catalog.
2. Language-specific only, with a note that language-agnostic weaknesses
   also apply.
3. **Language-specific by default, with a checkbox for the rest.** (Chosen.)

## Decisions

### Implicit views (build)

- A new module beside `scripts/views.ts` evaluates the filter of each
  implicit view on an **offer list** (919, 1424, 678, 709, 1040). Its
  members go into `CweView.memberIds` like any other view's, and `groupIds`
  is empty.
- A **skip list** holds the other live implicit views, each with a comment
  giving the reason from the table above.
- The build fails on:
  - a live implicit view on neither list, so a new one in a future release
    is a decision, not a silent addition;
  - an offered view whose filter doesn't evaluate, or matches no weaknesses;
  - a match that isn't a `Weakness` in the catalog;
  - an offered view that is now Deprecated or Obsolete, no longer
    implicit, or missing from the release, which also means the lists need
    revisiting.
- Offered views are sorted into the View list by name, like the others.
  View 1000 stays first.

### Language data (build)

- A new `scripts/languages.ts`, used by `prepare-data.ts`, reads
  `Applicable_Platforms/Language` through the existing fast-xml-parser pass,
  the way `phases.ts` reads introductions. No XPath is needed.
- It holds the class-to-language mapping, which is ours:

  | Class | Languages |
  | --- | --- |
  | Memory-Unsafe | C, C++ |
  | Compiled | C, C++, Go, Rust |
  | Interpreted | Python, PHP, Perl, Ruby, JavaScript |
  | Object-Oriented | C++, Java, C#, Python, PHP, Ruby, VB.NET, JavaScript |
  | Hardware Description Language | Verilog, VHDL |
  | Not Language-Specific | none: it is the checkbox |
  | Assembly | none: no named language is assembly |

- The build fails on a language name or class it doesn't know, so a new one
  is a decision. "Other" is known and offered as nothing.
- `cwe.json` gains, optionally like `views` and `phases` so hand-built test
  data stays valid:
  - `languages`: one entry per offered language, sorted by name, with its
    `name`, the `classes` mapped to it, and the sorted `memberIds` it
    matches (by name or by class);
  - `languageAgnosticIds`: the sorted weaknesses marked Not
    Language-Specific.
- Deprecated weaknesses are matched the same way as live ones, as views
  treat them today.
- A mapped language that no weakness names, directly or by class, in a
  release is not offered.
- `readLocalMeta` must treat a local `cwe.json` without `languages` as
  stale, like the existing `catalogDate` check, so data written before this
  change is regenerated rather than kept because its version matches the
  pin.

### Matching

- `Filter` gains `language: string | null` and `anyLanguage: boolean`.
- With a language set, a CWE matches when it is in that language's
  `memberIds`, or, with `anyLanguage`, in `languageAgnosticIds`. This is
  combined with view, group and phase by AND.
- `anyLanguage` has no effect without a language and is never stored without
  one: clearing the language clears it. Changing to another language keeps
  it.
- `filterCount` counts the language as one filter, checkbox or not.

### Controls

A Language row goes between Group and Phase in the filter panel:

```text
Language  [C                 ▾]   Clear language
          ☐ Also show weaknesses that apply to any language (+743)
          Weaknesses MITRE ties to C, or to memory-unsafe or compiled
          languages. Which languages count as which is our call, not MITRE's.
Phase     [Any phase         ▾]   Clear phase
```

- The picker is a plain list like Phase, starting on "Any language".
- The checkbox is shown only once a language is chosen. Its count is the
  number of weaknesses it would add: those in `languageAgnosticIds` and not
  already in the language's members.
- The note is shown only once a language is chosen. It is generated from the
  language's `classes`, so it can't drift from the mapping. For a language
  with no classes, it reads "Weaknesses MITRE ties to SQL." and leaves out
  the second sentence.
- "Clear all" clears the language and the checkbox too.
- **Filter bar:** one chip, `C ×`, or `C + any language ×` with the
  checkbox ticked. Removing it clears both.
- The views MITRE defines by language (658–661) are not offered, so there is
  no second way to filter by C.

### URL

- `&language=<name>` and `&anyLanguage=1`, handled like the other
  parameters: written with `replaceState`, read once on load, and a value
  this release doesn't have is dropped and named in the filter bar.
- `anyLanguage` without `language`, or with a value other than `1`, is
  dropped.
- Both parameters take only a closed list of values, an allowlist, so the
  address can't be used for cross-site scripting. `language` must equal a
  language this release offers, and `anyLanguage` must be exactly `1`.
  Anything else is dropped before it reaches the filter or the page, and
  tests cover markup, script URLs, quote breakouts, case and whitespace
  variants and object keys.
- Language names contain `+` and `#` (C++, C#), so they must survive
  `URLSearchParams` both ways, and the "dropped" label needs a safe-value
  pattern that admits them. A hand-typed `?language=C++` reads as C followed by two spaces
  and is dropped like any unknown value; it isn't repaired.

## Calls made in design (not the maintainer's; correct if wrong)

- The offer and skip lists above, including skipping 677, 701 and 702.
- The class-to-language mapping above.
- "Other" is not offered as a language.
- The checkbox adds Not Language-Specific entries exactly as MITRE marks
  them, the 48 hardware ones included.
- The Language row sits between Group and Phase.
- Languages are listed by name, not by how many weaknesses they have.
- The URL parameter names `language` and `anyLanguage`.
- Changing the language keeps the checkbox as it was.
- A hand-typed, unencoded `language=C++` is dropped, not repaired.
- A mapped language with no members in a release is not offered.
- On the phone, the panel's bottom sheet already scrolls, so "fits" means
  no horizontal overflow, not fitting without scrolling.

## Left to the builder

- The module layout for the XPath step and how the namespace is removed
  (stripping the root's `xmlns` from the text before parsing is enough).
- Exact wording and styling of the note and checkbox, within the existing
  tokens, and how the note is tied to the control for screen readers.
- Fixtures: replace the fixture's implicit view (its filter today starts
  `/Weakness[`, a shape MITRE doesn't use) with real-shaped ones, and add
  weaknesses with named languages, language classes and Not
  Language-Specific. Add failure cases for an unknown implicit view, an
  unknown language, an unknown class and a filter matching nothing. These
  are real-world: today's data, or a MITRE change outside our control.
- Splitting the work into tasks.

View 658 stays unoffered (it is on the skip list), so the existing
real-world tests that expect it left out, in `test/scripts/views.test.ts`
and `test/scripts/prepare-data.test.ts`, keep their meaning. If the
fixture's implicit view changes, they change with it, as an intended
change.
