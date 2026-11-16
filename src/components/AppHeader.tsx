import { useEffect, useId, useRef, useState } from 'react';
import type { EdgeLabels } from '../lib/edge-labels';
import { DEFAULT_FILTER, filterCount, type Filter } from '../lib/filter';
import type { Graph } from '../lib/graph';
import { EdgeLabelsToggle } from './EdgeLabelsToggle';
import { FilterBar } from './FilterBar';
import { FilterPanel } from './FilterPanel';
import { ReleaseSwitcher } from './ReleaseSwitcher';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  graph: Graph;
  onSelect: (id: string) => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
  edgeLabels: EdgeLabels;
  onEdgeLabelsChange: (edgeLabels: EdgeLabels) => void;
  filter?: Filter;
  /** The filter's matches (see `matchingIds`), or null with no filter. */
  matches?: Set<string> | null;
  /** Filter values from the address this release doesn't have. */
  dropped?: string[];
  onFilterChange?: (filter: Filter) => void;
  /** Below the breakpoint, where the filter panel is a bottom sheet. */
  narrow?: boolean;
}

const NO_DROPPED: string[] = [];

interface FilterButtonProps {
  graph: Graph;
  filter: Filter;
  onChange: (filter: Filter) => void;
  narrow: boolean;
}

/** Opens the filter panel, and closes it the way ReleaseSwitcher closes its list. */
function FilterButton({ graph, filter, onChange, narrow }: FilterButtonProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const count = filterCount(filter);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      // A picker inside handles its own Escape, closing only its list.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="filter-menu"
      onBlur={(event) => {
        // Tabbing out closes it, as a click outside does. A click on the
        // panel's background blurs with no new focus; that isn't leaving.
        if (event.relatedTarget !== null && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="filter-button"
        aria-label={count === 0 ? 'Filter' : `Filter, ${count} set`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        Filter
        {count > 0 && <span className="filter-button__badge">{count}</span>}
      </button>
      {open && <FilterPanel id={panelId} graph={graph} filter={filter} onChange={onChange} narrow={narrow} onClose={close} />}
    </div>
  );
}

export function AppHeader({
  graph,
  onSelect,
  drawerOpen,
  onToggleDrawer,
  edgeLabels,
  onEdgeLabelsChange,
  filter = DEFAULT_FILTER,
  matches = null,
  dropped = NO_DROPPED,
  onFilterChange,
  narrow = false,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header__drawer-toggle"
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        aria-label="Weakness tree"
      >
        ☰
      </button>
      <h1 className="app-header__title">CWE Visualizer</h1>
      <div className="app-header__search">
        <SearchBox graph={graph} onSelect={onSelect} matches={matches} />
        {onFilterChange && <FilterButton graph={graph} filter={filter} onChange={onFilterChange} narrow={narrow} />}
      </div>
      <ReleaseSwitcher />
      <span className="app-header__version">CWE {graph.meta.cweVersion}</span>
      <EdgeLabelsToggle edgeLabels={edgeLabels} onChange={onEdgeLabelsChange} />
      <ThemeToggle />
      <a
        className="app-header__repo"
        href="https://github.com/mureinik/cwe-visualizer"
        target="_blank"
        rel="noreferrer"
        aria-label="Source on GitHub"
        title="Source on GitHub"
      >
        {/* The GitHub mark, from Primer Octicons (mark-github, MIT). */}
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
          />
        </svg>
      </a>
      {onFilterChange && (
        <FilterBar
          graph={graph}
          filter={filter}
          matchCount={matches?.size ?? graph.all.length}
          dropped={dropped}
          onChange={onFilterChange}
        />
      )}
    </header>
  );
}
