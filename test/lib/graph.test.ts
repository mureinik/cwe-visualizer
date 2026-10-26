import { describe, it, expect } from 'vitest';
import { buildGraph, ancestorsOf, compareIds, countDescendants, type CweData } from '../../src/lib/graph';

const sampleData: CweData = {
  meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
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

  it('carries a relation\'s view onto its synthesized inverse', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [{ from: '1', to: '2', type: 'CanPrecede', viewId: '1000' }],
    };
    expect(buildGraph(data).relatedTo.get('2')).toEqual([{ from: '2', to: '1', type: 'CanFollow', viewId: '1000' }]);
  });

  // Ids that reach a lookup are always numeric (CWE_ID is an integer in the
  // schema, and App.tsx drops a non-numeric ?cwe=), so nothing in the app looks
  // up a key like constructor.
  describe('lookups by an object key', { tags: ['theoretical'] }, () => {
    it('has no inherited keys in nodes, so only CWE ids look up', () => {
      for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
        expect(key in graph.nodes).toBe(false);
        expect(graph.nodes[key]).toBeUndefined();
      }
      expect('79' in graph.nodes).toBe(true);
    });
  });

  // The schema enumerates Nature, none of its values is an Object.prototype
  // member, and no future type would be named like one.
  describe('a relation type named like an object key', { tags: ['theoretical'] }, () => {
    it('falls back for a relation type named like an Object.prototype member', () => {
      const data: CweData = {
        meta: sampleData.meta,
        nodes: {
          '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
          '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
        },
        edges: [{ from: '1', to: '2', type: 'toString' }],
      };
      const graph = buildGraph(data);
      expect(graph.relatedTo.get('2')).toEqual([{ from: '2', to: '1', type: 'toString (inverse)' }]);
    });
  });
});

// The schema allows ParentOf, though today's data only states ChildOf.
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

  it('records a link once when both ChildOf and ParentOf state it', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: '', status: '', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: '', status: '', description: '', url: '' },
      },
      edges: [
        { from: '1', to: '2', type: 'ParentOf' },
        { from: '2', to: '1', type: 'ChildOf' },
      ],
    };
    const graph = buildGraph(data);
    expect(graph.childrenOf.get('1')).toEqual(['2']);
    expect(graph.parentsOf.get('2')).toEqual(['1']);
  });
});

describe('compareIds', () => {
  it('orders ids numerically, not as strings', () => {
    expect(['120', '79', '1000', '20'].sort(compareIds)).toEqual(['20', '79', '120', '1000']);
  });
});

// A small hierarchy for the walks below.
const deep: CweData = {
  meta: sampleData.meta,
  nodes: Object.fromEntries(
    ['1', '2', '3', '4', '5'].map((id) => [
      id,
      { id, name: `N${id}`, abstraction: 'Base', status: 'Draft', description: '', url: '' },
    ]),
  ),
  edges: [
    { from: '2', to: '1', type: 'ChildOf' },
    { from: '3', to: '1', type: 'ChildOf' },
    { from: '4', to: '2', type: 'ChildOf' },
    // 5 sits under both 3 and 4 — the hierarchy is a DAG
    { from: '5', to: '3', type: 'ChildOf' },
    { from: '5', to: '4', type: 'ChildOf' },
  ],
};

describe('ancestorsOf', () => {
  const graph = buildGraph(sampleData);

  it('returns every ancestor up to the root', () => {
    expect(ancestorsOf(graph, '79')).toEqual(new Set(['74']));
  });

  it('returns an empty set for a root node', () => {
    expect(ancestorsOf(graph, '74')).toEqual(new Set());
  });

  it('walks every level, visiting an ancestor reachable by two paths once', () => {
    expect(ancestorsOf(buildGraph(deep), '5')).toEqual(new Set(['1', '2', '3', '4']));
  });

  // Real: `?cwe=99999` reaches this, since the tree calls `ancestorsOf` with
  // the selected id.
  it('returns an empty set for an id not in the corpus', () => {
    expect(ancestorsOf(graph, '99999')).toEqual(new Set());
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

  // Nothing in src/ passes rootIds. Promote all three tests if something
  // starts to.
  describe('the rootIds option', { tags: ['theoretical'] }, () => {
    it('accepts an explicit root set, which a view would supply', () => {
      const graph = buildGraph(withDeprecated, { rootIds: ['285'] });
      expect(graph.roots).toEqual(['285']);
      expect(graph.deprecatedRoots).toEqual([]);
    });

    it('ignores explicit root ids that are not in the corpus', () => {
      expect(buildGraph(withDeprecated, { rootIds: ['285', '99999'] }).roots).toEqual(['285']);
    });

    it('ignores object keys among the declared roots', () => {
      expect(buildGraph(sampleData, { rootIds: ['constructor', '74'] }).roots).toEqual(['74']);
    });
  });
});

describe('countDescendants', () => {
  it('counts every level beneath a node', () => {
    expect(countDescendants(buildGraph(deep), '1')).toBe(4);
  });

  it('counts a node reachable by two paths only once', () => {
    expect(countDescendants(buildGraph(deep), '2')).toBe(2);
  });

  it('is zero for a leaf', () => {
    expect(countDescendants(buildGraph(deep), '5')).toBe(0);
  });

  // Its only caller, LandingPanel, passes ids from graph.roots.
  describe('an id outside the corpus', { tags: ['theoretical'] }, () => {
    it('is zero for an id not in the corpus', () => {
      expect(countDescendants(buildGraph(deep), '99999')).toBe(0);
    });
  });
});

describe('buildGraph relation de-duplication', () => {
  it('records a relation once even when MITRE states it from both ends', () => {
    const reciprocal: CweData = {
      meta: sampleData.meta,
      nodes: {
        '257': { id: '257', name: 'A', abstraction: 'Base', status: 'Draft', description: '', url: '' },
        '259': { id: '259', name: 'B', abstraction: 'Base', status: 'Draft', description: '', url: '' },
      },
      edges: [
        { from: '257', to: '259', type: 'PeerOf' },
        { from: '259', to: '257', type: 'PeerOf' },
      ],
    };
    const graph = buildGraph(reciprocal);
    expect(graph.relatedTo.get('257')).toEqual([{ from: '257', to: '259', type: 'PeerOf' }]);
    expect(graph.relatedTo.get('259')).toEqual([{ from: '259', to: '257', type: 'PeerOf' }]);
  });

  it('still keeps two genuinely different relations between the same pair', () => {
    const twoKinds: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1': { id: '1', name: 'A', abstraction: 'Base', status: 'Draft', description: '', url: '' },
        '2': { id: '2', name: 'B', abstraction: 'Base', status: 'Draft', description: '', url: '' },
      },
      edges: [
        { from: '1', to: '2', type: 'PeerOf' },
        { from: '1', to: '2', type: 'CanPrecede' },
      ],
    };
    expect(buildGraph(twoKinds).relatedTo.get('1')).toHaveLength(2);
  });
});

// A hierarchy relation to an entry that isn't in the download would be a
// MITRE mistake, and the schema can't rule it out. buildGraph keeps such
// edges, so the walks must step over the gap.
describe('hierarchy edges with an end outside the corpus', { tags: ['theoretical'] }, () => {
  const dangling: CweData = {
    meta: sampleData.meta,
    nodes: {
      '1': { id: '1', name: 'A', abstraction: 'Base', status: 'Draft', description: '', url: '' },
    },
    edges: [{ from: '1', to: '99999', type: 'ChildOf' }],
  };
  const graph = buildGraph(dangling);

  it('indexes the edge under the missing id too', () => {
    expect(graph.childrenOf.get('99999')).toEqual(['1']);
    expect(graph.parentsOf.get('1')).toEqual(['99999']);
  });

  it('walks up to the missing parent and stops there', () => {
    expect(ancestorsOf(graph, '1')).toEqual(new Set(['99999']));
  });

  it('counts down from the missing parent and stops at the leaf', () => {
    expect(countDescendants(graph, '99999')).toBe(1);
  });
});
