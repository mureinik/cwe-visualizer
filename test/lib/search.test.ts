import { describe, it, expect } from 'vitest';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { searchNodes } from '../../src/lib/search';

const node = (id: string, name: string, status = 'Stable') => ({
  id, name, abstraction: 'Base', status, description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': node('79', 'Cross-site Scripting'),
    '179': node('179', 'Incorrect Behavior Order'),
    '279': node('279', 'Incorrect Execution-Assigned Permissions'),
    '789': node('789', 'Memory Allocation with Excessive Size Value'),
    '89': node('89', 'SQL Injection'),
    '943': node('943', 'Improper Neutralization in Data Query Logic'),
    '71': node('71', 'DEPRECATED: Apple .DS_Store', 'Deprecated'),
  },
  edges: [],
};

const graph = buildGraph(data);
const ids = (query: string) => searchNodes(graph, query).map((n) => n.id);

describe('searchNodes', () => {
  it('ranks an exact id match first', () => {
    expect(ids('79')[0]).toBe('79');
  });

  it('ranks id-prefix matches above mere substring matches', () => {
    expect(ids('79').indexOf('789')).toBeLessThan(ids('79').indexOf('179'));
  });

  it('ranks a name-start match above a name-contains match', () => {
    const result = ids('sql');
    expect(result[0]).toBe('89');
  });

  it('matches names case-insensitively', () => {
    expect(ids('INJECTION')).toContain('89');
  });

  it('ranks deprecated entries last', () => {
    expect(ids('a').at(-1)).toBe('71');
  });

  it('returns an empty array for a blank query', () => {
    expect(ids('   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(ids('zzzzz')).toEqual([]);
  });

  it('breaks ties by ascending id, so results are stable', () => {
    expect(ids('incorrect')).toEqual(['179', '279']);
  });
});
