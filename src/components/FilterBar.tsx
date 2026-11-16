import { DEFAULT_VIEW_ID, filterCount, type Filter } from '../lib/filter';
import type { Graph } from '../lib/graph';
import { phaseKey, phaseLabel } from '../lib/phases';

interface FilterBarProps {
  graph: Graph;
  filter: Filter;
  matchCount: number;
  /** Values from the address this release doesn't have, e.g. "view 9999". */
  dropped: string[];
  onChange: (filter: Filter) => void;
}

interface Chip {
  key: string;
  label: string;
  next: Filter;
}

function chipsFor(graph: Graph, filter: Filter): Chip[] {
  const chips: Chip[] = [];
  if (filter.viewId !== DEFAULT_VIEW_ID) {
    chips.push({
      key: 'view',
      label: graph.views.find((view) => view.id === filter.viewId)?.name ?? filter.viewId,
      // A group belongs to its view, so it can't outlive it.
      next: { ...filter, viewId: DEFAULT_VIEW_ID, groupId: null },
    });
  }
  if (filter.groupId !== null) {
    chips.push({
      key: 'group',
      label: graph.groups[filter.groupId]?.name ?? filter.groupId,
      next: { ...filter, groupId: null },
    });
  }
  if (filter.phase !== null) {
    const phase = graph.phases.find((p) => phaseKey(p) === filter.phase);
    chips.push({
      key: 'phase',
      label: phase ? phaseLabel(phase) : filter.phase,
      next: { ...filter, phase: null },
    });
  }
  return chips;
}

export function FilterBar({ graph, filter, matchCount, dropped, onChange }: FilterBarProps) {
  const chips = chipsFor(graph, filter);
  const empty = chips.length === 0 && dropped.length === 0;

  // Always mounted, hidden when empty, so the live region below exists before
  // the first change and announces it.
  return (
    <div className={`filter-bar${empty ? ' visually-hidden' : ''}`}>
      {chips.length > 0 && (
        <ul className="filter-bar__chips" aria-label="Filters">
          {chips.map((chip) => (
            <li key={chip.key} className="filter-chip">
              <span className="filter-chip__label" title={chip.label}>
                {chip.label}
              </span>
              <button
                type="button"
                className="filter-chip__remove"
                aria-label={`Remove filter: ${chip.label}`}
                onClick={() => onChange(chip.next)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className="filter-bar__count" role="status" aria-live="polite">
        {filterCount(filter) > 0 ? `${matchCount} CWE${matchCount === 1 ? '' : 's'}` : ''}
      </span>
      {dropped.length > 0 && (
        <p className="filter-bar__dropped">
          {`Not in CWE ${graph.meta.cweVersion}, so ignored: ${dropped.join(', ')}`}
        </p>
      )}
    </div>
  );
}
