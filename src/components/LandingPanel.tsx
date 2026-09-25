import { countDescendants, type Graph } from '../lib/graph';
import { Glyph } from './Glyph';

interface LandingPanelProps {
  graph: Graph;
  onSelect: (id: string) => void;
  onOpenTree: () => void;
}

export function LandingPanel({ graph, onSelect, onOpenTree }: LandingPanelProps) {
  const total = graph.all.length;

  return (
    <div className="landing">
      <div className="landing__inner">
        <p className="landing__lede">
          Explore <strong>{total.toLocaleString()}</strong> software weaknesses from MITRE&rsquo;s CWE{' '}
          {graph.meta.cweVersion} corpus — their hierarchy, and how they lead to one another.
        </p>

        <h2 className="landing__heading">Start from a pillar</h2>
        <ul className="landing__pillars">
          {graph.roots.map((id) => {
            const node = graph.nodes[id];
            const beneath = countDescendants(graph, id);
            return (
              <li key={id}>
                <button
                  type="button"
                  className="pillar-card"
                  onClick={() => onSelect(id)}
                  aria-label={`CWE-${id}: ${node.name}, ${beneath} weaknesses beneath it`}
                >
                  <Glyph abstraction={node.abstraction} size={16} />
                  <span className="pillar-card__id">CWE-{id}</span>
                  <span className="pillar-card__name">{node.name}</span>
                  <span className="pillar-card__count">{beneath}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="landing__hint">
          …or search by ID or name above, or browse the full tree from{' '}
          <button
            type="button"
            className="landing__tree-button"
            onClick={onOpenTree}
            aria-label="Browse the full tree"
          >
            <span aria-hidden="true">☰</span>
          </button>
          .
        </p>
      </div>
    </div>
  );
}
