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

  // The address is anyone's to write, and the filter bar repeats what it
  // drops, so only a value that reads as an id or a phase name is repeated.
  it('names a non-numeric view or group only generically', () => {
    expect(readFilter('?view=Click%20here&group=evil.example', graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['an unrecognised view', 'an unrecognised group'],
    });
  });

  it('names a long or unusual phase only generically', () => {
    const sentence = 'Your session has expired, sign in again at evil.example';
    expect(readFilter(`?phase=${encodeURIComponent(sentence)}`, graph).dropped).toEqual(['an unrecognised phase']);
    expect(readFilter('?phase=%3Cb%3EHi%3C%2Fb%3E', graph).dropped).toEqual(['an unrecognised phase']);
    expect(readFilter('?phase=Design%20%26%20Test%3A%20Old%20(v2)', graph).dropped).toEqual(['phase Design & Test: Old (v2)']);
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
