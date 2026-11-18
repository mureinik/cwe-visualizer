// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readDimensions } from '../../scripts/dimensions.ts';

const dim = (type: string, text?: string): Record<string, string> => (text === undefined ? { '@_Type': type } : { '@_Type': type, '#text': text });

describe('readDimensions', () => {
  it("reads CWE-1037's dimensions in schema order", () => {
    const raw = {
      Dimension: [
        dim('Technology', 'Processor'),
        dim('Behavior-Type', 'Optimization'),
        dim('Behavior-Type', 'Removal or Modification'),
        dim('Code-Type', 'Code'),
        dim('Code-Property', 'Security-critical'),
      ],
    };
    expect(readDimensions(raw, 'CWE-1037')).toEqual([
      { type: 'Behavior-Type', value: 'Optimization' },
      { type: 'Behavior-Type', value: 'Removal or Modification' },
      { type: 'Code-Type', value: 'Code' },
      { type: 'Code-Property', value: 'Security-critical' },
      { type: 'Technology', value: 'Processor' },
    ]);
  });

  it('reads a single Dimension given as an object', () => {
    expect(readDimensions({ Dimension: dim('Other', 'Output') }, 'CWE-1')).toEqual([{ type: 'Other', value: 'Output' }]);
  });

  it('returns nothing when there are no dimensions', () => {
    expect(readDimensions(undefined, 'CWE-1')).toEqual([]);
    expect(readDimensions('', 'CWE-1')).toEqual([]);
  });

  it('collapses whitespace', () => {
    expect(readDimensions({ Dimension: dim('Behavior-Type', '\n\t   Removal   or\n Modification\t') }, 'CWE-1')).toEqual([
      { type: 'Behavior-Type', value: 'Removal or Modification' },
    ]);
  });

  it('keeps a leading quote, as CWE-405 has one', () => {
    expect(readDimensions({ Dimension: dim('Other', '"Asymmetric') }, 'CWE-405')).toEqual([{ type: 'Other', value: '"Asymmetric' }]);
  });

  it('throws on an unknown type', () => {
    expect(() => readDimensions({ Dimension: dim('Behaviour-Type', 'X') }, 'CWE-1')).toThrow(
      'CWE-1: unknown Dimension Type "Behaviour-Type"',
    );
  });

  it('throws on a missing type', () => {
    expect(() => readDimensions({ Dimension: { '#text': 'X' } }, 'CWE-1')).toThrow('CWE-1: unknown Dimension Type ""');
  });

  it('throws on a whitespace-only value', () => {
    expect(() => readDimensions({ Dimension: dim('Other', ' \n\t ') }, 'CWE-1')).toThrow('CWE-1: empty Dimension of Type Other');
  });

  it('throws on an element with no text', () => {
    expect(() => readDimensions({ Dimension: dim('Other') }, 'CWE-1')).toThrow('CWE-1: empty Dimension of Type Other');
  });

  it('throws on the same type and value twice', () => {
    const raw = { Dimension: [dim('Behavior-Type', 'Comparison'), dim('Behavior-Type', 'Comparison')] };
    expect(() => readDimensions(raw, 'CWE-1')).toThrow('CWE-1: duplicate Dimension Behavior-Type "Comparison"');
  });

  it("names a relation's two ends in its message", () => {
    expect(() => readDimensions({ Dimension: dim('X', 'Y') }, 'CWE-201 ChildOf CWE-200')).toThrow(
      'CWE-201 ChildOf CWE-200: unknown Dimension Type "X"',
    );
  });
});

// 5.0 has neither a childless nor a repeated Dimensions element.
describe('readDimensions on a malformed Dimensions element', { tags: ['theoretical'] }, () => {
  it('returns nothing for an absent or empty element', () => {
    expect(readDimensions(undefined, 'CWE-1')).toEqual([]);
    expect(readDimensions('', 'CWE-1')).toEqual([]);
  });

  it('throws on an element with no Dimension children', () => {
    expect(() => readDimensions({ Other: 'x' }, 'CWE-1')).toThrow('CWE-1: Dimensions has no Dimension elements');
  });

  it('throws on a repeated Dimensions element', () => {
    expect(() => readDimensions([{ Dimension: dim('Other', 'a') }, { Dimension: dim('Other', 'b') }], 'CWE-1')).toThrow(
      'CWE-1: more than one Dimensions element',
    );
  });
});
