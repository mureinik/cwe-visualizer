// Reads a Dimensions element into the dimensions a weakness or relation
// carries. Strict on purpose, like phases.ts: a type it doesn't know, an empty
// value or a repeated pair fails the build, so a change in MITRE's data is a decision.

import type { CweDimension } from '../src/lib/cwe-data.ts';
import { isDimensionType, mergeDimensions } from '../src/lib/dimensions.ts';

/** A Dimension as fast-xml-parser gives it, or a bare string when the element has no attributes. */
interface RawDimension {
  '@_Type'?: string;
  '#text'?: string;
}

function toArray<T>(x: T | T[] | undefined): T[] {
  return Array.isArray(x) ? x : x === undefined ? [] : [x];
}

/** Every run of whitespace becomes one space, and the ends are trimmed. */
function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * The dimensions of a `Dimensions` element, in schema order. `where` names the
 * weakness ("CWE-1024") or relation ("CWE-201 ChildOf CWE-200") for errors.
 */
export function readDimensions(raw: unknown, where: string): CweDimension[] {
  if (typeof raw !== 'object' || raw === null) {
    return [];
  }
  const seen = new Set<string>();
  const entries: CweDimension[] = [];
  for (const dimension of toArray((raw as { Dimension?: RawDimension | string | (RawDimension | string)[] }).Dimension)) {
    const element: RawDimension = typeof dimension === 'string' ? { '#text': dimension } : dimension;
    const type = element['@_Type']?.trim() ?? '';
    if (!isDimensionType(type)) {
      throw new Error(`${where}: unknown Dimension Type "${type}"`);
    }
    const value = collapse(element['#text'] ?? '');
    if (value === '') {
      throw new Error(`${where}: empty Dimension of Type ${type}`);
    }
    const key = JSON.stringify([type, value]);
    if (seen.has(key)) {
      throw new Error(`${where}: duplicate Dimension ${type} "${value}"`);
    }
    seen.add(key);
    entries.push({ type, value });
  }
  return mergeDimensions(entries);
}
