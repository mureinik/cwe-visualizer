import { relationLabel, type Band, type EgoEdge, type EgoGraph, type EgoNode, type EgoOverflow, type LateralRelation } from './ego';
import { CHAR_PX, labelBudget } from './labels';
import {
  compactChipWidth,
  HALO_GAP,
  NODE_RADIUS,
  OVERFLOW_CHIP_HEIGHT,
  OVERFLOW_CHIP_WIDTH,
  SELECTED_NODE_RADIUS,
} from './shapes';

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
  /** Where the edge's label goes: a point on its curve, usually the midpoint. */
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
  /**
   * Where a slot in the row is narrower than the full chip, the marker shows
   * only its count and sits in the margin at the stage's edge instead.
   */
  compact: boolean;
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
 * `max`, and at least one. On a 360px phone that's one: two would leave their
 * ids running together (issue #301). The "+N more" marker offers the rest.
 */
export function lateralCapFor(width: number, max: number): number {
  const half = width / 2 - CENTER_CLEARANCE - edgeMargin(width);
  return Math.max(1, Math.min(max, Math.floor(half / MIN_LATERAL_SLOT)));
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
 * nearer the centre, at least. Laterals share the centre's row, so straight
 * edges would lie on top of each other, and their labels with them. One step
 * clears a line of label text, and the nearest edge takes one too, so that
 * its label stays off the row's glyphs.
 */
const LATERAL_ARC = 22;

/** The widest a step gets, however much room a tall stage has for it. */
const MAX_LATERAL_ARC = 32;

/**
 * How far along the row an arc's control points sit from its ends. Being the
 * same for every arc, the higher ones leave the centre at a steeper angle, so
 * the arcs fan out. Placed by the arc's length instead, a lateral twice as far
 * out at twice the height leaves at the same angle as its neighbour, and the
 * two run along each other before they part.
 */
const LATERAL_FAN = 60;

/**
 * How far along a child's edge its label sits, from the child. All of a CWE's
 * child edges meet at it, so the labels only have room near the other end.
 */
const CHILD_LABEL_AT = 0.2;

/** Where every other label goes when they can't all fit in one line. */
const CHILD_LABEL_STAGGERED_AT = 0.4;

/** The narrowest child slot that fits a "ChildOf" and a gap to the next. */
const MIN_CHILD_LABEL_SLOT = 56;

/**
 * Half the width of the longest label on a lateral, "StartsWith (inverse)".
 * One centred closer than this to the selected node would reach across it.
 */
const LATERAL_LABEL_REACH = 64;

/** How far apart along its curve the spots tried for a label are. */
const LABEL_STEP = 0.025;

/** How many more times the labels pick spots, when one is left without. */
const LABEL_ATTEMPTS = 3;

/** The nearest a label gets to either end of its curve. */
const LABEL_END = 0.1;

/** How far an edge label's text rises above its baseline, and hangs below it. */
const LABEL_ASCENT = 11;
const LABEL_DESCENT = 4;

/** Where a node's id and name start and end, below its glyph (see GraphNode). */
const NAME_TOP = 5;
const NAME_BOTTOM = 34;

/** How far a compact lateral marker sits from the stage's edge. */
const MARKER_EDGE_GAP = 2;

type Cubic = [Point, Point, Point, Point];

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function labelBox({ x, y }: Point, anchor: PositionedEdge['labelAnchor'], text: string): Box {
  const width = text.length * CHAR_PX;
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'start' ? x : x - width;
  return { left, right: left + width, top: y - LABEL_ASCENT, bottom: y + LABEL_DESCENT };
}

/** What a label must stay off: every node's glyph and name, and the chips. */
function labelObstacles(
  nodes: PositionedNode[],
  centerId: string,
  chips: (Point & { width: number })[],
  usableWidth: number,
): Box[] {
  const boxes = chips.map(({ x, y, width }) => ({
    left: x - width / 2,
    right: x + width / 2,
    top: y - OVERFLOW_CHIP_HEIGHT / 2,
    bottom: y + OVERFLOW_CHIP_HEIGHT / 2,
  }));
  for (const node of nodes) {
    const radius = node.id === centerId ? SELECTED_NODE_RADIUS + HALO_GAP : NODE_RADIUS;
    boxes.push({ left: node.x - radius, right: node.x + radius, top: node.y - radius, bottom: node.y + radius });
    // The stage fits each name to the gap to its nearest neighbour, so this
    // is the widest it can be.
    const gaps = nodes.filter((n) => n.band === node.band && n !== node).map((n) => Math.abs(n.x - node.x));
    const half = (labelBudget(gaps.length > 0 ? Math.min(...gaps) : usableWidth) * CHAR_PX) / 2;
    boxes.push({ left: node.x - half, right: node.x + half, top: node.y + radius + NAME_TOP, bottom: node.y + radius + NAME_BOTTOM });
  }
  return boxes;
}

interface LabelledEdge {
  edge: PositionedEdge;
  curve: Cubic;
  /** How far along its curve the label usually goes. */
  labelAt: number;
}

interface Seat {
  point: Point;
  anchor: PositionedEdge['labelAnchor'];
}

/**
 * Gives each label, in turn, its usual spot unless something's there, and
 * otherwise the nearest free one along its own curve, so that it still reads
 * as that line's. With `beside`, a label may also start or end at each spot
 * rather than be centred on it. A label with no free spot at all takes the
 * one with the fewest clashes.
 */
function seatLabels(order: LabelledEdge[], obstacles: Box[], size: StageSize, beside: boolean) {
  const taken = [...obstacles];
  const seats = new Map<LabelledEdge, Seat>();
  const stuck: LabelledEdge[] = [];
  for (const item of order) {
    const { edge, curve, labelAt } = item;
    const text = relationLabel(edge);
    const anchors = beside
      ? [edge.labelAnchor, ...(['start', 'end'] as const).filter((anchor) => anchor !== edge.labelAnchor)]
      : [edge.labelAnchor];
    let best = { point: edge.label, anchor: edge.labelAnchor, box: labelBox(edge.label, edge.labelAnchor, text), clashes: Infinity };
    for (const [t, anchor] of labelSpots(labelAt).flatMap((t) => anchors.map((anchor) => [t, anchor] as const))) {
      const point = pointOn(curve, t);
      const box = labelBox(point, anchor, text);
      const offStage = box.left < 0 || box.right > size.width || box.top < 0;
      const count = taken.filter((other) => overlaps(box, other)).length + (offStage ? 1 : 0);
      if (count < best.clashes) {
        best = { point, anchor, box, clashes: count };
      }
      if (count === 0) {
        break;
      }
    }
    seats.set(item, { point: best.point, anchor: best.anchor });
    taken.push(best.box);
    if (best.clashes > 0) {
      stuck.push(item);
    }
  }
  return { seats, stuck };
}

/**
 * Relations pick first, as an arc has the fewest spots to offer. Who picks
 * first decides who ends up with no free spot, so a label left stuck moves
 * to the front and everyone picks again.
 */
function seatAllLabels(placed: LabelledEdge[], obstacles: Box[], size: StageSize, beside: boolean) {
  let order = [...placed].sort((a, b) => Number(a.edge.group === 'hierarchy') - Number(b.edge.group === 'hierarchy'));
  let seating = seatLabels(order, obstacles, size, beside);
  for (let attempt = 0; attempt < LABEL_ATTEMPTS && seating.stuck.length > 0; attempt++) {
    const { stuck } = seating;
    order = [...stuck, ...order.filter((item) => !stuck.includes(item))];
    const next = seatLabels(order, obstacles, size, beside);
    if (next.stuck.length < seating.stuck.length) {
      seating = next;
    }
  }
  return seating;
}

/** The spots to try on a curve, nearest the usual one first. */
function labelSpots(usual: number): number[] {
  const spots = [usual];
  for (let step = LABEL_STEP; step < 1; step += LABEL_STEP) {
    spots.push(usual + step, usual - step);
  }
  return spots.filter((t) => t >= LABEL_END && t <= 1 - LABEL_END);
}

/**
 * The curve from one node to another, with its midpoint moved `bend` pixels
 * along `normal`. A cubic's midpoint is (P0 + 3·P1 + 3·P2 + P3) / 8, so
 * moving both control points by d moves it by ¾d.
 */
function cubic(from: Point, to: Point, normal: Point, bend: number): Cubic {
  const sameBand = Math.abs(from.y - to.y) < 1;
  // Inset equally from both ends, which leaves the midpoint where it was.
  const inset = Math.sign(to.x - from.x) * Math.min(LATERAL_FAN, Math.abs(to.x - from.x) / 2);
  const [c1x, c1y, c2x, c2y] = sameBand
    ? [from.x + inset, from.y, to.x - inset, to.y]
    : [from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2];
  const dx = (normal.x * bend * 4) / 3;
  const dy = (normal.y * bend * 4) / 3;
  return [from, { x: c1x + dx, y: c1y + dy }, { x: c2x + dx, y: c2y + dy }, to];
}

function pathOf([from, c1, c2, to]: Cubic): string {
  const n = (v: number) => Number(v.toFixed(2));
  return `M ${n(from.x)} ${n(from.y)} C ${n(c1.x)} ${n(c1.y)}, ${n(c2.x)} ${n(c2.y)}, ${n(to.x)} ${n(to.y)}`;
}

function pointOn([from, c1, c2, to]: Cubic, t: number): Point {
  const u = 1 - t;
  const along = (a: number, b: number, c: number, d: number) =>
    u ** 3 * a + 3 * u ** 2 * t * b + 3 * u * t ** 2 * c + t ** 3 * d;
  return { x: along(from.x, c1.x, c2.x, to.x), y: along(from.y, c1.y, c2.y, to.y) };
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
    // The full marker takes a slot of its own. Where that slot would be too
    // narrow for it, it covered the lateral next to it (issue #291), so it
    // shrinks to its count and moves into the margin, which only exists to
    // keep names off the edge and the marker has none.
    const compact = hiddenCount > 0 && (end - start) / (members.length + 1) < OVERFLOW_CHIP_WIDTH;
    const slots = hiddenCount > 0 && !compact ? members.length + 1 : members.length;

    // The marker takes the slot furthest from the centre, so the relations
    // that are drawn stay nearest the node they belong to.
    const markerIndex = side === 'left' ? 0 : slots - 1;
    const memberIndex = (i: number) => (side === 'left' && hiddenCount > 0 && !compact ? i + 1 : i);
    const markerHalf = compactChipWidth(hiddenCount) / 2 + MARKER_EDGE_GAP;
    const markerX = !compact
      ? spread(markerIndex, slots, start, end)
      : side === 'left'
        ? markerHalf
        : width - markerHalf;

    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(memberIndex(i), slots, start, end), y: centerY });
      arcSteps.set(node.id, side === 'left' ? members.length - i : i + 1);
    });

    if (hiddenCount > 0) {
      lateralOverflow.push({
        side,
        hiddenCount,
        hidden: ego.hiddenLaterals[side],
        compact,
        x: markerX,
        y: centerY,
      });
    }
  }

  // The steps share out the room under the row above, whose labels hang down
  // into it. One more than the arcs, so the highest stays clear of them.
  const ceiling = ego.nodes.some((n) => n.band === -1) ? yOf(-1) + LABEL_DEPTH : 0;
  const arcCount = Math.max(0, ...arcSteps.values());
  const arcStep = Math.max(LATERAL_ARC, Math.min(MAX_LATERAL_ARC, (centerY - ceiling) / (arcCount + 1)));

  const childBandY = yOf(1);
  const children = ego.nodes.filter((n) => n.band === 1);
  const childCount = children.length;
  const childSlots = ego.overflow ? childCount + 1 : childCount;
  const staggered = (width - 2 * margin) / childSlots < MIN_CHILD_LABEL_SLOT;
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

  const placed: LabelledEdge[] = bent.flatMap(({ edge, bend }) => {
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
    const arced = bend - Math.sign(normal.y) * steps * arcStep;
    // Labels on opposite sides sit at the same height, so one that reaches
    // the centre grows away from it, or the two run together on a phone.
    if (steps > 0 && Math.abs(to.x - from.x) / 2 < LATERAL_LABEL_REACH) {
      labelAnchor = Math.min(from.x, to.x) < width / 2 ? 'end' : 'start';
    }
    const curve = cubic(from, to, normal, arced);
    // One that shares its pair stays level with the other edge's label, which
    // it is anchored away from.
    let labelAt = 0.5;
    if (edge.group === 'hierarchy' && from.band === 1 && bend === 0) {
      const raised = staggered && children.findIndex((n) => n.id === from.id) % 2 === 1;
      labelAt = raised ? CHILD_LABEL_STAGGERED_AT : CHILD_LABEL_AT;
    }
    return [{ edge: { ...edge, path: pathOf(curve), label: pointOn(curve, labelAt), labelAnchor }, curve, labelAt }];
  });

  const chips = [
    ...lateralOverflow.map((m) => ({ ...m, width: m.compact ? compactChipWidth(m.hiddenCount) : OVERFLOW_CHIP_WIDTH })),
    ...(overflow ? [{ ...overflow, width: OVERFLOW_CHIP_WIDTH }] : []),
  ];
  const obstacles = labelObstacles(nodes, ego.centerId, chips, width - 2 * margin);
  // Labels go beside their lines only in a view that needs it, so a view
  // that fits them all on their lines keeps them exactly there.
  let seating = seatAllLabels(placed, obstacles, size, false);
  if (seating.stuck.length > 0) {
    const beside = seatAllLabels(placed, obstacles, size, true);
    if (beside.stuck.length < seating.stuck.length) {
      seating = beside;
    }
  }
  for (const [item, { point, anchor }] of seating.seats) {
    item.edge.label = point;
    item.edge.labelAnchor = anchor;
  }

  return { nodes, edges: placed.map((item) => item.edge), overflow, lateralOverflow };
}
