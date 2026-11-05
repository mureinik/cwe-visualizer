import type { Band, EgoEdge, EgoGraph, EgoNode, EgoOverflow, LateralRelation } from './ego';

export interface StageSize {
  width: number;
  height: number;
}

export interface PositionedNode extends EgoNode {
  x: number;
  y: number;
}

export interface PositionedEdge extends EgoEdge {
  path: string;
  /** Where the edge's label goes: the midpoint of its curve. */
  label: { x: number; y: number };
  /**
   * Which end of the label sits on that point. An edge bent sideways to clear
   * another between the same pair anchors its label on the outer side, so
   * the two labels grow away from each other.
   */
  labelAnchor: 'start' | 'middle' | 'end';
}

export interface PositionedOverflow extends EgoOverflow {
  x: number;
  y: number;
}

export interface PositionedLateralOverflow {
  side: 'left' | 'right';
  hiddenCount: number;
  /** The relations the marker stands for. */
  hidden: LateralRelation[];
  x: number;
  y: number;
}

export interface Layout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  overflow: PositionedOverflow | null;
  lateralOverflow: PositionedLateralOverflow[];
}

/** Vertical position of each band, as a fraction of stage height. */
export function bandY(band: Band): number {
  switch (band) {
    case -2:
      return 0.12;
    case -1:
      return 0.32;
    case 0:
      return 0.55;
    case 1:
      return 0.82;
  }
}

/**
 * How far a node's two-line label hangs below its centre: the glyph, the id
 * line, the name line and its descenders (see GraphNode). A band drawn
 * closer than this to the bottom of the stage has its label cut off.
 */
export const LABEL_DEPTH = 48;

/**
 * Keeps the outermost node in a band away from the stage edge. Without it a
 * band's first and last labels are centred on x≈0 and x≈width and get
 * clipped in half.
 */
export const EDGE_MARGIN = 80;

/**
 * The margin actually used on a stage this wide. On a phone the full
 * EDGE_MARGIN would spend 40% of the width on blank space, and each node
 * only needs half its own slot clear of the edge.
 */
export function edgeMargin(width: number): number {
  return Math.min(EDGE_MARGIN, width * 0.1);
}

/**
 * The narrowest slot a child can have and stay legible: its glyph, a
 * four-digit bare id beneath it, and a gutter to the next one.
 */
export const MIN_CHILD_SLOT = 44;

/**
 * How many children fit across a stage this wide, never more than `max`.
 * One slot is held back for the overflow chip, since a cap that engages
 * always brings one.
 */
export function childCapFor(width: number, max: number): number {
  const slots = Math.floor((width - 2 * edgeMargin(width)) / MIN_CHILD_SLOT);
  return Math.max(1, Math.min(max, slots - 1));
}

/**
 * Clear space either side of the pinned centre. Laterals are spread across
 * the half-widths, so without this the innermost one sits flush against the
 * selected node and squeezes its label — CWE-119 puts eleven on one side.
 */
export const CENTER_CLEARANCE = 100;

/** The narrowest slot a lateral can have: its glyph and a gutter to the next. */
const MIN_LATERAL_SLOT = 28;

/**
 * How many laterals fit on each side of a stage this wide, never more than
 * `max`. A phone's stage is too short for more than two arcs under the parent
 * row, so two always fit and the "+N more" marker offers the rest.
 */
export function lateralCapFor(width: number, max: number): number {
  const half = width / 2 - CENTER_CLEARANCE - edgeMargin(width);
  return Math.max(2, Math.min(max, Math.floor(half / MIN_LATERAL_SLOT)));
}

/** Spreads n items evenly across [start, end], centred. */
function spread(index: number, count: number, start: number, end: number): number {
  return start + ((end - start) * (index + 0.5)) / count;
}

interface Point {
  x: number;
  y: number;
}

/**
 * How far apart, at their midpoints, two edges between the same pair are
 * drawn. A hierarchy edge and a relation between the same two CWEs would
 * otherwise share one curve, and only the one drawn last would show.
 */
export const BUNDLE_GAP = 20;

/**
 * How much higher, at its midpoint, each lateral's edge arcs than the one
 * nearer the centre. Laterals share the centre's row, so straight edges would
 * lie on top of each other, and their labels with them. One step clears a
 * line of label text, and the nearest edge takes one too, so that its label
 * stays off the row's glyphs.
 */
const LATERAL_ARC = 22;

/**
 * Half the width of the longest label on a lateral, "StartsWith (inverse)".
 * One centred closer than this to the selected node would reach across it.
 */
const LATERAL_LABEL_REACH = 64;

/**
 * The curve from one node to another, with its midpoint moved `bend` pixels
 * along `normal`. A cubic's midpoint is (P0 + 3·P1 + 3·P2 + P3) / 8, so
 * moving both control points by d moves it by ¾d.
 */
function cubic(from: Point, to: Point, normal: Point, bend: number): string {
  const sameBand = Math.abs(from.y - to.y) < 1;
  const [c1x, c1y, c2x, c2y] = sameBand
    ? [(from.x + to.x) / 2, from.y, (from.x + to.x) / 2, to.y]
    : [from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2];
  const dx = (normal.x * bend * 4) / 3;
  const dy = (normal.y * bend * 4) / 3;
  const n = (v: number) => Number(v.toFixed(2));
  return `M ${n(from.x)} ${n(from.y)} C ${n(c1x + dx)} ${n(c1y + dy)}, ${n(c2x + dx)} ${n(c2y + dy)}, ${n(to.x)} ${n(to.y)}`;
}

/**
 * The unit normal of the line between two nodes, taken in id order, so both
 * edges of a pair agree on it whichever way each one runs.
 */
function pairNormal(a: Point & { id: string }, b: Point & { id: string }): Point {
  const [p, q] = a.id < b.id ? [a, b] : [b, a];
  const length = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  return { x: -(q.y - p.y) / length, y: (q.x - p.x) / length };
}

export function layoutEgoGraph(ego: EgoGraph, size: StageSize): Layout {
  const { width, height } = size;
  const margin = edgeMargin(width);
  const positioned = new Map<string, PositionedNode>();

  // A band nobody is on still reserves its row, and the narrow layout never
  // has grandparents — so rescale from the topmost populated band rather
  // than leave the top third of a phone blank while the bands below crowd
  // each other's labels. The children band stays put unless the stage is
  // too short to hang its labels underneath, which a phone's is.
  const topBand = ego.nodes.reduce<Band>((top, n) => (n.band < top ? n.band : top), 0);
  const first = height * bandY(-2);
  const last = Math.max(first, Math.min(height * bandY(1), height - LABEL_DEPTH));
  const yOf = (band: Band) =>
    first + ((bandY(band) - bandY(topBand)) / (bandY(1) - bandY(topBand))) * (last - first);

  // Bands -2, -1 and 1 distribute across the full width. Band 0 is special:
  // the centre is pinned mid-stage, and laterals fill the halves either side,
  // because horizontal position there encodes sequence direction.
  for (const band of [-2, -1, 1] as const) {
    const members = ego.nodes.filter((n) => n.band === band);
    // The overflow chip lives in the children band and needs a slot of its
    // own, or it lands on top of the last child.
    const slots = band === 1 && ego.overflow ? members.length + 1 : members.length;
    members.forEach((node, i) => {
      positioned.set(node.id, {
        ...node,
        x: spread(i, slots, margin, width - margin),
        y: yOf(band),
      });
    });
  }

  const centerY = yOf(0);
  const center = ego.nodes.find((n) => n.band === 0 && n.side === 'center');
  if (center) {
    positioned.set(center.id, { ...center, x: width / 2, y: centerY });
  }

  const lateralOverflow: PositionedLateralOverflow[] = [];
  /** How many arc steps above the row each lateral's edge runs. */
  const arcSteps = new Map<string, number>();
  for (const side of ['left', 'right'] as const) {
    const members = ego.nodes.filter((n) => n.band === 0 && n.side === side);
    const [start, end] =
      side === 'left'
        ? [margin, width / 2 - CENTER_CLEARANCE]
        : [width / 2 + CENTER_CLEARANCE, width - margin];

    const hiddenCount = ego.lateralOverflow[side];
    const slots = hiddenCount > 0 ? members.length + 1 : members.length;

    // The marker takes the slot furthest from the centre, so the relations
    // that are drawn stay nearest the node they belong to.
    const markerIndex = side === 'left' ? 0 : slots - 1;
    const memberIndex = (i: number) => (side === 'left' && hiddenCount > 0 ? i + 1 : i);

    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(memberIndex(i), slots, start, end), y: centerY });
      arcSteps.set(node.id, side === 'left' ? members.length - i : i + 1);
    });

    if (hiddenCount > 0) {
      lateralOverflow.push({
        side,
        hiddenCount,
        hidden: ego.hiddenLaterals[side],
        x: spread(markerIndex, slots, start, end),
        y: centerY,
      });
    }
  }

  const childBandY = yOf(1);
  const childCount = ego.nodes.filter((n) => n.band === 1).length;
  const overflow: PositionedOverflow | null = ego.overflow
    ? {
        ...ego.overflow,
        // Same denominator the children used above, so the chip takes the
        // slot after the last of them rather than overlapping it.
        x: spread(childCount, childCount + 1, margin, width - margin),
        y: childBandY,
      }
    : null;

  const nodes = ego.nodes.flatMap((n) => {
    const node = positioned.get(n.id);
    return node ? [node] : [];
  });

  // Edges between the same pair, in the order the ego graph gives them, are
  // spread symmetrically about the line between the two nodes.
  const pairKey = (edge: EgoEdge) => [edge.from, edge.to].sort().join('|');
  const bent = ego.edges.map((edge) => ({ edge, bend: 0 }));
  const bundles = new Map<string, typeof bent>();
  for (const item of bent) {
    const bundle = bundles.get(pairKey(item.edge)) ?? [];
    bundle.push(item);
    bundles.set(pairKey(item.edge), bundle);
  }
  for (const bundle of bundles.values()) {
    bundle.forEach((item, i) => {
      item.bend = (i - (bundle.length - 1) / 2) * BUNDLE_GAP;
    });
  }

  const edges: PositionedEdge[] = bent.flatMap(({ edge, bend }) => {
    const from = positioned.get(edge.from);
    const to = positioned.get(edge.to);
    if (!from || !to) {
      return [];
    }
    const normal = pairNormal(from, to);
    // A line within 60° of vertical bends partly sideways, where the labels'
    // width would make them collide; anchoring them outwards keeps them
    // apart. A flatter one bends up and down, which separates them already.
    const sideways = Math.abs(normal.x) >= 0.5;
    const outward = normal.x * bend;
    let labelAnchor: PositionedEdge['labelAnchor'] = !sideways || bend === 0 ? 'middle' : outward > 0 ? 'start' : 'end';
    // Only a lateral has steps, and its edge lies along the row, so its normal
    // points straight up or down. The sign keeps every arc going up.
    const steps = arcSteps.get(edge.from) ?? arcSteps.get(edge.to) ?? 0;
    const arced = bend - Math.sign(normal.y) * steps * LATERAL_ARC;
    // Labels on opposite sides sit at the same height, so one that reaches
    // the centre grows away from it, or the two run together on a phone.
    if (steps > 0 && Math.abs(to.x - from.x) / 2 < LATERAL_LABEL_REACH) {
      labelAnchor = Math.min(from.x, to.x) < width / 2 ? 'end' : 'start';
    }
    return [
      {
        ...edge,
        path: cubic(from, to, normal, arced),
        label: { x: (from.x + to.x) / 2 + normal.x * arced, y: (from.y + to.y) / 2 + normal.y * arced },
        labelAnchor,
      },
    ];
  });

  return { nodes, edges, overflow, lateralOverflow };
}
