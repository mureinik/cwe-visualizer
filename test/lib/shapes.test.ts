import { describe, it, expect } from 'vitest';
import { GLYPHS, FALLBACK_GLYPH, glyphFor } from '../../src/lib/shapes';

describe('glyphFor', () => {
  it('maps each CWE abstraction to a distinct shape', () => {
    const shapes = ['Pillar', 'Class', 'Base', 'Variant', 'Compound'].map((a) => glyphFor(a).shape);
    expect(new Set(shapes).size).toBe(5);
  });

  it('gives each abstraction its own colour token', () => {
    expect(glyphFor('Pillar').token).toBe('--abs-pillar');
    expect(glyphFor('Class').token).toBe('--abs-class');
    expect(glyphFor('Base').token).toBe('--abs-base');
    expect(glyphFor('Variant').token).toBe('--abs-variant');
    expect(glyphFor('Compound').token).toBe('--abs-compound');
  });

  it('distinguishes Class from Base by shape, not only by colour', () => {
    expect(glyphFor('Class').shape).not.toBe(glyphFor('Base').shape);
  });

  it('falls back for an unknown abstraction rather than throwing', () => {
    expect(glyphFor('Category')).toEqual(FALLBACK_GLYPH);
    expect(glyphFor('')).toEqual(FALLBACK_GLYPH);
  });

  it('keeps the registry open for future node kinds', () => {
    expect(Object.keys(GLYPHS)).toEqual(['Pillar', 'Class', 'Base', 'Variant', 'Compound']);
  });
});
