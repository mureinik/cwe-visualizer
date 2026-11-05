import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import { relationLabel } from '../lib/ego';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  /** Whether the edge ends at the selected node, whose halo is the larger. */
  intoCenter?: boolean;
}

function groupClass(dimmed: boolean) {
  return `graph-edge-group${dimmed ? ' graph-edge-group--dimmed' : ''}`;
}

export function GraphEdge({ edge, dimmed, intoCenter = false }: GraphEdgeProps) {
  const { line } = EDGE_GROUPS[edge.group];

  return (
    <g className={groupClass(dimmed)}>
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
    </g>
  );
}

interface GraphEdgeLabelProps {
  edge: PositionedEdge;
  dimmed: boolean;
}

/** Apart from its edge, so that it can be drawn over all of them. */
export function GraphEdgeLabel({ edge, dimmed }: GraphEdgeLabelProps) {
  return (
    <g className={groupClass(dimmed)}>
      <text className="graph-edge__label" x={edge.label.x} y={edge.label.y} textAnchor={edge.labelAnchor}>
        {relationLabel(edge)}
      </text>
    </g>
  );
}
