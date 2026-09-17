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

export interface Layout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  overflow: PositionedOverflow | null;
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
  const positioned = new Map<string, PositionedNode>();

  // Bands -2, -1 and 1 distribute across the full width. Band 0 is special:
  // the centre is pinned mid-stage, and laterals fill the halves either side,
  // because horizontal position there encodes sequence direction.
  for (const band of [-2, -1, 1] as const) {
    const members = ego.nodes.filter((n) => n.band === band);
    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(i, members.length, 0, width), y: height * bandY(band) });
    });
  }

  const centerY = height * bandY(0);
  const center = ego.nodes.find((n) => n.band === 0 && n.side === 'center');
  if (center) positioned.set(center.id, { ...center, x: width / 2, y: centerY });

  for (const side of ['left', 'right'] as const) {
    const members = ego.nodes.filter((n) => n.band === 0 && n.side === side);
    const [start, end] = side === 'left' ? [0, width / 2] : [width / 2, width];
    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(i, members.length, start, end), y: centerY });
    });
  }

  const childBandY = height * bandY(1);
  const childCount = ego.nodes.filter((n) => n.band === 1).length;
  const overflow: PositionedOverflow | null = ego.overflow
    ? { ...ego.overflow, x: spread(childCount, childCount + 1, 0, width), y: childBandY }
    : null;

  const nodes = ego.nodes.map((n) => positioned.get(n.id)!).filter(Boolean);

  const edges: PositionedEdge[] = ego.edges.flatMap((edge) => {
    const from = positioned.get(edge.from);
    const to = positioned.get(edge.to);
    return from && to ? [{ ...edge, path: cubic(from, to) }] : [];
  });

  return { nodes, edges, overflow };
}
