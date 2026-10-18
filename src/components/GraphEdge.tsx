import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  label: string | null;
}

export function GraphEdge({ edge, dimmed, label }: GraphEdgeProps) {
  const { line } = EDGE_GROUPS[edge.group];

  // The path's first and last coordinate pairs are its endpoints, which is
  // all the midpoint needs.
  const numbers = edge.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const x1 = numbers[0] ?? 0;
  const y1 = numbers[1] ?? 0;
  const x2 = numbers.at(-2) ?? 0;
  const y2 = numbers.at(-1) ?? 0;

  return (
    <g className={`graph-edge-group${dimmed ? ' graph-edge-group--dimmed' : ''}`}>
      <path
        className={`graph-edge graph-edge--${edge.group}`}
        d={edge.path}
        fill="none"
        stroke={`var(${line.token})`}
        strokeWidth={line.width}
        strokeDasharray={line.dash ?? undefined}
        markerEnd={line.arrow ? `url(#${arrowMarkerId('graph', edge.group)})` : undefined}
      >
        <title>{edge.type}</title>
      </path>
      {label && (
        <text className="graph-edge__label" x={(x1 + x2) / 2} y={(y1 + y2) / 2} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
