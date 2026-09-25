import { describe, it, expect } from 'vitest';
import { RELATION_GROUPS, relationGroup, baseRelationType } from '../../src/lib/relations';

describe('baseRelationType', () => {
  it('strips the synthesized inverse suffix', () => {
    expect(baseRelationType('StartsWith (inverse)')).toBe('StartsWith');
  });

  it('leaves a plain type alone', () => {
    expect(baseRelationType('PeerOf')).toBe('PeerOf');
  });
});

describe('relationGroup', () => {
  it.each([
    ['CanPrecede', 'sequence'],
    ['CanFollow', 'sequence'],
    ['StartsWith', 'sequence'],
    ['StartsWith (inverse)', 'sequence'],
    ['PeerOf', 'peer'],
    ['CanAlsoBe', 'peer'],
    ['Requires', 'requires'],
    ['RequiredBy', 'requires'],
  ])('groups %s as %s', (type, expected) => {
    expect(relationGroup(type)).toBe(expected);
  });

  it('falls back to peer for an unrecognised type rather than throwing', () => {
    expect(relationGroup('SomethingMitreAddsLater')).toBe('peer');
  });

  it('gives every group a label and a colour token', () => {
    for (const spec of Object.values(RELATION_GROUPS)) {
      expect(spec.label).toBeTruthy();
      expect(spec.token).toMatch(/^--rel-/);
    }
  });
});
