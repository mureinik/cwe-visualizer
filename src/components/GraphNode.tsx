import { isDeprecated, type CweNode } from '../lib/graph';
import type { PositionedNode } from '../lib/layout';
import { HALO_GAP, NODE_RADIUS, SELECTED_NODE_RADIUS } from '../lib/shapes';
import { GlyphShape } from './Glyph';

interface GraphNodeProps {
  node: PositionedNode;
  cweNode: CweNode;
  /** Accessible label — the full name, always. */
  label: string;
  /** What's drawn under the node: shared prefix elided, fitted to its slot. */
  displayName: string;
  /** Too little room for "CWE-1085"; show the bare number instead. */
  compactId: boolean;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void;
  onHover: (id: string | null) => void;
}

export function GraphNode({
  node,
  cweNode,
  label,
  displayName,
  compactId,
  selected,
  dimmed,
  onSelect,
  onKeyDown,
  onHover,
}: GraphNodeProps) {
  const deprecated = isDeprecated(cweNode);
  const r = selected ? SELECTED_NODE_RADIUS : NODE_RADIUS;
  // Clear the selection halo as well as the glyph, so the label's knockout
  // stroke doesn't cut a gap through the ring.
  const labelTop = (selected ? r + HALO_GAP : r) + 16;

  return (
    <g
      className={`graph-node${selected ? ' graph-node--selected' : ''}${dimmed ? ' graph-node--dimmed' : ''}`}
      data-node-id={node.id}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(node.id)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
    >
      {selected && <circle className="graph-node__halo" r={r + HALO_GAP} />}
      <GlyphShape abstraction={cweNode.abstraction} r={r} deprecated={deprecated} />
      <text className="graph-node__id" y={labelTop} textAnchor="middle">
        {compactId ? node.id : `CWE-${node.id}`}
      </text>
      <text className="graph-node__name" y={labelTop + 14} textAnchor="middle">
        {displayName}
      </text>
      <title>{`CWE-${node.id}: ${cweNode.name}`}</title>
    </g>
  );
}
