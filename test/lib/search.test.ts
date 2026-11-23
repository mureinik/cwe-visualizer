import { describe, it, expect } from 'vitest';
import type { CweNode } from '../../src/lib/cwe-data';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { searchNodes } from '../../src/lib/search';

const node = (
  id: string,
  name: string,
  status = 'Stable',
  extra: Pick<CweNode, 'alternateTerms' | 'previousNames'> = {},
): CweNode => ({
  id,
  name,
  abstraction: 'Base',
  status,
  description: '',
  url: '',
  ...extra,
});

const data: CweData = {
  meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
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
const ids = (query: string) => searchNodes(graph, query).map((h) => h.node.id);

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

  // No entry in today's data is Obsolete, but the schema allows it.
  it('ranks obsolete entries last as well', () => {
    const withObsolete = buildGraph({
      ...data,
      nodes: { '72': node('72', 'Injection, obsolete', 'Obsolete'), '74': node('74', 'Injection') },
    });
    expect(searchNodes(withObsolete, '7').map((h) => h.node.id)).toEqual(['74', '72']);
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

  it('returns only the filter matches when given a set', () => {
    expect(searchNodes(graph, '9', new Set(['89'])).map((h) => h.node.id)).toEqual(['89']);
  });

  it('is unchanged by a null filter', () => {
    expect(searchNodes(graph, '9', null)).toEqual(searchNodes(graph, '9'));
  });
});

describe('searchNodes with other names', () => {
  const otherData: CweData = {
    ...data,
    nodes: {
      '79': node('79', 'Improper Neutralization of Input During Web Page Generation', 'Stable', {
        alternateTerms: [
          { term: 'XSS' },
          { term: 'HTML Injection' },
          { term: 'Reflected XSS / Non-Persistent XSS / Type 1 XSS' },
        ],
      }),
      '85': node('85', 'Doubled Character XSS Manipulations'),
      '87': node('87', 'Improper Neutralization of Alternate XSS Syntax'),
      '74': node('74', 'Improper Neutralization of Special Elements in Output Used by a Downstream Component', 'Stable', {
        alternateTerms: [{ term: 'Injection' }],
      }),
      '91': node('91', 'XML Injection'),
      '352': node('352', 'Cross-Site Request Forgery', 'Stable', {
        alternateTerms: [{ term: 'CSRF' }, { term: 'XSRF' }],
      }),
      '285': node('285', 'Improper Authorization', 'Stable', { alternateTerms: [{ term: 'AuthZ' }] }),
      '256': node('256', 'Plaintext Storage of a Password', 'Stable', {
        previousNames: [{ name: 'Plaintext Storage of a Password', date: '2018-03-27' }],
      }),
      '1004': node('1004', 'Improper Neutralization Example', 'Stable', {
        alternateTerms: [{ term: 'Neutralization Bypass' }],
      }),
      '1001': node('1001', 'Failure-Prone Example'),
      '1002': node('1002', 'Unrelated Name', 'Stable', {
        previousNames: [
          { name: 'Failure to Sanitize X', date: '2008-09-09' },
          { name: 'Failure to Preserve X', date: '2009-07-27' },
        ],
      }),
      '1003': node('1003', 'Third Example', 'Stable', {
        previousNames: [
          { name: 'Tie Alpha', date: '2010-01-01' },
          { name: 'Tie Beta', date: '2010-01-01' },
          { name: 'Tie Gamma', date: '2009-01-01' },
        ],
      }),
    },
  };
  const otherGraph = buildGraph(otherData);
  const ids = (query: string) => searchNodes(otherGraph, query).map((h) => h.node.id);

  it('ranks an exact alternate term above names that merely contain the query', () => {
    expect(ids('xss')).toEqual(['79', '85', '87']);
    expect(ids('injection').slice(0, 2)).toEqual(['74', '91']);
  });

  it('ranks a partial term match below every name match', () => {
    expect(ids('xs').indexOf('79')).toBeGreaterThan(ids('xs').indexOf('87'));
  });

  it('ranks former names below names', () => {
    expect(ids('failure')).toEqual(['1001', '1002']);
  });

  it('matches terms case-insensitively and reports MITRE casing', () => {
    expect(searchNodes(otherGraph, 'authz')[0]).toEqual({
      node: otherGraph.nodes['285'],
      via: { kind: 'term', name: 'AuthZ' },
    });
  });

  it('reports the term at the best rank, not the first that contains the query', () => {
    expect(searchNodes(otherGraph, 'xss')[0].via).toEqual({ kind: 'term', name: 'XSS' });
  });

  it('reports the newest matching former name', () => {
    expect(searchNodes(otherGraph, 'failure to')[0].via).toEqual({ kind: 'former', name: 'Failure to Preserve X' });
  });

  it('reports the later former name when the dates tie, and not an older one listed after', () => {
    expect(searchNodes(otherGraph, 'tie')[0].via).toEqual({ kind: 'former', name: 'Tie Beta' });
  });

  it('ranks a former name that starts with the query above one that merely contains it', () => {
    expect(searchNodes(otherGraph, 'failure to s')[0].via).toEqual({ kind: 'former', name: 'Failure to Sanitize X' });
    expect(searchNodes(otherGraph, 'sanitize')[0].via).toEqual({ kind: 'former', name: 'Failure to Sanitize X' });
  });

  it('reports nothing when the name itself matched', () => {
    expect(searchNodes(otherGraph, 'plaintext')[0].via).toBeUndefined();
  });

  it('reports nothing when a former name equals the name that matched', () => {
    expect(searchNodes(otherGraph, 'storage')[0]).toEqual({ node: otherGraph.nodes['256'] });
  });

  it('reports nothing when the name contains the query and a term only starts with it', () => {
    const hit = searchNodes(otherGraph, 'neutralization').find((h) => h.node.id === '1004');
    expect(hit?.via).toBeUndefined();
  });

  it('finds no term match outside the filter', () => {
    expect(searchNodes(otherGraph, 'xss', new Set(['85', '87'])).map((h) => h.node.id)).toEqual(['85', '87']);
  });
});
