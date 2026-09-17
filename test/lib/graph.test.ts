import { describe, it, expect } from 'vitest';
import { buildGraph, ancestorsOf, type CweData } from '../../src/lib/graph';

const sampleData: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'd74', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'd79', url: 'https://cwe.mitre.org/data/definitions/79.html' },
    '80': { id: '80', name: 'Improper Neutralization', abstraction: 'Base', status: 'Stable', description: 'd80', url: 'https://cwe.mitre.org/data/definitions/80.html' },
    '89': { id: '89', name: 'SQL Injection', abstraction: 'Base', status: 'Stable', description: 'd89', url: 'https://cwe.mitre.org/data/definitions/89.html' },
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '79', to: '80', type: 'PeerOf' },
    { from: '80', to: '74', type: 'ChildOf' },
    { from: '89', to: '74', type: 'ChildOf' },
    { from: '89', to: '20', type: 'CanFollow' },
  ],
};

describe('buildGraph', () => {
  const graph = buildGraph(sampleData);

  it('indexes children under their ChildOf parent', () => {
    expect(graph.childrenOf.get('74')?.slice().sort()).toEqual(['79', '80', '89']);
  });

  it('treats nodes with no parent edge as roots', () => {
    expect(graph.roots).toEqual(['74']);
  });

  it('groups non-hierarchy edges under relatedTo', () => {
    expect(graph.relatedTo.get('79')).toEqual([{ from: '79', to: '80', type: 'PeerOf' }]);
    expect(graph.relatedTo.get('89')).toEqual([{ from: '89', to: '20', type: 'CanFollow' }]);
  });

  it('does not put ChildOf edges in relatedTo', () => {
    // '74' is the target of three ChildOf edges (from 79, 80 and 89) and has
    // no non-hierarchy edge pointing at it in either direction, so it's a
    // clean check that ChildOf never populates relatedTo on either side.
    // ('80' is not used here: it also has a PeerOf edge from 79, so since
    // non-hierarchy edges are now indexed on both endpoints, 80 legitimately
    // gains an inverse PeerOf entry — see 'synthesizes an inverse edge...'.)
    expect(graph.relatedTo.get('74')).toEqual([]);
  });

  it('synthesizes an inverse edge on the target side of a one-sided relation', () => {
    // The fixture only encodes 79 -> 80 (PeerOf); MITRE's real data rarely
    // encodes the reverse direction, so buildGraph must synthesize it.
    expect(graph.relatedTo.get('80')).toEqual([{ from: '80', to: '79', type: 'PeerOf' }]);
  });

  it('labels a synthesized CanPrecede inverse as CanFollow', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [{ from: '1', to: '2', type: 'CanPrecede' }],
    };
    const graph = buildGraph(data);
    expect(graph.relatedTo.get('1')).toEqual([{ from: '1', to: '2', type: 'CanPrecede' }]);
    expect(graph.relatedTo.get('2')).toEqual([{ from: '2', to: '1', type: 'CanFollow' }]);
  });

  it('falls back to a generic "(inverse)" label for relation types with no known inverse', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [{ from: '1', to: '2', type: 'StartsWith' }],
    };
    const graph = buildGraph(data);
    expect(graph.relatedTo.get('2')).toEqual([{ from: '2', to: '1', type: 'StartsWith (inverse)' }]);
  });
});

describe('buildGraph ParentOf direction', () => {
  it('treats a ParentOf edge as establishing the same child relationship as ChildOf', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [{ from: '1', to: '2', type: 'ParentOf' }],
    };
    const graph = buildGraph(data);
    expect(graph.childrenOf.get('1')).toEqual(['2']);
    expect(graph.roots).toEqual(['1']);
  });
});

describe('ancestorsOf', () => {
  const graph = buildGraph(sampleData);

  it('returns every ancestor up to the root', () => {
    expect(ancestorsOf(graph, '79')).toEqual(new Set(['74']));
  });

  it('returns an empty set for a root node', () => {
    expect(ancestorsOf(graph, '74')).toEqual(new Set());
  });
});

describe('buildGraph roots', () => {
  const withDeprecated: CweData = {
    meta: sampleData.meta,
    nodes: {
      '284': { id: '284', name: 'Improper Access Control', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
      '285': { id: '285', name: 'Improper Authorization', abstraction: 'Class', status: 'Draft', description: '', url: '' },
      '71': { id: '71', name: "DEPRECATED: Apple '.DS_Store'", abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
    },
    edges: [{ from: '285', to: '284', type: 'ChildOf' }],
  };

  it('keeps live parentless nodes in roots', () => {
    expect(buildGraph(withDeprecated).roots).toEqual(['284']);
  });

  it('moves parentless deprecated nodes into deprecatedRoots', () => {
    expect(buildGraph(withDeprecated).deprecatedRoots).toEqual(['71']);
  });

  it('sorts both root lists numerically', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1000': { id: '1000', name: 'A', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
        '99': { id: '99', name: 'B', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
      },
      edges: [],
    };
    expect(buildGraph(data).roots).toEqual(['99', '1000']);
  });

  it('accepts an explicit root set, which a view would supply', () => {
    const graph = buildGraph(withDeprecated, { rootIds: ['285'] });
    expect(graph.roots).toEqual(['285']);
    expect(graph.deprecatedRoots).toEqual([]);
  });

  it('ignores explicit root ids that are not in the corpus', () => {
    expect(buildGraph(withDeprecated, { rootIds: ['285', '99999'] }).roots).toEqual(['285']);
  });
});
