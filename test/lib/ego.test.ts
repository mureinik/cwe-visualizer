import { describe, it, expect } from 'vitest';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { buildEgoGraph } from '../../src/lib/ego';

const node = (id: string) => ({
  id, name: `Name ${id}`, abstraction: 'Base', status: 'Draft', description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: Object.fromEntries(
    ['1', '2', '3', '10', '11', '12', '20', '30', '40'].map((id) => [id, node(id)])
  ),
  edges: [
    { from: '2', to: '1', type: 'ChildOf' },
    { from: '3', to: '2', type: 'ChildOf' },
    { from: '10', to: '3', type: 'ChildOf' },
    { from: '11', to: '3', type: 'ChildOf' },
    { from: '12', to: '3', type: 'ChildOf' },
    { from: '3', to: '20', type: 'CanFollow' },
    { from: '3', to: '30', type: 'CanPrecede' },
    { from: '3', to: '40', type: 'PeerOf' },
  ],
};

const graph = buildGraph(data);
const bandOf = (ego: ReturnType<typeof buildEgoGraph>, id: string) =>
  ego.nodes.find((n) => n.id === id)?.band;

describe('buildEgoGraph', () => {
  const ego = buildEgoGraph(graph, '3');

  it('puts the centre on band 0', () => {
    expect(ego.centerId).toBe('3');
    expect(ego.nodes.find((n) => n.id === '3')).toEqual({ id: '3', band: 0, side: 'center' });
  });

  it('puts parents one band up and grandparents two', () => {
    expect(bandOf(ego, '2')).toBe(-1);
    expect(bandOf(ego, '1')).toBe(-2);
  });

  it('puts children one band down', () => {
    expect(bandOf(ego, '10')).toBe(1);
    expect(bandOf(ego, '12')).toBe(1);
  });

  it('stops at one hop down — a grandchild is not included', () => {
    const deeper = buildGraph({
      ...data,
      edges: [...data.edges, { from: '99', to: '10', type: 'ChildOf' }],
      nodes: { ...data.nodes, '99': node('99') },
    });
    expect(bandOf(buildEgoGraph(deeper, '3'), '99')).toBeUndefined();
  });

  it('honours ancestorHops: 1 by dropping grandparents', () => {
    expect(bandOf(buildEgoGraph(graph, '3', { ancestorHops: 1 }), '1')).toBeUndefined();
  });

  it('places a CanFollow relation to the left and CanPrecede to the right', () => {
    expect(ego.nodes.find((n) => n.id === '20')?.side).toBe('left');
    expect(ego.nodes.find((n) => n.id === '30')?.side).toBe('right');
    expect(bandOf(ego, '20')).toBe(0);
  });

  it('gives non-directional relations a side, since position there carries no meaning', () => {
    expect(['left', 'right']).toContain(ego.nodes.find((n) => n.id === '40')?.side);
  });

  it('groups each edge by relation kind', () => {
    const groups = Object.fromEntries(ego.edges.map((e) => [`${e.from}->${e.to}`, e.group]));
    expect(groups['3->2']).toBe('hierarchy');
    expect(groups['3->30']).toBe('sequence');
    expect(groups['3->40']).toBe('peer');
  });

  it('caps children and reports the remainder', () => {
    const many: CweData = {
      ...data,
      nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${200 + i}`, node(`${200 + i}`)])) },
      edges: [...data.edges, ...Array.from({ length: 15 }, (_, i) => ({ from: `${200 + i}`, to: '3', type: 'ChildOf' }))],
    };
    const capped = buildEgoGraph(buildGraph(many), '3', { childCap: 10 });
    expect(capped.nodes.filter((n) => n.band === 1)).toHaveLength(10);
    expect(capped.overflow).toEqual({ parentId: '3', hiddenCount: 8 });
  });

  it('reports no overflow when every child fits', () => {
    expect(ego.overflow).toBeNull();
  });

  it('returns a lone node for an entry with no relations at all', () => {
    const isolated = buildGraph({ ...data, edges: [] });
    const lone = buildEgoGraph(isolated, '3');
    expect(lone.nodes).toEqual([{ id: '3', band: 0, side: 'center' }]);
    expect(lone.edges).toEqual([]);
  });

  it('skips relation targets that are not in the corpus', () => {
    const dangling = buildGraph({
      ...data,
      edges: [...data.edges, { from: '3', to: '99999', type: 'PeerOf' }],
    });
    expect(bandOf(buildEgoGraph(dangling, '3'), '99999')).toBeUndefined();
  });

  it('returns an empty graph for an unknown centre', () => {
    const missing = buildEgoGraph(graph, '99999');
    expect(missing.nodes).toEqual([]);
    expect(missing.edges).toEqual([]);
  });

  it('is deterministic — same input, same output', () => {
    expect(buildEgoGraph(graph, '3')).toEqual(buildEgoGraph(graph, '3'));
  });
});
