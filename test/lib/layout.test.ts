import { describe, it, expect } from 'vitest';
import {
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
    expect(edge.label.y).toBeCloseTo(at('3').y - 22);
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
    expect(heights(row)).toEqual({ '11': 22, '10': 44, '90': 22, '91': 44 });
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
    expect(y - (ys[0] + ys[1]) / 2).toBeCloseTo(22);
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
