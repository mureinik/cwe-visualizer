import type { CweData, CweEdge, CweMeta, CweNode } from './cwe-data';
import { INVERSE_SUFFIX } from './relations';

export type { CweData, CweEdge, CweMeta, CweNode } from './cwe-data';

export interface Graph {
  meta: CweMeta;
  /**
   * Keyed by CWE id, with a null prototype, so `id in nodes` and
   * `nodes[id]` see only CWEs and never an inherited key like `constructor`.
   */
  nodes: Record<string, CweNode>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  relatedTo: Map<string, CweEdge[]>;
  /** Top-level entries to display. Deprecated and obsolete orphans are not here. */
  roots: string[];
  /**
   * Parentless entries MITRE has deprecated or marked obsolete (see
   * isDeprecated). Kept separate so they can be
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
// label so it's never silently dropped or mislabeled as the original. A Map,
// so a type that happens to share a name with an Object.prototype member
// still falls back.
const INVERSE_NATURES = new Map([
  ['PeerOf', 'PeerOf'],
  ['CanAlsoBe', 'CanAlsoBe'],
  ['Overlaps', 'Overlaps'],
  ['CanPrecede', 'CanFollow'],
  ['CanFollow', 'CanPrecede'],
  ['Requires', 'RequiredBy'],
  ['RequiredBy', 'Requires'],
]);

function inverseNature(type: string): string {
  return INVERSE_NATURES.get(type) ?? `${type}${INVERSE_SUFFIX}`;
}

/**
 * Whether MITRE has retired the entry. Obsolete entries are "still valid but
 * no longer relevant", usually superseded, so they get the same treatment as
 * Deprecated ones.
 */
export function isDeprecated(node: CweNode | undefined): boolean {
  return node?.status === 'Deprecated' || node?.status === 'Obsolete';
}

/**
 * Orders CWE ids numerically, so 79 sorts before 120. Every list of ids in
 * the app (tree, ego graph, search ties) sorts with this, so they agree.
 */
export function compareIds(a: string, b: string): number {
  return Number(a) - Number(b);
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
  const nodes = Object.assign(Object.create(null) as Record<string, CweNode>, data.nodes);
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  const relatedTo = new Map<string, CweEdge[]>();

  for (const id of Object.keys(nodes)) {
    childrenOf.set(id, []);
    parentsOf.set(id, []);
    relatedTo.set(id, []);
  }

  // MITRE states some relations from both ends, and buildGraph also
  // synthesizes the missing direction of one-sided ones — so without this the
  // same relation can be recorded twice, byte for byte, on the same node.
  const relatedSeen = new Map<string, Set<string>>();
  function addRelated(id: string, edge: CweEdge) {
    const list = relatedTo.get(id);
    if (!list) return;
    const seen = relatedSeen.get(id) ?? new Set<string>();
    const key = `${edge.to}|${edge.type}`;
    if (seen.has(key)) return;
    seen.add(key);
    relatedSeen.set(id, seen);
    list.push(edge);
  }

  for (const edge of data.edges) {
    if (edge.type === 'ChildOf') {
      addUnique(childrenOf, edge.to, edge.from);
      addUnique(parentsOf, edge.from, edge.to);
    } else if (edge.type === 'ParentOf') {
      addUnique(childrenOf, edge.from, edge.to);
      addUnique(parentsOf, edge.to, edge.from);
    } else {
      addRelated(edge.from, edge);
      const inverse: CweEdge = { from: edge.to, to: edge.from, type: inverseNature(edge.type) };
      if (edge.viewId !== undefined) inverse.viewId = edge.viewId;
      addRelated(edge.to, inverse);
    }
  }

  const isDeprecatedId = (id: string) => isDeprecated(nodes[id]);

  let roots: string[];
  let deprecatedRoots: string[];

  if (options?.rootIds) {
    roots = options.rootIds.filter((id) => id in nodes).sort(compareIds);
    deprecatedRoots = [];
  } else {
    const parentless = Object.keys(nodes).filter((id) => (parentsOf.get(id) ?? []).length === 0);
    roots = parentless.filter((id) => !isDeprecatedId(id)).sort(compareIds);
    deprecatedRoots = parentless.filter(isDeprecatedId).sort(compareIds);
  }

  const all = Object.values(nodes).sort((a, b) => compareIds(a.id, b.id));

  return { meta: data.meta, nodes, childrenOf, parentsOf, relatedTo, roots, deprecatedRoots, all };
}

export function ancestorsOf(graph: Graph, id: string): Set<string> {
  const ancestors = new Set<string>();
  const queue = [...(graph.parentsOf.get(id) ?? [])];
  // Walk by index rather than shift(), which is O(n) per call.
  for (let i = 0; i < queue.length; i += 1) {
    const next = queue[i];
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
  // Walk by index rather than shift(), which is O(n) per call.
  for (let i = 0; i < queue.length; i += 1) {
    const next = queue[i];
    if (seen.has(next)) continue;
    seen.add(next);
    queue.push(...(graph.childrenOf.get(next) ?? []));
  }
  seen.delete(id);
  return seen.size;
}
