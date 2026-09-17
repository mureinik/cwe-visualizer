import type { Graph } from '../lib/graph';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

export function AppHeader({ graph, onSelect }: AppHeaderProps) {
  return (
    <header className="app-header">
      <h1 className="app-header__title">CWE Visualizer</h1>
      <div className="app-header__search">
        <SearchBox graph={graph} onSelect={onSelect} />
      </div>
      <span className="app-header__version">CWE {graph.meta.cweVersion}</span>
      <ThemeToggle />
    </header>
  );
}
