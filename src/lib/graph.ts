export interface CweNode {
  id: string;
  name: string;
  abstraction: string;
  status: string;
  description: string;
  url: string;
}

export interface CweEdge {
  from: string;
  to: string;
  type: string;
  /** See the matching comment in scripts/prepare-data.ts. */
  viewId?: string;
}

export interface CweMeta {
  cweVersion: string;
  lastModified: string;
  generatedAt: string;
}

export interface CweData {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  edges: CweEdge[];
}

export interface Graph {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  relatedTo: Map<string, CweEdge[]>;
  /** Top-level entries to display. Deprecated orphans are not here. */
  roots: string[];
  /**
   * Parentless entries MITRE has deprecated. Kept separate so they can be
   * shown in one collapsed group instead of interleaved by ID at the top of
   * the tree, which is what they do today.
   */
  deprecatedRoots: string[];
  all: CweNode[];
}

export interface BuildGraphOptions {
  /**
   * Declared top-level entries. A view supplies its members here; with no
   * options, roots are derived as "has no parent", which is what the
   * Research Concepts hierarchy amounts to.
   */
  rootIds?: string[];
}

// MITRE's source XML encodes most non-hierarchy relations one-sided (only on
// the node that lists them in Related_Weaknesses), so buildGraph synthesizes
// the missing direction. This maps a relation's type to the name its inverse
// should carry; anything not listed falls back to a generic "(inverse)"
// label so it's never silently dropped or mislabeled as the original.
function inverseNature(type: string): string {
  const inverses: Record<string, string> = {
    PeerOf: 'PeerOf',
    CanAlsoBe: 'CanAlsoBe',
    CanPrecede: 'CanFollow',
    CanFollow: 'CanPrecede',
    Requires: 'RequiredBy',
    RequiredBy: 'Requires',
  };
  return inverses[type] ?? `${type} (inverse)`;
}

function addUnique(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (!list) {
    map.set(key, [value]);
    return;
  }
  if (!list.includes(value)) {
    list.push(value);
  }
}

export function buildGraph(data: CweData, options?: BuildGraphOptions): Graph {
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const relatedTo = new Map<string, CweEdge[]>();

  for (const id of Object.keys(data.nodes)) {
    childrenOf.set(id, []);
    parentsOf.set(id, []);
    relatedTo.set(id, []);
  }

  for (const edge of data.edges) {
    if (edge.type === 'ChildOf') {
      addUnique(childrenOf, edge.to, edge.from);
      addUnique(parentsOf, edge.from, edge.to);
    } else if (edge.type === 'ParentOf') {
      addUnique(childrenOf, edge.from, edge.to);
      addUnique(parentsOf, edge.to, edge.from);
    } else {
      relatedTo.get(edge.from)?.push(edge);
      relatedTo.get(edge.to)?.push({ from: edge.to, to: edge.from, type: inverseNature(edge.type) });
    }
  }

  const byId = (a: string, b: string) => Number(a) - Number(b);
  const isDeprecated = (id: string) => data.nodes[id]?.status === 'Deprecated';

  let roots: string[];
  let deprecatedRoots: string[];

  if (options?.rootIds) {
    roots = options.rootIds.filter((id) => id in data.nodes).sort(byId);
    deprecatedRoots = [];
  } else {
    const parentless = Object.keys(data.nodes).filter((id) => (parentsOf.get(id) ?? []).length === 0);
    roots = parentless.filter((id) => !isDeprecated(id)).sort(byId);
    deprecatedRoots = parentless.filter(isDeprecated).sort(byId);
  }

  const all = Object.values(data.nodes).sort((a, b) => Number(a.id) - Number(b.id));

  return { meta: data.meta, nodes: data.nodes, childrenOf, parentsOf, relatedTo, roots, deprecatedRoots, all };
}

export function ancestorsOf(graph: Graph, id: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...(graph.parentsOf.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (ancestors.has(next)) continue;
    ancestors.add(next);
    queue.push(...(graph.parentsOf.get(next) ?? []));
  }
  return ancestors;
}

/**
 * How many distinct weaknesses sit beneath `id`, at any depth. The hierarchy
 * is a DAG rather than a tree — 200 entries have more than one parent — so
 * this counts each descendant once however many paths reach it.
 */
export function countDescendants(graph: Graph, id: string): number {
  const seen = new Set<string>();
  const queue = [...(graph.childrenOf.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(graph.childrenOf.get(next) ?? []));
  }
  seen.delete(id);
  return seen.size;
}
