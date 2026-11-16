import { useId, useRef } from 'react';
import { DEFAULT_FILTER, DEFAULT_VIEW_ID, filterCount, type Filter } from '../lib/filter';
import { isDeprecated, type Graph } from '../lib/graph';
import { phaseKey, phaseLabel } from '../lib/phases';
import { Picker, type PickerOption } from './Picker';

interface FilterPanelProps {
  id?: string;
  graph: Graph;
  filter: Filter;
  onChange: (filter: Filter) => void;
  /** Shown as a bottom sheet, with a close button. */
  narrow: boolean;
  onClose: () => void;
}

/** The view, group and phase pickers. There is no Apply: every change takes effect at once. */
export function FilterPanel({ id, graph, filter, onChange, narrow, onClose }: FilterPanelProps) {
  const phaseId = useId();
  const viewRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef<HTMLSelectElement>(null);
  // A clear button disables itself once used, which would drop focus to the
  // page; it goes to the control the button cleared instead.
  const clear = (next: Filter, focusTo: React.RefObject<HTMLInputElement | HTMLSelectElement | null>) => {
    onChange(next);
    focusTo.current?.focus();
  };
  const viewOptions: PickerOption[] = graph.views.map((view) => ({ id: view.id, label: `${view.name} (${view.id})` }));
  const groupOptions: PickerOption[] = (graph.views.find((view) => view.id === filter.viewId)?.groupIds ?? [])
    .map((groupId) => graph.groups[groupId])
    .map((group) => ({ id: group.id, label: group.name, deprecated: isDeprecated(group) }));

  return (
    <div id={id} className={`filter-panel${narrow ? ' filter-panel--sheet' : ''}`} role="dialog" aria-label="Filter">
      {narrow && (
        <div className="filter-panel__head">
          <h2 className="filter-panel__title">Filter</h2>
          <button type="button" className="filter-panel__close" aria-label="Close filters" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
      <div className="filter-panel__field">
        <Picker
          label="View"
          inputRef={viewRef}
          options={viewOptions}
          value={filter.viewId}
          onChange={(viewId) => onChange({ ...filter, viewId, groupId: null })}
        />
        <button
          type="button"
          className="filter-panel__clear"
          disabled={filter.viewId === DEFAULT_VIEW_ID}
          onClick={() => clear({ ...filter, viewId: DEFAULT_VIEW_ID, groupId: null }, viewRef)}
        >
          Show all CWEs
        </button>
      </div>
      <div className="filter-panel__field">
        <Picker
          label="Group"
          inputRef={groupRef}
          options={groupOptions}
          value={filter.groupId}
          placeholder={groupOptions.length === 0 ? 'None in this view' : 'Any group'}
          disabled={groupOptions.length === 0}
          onChange={(groupId) => onChange({ ...filter, groupId })}
        />
        <button
          type="button"
          className="filter-panel__clear"
          disabled={filter.groupId === null}
          onClick={() => clear({ ...filter, groupId: null }, groupRef)}
        >
          Clear group
        </button>
      </div>
      <div className="filter-panel__field">
        <div className="picker">
          <label className="picker__label" htmlFor={phaseId}>
            Phase
          </label>
          <select
            ref={phaseRef}
            id={phaseId}
            className="picker__input"
            value={filter.phase ?? ''}
            onChange={(e) => onChange({ ...filter, phase: e.target.value === '' ? null : e.target.value })}
          >
            <option value="">Any phase</option>
            {graph.phases.map((phase) => (
              <option key={phaseKey(phase)} value={phaseKey(phase)}>
                {phaseLabel(phase)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="filter-panel__clear"
          disabled={filter.phase === null}
          onClick={() => clear({ ...filter, phase: null }, phaseRef)}
        >
          Clear phase
        </button>
      </div>
      <button
        type="button"
        className="filter-panel__clear-all"
        disabled={filterCount(filter) === 0}
        onClick={() => clear(DEFAULT_FILTER, viewRef)}
      >
        Clear all
      </button>
    </div>
  );
}
