import { ancestorsOf, type Graph } from './graph';
import { phaseKey } from './phases';

/** The view that imposes no constraint. Matches scripts/views.ts. */
export const DEFAULT_VIEW_ID = '1000';

export interface Filter {
  viewId: string;
  groupId: string | null;
  /** A phaseKey. */
  phase: string | null;
}

export const DEFAULT_FILTER: Filter = { viewId: DEFAULT_VIEW_ID, groupId: null, phase: null };

/** How many of the three constraints are active. */
export function filterCount(filter: Filter): number {
  return (filter.viewId === DEFAULT_VIEW_ID ? 0 : 1) + (filter.groupId === null ? 0 : 1) + (filter.phase === null ? 0 : 1);
}

/** The ids passing the filter, or null when the filter constrains nothing. */
export function matchingIds(graph: Graph, filter: Filter): Set<string> | null {
  if (filterCount(filter) === 0) {
    return null;
  }

  let allowed: Set<string> | null = null;
  if (filter.viewId !== DEFAULT_VIEW_ID) {
    const ids = filter.groupId === null
      ? graph.views.find((view) => view.id === filter.viewId)?.memberIds
      : graph.groups[filter.groupId]?.membersByView[filter.viewId];
    allowed = new Set(ids ?? []);
  }

  const { phase } = filter;
  return new Set(
    graph.all
      .filter((node) => allowed === null || allowed.has(node.id))
      .filter((node) => phase === null || (node.phases ?? []).some((p) => phaseKey(p) === phase))
      .map((node) => node.id),
  );
}

/** The matches plus all their ancestors, so each match stays reachable in the tree. */
export function withMatchPaths(graph: Graph, matches: Set<string>): Set<string> {
  const result = new Set(matches);
  for (const id of matches) {
    for (const ancestor of ancestorsOf(graph, id)) {
      result.add(ancestor);
    }
  }
  return result;
}

/** How many distinct matching descendants sit beneath `id`, excluding `id`. */
export function countMatchesBeneath(graph: Graph, id: string, matches: Set<string>): number {
  const seen = new Set<string>();
  const queue = [...(graph.childrenOf.get(id) ?? [])];
  for (let i = 0; i < queue.length; i += 1) {
    const next = queue[i];
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    queue.push(...(graph.childrenOf.get(next) ?? []));
  }
  seen.delete(id);
  let count = 0;
  for (const descendant of seen) {
    if (matches.has(descendant)) {
      count += 1;
    }
  }
  return count;
}
