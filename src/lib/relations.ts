export type RelationGroup = 'sequence' | 'peer' | 'requires';

/** Every kind of edge the graph draws: the hierarchy, then each relation group. */
export type EdgeGroup = 'hierarchy' | RelationGroup;

/**
 * How a group's edges are drawn. The graph and the legend both read it, so
 * restyling a group here restyles both.
 */
export interface LineStyle {
  /** The CSS custom property holding the colour. */
  token: string;
  width: number;
  /** The stroke-dasharray, or null for a solid line. */
  dash: string | null;
  /** An arrowhead at the target end, for relations that have a direction. */
  arrow: boolean;
}

export interface EdgeGroupSpec {
  key: EdgeGroup;
  label: string;
  line: LineStyle;
}

export interface RelationGroupSpec extends EdgeGroupSpec {
  key: RelationGroup;
}

export const RELATION_GROUPS: Record<RelationGroup, RelationGroupSpec> = {
  sequence: {
    key: 'sequence',
    label: 'Sequence',
    line: { token: '--rel-sequence', width: 1.5, dash: null, arrow: true },
  },
  peer: {
    key: 'peer',
    label: 'Peers',
    line: { token: '--rel-peer', width: 1.5, dash: '4 3', arrow: false },
  },
  requires: {
    key: 'requires',
    label: 'Requires',
    line: { token: '--rel-requires', width: 1.5, dash: null, arrow: false },
  },
};

export const EDGE_GROUPS: Record<EdgeGroup, EdgeGroupSpec> = {
  hierarchy: {
    key: 'hierarchy',
    label: 'Parent / child',
    line: { token: '--rel-hierarchy', width: 2, dash: null, arrow: false },
  },
  ...RELATION_GROUPS,
};

/**
 * The id of a group's arrowhead marker. The graph and the legend each define
 * their own, at different sizes, so the id names which one.
 */
export function arrowMarkerId(scope: 'graph' | 'legend', group: EdgeGroup): string {
  return `${scope}-arrow-${group}`;
}

const BY_TYPE: Record<string, RelationGroup> = {
  CanPrecede: 'sequence',
  CanFollow: 'sequence',
  StartsWith: 'sequence',
  PeerOf: 'peer',
  CanAlsoBe: 'peer',
  Requires: 'requires',
  RequiredBy: 'requires',
};

/**
 * buildGraph synthesizes the missing direction of one-sided relations and
 * labels anything with no known inverse "<Type> (inverse)". This is the one
 * place that spelling lives; everything else goes through the helpers below.
 */
export const INVERSE_SUFFIX = ' (inverse)';

/** True for a direction buildGraph synthesized with the generic suffix. */
export function isInverse(type: string): boolean {
  return type.endsWith(INVERSE_SUFFIX);
}

/**
 * The underlying type, without the synthesized-inverse suffix. Group by this
 * so a synthesized edge lands with its counterpart.
 */
export function baseRelationType(type: string): string {
  return isInverse(type) ? type.slice(0, -INVERSE_SUFFIX.length) : type;
}

export function relationGroup(type: string): RelationGroup {
  return BY_TYPE[baseRelationType(type)] ?? 'peer';
}
