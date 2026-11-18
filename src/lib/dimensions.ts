import type { CweDimension } from './cwe-data';

/** The schema's 18 dimension types, in schema order. */
export const DIMENSION_TYPES: readonly string[] = [
  'Behavior-Type',
  'Behavior-Property',
  'Resource-Type',
  'Resource-Property',
  'Input-Type',
  'Input-Property',
  'Info-Type',
  'Info-Property',
  'Code-Type',
  'Code-Property',
  'Technology',
  'Language-Type',
  'Language-Property',
  'Framework',
  'Common-Name',
  'Attack',
  'Acronym',
  'Other',
];

export function isDimensionType(type: string): boolean {
  return DIMENSION_TYPES.includes(type);
}

/** A type as a reader sees it: the hyphen becomes a space and the second word is lowercased. */
export function dimensionTypeLabel(type: string): string {
  const [first, ...rest] = type.split('-');
  return [first, ...rest.map((word) => word.toLowerCase())].join(' ');
}

/** Concatenates the lists, keeps the first of each type and value pair, then stable-sorts by schema position. */
export function mergeDimensions(
  ...lists: readonly (readonly CweDimension[])[]
): CweDimension[] {
  const seen = new Set<string>();
  const merged: CweDimension[] = [];
  for (const dim of lists.flat()) {
    const key = JSON.stringify([dim.type, dim.value]);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(dim);
    }
  }
  return merged.sort(
    (a, b) => DIMENSION_TYPES.indexOf(a.type) - DIMENSION_TYPES.indexOf(b.type),
  );
}

export interface DimensionRow {
  label: string;
  values: string[];
}

/** One row per type, in the order of the input. */
export function dimensionRows(dims: readonly CweDimension[]): DimensionRow[] {
  const rows = new Map<string, DimensionRow>();
  for (const { type, value } of dims) {
    const row = rows.get(type) ?? {
      label: dimensionTypeLabel(type),
      values: [],
    };
    row.values.push(value);
    rows.set(type, row);
  }
  return [...rows.values()];
}

/** The dimensions of one relation type, such as "ChildOf". */
export interface TypedDimensions {
  type: string;
  dimensions: CweDimension[];
}

/** Every value, across the groups, joined for a chip. Callers pass only groups with dimensions. */
export function chipDimensionLine(groups: readonly TypedDimensions[]): string {
  return groups
    .flatMap((group) => group.dimensions.map((dim) => dim.value))
    .join(' · ');
}

function differsByEntries(dimensions: readonly CweDimension[]): string {
  return dimensions
    .map((dim) => `${dimensionTypeLabel(dim.type)} ${dim.value}`)
    .join('; ');
}

/** The chip's accessible name and title: what its relation's dimensions say. Callers pass only groups with dimensions. */
export function differsBy(groups: readonly TypedDimensions[]): string {
  const body =
    groups.length === 1
      ? differsByEntries(groups[0].dimensions)
      : groups
          .map(
            (group) => `${group.type}: ${differsByEntries(group.dimensions)}`,
          )
          .join('. ');
  return `Differs by: ${body}`;
}

function rowLines(
  dimensions: readonly CweDimension[],
  indent: string,
): string[] {
  return dimensionRows(dimensions).map(
    (row) => `${indent}${row.label}: ${row.values.join('; ')}`,
  );
}

/** An edge's tooltip: its relation types, then the dimensions, if any. */
export function edgeTitle(
  types: readonly string[],
  groups: readonly TypedDimensions[],
): string {
  const lines = [types.join(', ')];
  if (types.length <= 1) {
    for (const group of groups) {
      lines.push(...rowLines(group.dimensions, ''));
    }
  } else {
    for (const group of groups) {
      lines.push(`${group.type}:`, ...rowLines(group.dimensions, '  '));
    }
  }
  return lines.join('\n');
}
