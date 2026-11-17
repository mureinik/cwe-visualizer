import { ancestorsOf, descendantsOf, type Graph } from './graph';
import { phaseKey } from './phases';

/** The view that imposes no constraint. Matches scripts/views.ts. */
export const DEFAULT_VIEW_ID = '1000';

export interface Filter {
  viewId: string;
  groupId: string | null;
  /** A phaseKey. */
  phase: string | null;
  /** The name of an entry in graph.languages. */
  language: string | null;
  /** Also keep the weaknesses that apply to any language. Meaningful only with a language. */
  anyLanguage: boolean;
}

export const DEFAULT_FILTER: Filter = { viewId: DEFAULT_VIEW_ID, groupId: null, phase: null, language: null, anyLanguage: false };

/** How many of the four constraints are active; the checkbox widens the language, so it doesn't count. */
export function filterCount(filter: Filter): number {
  return (filter.viewId === DEFAULT_VIEW_ID ? 0 : 1) +
    (filter.groupId === null ? 0 : 1) +
    (filter.phase === null ? 0 : 1) +
    (filter.language === null ? 0 : 1);
}

/** How many weaknesses applying to any language the checkbox adds: those not already members of `language`. */
export function agnosticExtra(graph: Graph, language: string): number {
  const members = new Set(graph.languages.find((l) => l.name === language)?.memberIds);
  return graph.languageAgnosticIds.filter((id) => !members.has(id)).length;
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

  let inLanguage: Set<string> | null = null;
  if (filter.language !== null) {
    inLanguage = new Set(graph.languages.find((l) => l.name === filter.language)?.memberIds);
    if (filter.anyLanguage) {
      graph.languageAgnosticIds.forEach((id) => inLanguage?.add(id));
    }
  }

  const { phase } = filter;
  return new Set(
    graph.all
      .filter((node) => allowed === null || allowed.has(node.id))
      .filter((node) => inLanguage === null || inLanguage.has(node.id))
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
  return [...descendantsOf(graph, id)].filter((descendant) => matches.has(descendant)).length;
}
