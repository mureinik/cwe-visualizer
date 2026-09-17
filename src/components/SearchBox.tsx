import { useId, useState } from 'react';
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/search';
import { Glyph } from './Glyph';

interface SearchBoxProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

const MAX_RESULTS = 20;

export function SearchBox({ graph, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();

  const results = searchNodes(graph, query).slice(0, MAX_RESULTS);
  const open = query.trim() !== '' && !dismissed;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(index: number) {
    const node = results[index];
    if (!node) return;
    onSelect(node.id);
    setQuery('');
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
      setActive(-1);
    }
  }

  return (
    <div className="search-box">
      <input
        type="search"
        role="combobox"
        placeholder="Search CWEs by ID or name…"
        value={query}
        aria-label="Search CWEs"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setDismissed(false);
        }}
      />
      {open && (
        <ul className="search-results" id={listId} role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <li className="search-results__empty">No matches</li>
          ) : (
            results.map((node, index) => (
              <li
                key={node.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                aria-label={`CWE-${node.id}: ${node.name}`}
                className={`search-result${index === active ? ' search-result--active' : ''}`}
                onMouseDown={(e) => {
                  // Select before the input can blur and close the list.
                  e.preventDefault();
                  choose(index);
                }}
              >
                <Glyph abstraction={node.abstraction} size={12} deprecated={node.status === 'Deprecated'} />
                <span className="search-result__id">CWE-{node.id}</span>
                <span className="search-result__name">{node.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
