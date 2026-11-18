import { describe, it, expect } from 'vitest';
import type { CweDimension } from '../../src/lib/cwe-data';
import {
  DIMENSION_TYPES,
  chipDimensionLine,
  differsBy,
  dimensionRows,
  dimensionTypeLabel,
  edgeTitle,
  isDimensionType,
  mergeDimensions,
} from '../../src/lib/dimensions';

const d = (type: string, value: string): CweDimension => ({ type, value });

const CWE_1037 = [
  d('Technology', 'Processor'),
  d('Behavior-Type', 'Optimization'),
  d('Behavior-Type', 'Removal or Modification'),
  d('Code-Type', 'Code'),
  d('Code-Property', 'Security-critical'),
];

const CWE_201_CHILD_OF = [
  d('Behavior-Type', 'Exposure'),
  d('Other', 'to an Unauthorized Actor'),
];

describe('DIMENSION_TYPES', () => {
  it("lists the schema's 18 types in order", () => {
    expect(DIMENSION_TYPES).toEqual([
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
    ]);
  });

  it('recognizes only those types', () => {
    expect(isDimensionType('Behavior-Type')).toBe(true);
    expect(isDimensionType('Behaviour-Type')).toBe(false);
    expect(isDimensionType('')).toBe(false);
  });
});

describe('dimensionTypeLabel', () => {
  it('turns the hyphen into a space and lowercases the second word', () => {
    expect(dimensionTypeLabel('Behavior-Type')).toBe('Behavior type');
    expect(dimensionTypeLabel('Common-Name')).toBe('Common name');
    expect(dimensionTypeLabel('Info-Property')).toBe('Info property');
  });

  it('leaves a one-word type as it is', () => {
    expect(dimensionTypeLabel('Other')).toBe('Other');
    expect(dimensionTypeLabel('Technology')).toBe('Technology');
  });
});

describe('mergeDimensions', () => {
  it("sorts CWE-1037's source order by schema position, keeping MITRE's order within a type", () => {
    expect(mergeDimensions(CWE_1037)).toEqual([
      d('Behavior-Type', 'Optimization'),
      d('Behavior-Type', 'Removal or Modification'),
      d('Code-Type', 'Code'),
      d('Code-Property', 'Security-critical'),
      d('Technology', 'Processor'),
    ]);
  });

  it('keeps one of a pair that two lists share', () => {
    const a = d('Behavior-Type', 'A');
    const b = d('Technology', 'B');
    const c = d('Other', 'C');
    expect(mergeDimensions([a, b], [b, c])).toEqual([a, b, c]);
  });

  it('gives an empty list for no input', () => {
    expect(mergeDimensions()).toEqual([]);
    expect(mergeDimensions([])).toEqual([]);
  });
});

describe('dimensionRows', () => {
  it('gives one row per type, in input order', () => {
    expect(dimensionRows(mergeDimensions(CWE_1037))).toEqual([
      {
        label: 'Behavior type',
        values: ['Optimization', 'Removal or Modification'],
      },
      { label: 'Code type', values: ['Code'] },
      { label: 'Code property', values: ['Security-critical'] },
      { label: 'Technology', values: ['Processor'] },
    ]);
  });
});

describe('the edge texts, for one relation type', () => {
  const group = [{ type: 'ChildOf', dimensions: CWE_201_CHILD_OF }];

  it('puts the values on the chip', () => {
    expect(chipDimensionLine(group)).toBe(
      'Exposure · to an Unauthorized Actor',
    );
  });

  it('names the types in the accessible name', () => {
    expect(differsBy(group)).toBe(
      'Differs by: Behavior type Exposure; Other to an Unauthorized Actor',
    );
  });

  it('lists a row per type in the tooltip', () => {
    expect(edgeTitle(['ChildOf'], group)).toBe(
      'ChildOf\nBehavior type: Exposure\nOther: to an Unauthorized Actor',
    );
  });

  it('joins several values of a type with "; " in the tooltip', () => {
    expect(
      edgeTitle(
        ['ChildOf'],
        [{ type: 'ChildOf', dimensions: mergeDimensions(CWE_1037) }],
      ),
    ).toContain('\nBehavior type: Optimization; Removal or Modification\n');
  });
});

describe('the edge texts, for several relation types', () => {
  const groups = [
    { type: 'CanAlsoBe', dimensions: [d('Behavior-Type', 'Generation')] },
    { type: 'PeerOf', dimensions: [d('Other', 'Output')] },
  ];

  it('puts every value on the chip', () => {
    expect(chipDimensionLine(groups)).toBe('Generation · Output');
  });

  it('prefixes each group with its relation type in the accessible name', () => {
    expect(differsBy(groups)).toBe(
      'Differs by: CanAlsoBe: Behavior type Generation. PeerOf: Other Output',
    );
  });

  it('nests each group under its relation type in the tooltip', () => {
    expect(edgeTitle(['CanAlsoBe', 'PeerOf'], groups)).toBe(
      'CanAlsoBe, PeerOf\nCanAlsoBe:\n  Behavior type: Generation\nPeerOf:\n  Other: Output',
    );
  });
});

describe('edgeTitle for several types with one group', () => {
  it('nests the group under its type', () => {
    expect(
      edgeTitle(
        ['CanAlsoBe', 'PeerOf'],
        [{ type: 'PeerOf', dimensions: [d('Other', 'Output')] }],
      ),
    ).toBe('CanAlsoBe, PeerOf\nPeerOf:\n  Other: Output');
  });
});

describe('edgeTitle without dimensions', () => {
  it("is today's tooltip", () => {
    expect(edgeTitle(['ChildOf'], [])).toBe('ChildOf');
    expect(edgeTitle(['Overlaps', 'PeerOf'], [])).toBe('Overlaps, PeerOf');
  });
});
