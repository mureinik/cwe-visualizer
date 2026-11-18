import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import { edgeTitle, type TypedDimensions } from '../lib/dimensions';
import { relationLabel } from '../lib/ego';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  unmatched?: boolean;
  /** Whether the edge ends at the selected node, whose halo is the larger. */
  intoCenter?: boolean;
  /** The dimensions MITRE states on the edge's relations, for its tooltip. */
  dimensions?: TypedDimensions[];
}

function groupClass(dimmed: boolean, unmatched: boolean) {
  return `graph-edge-group${dimmed ? ' graph-edge-group--dimmed' : ''}${unmatched ? ' graph-edge-group--unmatched' : ''}`;
}

export function GraphEdge({ edge, dimmed, unmatched = false, intoCenter = false, dimensions }: GraphEdgeProps) {
  const { line } = EDGE_GROUPS[edge.group];

  return (
    <g className={groupClass(dimmed, unmatched)}>
      <path
        className={`graph-edge graph-edge--${edge.group}`}
        d={edge.path}
        fill="none"
        stroke={`var(${line.token})`}
        strokeWidth={line.width}
        strokeDasharray={line.dash}
        markerEnd={line.arrow ? `url(#${arrowMarkerId(intoCenter ? 'graph-center' : 'graph', edge.group)})` : undefined}
      >
        <title>{edgeTitle(edge.types, dimensions ?? [])}</title>
      </path>
    </g>
  );
}

interface GraphEdgeLabelProps {
  edge: PositionedEdge;
  dimmed: boolean;
  unmatched?: boolean;
  /** As on GraphEdge: the label sits over the middle of its edge, so it carries the same tooltip. */
  dimensions: TypedDimensions[];
}

/**
 * Apart from its edge, so that it can be drawn over all of them. The tooltip
 * is on the group, not the text, so the label's text stays the relation alone.
 */
export function GraphEdgeLabel({ edge, dimmed, unmatched = false, dimensions }: GraphEdgeLabelProps) {
  return (
    <g className={groupClass(dimmed, unmatched)}>
      <title>{edgeTitle(edge.types, dimensions)}</title>
      <text
        className="graph-edge__label"
        x={edge.label.x}
        y={edge.label.y}
        textAnchor={edge.labelAnchor}
        fill={`var(${EDGE_GROUPS[edge.group].line.token})`}
      >
        {relationLabel(edge)}
      </text>
    </g>
  );
}
