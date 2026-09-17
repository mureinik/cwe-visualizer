import { RELATION_GROUPS } from '../lib/relations';
import type { PositionedEdge } from '../lib/layout';

export function GraphEdge({ edge }: { edge: PositionedEdge }) {
  const stroke =
    edge.group === 'hierarchy' ? 'var(--rel-hierarchy)' : `var(${RELATION_GROUPS[edge.group].token})`;
  return (
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
  );
}
