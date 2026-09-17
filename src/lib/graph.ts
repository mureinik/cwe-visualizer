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
  roots: string[];
  all: CweNode[];
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

export function buildGraph(data: CweData): Graph {
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

  const roots = Object.keys(data.nodes)
    .filter((id) => (parentsOf.get(id) ?? []).length === 0)
    .sort((a, b) => Number(a) - Number(b));

  const all = Object.values(data.nodes).sort((a, b) => Number(a.id) - Number(b.id));

  return { meta: data.meta, nodes: data.nodes, childrenOf, parentsOf, relatedTo, roots, all };
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

export function searchNodes(graph: Graph, query: string): CweNode[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [];
  return graph.all.filter(
    (node) => node.id.includes(trimmed) || node.name.toLowerCase().includes(trimmed)
  );
}
