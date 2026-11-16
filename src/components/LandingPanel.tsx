import { countMatchesBeneath } from '../lib/filter';
import { countDescendants, type Graph } from '../lib/graph';
import { Glyph } from './Glyph';

interface LandingPanelProps {
  graph: Graph;
  onSelect: (id: string) => void;
  onOpenTree: () => void;
  /** The filter's matches (see `matchingIds`), or null with no filter. */
  matches?: Set<string> | null;
  onClearFilter?: () => void;
}

export function LandingPanel({ graph, onSelect, onOpenTree, matches = null, onClearFilter }: LandingPanelProps) {
  const total = graph.all.length;
  const pillars = graph.roots.map((id) => ({
    id,
    beneath: countDescendants(graph, id),
    matched: matches === null ? null : countMatchesBeneath(graph, id, matches),
  }));
  // A pillar stays when it matches, or leads to one that does.
  const listed = matches === null
    ? pillars
    : pillars.filter(({ id, matched }) => matches.has(id) || (matched ?? 0) > 0);

  return (
    <div className="landing">
      <div className="landing__inner">
        <p className="landing__lede">
          Explore <strong>{total.toLocaleString()}</strong> software weaknesses from MITRE&rsquo;s CWE{' '}
          {graph.meta.cweVersion} corpus — their hierarchy, and how they lead to one another.
        </p>

        {matches?.size === 0 ? (
          <div className="landing__empty">
            <p className="landing__empty-text">No CWEs match the filter.</p>
            <button type="button" className="landing__clear" onClick={onClearFilter}>
              Clear filter
            </button>
          </div>
        ) : (
          <>
            <h2 className="landing__heading">Start from a pillar</h2>
            <ul className="landing__pillars">
              {listed.map(({ id, beneath, matched }) => {
                const node = graph.nodes[id];
                const context = matches !== null && !matches.has(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`pillar-card${context ? ' pillar-card--context' : ''}`}
                      onClick={() => onSelect(id)}
                      aria-label={
                        matched === null
                          ? `CWE-${id}: ${node.name}, ${beneath} weaknesses beneath it`
                          : `CWE-${id}: ${node.name}, ${matched} of ${beneath} weaknesses beneath it match the filter`
                      }
                    >
                      <Glyph abstraction={node.abstraction} size={16} />
                      <span className="pillar-card__id">CWE-{id}</span>
                      <span className="pillar-card__name">{node.name}</span>
                      <span className="pillar-card__count">
                        {matched === null ? beneath : `${matched} of ${beneath}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

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
