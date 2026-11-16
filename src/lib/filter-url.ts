import { DEFAULT_FILTER, DEFAULT_VIEW_ID, type Filter } from './filter';
import type { CweView, Graph } from './graph';
import { phaseKey } from './phases';

/** Reads the filter from a query string, dropping values this graph doesn't know. */
export function readFilter(search: string, graph: Graph): { filter: Filter; dropped: string[] } {
  const params = new URLSearchParams(search);
  const filter: Filter = { ...DEFAULT_FILTER };
  const dropped: string[] = [];

  const view = params.get('view');
  let validView: CweView | undefined;
  if (view !== null) {
    validView = graph.views.find((v) => v.id === view);
    if (!validView) {
      dropped.push(`view ${view}`);
    } else if (view !== DEFAULT_VIEW_ID) {
      filter.viewId = view;
    }
  }

  const group = params.get('group');
  if (group !== null) {
    if (filter.viewId !== DEFAULT_VIEW_ID && validView?.groupIds.includes(group)) {
      filter.groupId = group;
    } else {
      dropped.push(`group ${group}`);
    }
  }

  const phase = params.get('phase');
  if (phase !== null) {
    if (graph.phases.some((p) => phaseKey(p) === phase)) {
      filter.phase = phase;
    } else {
      dropped.push(`phase ${phase}`);
    }
  }

  return { filter, dropped };
}

/** Sets or deletes `view`, `group` and `phase`; leaves everything else alone. */
export function writeFilter(params: URLSearchParams, filter: Filter): void {
  if (filter.viewId === DEFAULT_VIEW_ID) {
    params.delete('view');
  } else {
    params.set('view', filter.viewId);
  }
  if (filter.groupId === null) {
    params.delete('group');
  } else {
    params.set('group', filter.groupId);
  }
  if (filter.phase === null) {
    params.delete('phase');
  } else {
    params.set('phase', filter.phase);
  }
}
