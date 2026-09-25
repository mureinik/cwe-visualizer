import type { CweNode, Graph } from './graph';

/** Lower sorts first. */
function rank(node: CweNode, query: string): number {
  const id = node.id;
  const name = node.name.toLowerCase();

  if (id === query) return 0;
  if (id.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (id.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function searchNodes(graph: Graph, query: string): CweNode[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [];

  return graph.all
    .map((node) => ({ node, rank: rank(node, trimmed) }))
    .filter((scored) => scored.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => {
      // Deprecated entries are still findable, but never ahead of a live one.
      const aDeprecated = a.node.status === 'Deprecated' ? 1 : 0;
      const bDeprecated = b.node.status === 'Deprecated' ? 1 : 0;
      if (aDeprecated !== bDeprecated) return aDeprecated - bDeprecated;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return Number(a.node.id) - Number(b.node.id);
    })
    .map((scored) => scored.node);
}
