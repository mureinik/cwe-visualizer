import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/lib/graph';
import { DEFAULT_FILTER } from '../../src/lib/filter';
import { readFilter, writeFilter } from '../../src/lib/filter-url';
import { filterData as data } from '../fixtures/filter-data';

const graph = buildGraph({
  ...data,
  phases: [...(data.phases ?? []), { name: 'Implementation & Physical Design', domain: 'Hardware' }],
});

describe('readFilter', () => {
  it('reads a valid view, group and phase', () => {
    expect(readFilter('?cwe=79&view=10&group=20&phase=AI%3ATesting', graph)).toEqual({
      filter: { viewId: '10', groupId: '20', phase: 'AI:Testing' },
      dropped: [],
    });
  });

  it('drops values the graph does not know', () => {
    expect(readFilter('?view=9999&group=5&phase=Nope', graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['view 9999', 'group 5', 'phase Nope'],
    });
  });

  it('drops a group with no view', () => {
    expect(readFilter('?group=20', graph)).toEqual({ filter: DEFAULT_FILTER, dropped: ['group 20'] });
  });

  it('accepts the default view silently', () => {
    expect(readFilter('?view=1000', graph)).toEqual({ filter: DEFAULT_FILTER, dropped: [] });
  });
});

describe('writeFilter', () => {
  it('round-trips a custom phase', () => {
    const filter = { viewId: '10', groupId: null, phase: 'Hardware:Implementation & Physical Design' };
    const params = new URLSearchParams();
    writeFilter(params, filter);
    expect(readFilter(`?${params.toString()}`, graph)).toEqual({ filter, dropped: [] });
  });

  it('removes all three parameters for the default filter and keeps cwe', () => {
    const params = new URLSearchParams('cwe=79&view=10&group=20&phase=Testing');
    writeFilter(params, DEFAULT_FILTER);
    expect(params.toString()).toBe('cwe=79');
  });
});
