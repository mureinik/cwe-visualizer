import { describe, it, expect } from 'vitest';
import { EDGE_GROUPS, RELATION_GROUPS, relationGroup, baseRelationType, isInverse } from '../../src/lib/relations';

describe('isInverse', () => {
  it('recognises the synthesized inverse suffix', () => {
    expect(isInverse('StartsWith (inverse)')).toBe(true);
  });

  it('rejects a plain type, including a named inverse like CanFollow', () => {
    expect(isInverse('PeerOf')).toBe(false);
    expect(isInverse('CanFollow')).toBe(false);
  });

  it('only matches the suffix at the end', () => {
    expect(isInverse('StartsWith (inverse) extra')).toBe(false);
  });
});

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
    for (const spec of Object.values(EDGE_GROUPS)) {
      expect(spec.label).toBeTruthy();
      expect(spec.line.token).toMatch(/^--rel-/);
    }
  });

  it('lists the hierarchy, then every relation group, as edge groups', () => {
    expect(Object.keys(EDGE_GROUPS)).toEqual(['hierarchy', ...Object.keys(RELATION_GROUPS)]);
  });
});
