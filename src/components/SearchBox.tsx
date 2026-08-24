import { useState } from 'react';
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/graph';

interface SearchBoxProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

export function SearchBox({ graph, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const results = searchNodes(graph, query).slice(0, 20);

  return (
    <div className="search-box">
      <input
        type="search"
        placeholder="Search CWEs by ID or name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search CWEs"
      />
      {query.trim() !== '' && (
        <ul className="search-results">
          {results.length === 0 ? (
            <li className="search-results__empty">No matches</li>
          ) : (
            results.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(node.id);
                    setQuery('');
                  }}
                >
                  CWE-{node.id}: {node.name}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
