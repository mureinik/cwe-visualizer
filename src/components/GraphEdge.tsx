import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  label: string | null;
}

export function GraphEdge({ edge, dimmed, label }: GraphEdgeProps) {
  const { line } = EDGE_GROUPS[edge.group];

  return (
    <g className={`graph-edge-group${dimmed ? ' graph-edge-group--dimmed' : ''}`}>
      <path
        className={`graph-edge graph-edge--${edge.group}`}
        d={edge.path}
        fill="none"
        stroke={`var(${line.token})`}
        strokeWidth={line.width}
        strokeDasharray={line.dash}
        markerEnd={line.arrow ? `url(#${arrowMarkerId('graph', edge.group)})` : undefined}
      >
        <title>{edge.type}</title>
      </path>
      {label && (
        <text className="graph-edge__label" x={edge.label.x} y={edge.label.y} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
