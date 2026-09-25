import { describe, it, expect } from 'vitest';
import {
  longestCommonPrefix,
  dominantPrefix,
  elideSharedPrefix,
  fitLabel,
  labelBudget,
} from '../../src/lib/labels';

describe('longestCommonPrefix', () => {
  it('finds the shared opening text', () => {
    expect(
      longestCommonPrefix(['Improper Neutralization of Script in Attributes', 'Improper Neutralization of Script-Related HTML Tags'])
    ).toBe('Improper Neutralization of Script');
  });

  it('is empty when nothing is shared', () => {
    expect(longestCommonPrefix(['Missing Authorization', 'Improper Access Control'])).toBe('');
  });

  it('is empty for fewer than two values', () => {
    expect(longestCommonPrefix(['Only one'])).toBe('');
    expect(longestCommonPrefix([])).toBe('');
  });
});

describe('elideSharedPrefix', () => {
  const xss = [
    'Improper Neutralization of Script in Attributes',
    'Improper Neutralization of Script-Related HTML Tags',
    'Improper Neutralization of Encoded URI Schemes',
  ];

  it('replaces the shared prefix with an ellipsis, cut at a word boundary', () => {
    expect(elideSharedPrefix(xss)).toEqual([
      '…Script in Attributes',
      '…Script-Related HTML Tags',
      '…Encoded URI Schemes',
    ]);
  });

  it('leaves names alone when the shared prefix is too short to be worth it', () => {
    const names = ['Improper Access Control', 'Incorrect Authorization'];
    expect(elideSharedPrefix(names)).toEqual(names);
  });

  it('is not defeated by one sibling that breaks the pattern', () => {
    // CWE-79's real children: six share the prefix, CWE-85 does not.
    const real = [
      'Improper Neutralization of Script-Related HTML Tags',
      'Improper Neutralization of Script in an Error Message',
      'Improper Neutralization of Script in Attributes',
      'Improper Neutralization of Encoded URI Schemes',
      'Doubled Character XSS Manipulations',
      'Improper Neutralization of Invalid Characters',
      'Improper Neutralization of Alternate XSS Syntax',
    ];
    const out = elideSharedPrefix(real);
    expect(out[0]).toBe('…Script-Related HTML Tags');
    expect(out[3]).toBe('…Encoded URI Schemes');
    // the outlier keeps its whole name rather than dragging the rest down
    expect(out[4]).toBe('Doubled Character XSS Manipulations');
  });

  it('leaves names alone when nothing is shared', () => {
    const names = ['Missing Authorization', 'Origin Validation Error'];
    expect(elideSharedPrefix(names)).toEqual(names);
  });

  it('never elides a name away to nothing', () => {
    const names = ['Improper Neutralization of Input', 'Improper Neutralization of Input Extra'];
    for (const label of elideSharedPrefix(names)) {
      expect(label.replace(/…/g, '')).not.toBe('');
    }
  });

  it('passes a single name through untouched', () => {
    expect(elideSharedPrefix(['Improper Access Control'])).toEqual(['Improper Access Control']);
  });
});

describe('dominantPrefix', () => {
  it('requires at least half the names to share it', () => {
    expect(dominantPrefix(['Improper Access Control', 'Improper Authorization', 'Missing Something'])).toBe('Improper ');
    expect(dominantPrefix(['Improper Access Control', 'Missing Something', 'Origin Error', 'Unusual Thing'])).toBe('');
  });

  it('prefers the longest qualifying prefix', () => {
    expect(
      dominantPrefix(['Improper Neutralization of A', 'Improper Neutralization of B', 'Improper Access Control'])
    ).toBe('Improper Neutralization of ');
  });
});

describe('fitLabel', () => {
  it('leaves a short label alone', () => {
    expect(fitLabel('Short', 20)).toBe('Short');
  });

  it('truncates with a trailing ellipsis, dropping the space before it', () => {
    expect(fitLabel('Improper Neutralization of Input', 10)).toBe('Improper…');
  });

  it('never returns more characters than the budget', () => {
    for (const budget of [4, 10, 17, 30]) {
      expect(fitLabel('Improper Neutralization of Input', budget).length).toBeLessThanOrEqual(budget);
    }
  });

  it('copes with a budget too small to say anything', () => {
    expect(fitLabel('Improper', 1).length).toBeLessThanOrEqual(1);
    expect(fitLabel('Improper', 0)).toBe('');
  });
});

describe('labelBudget', () => {
  it('gives a wide slot more characters than a narrow one', () => {
    expect(labelBudget(300)).toBeGreaterThan(labelBudget(100));
  });

  it('never goes negative on a vanishing slot', () => {
    expect(labelBudget(4)).toBeGreaterThanOrEqual(0);
    expect(labelBudget(0)).toBeGreaterThanOrEqual(0);
  });

  it('keeps ten children of a pillar inside their slots on a wide stage', () => {
    // (1440 - 2*80) / 10 = 128px per child
    expect(labelBudget(128)).toBeLessThanOrEqual(18);
  });

  it('caps a lone node in a band instead of letting it span the stage', () => {
    expect(labelBudget(1280)).toBeLessThanOrEqual(34);
  });
});
