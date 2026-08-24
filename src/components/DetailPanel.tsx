import type { Graph } from '../lib/graph';

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DetailPanel({ graph, selectedId, onSelect }: DetailPanelProps) {
  if (!selectedId) {
    return <div className="detail-panel detail-panel--empty">Select a CWE to see its details.</div>;
  }

  const node = graph.nodes[selectedId];
  if (!node) {
    return <div className="detail-panel detail-panel--empty">CWE-{selectedId} was not found.</div>;
  }

  const related = graph.relatedTo.get(selectedId) ?? [];

  return (
    <div className="detail-panel">
      <h2>
        CWE-{node.id}: {node.name}
      </h2>
      <dl>
        <dt>Abstraction</dt>
        <dd>{node.abstraction}</dd>
        <dt>Status</dt>
        <dd>{node.status}</dd>
      </dl>
      <p>{node.description}</p>
      <a href={node.url} target="_blank" rel="noreferrer">
        View on cwe.mitre.org
      </a>
      {related.length > 0 && (
        <>
          <h3>Related weaknesses</h3>
          <ul className="related-list">
            {related.map((edge) => (
              <li key={`${edge.type}-${edge.to}`}>
                <span className="related-list__type">{edge.type}</span>{' '}
                <button type="button" onClick={() => onSelect(edge.to)}>
                  CWE-{edge.to}
                  {graph.nodes[edge.to] ? `: ${graph.nodes[edge.to].name}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
