export type ShapeName = 'diamond' | 'ringed-circle' | 'circle' | 'hollow-circle' | 'hexagon' | 'square';

export interface Glyph {
  shape: ShapeName;
  /** CSS custom property supplying this glyph's colour. */
  token: string;
  /** Human-readable name, used in accessible labels. */
  label: string;
}

/**
 * Keyed by CWE abstraction. Adding MITRE's Category or View constructs later
 * is an entry here plus a token, not a change to any consumer — every
 * renderer goes through glyphFor().
 */
export const GLYPHS: Record<string, Glyph> = {
  Pillar: { shape: 'diamond', token: '--abs-pillar', label: 'Pillar' },
  Class: { shape: 'ringed-circle', token: '--abs-class', label: 'Class' },
  Base: { shape: 'circle', token: '--abs-base', label: 'Base' },
  Variant: { shape: 'hollow-circle', token: '--abs-variant', label: 'Variant' },
  Compound: { shape: 'hexagon', token: '--abs-compound', label: 'Compound' },
};

export const FALLBACK_GLYPH: Glyph = {
  shape: 'square',
  token: '--text-muted',
  label: 'Unknown',
};

export function glyphFor(abstraction: string): Glyph {
  return GLYPHS[abstraction] ?? FALLBACK_GLYPH;
}
