import { useId, useRef } from 'react';
import { DEFAULT_FILTER, DEFAULT_VIEW_ID, agnosticExtra, filterCount, type Filter } from '../lib/filter';
import { isDeprecated, type Graph } from '../lib/graph';
import { languageNote } from '../lib/languages';
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

/** The view, group, language and phase pickers. There is no Apply: every change takes effect at once. */
export function FilterPanel({ id, graph, filter, onChange, narrow, onClose }: FilterPanelProps) {
  const phaseId = useId();
  const languageId = useId();
  const noteId = useId();
  const viewRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);
  const phaseRef = useRef<HTMLSelectElement>(null);
  const languageRef = useRef<HTMLSelectElement>(null);
  const language = graph.languages.find((l) => l.name === filter.language);
  // A clear button disables itself once used, which would drop focus to the
  // page; it goes to the control the button cleared instead.
  const clear = (next: Filter, focusTo: React.RefObject<HTMLInputElement | HTMLSelectElement | null>) => {
    onChange(next);
    focusTo.current?.focus();
  };
  const viewOptions: PickerOption[] = graph.views.map((view) => ({ id: view.id, label: `${view.name} (${view.id})`, formerLabels: view.previousNames }));
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
      <div className="filter-panel__field filter-panel__field--language">
        <div className="filter-panel__row">
          <div className="picker">
            <label className="picker__label" htmlFor={languageId}>
              Language
            </label>
            <select
              ref={languageRef}
              id={languageId}
              className="picker__input"
              value={filter.language ?? ''}
              aria-describedby={language === undefined ? undefined : noteId}
              onChange={(e) =>
                onChange(
                  e.target.value === ''
                    ? { ...filter, language: null, anyLanguage: false }
                    : { ...filter, language: e.target.value },
                )}
            >
              <option value="">Any language</option>
              {graph.languages.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="filter-panel__clear"
            disabled={filter.language === null}
            onClick={() => clear({ ...filter, language: null, anyLanguage: false }, languageRef)}
          >
            Clear language
          </button>
        </div>
        {language !== undefined && (
          <>
            <label className="filter-panel__check">
              <input
                type="checkbox"
                checked={filter.anyLanguage}
                onChange={(e) => onChange({ ...filter, anyLanguage: e.target.checked })}
              />
              Also show weaknesses that apply to any language (+{agnosticExtra(graph, language.name)})
            </label>
            <p id={noteId} className="filter-panel__note">
              {languageNote(language)}
            </p>
          </>
        )}
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
