import type { Graph } from '../lib/graph';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  graph: Graph;
  onSelect: (id: string) => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export function AppHeader({ graph, onSelect, drawerOpen, onToggleDrawer }: AppHeaderProps) {
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
        <SearchBox graph={graph} onSelect={onSelect} />
      </div>
      <span className="app-header__version">CWE {graph.meta.cweVersion}</span>
      <ThemeToggle />
    </header>
  );
}
