import { RELATION_GROUPS } from '../lib/relations';
import type { PositionedEdge } from '../lib/layout';

interface GraphEdgeProps {
  edge: PositionedEdge;
  dimmed: boolean;
  label: string | null;
}

export function GraphEdge({ edge, dimmed, label }: GraphEdgeProps) {
  const stroke =
    edge.group === 'hierarchy' ? 'var(--rel-hierarchy)' : `var(${RELATION_GROUPS[edge.group].token})`;

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
        stroke={stroke}
        strokeWidth={edge.group === 'hierarchy' ? 2 : 1.5}
        strokeDasharray={edge.group === 'peer' ? '4 3' : undefined}
        markerEnd={edge.group === 'sequence' ? 'url(#graph-arrow)' : undefined}
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
