# Alternate Terms and Former Names — Design

Covers [#345](https://github.com/mureinik/cwe-visualizer/issues/345)
(alternate terms) and
[#358](https://github.com/mureinik/cwe-visualizer/issues/358) (former
names) in one design, since both are other names for the same entry.
[#361](https://github.com/mureinik/cwe-visualizer/issues/361) (CWE 5.0
term roles) builds on this and stays out of it.

## Intent

People search for weaknesses by the names they know: "XSS", "CSRF",
"SQLi". MITRE records those as a weakness's `Alternate_Terms`, and records
the names an entry used to have as `Content_History/Previous_Entry_Name`.
The app reads neither. Search matches only the ID and the current name,
so "XSS" doesn't find CWE-79, "CSRF" doesn't find CWE-352, and since CWE
5.0 renamed CWE-89 to "Improper Neutralization of Special Elements used in
an SQL Command", nothing in its name says "SQL Injection" any more. Older
documents, tools and CVEs also use former names, and so do people: view
1000 was "Research Concepts" until 5.0.

The reader should:

- find a weakness by any of its alternate terms or former names;
- find a view in the filter's View picker by a former name;
- see why a result matched when the visible name doesn't contain the
  query;
- see a weakness's alternate terms, with MITRE's descriptions, and its
  former names, with dates, in the detail panel.

## What the data holds

Measured on the CWE 5.0 archive (`cwec_v5.0.xml`) and schema
(`cwe_schema_v8.0.xsd`).

**Alternate terms:**

- 222 `Alternate_Term` elements on 129 weaknesses. No category or view has
  any.
- Each has a required `Term` (`xs:string`), optional `Role` elements
  ([#361](https://github.com/mureinik/cwe-visualizer/issues/361)'s, not read here), and an optional `Description` of type
  `StructuredTextType`, the same type as `Technical_Nuance`.
- 111 terms have a description, 22 to 664 characters long. All are a
  plain sentence except CWE-191's "Integer underflow", which is two
  `xhtml:p` paragraphs.
- No weakness repeats a term. Six terms are shared by several weaknesses,
  e.g. "AuthZ" (285, 862, 863), "Zip Slip" (23, 59), "Stack Exhaustion"
  (674, 789, 1325).
- Some terms bundle several names: CWE-79's "Reflected XSS /
  Non-Persistent XSS / Type 1 XSS".
- One term equals its weakness's current name (case-insensitively).
- Schema 7.x (CWE 4.x) has the same `Alternate_Terms` shape, without
  `Role`.

**Former names:**

- 826 `Previous_Entry_Name` elements on 490 weaknesses, 18 on views, none
  on categories.
- Each has a required `Date` (`YYYY-MM-DD` in all 844), which the schema
  defines as "the date on which this name was no longer used". MITRE
  lists them oldest first. Four on CWE-113 also carry an optional
  `Version` attribute, which isn't read.
- 8 equal the weakness's current name: the entry was renamed and later
  renamed back (CWE-256 twice). 2 repeat an earlier former name of the same
  weakness. 28 equal one of the weakness's alternate terms.
- Two equal another weakness's current name: CWE-1187's former "Use of
  Uninitialized Resource" is CWE-908's name today, and the same holds for
  375 and 374.
- Former names are noisy for broad queries. "failure" matches 8 weaknesses
  by name and 101 more by old "Failure to …" names.
- Of the 18 renamed views, only two are ones the View picker offers:
  - 1000 "Complete Weakness Hierarchy", formerly "Research Concepts"
    (until 2026-10-28) and "Natural Hierarchy" (until 2008-09-09);
  - 699 "Software Development", formerly "Development Concepts".

  The other 16 are deprecated, obsolete or implicit views the picker
  doesn't list.

**Dimensions:** the Common-Name (9) and Acronym (3) dimensions add nothing
to search. Each is either an alternate term already ("Cross-site
Scripting") or part of the weakness's name ("(SoC)", "Amplification").

## Goals

- Search finds a weakness by an alternate term or a former name, ranked
  as described under [Search](#search).
- A search result found through another name shows that name.
- The View picker finds a view by a former name and shows it.
- The detail panel shows alternate terms (with descriptions) and former
  names (with dates), each in its own closed disclosure.
- The build fails on structure it doesn't understand, as it does for
  Technical nuance and dimensions.

## Non-goals

- Term roles ([#361](https://github.com/mureinik/cwe-visualizer/issues/361)).
- Searching dimension values.
- Former names of categories (there are none) or of views the picker
  doesn't offer.
- Showing a view's former names anywhere but the View picker; views have
  no detail panel.
- Changing how the Category picker matches.
- Fuzzy matching or splitting bundled terms ("Reflected XSS /
  Non-Persistent XSS / Type 1 XSS"). Substring matching already finds each
  part.

## Anti-goals

- **Burying the obvious entry.** "xss" must list CWE-79 first and
  "injection" CWE-74 first, not after weaknesses that only mention the
  word in their name. That is what the ranking decision below is for.
- **Unexplained results.** A result that matched on a name the row
  doesn't show reads as a bug. Every such row says what matched.
- **Values we corrected.** Terms, descriptions and former names are
  MITRE's, verbatim apart from whitespace. `cwe.json` keeps the lists as
  MITRE gives them, including the former names that equal the current
  name.
- **Duplicated data.** Each name is stored once in `cwe.json`, where MITRE
  states it. No separate search index.
- **Noise for entries without these.** No empty disclosure or heading.

## Constraints

- The app reads only the prebuilt `public/data/cwe.json`. Everything is
  read at build time in `scripts/prepare-data.ts`. Types shared by both
  sides live in `src/lib/cwe-data.ts`.
- No new dependency.
- The build stays strict. Markup the structured-text converter doesn't
  know fails the build, naming the CWE.
- The build also handles CWE 4.x (schema 7.x) catalogs, which have the
  same two elements.
- New tests get classified as real-world or theoretical (CONTRIBUTING).
  Fixtures go in `test/fixtures/`.
- Keep the MITRE attribution untouched.

## Approaches

1. **Store the names as MITRE gives them and match at runtime.**
   (Chosen.) `CweNode` and `CweView` gain the lists; search and the
   picker read them. Lowercased copies for matching are made once when
   the graph is built, not on each keystroke. This follows the
   dimensions design: each fact once, where MITRE states it.
2. **A search index in `cwe.json`**, one list of lowercased names per ID.
   Simpler at runtime, but every name is stored twice, once to show and
   once to search. Rejected: the maintainer doesn't want duplicated data,
   as for dimensions.
3. **Only the bare names, without descriptions or dates.** Smaller, but it
   can't build the detail panel chosen below. Rejected.

Scope and display were settled in the same conversation:

- **Former names in scope:** chosen, one design for [#345](https://github.com/mureinik/cwe-visualizer/issues/345) and [#358](https://github.com/mureinik/cwe-visualizer/issues/358), as
  both are other names for the same entry. The maintainer reserved the
  right to split [#358](https://github.com/mureinik/cwe-visualizer/issues/358) out if it turned complicated; it didn't.
- **Ranking:** chosen, an alternate term equal to the whole query ranks
  just below a name prefix match. Rejected: every name match above every
  term match, as [#345](https://github.com/mureinik/cwe-visualizer/issues/345) first said, which lists CWE-85 and 87 before 79 for
  "xss".
- **Detail panel:** chosen, both lists, each in its own closed disclosure.
  Rejected: alternate terms only, with former names in search alone.
- **Descriptions:** chosen, the Technical nuance converter, so CWE-191's
  two paragraphs stay two. Rejected: collapsing to plain text.
- **Dimensions in search:** not read, as they add no name search lacks.

## Decisions

### Data

```ts
interface CweAlternateTerm {
  /** MITRE's Term, whitespace-collapsed and trimmed, otherwise verbatim. */
  term: string;
  /** MITRE's Description, converted like Technical_Nuance. Present only when non-empty. */
  description?: NuanceBlock[];
}

interface CwePreviousName {
  /** MITRE's Previous_Entry_Name text, whitespace-collapsed and trimmed. */
  name: string;
  /** The Date attribute (YYYY-MM-DD): when MITRE stopped using the name. */
  date: string;
}

interface CweNode {
  // ...existing fields
  /** Present only when non-empty. In MITRE's order. */
  alternateTerms?: CweAlternateTerm[];
  /** Present only when non-empty. In MITRE's order (oldest first). */
  previousNames?: CwePreviousName[];
}

interface CweView {
  // ...existing fields
  /** Present only when non-empty. Names only, as nothing shows the dates. */
  previousNames?: string[];
}
```

- `DATA_FORMAT` goes from 2 to 3, so a cached `cwe.json` without these
  fields is regenerated.
- Nothing is de-duplicated at build time. Search handles overlaps by
  taking each entry's best match (below), so a former name equal to the
  current name never shows as "formerly".
- `NuanceBlock` is reused as is for descriptions. Its name stays; the
  type's doc comment says it is MITRE structured text in general.

### Build checks

The build fails, naming the CWE or view, on any of these:

- an `Alternate_Term` without a `Term`, or with one that is empty after
  trimming;
- a `Previous_Entry_Name` without a `Date`, with a `Date` that isn't
  `YYYY-MM-DD`, or with empty text;
- a `Description` with markup the structured-text converter doesn't know
  (the converter's existing rule);
- more than one `Alternate_Terms` element, or an `Alternate_Terms` with no
  `Alternate_Term`.

None of these happen in 5.0 or in 4.21, the newest 4.x (pinned by
`v1.1`). 4.21 has 222 alternate terms (111 with a description, whose
only markup is two `xhtml:p`, the same as 5.0) and 774 weakness and 17
view former names, all with valid dates and non-empty text. The schema
forbids the missing `Term` and `Date`; the others are guards, for
consistency with the build's other strict checks.

The structured-text converter in `scripts/nuance.ts` is generalised to
take the element it is converting, so its error messages say
"Alternate_Term Description" rather than "Technical_Nuance". The
description must be read as raw inner XML (a `fast-xml-parser` stop node),
as Technical_Nuance is.

### Search

Ranking in `src/lib/search.ts`, lower first:

| Rank | Match |
| ------ | ------- |
| 0 | ID equals the query |
| 1 | ID starts with the query |
| 2 | Name starts with the query |
| 3 | An alternate term equals the query |
| 4 | ID contains the query |
| 5 | Name contains the query |
| 6 | An alternate term starts with the query |
| 7 | An alternate term contains the query |
| 8 | A former name starts with the query |
| 9 | A former name contains the query |

- **The rank-3 decision**, which must be recorded both here and as a
  comment on the ranking code: an alternate term that equals the whole
  query is how people name the weakness ("XSS", "CSRF", "Injection"), so
  it outranks a weakness that only mentions the word in its name. Without
  it, "xss" lists CWE-85 (Doubled Character XSS Manipulations) and 87
  ahead of 79, and "injection" lists 91, 1319 and 1334 ahead of 74. Partial
  term matches, and every former name, still rank below all name matches.
- Matching is case-insensitive substring matching on the trimmed query,
  as today.
- An entry's rank is its best match.
- Deprecated entries still sort after live ones, and ties still sort by
  ID.
- The search box still shows at most 20 results.

**The row:** when the best match is an alternate term or a former name, the
row adds a second line naming it:

```text
◆ CWE-79   Improper Neutralization of Input During Web Page Generation
           also called: XSS
◆ CWE-89   Improper Neutralization of Special Elements used in an SQL Command
           formerly: Failure to Sanitize Data into SQL Queries (aka 'SQL Injection')
```

- The line shows the name that gave the best rank. Among several at that
  rank, the first alternate term in MITRE's order, or the newest former
  name.
- An ID or name match adds no line.
- The option's accessible name gains the same text: "CWE-79: Improper
  Neutralization …, also called XSS".

### View picker

- The picker keeps its plain "contains" filter and its order: no ranking,
  as it lists 36 views.
- A view also matches when one of its former names contains the query.
- An option that matched only through a former name shows it on a second
  line, in the search row's style, and its accessible name gains it:

  ```text
  Complete Weakness Hierarchy (1000)
    formerly: Research Concepts
  ```

- The Category picker doesn't change. Its options carry no former names.

### Detail panel

Two new closed disclosures (native `<details>`), each present only when
its list is non-empty, and each closing again when another CWE is
selected, as Technical nuance does.

**Order in the panel:** description, Alternate terms, Dimensions, Technical
nuance, Former names. Alternate terms first, since they are how people
know the weakness; Former names last, since they are history. (Our call.)

**Alternate terms:**

- Summary: "Alternate terms (N)".
- One item per term, in MITRE's order. The term is bold; its description,
  when present, follows it, rendered as Technical nuance renders blocks.

```text
▾ Alternate terms (7)
  Cross-site Scripting
  XSS
    A common abbreviation/acronym for Cross-Site Scripting.
  HTML Injection
    A general term for an attack that inserts HTML into a web page, …
  …
```

**Former names:**

- Summary: "Former names (N)".
- One item per name, newest first, with "until" and the date, since the
  date is when the name stopped being used.
- Every former name MITRE lists is shown, including one equal to the
  current name. With its date, it reads as the history it is (CWE-256 was
  renamed and renamed back).

```text
▾ Former names (7)
  Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')
    until 2026-10-28
  Improper Sanitization of Special Elements used in an SQL Command ('SQL Injection')
    until 2010-06-21
  …
  SQL Injection
    until 2008-04-11
```

## Left to the builder

- Component structure: whether the two disclosures share a component with
  Technical nuance, and how the Picker option type carries former names.
- Where the lowercased copies live (on `Graph`, or a structure next to
  it), as long as they are built once per graph.
- CSS for the new rows and disclosures, within the existing styles.
- Whether the search box placeholder ("Search CWEs by ID or name…")
  changes.
- Fixtures: `test/fixtures/cwec-sample.xml` has no `Alternate_Terms` or
  `Content_History` yet, so it gains them, modelled on the real entries
  (CWE-79, 74, 89, 352, views 1000 and 699). No separate 4.x fixture
  (our call): the 4.x shape differs only by lacking `Role`, which isn't
  read.
- Test classification, by CONTRIBUTING's rules. The ranking cases above
  ("xss", "csrf", "injection", "failure", "Research Concepts") are
  real-world.
