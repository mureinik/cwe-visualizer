import type { Graph } from './graph';
import { relationGroup, type RelationGroup } from './relations';

export type Band = -2 | -1 | 0 | 1;
export type Side = 'left' | 'center' | 'right';

export interface EgoNode {
  id: string;
  band: Band;
  side: Side;
}

export interface EgoOverflow {
  parentId: string;
  hiddenCount: number;
}

export interface EgoEdge {
  from: string;
  to: string;
  type: string;
  group: 'hierarchy' | RelationGroup;
}

export interface EgoGraph {
  centerId: string;
  nodes: EgoNode[];
  edges: EgoEdge[];
  overflow: EgoOverflow | null;
}

export interface EgoOptions {
  /** How many hops up the hierarchy to include. Default 2. */
  ancestorHops?: number;
  /** Maximum children rendered before the rest collapse into overflow. Default 10. */
  childCap?: number;
}

const byId = (a: string, b: string) => Number(a) - Number(b);

/** Types whose direction means "this can lead to X" — X belongs on the right. */
const LEADS_TO = new Set(['CanPrecede', 'StartsWith', 'Requires']);
/** Types whose direction means "X can lead to this" — X belongs on the left. */
const LEADS_FROM = new Set(['CanFollow', 'RequiredBy']);

/**
 * The radius is asymmetric on purpose. A symmetric two-hop neighbourhood
 * explodes on a pillar — CWE-284 alone has 43 children — while ancestors top
 * out at five across the whole corpus, so going two hops up is cheap and
 * going two hops down is not.
 */
export function buildEgoGraph(graph: Graph, centerId: string, options?: EgoOptions): EgoGraph {
  const ancestorHops = options?.ancestorHops ?? 2;
  const childCap = options?.childCap ?? 10;

  if (!(centerId in graph.nodes)) {
    return { centerId, nodes: [], edges: [], overflow: null };
  }

  const nodes: EgoNode[] = [{ id: centerId, band: 0, side: 'center' }];
  const edges: EgoEdge[] = [];
  const seen = new Set<string>([centerId]);

  const add = (id: string, band: Band, side: Side) => {
    if (seen.has(id) || !(id in graph.nodes)) return false;
    seen.add(id);
    nodes.push({ id, band, side });
    return true;
  };

  // Ancestors, one band per hop upward.
  let frontier = [centerId];
  for (let hop = 1; hop <= ancestorHops && hop <= 2; hop += 1) {
    const band = (hop === 1 ? -1 : -2) as Band;
    const next: string[] = [];
    for (const childId of frontier) {
      for (const parentId of [...(graph.parentsOf.get(childId) ?? [])].sort(byId)) {
        if (!(parentId in graph.nodes)) continue;
        if (add(parentId, band, 'center')) next.push(parentId);
        edges.push({ from: childId, to: parentId, type: 'ChildOf', group: 'hierarchy' });
      }
    }
    frontier = next;
  }

  // Children, one hop down, ranked so the structurally significant ones
  // survive the cap: most direct children first, ties by ascending id.
  const allChildren = [...(graph.childrenOf.get(centerId) ?? [])]
    .filter((id) => id in graph.nodes)
    .sort((a, b) => {
      const byFanout = (graph.childrenOf.get(b) ?? []).length - (graph.childrenOf.get(a) ?? []).length;
      return byFanout !== 0 ? byFanout : byId(a, b);
    });

  for (const childId of allChildren.slice(0, childCap)) {
    add(childId, 1, 'center');
    edges.push({ from: childId, to: centerId, type: 'ChildOf', group: 'hierarchy' });
  }

  const hiddenCount = allChildren.length - Math.min(allChildren.length, childCap);
  const overflow = hiddenCount > 0 ? { parentId: centerId, hiddenCount } : null;

  // Lateral relations stay on band 0. Direction carries meaning where the
  // relation has one; everything else is placed to balance the row.
  let left = 0;
  let right = 0;
  for (const edge of [...(graph.relatedTo.get(centerId) ?? [])].sort((a, b) => byId(a.to, b.to))) {
    if (!(edge.to in graph.nodes) || edge.to === centerId) continue;
    const base = edge.type.replace(/ \(inverse\)$/, '');
    let side: Side;
    if (LEADS_TO.has(base)) side = 'right';
    else if (LEADS_FROM.has(base)) side = 'left';
    else side = left <= right ? 'left' : 'right';

    if (add(edge.to, 0, side)) {
      if (side === 'left') left += 1;
      else right += 1;
    }
    edges.push({ from: centerId, to: edge.to, type: edge.type, group: relationGroup(edge.type) });
  }

  return { centerId, nodes, edges, overflow };
}
