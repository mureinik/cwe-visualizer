import { describe, it, expect } from 'vitest';
import { layoutEgoGraph, EDGE_MARGIN, CENTER_CLEARANCE } from '../../src/lib/layout';
import type { EgoGraph } from '../../src/lib/ego';

const size = { width: 1000, height: 800 };

const ego: EgoGraph = {
  centerId: '3',
  nodes: [
    { id: '3', band: 0, side: 'center' },
    { id: '2', band: -1, side: 'center' },
    { id: '1', band: -2, side: 'center' },
    { id: '10', band: 1, side: 'center' },
    { id: '11', band: 1, side: 'center' },
    { id: '20', band: 0, side: 'left' },
    { id: '30', band: 0, side: 'right' },
  ],
  edges: [
    { from: '3', to: '2', type: 'ChildOf', group: 'hierarchy' },
    { from: '3', to: '30', type: 'CanPrecede', group: 'sequence' },
  ],
  overflow: { parentId: '3', hiddenCount: 8 },
  lateralOverflow: { left: 0, right: 0 },
};

const at = (id: string) => layoutEgoGraph(ego, size).nodes.find((n) => n.id === id)!;

describe('layoutEgoGraph', () => {
  it('centres the selected node horizontally', () => {
    expect(at('3').x).toBe(500);
  });

  it('stacks bands so more abstract sits higher', () => {
    expect(at('1').y).toBeLessThan(at('2').y);
    expect(at('2').y).toBeLessThan(at('3').y);
    expect(at('3').y).toBeLessThan(at('10').y);
  });

  it('keeps every node inside the stage', () => {
    for (const node of layoutEgoGraph(ego, size).nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(size.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(size.height);
    }
  });

  it('distributes siblings evenly across a band', () => {
    const noOverflow = layoutEgoGraph({ ...ego, overflow: null }, size);
    const xs = noOverflow.nodes.filter((n) => n.band === 1).map((n) => n.x);
    expect(xs[0]).not.toBe(xs[1]);
    expect(xs[0] + xs[1]).toBeCloseTo(size.width, 5);
  });

  it('puts a left-side lateral left of centre and a right-side one right', () => {
    expect(at('20').x).toBeLessThan(at('3').x);
    expect(at('30').x).toBeGreaterThan(at('3').x);
    expect(at('20').y).toBe(at('3').y);
  });

  it('emits a cubic path per edge', () => {
    const paths = layoutEgoGraph(ego, size).edges.map((e) => e.path);
    expect(paths).toHaveLength(2);
    for (const path of paths) expect(path).toMatch(/^M [\d.-]+ [\d.-]+ C /);
  });

  it('positions the overflow chip on the children band', () => {
    const { overflow } = layoutEgoGraph(ego, size);
    expect(overflow?.hiddenCount).toBe(8);
    expect(overflow?.y).toBe(at('10').y);
  });

  it('is deterministic', () => {
    expect(layoutEgoGraph(ego, size)).toEqual(layoutEgoGraph(ego, size));
  });

  it('does not divide by zero on an empty ego graph', () => {
    const empty = layoutEgoGraph({ centerId: 'x', nodes: [], edges: [], overflow: null, lateralOverflow: { left: 0, right: 0 } }, size);
    expect(empty.nodes).toEqual([]);
  });
});

describe('layoutEgoGraph edge margin', () => {
  it('keeps the outermost node in a band clear of the stage edge', () => {
    const wide: EgoGraph = {
      centerId: 'c',
      nodes: [
        { id: 'c', band: 0, side: 'center' },
        ...Array.from({ length: 8 }, (_, i) => ({ id: `k${i}`, band: 1 as const, side: 'center' as const })),
      ],
      edges: [],
      overflow: null,
      lateralOverflow: { left: 0, right: 0 },
    };
    const xs = layoutEgoGraph(wide, size).nodes.filter((n) => n.band === 1).map((n) => n.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(EDGE_MARGIN);
    expect(Math.max(...xs)).toBeLessThanOrEqual(size.width - EDGE_MARGIN);
  });

  it('keeps the overflow chip clear of the stage edge too', () => {
    const packed: EgoGraph = {
      centerId: 'c',
      nodes: [
        { id: 'c', band: 0, side: 'center' },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `k${i}`, band: 1 as const, side: 'center' as const })),
      ],
      edges: [],
      overflow: { parentId: 'c', hiddenCount: 33 },
      lateralOverflow: { left: 0, right: 0 },
    };
    const { overflow } = layoutEgoGraph(packed, size);
    expect(overflow!.x).toBeLessThanOrEqual(size.width - EDGE_MARGIN);
  });
});

describe('layoutEgoGraph overflow chip', () => {
  const withOverflow: EgoGraph = {
    centerId: 'c',
    nodes: [
      { id: 'c', band: 0, side: 'center' },
      ...Array.from({ length: 10 }, (_, i) => ({ id: `k${i}`, band: 1 as const, side: 'center' as const })),
    ],
    edges: [],
    overflow: { parentId: 'c', hiddenCount: 33 },
    lateralOverflow: { left: 0, right: 0 },
  };

  it('does not overlap the last child', () => {
    const { nodes, overflow } = layoutEgoGraph(withOverflow, { width: 960, height: 600 });
    const lastChild = Math.max(...nodes.filter((n) => n.band === 1).map((n) => n.x));
    // The chip's rect spans 68px, so its centre must clear the child by more
    // than half that or it is drawn on top of it.
    expect(overflow!.x - lastChild).toBeGreaterThan(34);
  });

  it('takes a slot of its own, so the children shift left to make room', () => {
    const size960 = { width: 960, height: 600 };
    const without = layoutEgoGraph({ ...withOverflow, overflow: null }, size960);
    const with_ = layoutEgoGraph(withOverflow, size960);
    const lastWithout = Math.max(...without.nodes.filter((n) => n.band === 1).map((n) => n.x));
    const lastWith = Math.max(...with_.nodes.filter((n) => n.band === 1).map((n) => n.x));
    expect(lastWith).toBeLessThan(lastWithout);
  });
});

describe('layoutEgoGraph centre clearance', () => {
  it('keeps laterals away from the pinned centre however many there are', () => {
    const crowded: EgoGraph = {
      centerId: 'c',
      nodes: [
        { id: 'c', band: 0, side: 'center' },
        ...Array.from({ length: 11 }, (_, i) => ({ id: `l${i}`, band: 0 as const, side: 'left' as const })),
      ],
      edges: [],
      overflow: null,
      lateralOverflow: { left: 0, right: 0 },
    };
    const { nodes } = layoutEgoGraph(crowded, size);
    const centre = nodes.find((n) => n.id === 'c')!;
    const nearest = Math.max(...nodes.filter((n) => n.id !== 'c').map((n) => n.x));
    expect(centre.x - nearest).toBeGreaterThanOrEqual(CENTER_CLEARANCE);
  });
});

describe('layoutEgoGraph lateral overflow marker', () => {
  it('places a marker on the side that was capped, furthest from the centre', () => {
    const capped: EgoGraph = {
      centerId: 'c',
      nodes: [
        { id: 'c', band: 0, side: 'center' },
        ...Array.from({ length: 6 }, (_, i) => ({ id: `l${i}`, band: 0 as const, side: 'left' as const })),
      ],
      edges: [],
      overflow: null,
      lateralOverflow: { left: 5, right: 0 },
    };
    const { nodes, lateralOverflow } = layoutEgoGraph(capped, size);
    expect(lateralOverflow).toHaveLength(1);
    const marker = lateralOverflow[0];
    expect(marker.side).toBe('left');
    expect(marker.hiddenCount).toBe(5);
    const leftmostNode = Math.min(...nodes.filter((n) => n.id !== 'c').map((n) => n.x));
    expect(marker.x).toBeLessThan(leftmostNode);
  });

  it('emits no marker when nothing was capped', () => {
    expect(layoutEgoGraph(ego, size).lateralOverflow).toEqual([]);
  });
});
