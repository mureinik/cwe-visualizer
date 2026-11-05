import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import { relationLabel } from '../lib/ego';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  label: string | null;
  /** Whether the edge ends at the selected node, whose halo is the larger. */
  intoCenter?: boolean;
}

export function GraphEdge({ edge, dimmed, label, intoCenter = false }: GraphEdgeProps) {
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
        markerEnd={line.arrow ? `url(#${arrowMarkerId(intoCenter ? 'graph-center' : 'graph', edge.group)})` : undefined}
      >
        <title>{relationLabel(edge)}</title>
      </path>
      {label && (
        <text className="graph-edge__label" x={edge.label.x} y={edge.label.y} textAnchor={edge.labelAnchor}>
          {label}
        </text>
      )}
    </g>
  );
}
