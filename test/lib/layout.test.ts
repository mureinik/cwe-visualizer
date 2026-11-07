import { describe, it, expect } from 'vitest';
import {
  lateralCapFor,
  layoutEgoGraph,
  bandY,
  BUNDLE_GAP,
  childCapFor,
  edgeMargin,
  EDGE_MARGIN,
  CENTER_CLEARANCE,
  LABEL_DEPTH,
  MIN_CHILD_SLOT,
} from '../../src/lib/layout';
import { relationLabel, type EgoGraph } from '../../src/lib/ego';
import { HALO_GAP, NODE_RADIUS, SELECTED_NODE_RADIUS } from '../../src/lib/shapes';
import crowded from '../fixtures/label-collisions.json';

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
    { from: '3', to: '2', types: ['ChildOf'], group: 'hierarchy' },
    { from: '3', to: '30', types: ['CanPrecede'], group: 'sequence' },
  ],
  overflow: { parentId: '3', hiddenCount: 8 },
  lateralOverflow: { left: 0, right: 0 },
  hiddenLaterals: { left: [], right: [] },
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
    for (const path of paths) {
      expect(path).toMatch(/^M [\d.-]+ [\d.-]+ C /);
    }
  });

  it('puts each edge label at the midpoint of its curve', () => {
    const edge = layoutEgoGraph(ego, size).edges.find((e) => e.to === '30')!;
    expect(edge.label.x).toBe((at('3').x + at('30').x) / 2);
    expect(edge.label.y).toBeCloseTo(at('3').y - 32);
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
    const empty = layoutEgoGraph({ centerId: 'x', nodes: [], edges: [], overflow: null, lateralOverflow: { left: 0, right: 0 }, hiddenLaterals: { left: [], right: [] } }, size);
    expect(empty.nodes).toEqual([]);
  });
});

describe('layoutEgoGraph child edge labels', () => {
  // All of a CWE's child edges meet at it, so their midpoints crowd together;
  // CWE-79 in CWE 5.0 has seven.
  const family: EgoGraph = {
    ...ego,
    nodes: [
      { id: '3', band: 0, side: 'center' },
      { id: '10', band: 1, side: 'center' },
      { id: '11', band: 1, side: 'center' },
    ],
    edges: ['10', '11'].map((from) => ({ from, to: '3', types: ['ChildOf'], group: 'hierarchy' as const })),
    overflow: null,
  };

  it('puts the label nearer the child, where the edges have spread out', () => {
    const layout = layoutEgoGraph(family, size);
    const center = layout.nodes.find((n) => n.id === '3')!;
    for (const edge of layout.edges) {
      const child = layout.nodes.find((n) => n.id === edge.from)!;
      expect(Math.abs(edge.label.y - child.y)).toBeLessThan(Math.abs(edge.label.y - center.y));
      expect(Math.abs(edge.label.x - child.x)).toBeLessThan(Math.abs(edge.label.x - center.x));
    }
  });

  it('keeps the label on its curve', () => {
    const edge = layoutEgoGraph(family, size).edges[0];
    const near = sample(edge.path).some((p) => Math.hypot(p.x - edge.label.x, p.y - edge.label.y) < 2);
    expect(near).toBe(true);
  });

  describe('on a stage too narrow for them side by side', () => {
    // CWE-79 in CWE 5.0 at 390px: six children and a "+1 more" chip.
    const ids = ['10', '11', '12', '13', '14', '15'];
    const crowded: EgoGraph = {
      ...family,
      nodes: [{ id: '3', band: 0, side: 'center' }, ...ids.map((id) => ({ id, band: 1 as const, side: 'center' as const }))],
      edges: ids.map((from) => ({ from, to: '3', types: ['ChildOf'], group: 'hierarchy' as const })),
      overflow: { parentId: '3', hiddenCount: 1 },
    };
    const labels = (stage: { width: number; height: number }) => layoutEgoGraph(crowded, stage).edges.map((e) => e.label);

    it('alternates their heights, so neighbours cannot run together', () => {
      const phone = labels({ width: 390, height: 330 });
      for (let i = 1; i < phone.length; i += 1) {
        expect(Math.abs(phone[i].y - phone[i - 1].y)).toBeGreaterThan(14);
      }
    });

    it('leaves room between those that share a height', () => {
      const phone = labels({ width: 390, height: 330 });
      for (let i = 2; i < phone.length; i += 1) {
        expect(Math.abs(phone[i].x - phone[i - 2].x)).toBeGreaterThan(48);
      }
    });

    it('keeps them on one line where there is room', () => {
      expect(new Set(labels(size).map((l) => l.y.toFixed(2))).size).toBe(1);
    });
  });

  it('leaves a relation to a child at the midpoint', () => {
    // CWE-788 Overlaps its child CWE-126 in CWE 5.0.
    const related = {
      ...family,
      edges: [{ from: '10', to: '3', types: ['Overlaps'], group: 'peer' as const }],
    };
    const layout = layoutEgoGraph(related, size);
    const [a, b] = [layout.nodes.find((n) => n.id === '3')!, layout.nodes.find((n) => n.id === '10')!];
    expect(layout.edges[0].label.y).toBeCloseTo((a.y + b.y) / 2);
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
      hiddenLaterals: { left: [], right: [] },
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
      hiddenLaterals: { left: [], right: [] },
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
    hiddenLaterals: { left: [], right: [] },
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
      hiddenLaterals: { left: [], right: [] },
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
      hiddenLaterals: {
        left: Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, type: 'CanFollow' })),
        right: [],
      },
    };
    const { nodes, lateralOverflow } = layoutEgoGraph(capped, size);
    expect(lateralOverflow).toHaveLength(1);
    const marker = lateralOverflow[0];
    expect(marker.side).toBe('left');
    expect(marker.hiddenCount).toBe(5);
    const leftmostNode = Math.min(...nodes.filter((n) => n.id !== 'c').map((n) => n.x));
    expect(marker.x).toBeLessThan(leftmostNode);
  });

  it('gives the marker the relations it stands for', () => {
    const hidden = Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, type: 'CanFollow' }));
    const capped: EgoGraph = {
      centerId: 'c',
      nodes: [{ id: 'c', band: 0, side: 'center' }],
      edges: [],
      overflow: null,
      lateralOverflow: { left: 5, right: 0 },
      hiddenLaterals: { left: hidden, right: [] },
    };
    expect(layoutEgoGraph(capped, size).lateralOverflow.map((m) => m.hidden)).toEqual([hidden]);
  });

  it('emits no marker when nothing was capped', () => {
    expect(layoutEgoGraph(ego, size).lateralOverflow).toEqual([]);
  });
});

describe('layoutEgoGraph empty upper bands', () => {
  // The narrow layout asks for one hop up, so there is never a grandparent
  // band; reserving its row anyway squeezes every other band together.
  const oneHop: EgoGraph = {
    ...ego,
    nodes: ego.nodes.filter((n) => n.band !== -2),
    edges: ego.edges.filter((e) => e.to !== '1'),
  };

  it('moves the topmost populated band up into the room left empty', () => {
    const top = layoutEgoGraph(oneHop, size).nodes.find((n) => n.id === '2')!;
    expect(top.y).toBeCloseTo(size.height * bandY(-2), 5);
  });

  it('leaves the children band where it was', () => {
    const child = layoutEgoGraph(oneHop, size).nodes.find((n) => n.id === '10')!;
    expect(child.y).toBeCloseTo(size.height * bandY(1), 5);
  });

  it('spreads the bands further apart than a fixed row would', () => {
    const nodes = layoutEgoGraph(oneHop, size).nodes;
    const y = (id: string) => nodes.find((n) => n.id === id)!.y;
    expect(y('3') - y('2')).toBeGreaterThan(1.2 * size.height * (bandY(0) - bandY(-1)));
    expect(y('10') - y('3')).toBeGreaterThan(1.2 * size.height * (bandY(1) - bandY(0)));
  });

  it('keeps every band where it was when all four are populated', () => {
    const nodes = layoutEgoGraph(ego, size).nodes;
    for (const node of nodes) {
      expect(node.y).toBeCloseTo(size.height * bandY(node.band), 5);
    }
  });
});

describe('narrow stages', () => {
  it('keeps the full margin where there is room for it', () => {
    expect(edgeMargin(1000)).toBe(EDGE_MARGIN);
  });

  it('shrinks the margin on a phone rather than give away 40% of the width', () => {
    expect(edgeMargin(412)).toBeLessThan(EDGE_MARGIN);
  });

  it.each([
    [360, 2],
    [412, 2],
    [480, 3],
    [600, 4],
    [1000, 4],
  ])('caps laterals per side on a %ipx stage at %i', (width, cap) => {
    expect(lateralCapFor(width, 4)).toBe(cap);
  });

  it('caps children so each, and the overflow chip, gets a legible slot', () => {
    const width = 412;
    const cap = childCapFor(width, 10);
    expect(cap).toBeGreaterThanOrEqual(1);
    // One slot more than the cap, for the chip.
    expect((width - 2 * edgeMargin(width)) / (cap + 1)).toBeGreaterThanOrEqual(MIN_CHILD_SLOT);
  });

  it('leaves the cap alone on a desktop stage', () => {
    expect(childCapFor(880, 10)).toBe(10);
  });

  it('never caps below one child', () => {
    expect(childCapFor(50, 10)).toBe(1);
  });
});

describe('layoutEgoGraph short stages', () => {
  // A phone with its browser chrome and the detail sheet leaves ~230px of
  // stage; 18% of that is less than the label hanging under a child.
  const short = { width: 412, height: 230 };

  it('leaves room for the labels under the lowest band', () => {
    for (const node of layoutEgoGraph(ego, short).nodes) {
      expect(node.y + LABEL_DEPTH).toBeLessThanOrEqual(short.height);
    }
  });

  it('keeps the bands in order', () => {
    const nodes = layoutEgoGraph(ego, short).nodes;
    const y = (id: string) => nodes.find((n) => n.id === id)!.y;
    expect(y('1')).toBeLessThan(y('2'));
    expect(y('2')).toBeLessThan(y('3'));
    expect(y('3')).toBeLessThan(y('10'));
  });
});

describe('layoutEgoGraph edges between the same pair', () => {
  // CWE 5.0: 126 ChildOf 788, and 788 Overlaps 126. Drawn on the same curve,
  // the dashed peer edge hid the hierarchy edge, and their labels collided.
  const pair = (centerId: string): EgoGraph => {
    const other = centerId === '788' ? '126' : '788';
    return {
      centerId,
      nodes: [
        { id: centerId, band: 0, side: 'center' },
        { id: other, band: centerId === '788' ? 1 : -1, side: 'center' },
      ],
      edges: [
        { from: '126', to: '788', types: ['ChildOf'], group: 'hierarchy' },
        { from: centerId, to: other, types: ['Overlaps'], group: 'peer' },
      ],
      overflow: null,
      lateralOverflow: { left: 0, right: 0 },
      hiddenLaterals: { left: [], right: [] },
    };
  };

  for (const centerId of ['788', '126']) {
    describe(`centred on ${centerId}`, () => {
      const [hierarchy, peer] = layoutEgoGraph(pair(centerId), size).edges;

      it('bends them apart rather than draw one on top of the other', () => {
        expect(hierarchy.path).not.toBe(peer.path);
        expect(hierarchy.label).not.toEqual(peer.label);
      });

      it('bends them to opposite sides of the line between the two', () => {
        const mid = {
          x: (hierarchy.label.x + peer.label.x) / 2,
          y: (hierarchy.label.y + peer.label.y) / 2,
        };
        const nodes = layoutEgoGraph(pair(centerId), size).nodes;
        const a = nodes.find((n) => n.id === '788')!;
        const b = nodes.find((n) => n.id === '126')!;
        expect(mid.x).toBeCloseTo((a.x + b.x) / 2);
        expect(mid.y).toBeCloseTo((a.y + b.y) / 2);
      });

      it('anchors each label away from the other, so they cannot overlap', () => {
        expect([hierarchy.labelAnchor, peer.labelAnchor].sort()).toEqual(['end', 'start']);
        const anchored = hierarchy.labelAnchor === 'start' ? hierarchy : peer;
        const other = anchored === hierarchy ? peer : hierarchy;
        expect(anchored.label.x).toBeGreaterThan(other.label.x);
      });
    });
  }

  it('leaves a lone edge on the straight curve, with a centred label', () => {
    const edge = layoutEgoGraph(ego, size).edges[0];
    expect(edge.labelAnchor).toBe('middle');
  });
});

describe('layoutEgoGraph on a stage too short for its bands', () => {
  // At 54px or less there is no room between the bands, so they share one
  // row, and a lone parent lands exactly on the centre. The window decides
  // the stage's height, so this is real, if rare.
  const flat = layoutEgoGraph(ego, { width: 1000, height: 50 });

  it('draws the edge between two nodes at one point without NaN', () => {
    const parent = flat.edges.find((e) => e.to === '2')!;
    expect(parent.path).not.toMatch(/NaN/);
    expect(parent.label.x).not.toBeNaN();
    expect(parent.label.y).not.toBeNaN();
  });
});

describe('layoutEgoGraph with an edge to a node it was not given', { tags: ['theoretical'] }, () => {
  // buildEgoGraph only records edges between nodes it placed, so every edge
  // has both ends positioned.
  it('drops the edge rather than draw it to nowhere', () => {
    const dangling: EgoGraph = {
      ...ego,
      edges: [...ego.edges, { from: '3', to: '99', types: ['PeerOf'], group: 'peer' }],
    };
    expect(layoutEgoGraph(dangling, size).edges.map((e) => e.to)).toEqual(['2', '30']);
  });
});

/** Points along an edge's cubic, at even steps of its parameter. */
function sample(path: string) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = path.match(/[\d.-]+/g)!.map(Number);
  return Array.from({ length: 201 }, (_, i) => {
    const t = i / 200;
    const u = 1 - t;
    return {
      x: u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3,
      y: u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3,
    };
  });
}

/** The y of the sampled point nearest to x. */
function heightAt(points: { x: number; y: number }[], x: number) {
  return points.reduce((best, p) => (Math.abs(p.x - x) < Math.abs(best.x - x) ? p : best)).y;
}

describe('lateral arcs', () => {
  const lateral = (id: string, side: 'left' | 'right') => ({ id, band: 0 as const, side });
  const relation = (to: string) => ({ from: '50', to, types: ['PeerOf'], group: 'peer' as const });
  // CWE-79 in CWE 5.0 has two laterals on each side. The ids run either side
  // of the centre's, which decides which way the pair's normal points.
  const row: EgoGraph = {
    centerId: '50',
    nodes: [
      { id: '50', band: 0, side: 'center' },
      lateral('10', 'left'),
      lateral('11', 'left'),
      lateral('90', 'right'),
      lateral('91', 'right'),
    ],
    edges: ['10', '11', '90', '91'].map(relation),
    overflow: null,
    lateralOverflow: { left: 0, right: 0 },
    hiddenLaterals: { left: [], right: [] },
  };

  /** How far above the row each edge's midpoint sits, by the node it reaches. */
  function heights(graph: EgoGraph) {
    const layout = layoutEgoGraph(graph, size);
    const y = layout.nodes.find((n) => n.id === '50')!.y;
    return Object.fromEntries(layout.edges.map((e) => [e.to, Math.round(y - e.label.y)]));
  }

  it('raises each lateral one step above the one nearer the centre', () => {
    expect(heights(row)).toEqual({ '11': 32, '10': 64, '90': 32, '91': 64 });
  });

  it('closes the steps up on a stage with little room under the parent row', () => {
    const under = {
      ...row,
      nodes: [...row.nodes, { id: '40', band: -1 as const, side: 'center' as const }],
    };
    expect(heights(under)).toEqual({ '11': 32, '10': 64, '90': 32, '91': 64 });
    const phone = layoutEgoGraph(under, { width: 390, height: 330 });
    const y = phone.nodes.find((n) => n.id === '50')!.y;
    const rises = phone.edges.map((e) => Math.round(y - e.label.y));
    expect(rises).toEqual([44, 22, 22, 44]);
  });

  it('keeps neighbouring arcs apart all the way from the halo', () => {
    // CWE-79 in CWE 5.0: the arcs to CWE-494 and CWE-352 used to leave the
    // centre at one angle, and ran along each other before they parted.
    const stage = { width: 1170, height: 740 };
    const layout = layoutEgoGraph(row, stage);
    const center = layout.nodes.find((n) => n.id === '50')!;
    const curve = (to: string) => sample(layout.edges.find((e) => e.to === to)!.path);
    const reach = layout.nodes.find((n) => n.id === '90')!.x - center.x - 15;
    for (let dx = 26; dx < reach; dx += 2) {
      const gap = heightAt(curve('91'), center.x + dx) - heightAt(curve('90'), center.x + dx);
      expect(gap).toBeLessThan(-6);
    }
  });

  it('gives the slot of a "+N more" marker no arc, since no edge reaches it', () => {
    const capped = { ...row, lateralOverflow: { left: 3, right: 3 } };
    expect(heights(capped)).toEqual(heights(row));
  });

  it('draws the arc through the point its label sits on', () => {
    const edge = layoutEgoGraph(row, size).edges.find((e) => e.to === '90')!;
    const [, y0, , c1y, , c2y, , y3] = edge.path.match(/[\d.-]+/g)!.map(Number);
    expect((y0 + 3 * c1y + 3 * c2y + y3) / 8).toBeCloseTo(edge.label.y, 1);
  });

  it('keeps two edges of one pair apart, either side of their arc', () => {
    // Different groups between the same two laterals can't share a line.
    const two = {
      ...row,
      nodes: row.nodes.filter((n) => n.id === '50' || n.id === '90'),
      edges: [relation('90'), { from: '50', to: '90', types: ['Requires'], group: 'requires' as const }],
    };
    const ys = layoutEgoGraph(two, size).edges.map((e) => e.label.y).sort((a, b) => a - b);
    expect(ys[1] - ys[0]).toBeCloseTo(BUNDLE_GAP);
    const y = layoutEgoGraph(two, size).nodes.find((n) => n.id === '50')!.y;
    expect(y - (ys[0] + ys[1]) / 2).toBeCloseTo(32);
  });

  it('centres a label on its arc where there is room', () => {
    expect(layoutEgoGraph(row, size).edges.map((e) => e.labelAnchor)).toEqual(['middle', 'middle', 'middle', 'middle']);
  });

  it('grows the nearest labels outwards on a phone, so they cannot meet across the centre', () => {
    // CWE-345 in CWE 5.0, at 390px: "CanAlsoBe (inverse)" on either side.
    const anchors = Object.fromEntries(
      layoutEgoGraph(row, { width: 390, height: 420 }).edges.map((e) => [e.to, e.labelAnchor]),
    );
    expect(anchors).toEqual({ '11': 'end', '10': 'middle', '90': 'start', '91': 'middle' });
  });

  it('leaves an edge to a parent or child alone', () => {
    const vertical: EgoGraph = {
      ...row,
      nodes: [{ id: '50', band: 0, side: 'center' }, { id: '40', band: -1, side: 'center' }],
      edges: [{ from: '50', to: '40', types: ['ChildOf'], group: 'hierarchy' }],
    };
    const layout = layoutEgoGraph(vertical, size);
    const [a, b] = layout.nodes;
    expect(layout.edges[0].label).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  });
});

describe('edge label placement', () => {
  interface Box { left: number; right: number; top: number; bottom: number }

  const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  // Measured from the rendered text at --text-xs, independently of the
  // estimate the layout works from.
  const labelBox = ({ label, labelAnchor, types }: ReturnType<typeof layoutEgoGraph>['edges'][number]): Box => {
    const width = relationLabel({ types }).length * 6.7;
    const left = labelAnchor === 'middle' ? label.x - width / 2 : labelAnchor === 'start' ? label.x : label.x - width;
    return { left, right: left + width, top: label.y - 10, bottom: label.y + 3 };
  };

  type View = { cwe: string; problem: string; size: typeof size; ego: EgoGraph };
  const views = crowded as View[];
  const tooCrowded = views.find((view) => view.problem === 'more labels than room')!;

  // The real views that had each problem, from CWE 5.0.
  describe.each(views.filter((view) => view !== tooCrowded))(
    'CWE-$cwe at $size.width px, which had $problem',
    ({ size: stage, ego: view }) => {
      const layout = layoutEgoGraph(view, stage);
      const boxes = layout.edges.map(labelBox);

      it('keeps the labels apart', () => {
        const clashes = boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => overlap(a, b)));
        expect(clashes).toEqual([]);
      });

      it('keeps them off the glyphs', () => {
        const glyphs = layout.nodes.map(({ id, x, y }) => {
          const r = id === view.centerId ? SELECTED_NODE_RADIUS + HALO_GAP : NODE_RADIUS;
          return { left: x - r, right: x + r, top: y - r, bottom: y + r };
        });
        expect(boxes.filter((box) => glyphs.some((glyph) => overlap(box, glyph)))).toEqual([]);
      });

      it('keeps them off the names', () => {
        // Narrower than any name, so this needs no estimate of their widths.
        const names = layout.nodes.map(({ id, x, y }) => {
          const r = id === view.centerId ? SELECTED_NODE_RADIUS + HALO_GAP : NODE_RADIUS;
          return { left: x - 12, right: x + 12, top: y + r + 6, bottom: y + r + 33 };
        });
        expect(boxes.filter((box) => names.some((name) => overlap(box, name)))).toEqual([]);
      });

      it('keeps them on the stage', () => {
        expect(boxes.filter((b) => b.left < 0 || b.right > stage.width || b.top < 0)).toEqual([]);
      });
    },
  );

  it('still labels every edge when the stage has no room for them all', () => {
    const { edges } = layoutEgoGraph(tooCrowded.ego, tooCrowded.size);
    expect(edges).toHaveLength(tooCrowded.ego.edges.length);
    expect(edges.every(({ label }) => Number.isFinite(label.x) && Number.isFinite(label.y))).toBe(true);
  });

  it('keeps every label centred on its line where they all fit that way', () => {
    const view = views.find((v) => v.cwe === '425' && v.size.width === 1170)!;
    const { edges } = layoutEgoGraph(view.ego, view.size);
    expect(edges.filter((e) => e.labelAnchor !== 'middle')).toEqual([]);
  });

  it('puts a label beside its line where no spot on the line is free', () => {
    // CWE-425 on a phone: CanPrecede to CWE-471 is centred on its arc
    // wherever there's room for it, and there isn't.
    const view = views.find((v) => v.cwe === '425' && v.size.width === 390)!;
    const { edges } = layoutEgoGraph(view.ego, view.size);
    expect(edges.find((e) => e.to === '471')!.labelAnchor).not.toBe('middle');
  });

  it('leaves a label at its usual place when nothing is in the way', () => {
    const edge = layoutEgoGraph(ego, size).edges.find((e) => e.to === '2')!;
    expect(edge.label).toEqual({ x: at('3').x, y: (at('3').y + at('2').y) / 2 });
  });

  it('keeps every label on its own edge', () => {
    const { edges } = layoutEgoGraph(tooCrowded.ego, tooCrowded.size);
    for (const { path, label } of edges) {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = path.match(/-?[\d.]+/g)!.map(Number);
      const nearest = Math.min(...Array.from({ length: 201 }, (_, i) => {
        const t = i / 200;
        const u = 1 - t;
        const along = (a: number, b: number, c: number, d: number) => u ** 3 * a + 3 * u ** 2 * t * b + 3 * u * t ** 2 * c + t ** 3 * d;
        return Math.hypot(along(x0, x1, x2, x3) - label.x, along(y0, y1, y2, y3) - label.y);
      }));
      expect(nearest).toBeLessThan(2);
    }
  });

  it('gives the same result for the same view', () => {
    expect(layoutEgoGraph(tooCrowded.ego, tooCrowded.size).edges).toEqual(layoutEgoGraph(tooCrowded.ego, tooCrowded.size).edges);
  });
});
