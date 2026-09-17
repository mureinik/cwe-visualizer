export type RelationGroup = 'sequence' | 'peer' | 'requires';

export interface RelationGroupSpec {
  key: RelationGroup;
  label: string;
  token: string;
}

export const RELATION_GROUPS: Record<RelationGroup, RelationGroupSpec> = {
  sequence: { key: 'sequence', label: 'Sequence', token: '--rel-sequence' },
  peer: { key: 'peer', label: 'Peers', token: '--rel-peer' },
  requires: { key: 'requires', label: 'Requires', token: '--rel-requires' },
};

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
 * labels anything with no known inverse "<Type> (inverse)". Group by the
 * underlying type so a synthesized edge lands with its counterpart.
 */
export function baseRelationType(type: string): string {
  return type.replace(/ \(inverse\)$/, '');
}

export function relationGroup(type: string): RelationGroup {
  return BY_TYPE[baseRelationType(type)] ?? 'peer';
}
