import type { Band, EgoEdge, EgoGraph, EgoNode, EgoOverflow } from './ego';

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
}

export interface PositionedOverflow extends EgoOverflow {
  x: number;
  y: number;
}

export interface PositionedLateralOverflow {
  side: 'left' | 'right';
  hiddenCount: number;
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

/** Spreads n items evenly across [start, end], centred. */
function spread(index: number, count: number, start: number, end: number): number {
  if (count <= 0) return (start + end) / 2;
  return start + ((end - start) * (index + 0.5)) / count;
}

function cubic(from: PositionedNode | PositionedOverflow, to: PositionedNode): string {
  const sameBand = Math.abs(from.y - to.y) < 1;
  const [c1x, c1y, c2x, c2y] = sameBand
    ? [(from.x + to.x) / 2, from.y, (from.x + to.x) / 2, to.y]
    : [from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2];
  const n = (v: number) => Number(v.toFixed(2));
  return `M ${n(from.x)} ${n(from.y)} C ${n(c1x)} ${n(c1y)}, ${n(c2x)} ${n(c2y)}, ${n(to.x)} ${n(to.y)}`;
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
  if (center) positioned.set(center.id, { ...center, x: width / 2, y: centerY });

  const lateralOverflow: PositionedLateralOverflow[] = [];
  for (const side of ['left', 'right'] as const) {
    const members = ego.nodes.filter((n) => n.band === 0 && n.side === side);
    const [start, end] =
      side === 'left'
        ? [margin, width / 2 - CENTER_CLEARANCE]
        : [width / 2 + CENTER_CLEARANCE, width - margin];

    const hiddenCount = ego.lateralOverflow?.[side] ?? 0;
    const slots = hiddenCount > 0 ? members.length + 1 : members.length;

    // The marker takes the slot furthest from the centre, so the relations
    // that are drawn stay nearest the node they belong to.
    const markerIndex = side === 'left' ? 0 : slots - 1;
    const memberIndex = (i: number) => (side === 'left' && hiddenCount > 0 ? i + 1 : i);

    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(memberIndex(i), slots, start, end), y: centerY });
    });

    if (hiddenCount > 0) {
      lateralOverflow.push({
        side,
        hiddenCount,
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

  const nodes = ego.nodes.map((n) => positioned.get(n.id)!).filter(Boolean);

  const edges: PositionedEdge[] = ego.edges.flatMap((edge) => {
    const from = positioned.get(edge.from);
    const to = positioned.get(edge.to);
    return from && to ? [{ ...edge, path: cubic(from, to) }] : [];
  });

  return { nodes, edges, overflow, lateralOverflow };
}
