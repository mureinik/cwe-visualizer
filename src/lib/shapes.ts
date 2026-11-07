/** A node's glyph radius on the graph. */
export const NODE_RADIUS = 9;
/** The selected node's glyph radius: it stands out from its neighbours. */
export const SELECTED_NODE_RADIUS = 13;
/** How far the selection halo sits outside the selected glyph. */
export const HALO_GAP = 7;

/** The size of a "+N more" chip on the graph. */
export const OVERFLOW_CHIP_WIDTH = 68;
export const OVERFLOW_CHIP_HEIGHT = 24;

/**
 * The width of a chip that shows only its "+N", where the full one doesn't
 * fit: room for each character at --text-xs, and padding either side.
 */
export function compactChipWidth(count: number): number {
  return 12 + `+${count}`.length * 7;
}

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
 * renderer goes through glyphFor(). It has no prototype, so an abstraction
 * named like an Object.prototype member still gets the fallback.
 */
export const GLYPHS = Object.assign(Object.create(null) as Record<string, Glyph>, {
  Pillar: { shape: 'diamond', token: '--abs-pillar', label: 'Pillar' },
  Class: { shape: 'ringed-circle', token: '--abs-class', label: 'Class' },
  Base: { shape: 'circle', token: '--abs-base', label: 'Base' },
  Variant: { shape: 'hollow-circle', token: '--abs-variant', label: 'Variant' },
  Compound: { shape: 'hexagon', token: '--abs-compound', label: 'Compound' },
});

export const FALLBACK_GLYPH: Glyph = {
  shape: 'square',
  token: '--text-muted',
  label: 'Unknown',
};

export function glyphFor(abstraction: string): Glyph {
  return GLYPHS[abstraction] ?? FALLBACK_GLYPH;
}
