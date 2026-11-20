// Reads a weakness's Alternate_Terms and an entry's Content_History into the
// alternate terms and former names the data carries. Strict on purpose, like
// dimensions.ts: a missing or empty part, or a date that isn't YYYY-MM-DD,
// fails the build, so a change in MITRE's data is a decision.

import type { CweAlternateTerm, CwePreviousName } from '../src/lib/cwe-data.ts';
import { parseNuance } from './nuance.ts';

/** An element that may carry text and attributes, or a bare string when it has no attributes. */
type RawText = string | { '#text'?: string; '@_Date'?: string };

/** An Alternate_Term as fast-xml-parser gives it, or an empty string when the element is empty. */
type RawTerm = string | { Term?: RawText; Description?: string };

function toArray<T>(x: T | T[] | undefined): T[] {
  return Array.isArray(x) ? x : x === undefined ? [] : [x];
}

/** Every run of whitespace becomes one space, and the ends are trimmed. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function textOf(raw: RawText): string {
  return typeof raw === 'string' ? raw : (raw['#text'] ?? '');
}

/**
 * The alternate terms of an `Alternate_Terms` element, in MITRE's order.
 * `Description` is a stop node, so a raw inner-XML string. `cweId` is
 * "CWE-79" for errors.
 */
export function readAlternateTerms(
  raw: unknown,
  cweId: string,
): CweAlternateTerm[] {
  if (Array.isArray(raw)) {
    throw new Error(`${cweId}: more than one Alternate_Terms element`);
  }
  if (raw === undefined) {
    return [];
  }
  const terms: RawTerm | RawTerm[] | undefined =
    typeof raw === 'object' && raw !== null
      ? (raw as { Alternate_Term?: RawTerm | RawTerm[] }).Alternate_Term
      : undefined;
  if (terms === undefined) {
    throw new Error(`${cweId}: Alternate_Terms has no Alternate_Term`);
  }
  return toArray(terms).map((entry) => {
    const { Term: term, Description: description } =
      typeof entry === 'string' ? {} : entry;
    if (term === undefined) {
      throw new Error(`${cweId}: Alternate_Term has no Term`);
    }
    const text = collapse(textOf(term));
    if (text === '') {
      throw new Error(`${cweId}: empty Alternate_Term`);
    }
    const blocks =
      description === undefined
        ? []
        : parseNuance(description, cweId, 'Alternate_Term Description');
    return blocks.length > 0
      ? { term: text, description: blocks }
      : { term: text };
  });
}

/**
 * The former names of a `Content_History` element, in MITRE's order (oldest
 * first). `where` is "CWE-79" or "View 1000" for errors.
 */
export function readPreviousNames(
  raw: unknown,
  where: string,
): CwePreviousName[] {
  const entries = (
    raw as { Previous_Entry_Name?: RawText | RawText[] } | undefined
  )?.Previous_Entry_Name;
  return toArray(entries).map((entry) => {
    const date =
      typeof entry === 'string' ? undefined : entry['@_Date']?.trim();
    if (date === undefined) {
      throw new Error(`${where}: Previous_Entry_Name has no Date`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(
        `${where}: Previous_Entry_Name Date is not YYYY-MM-DD: "${date}"`,
      );
    }
    const name = collapse(textOf(entry));
    if (name === '') {
      throw new Error(`${where}: empty Previous_Entry_Name`);
    }
    return { name, date };
  });
}
