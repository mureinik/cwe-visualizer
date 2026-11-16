import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/lib/graph';
import { filterData } from '../fixtures/filter-data';
import { DEFAULT_FILTER, countMatchesBeneath, filterCount, matchingIds, withMatchPaths } from '../../src/lib/filter';

const graph = buildGraph(filterData);
const view10 = { ...DEFAULT_FILTER, viewId: '10' };

describe('matchingIds', () => {
  it('is null for the default filter', () => {
    expect(matchingIds(graph, DEFAULT_FILTER)).toBeNull();
  });

  it('keeps the members of a view, narrowed by a group', () => {
    expect(matchingIds(graph, view10)).toEqual(new Set(['3', '5']));
    expect(matchingIds(graph, { ...view10, groupId: '20' })).toEqual(new Set(['3']));
  });

  it('keeps standard and AI Testing apart', () => {
    expect(matchingIds(graph, { ...DEFAULT_FILTER, phase: 'Testing' })).toEqual(new Set(['5']));
    expect(matchingIds(graph, { ...DEFAULT_FILTER, phase: 'AI:Testing' })).toEqual(new Set(['3']));
  });

  it('is empty, not null, when the constraints exclude everything', () => {
    expect(matchingIds(graph, { ...view10, phase: 'Implementation' })).toEqual(new Set());
  });

  it('applies a phase with the default view', () => {
    expect(matchingIds(graph, { ...DEFAULT_FILTER, phase: 'Implementation' })).toEqual(new Set(['2']));
  });
});

describe('filterCount', () => {
  it('counts the active constraints', () => {
    expect(filterCount(DEFAULT_FILTER)).toBe(0);
    expect(filterCount({ ...view10, phase: 'Testing' })).toBe(2);
    expect(filterCount({ ...DEFAULT_FILTER, phase: 'Testing' })).toBe(1);
  });
});

describe('withMatchPaths', () => {
  it('adds the ancestors of each match', () => {
    expect(withMatchPaths(graph, new Set(['3']))).toEqual(new Set(['1', '2', '3']));
  });
});

describe('countMatchesBeneath', () => {
  it('counts matching descendants, excluding the entry itself', () => {
    const matches = new Set(['3', '5']);
    expect(countMatchesBeneath(graph, '1', matches)).toBe(1);
    expect(countMatchesBeneath(graph, '4', matches)).toBe(1);
    expect(countMatchesBeneath(graph, '3', matches)).toBe(0);
  });
});
