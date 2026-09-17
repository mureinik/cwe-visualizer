import type { CweNode } from '../lib/graph';
import type { PositionedNode } from '../lib/layout';
import { GlyphShape } from './Glyph';

const MAX_LABEL = 24;

function truncate(text: string, max = MAX_LABEL): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

interface GraphNodeProps {
  node: PositionedNode;
  cweNode: CweNode;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>, id: string) => void;
}

export function GraphNode({ node, cweNode, label, selected, onSelect, onKeyDown }: GraphNodeProps) {
  const deprecated = cweNode.status === 'Deprecated';
  const r = selected ? 13 : 9;

  return (
    <g
      className={`graph-node${selected ? ' graph-node--selected' : ''}`}
      data-node-id={node.id}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => onKeyDown(event, node.id)}
    >
      {selected && <circle className="graph-node__halo" r={r + 7} />}
      <GlyphShape abstraction={cweNode.abstraction} r={r} deprecated={deprecated} />
      <text className="graph-node__id" y={r + 16} textAnchor="middle">
        CWE-{node.id}
      </text>
      <text className="graph-node__name" y={r + 30} textAnchor="middle">
        {truncate(cweNode.name)}
      </text>
      <title>{`CWE-${node.id}: ${cweNode.name}`}</title>
    </g>
  );
}
