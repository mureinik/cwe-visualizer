import { useCallback, useEffect, useState } from 'react';
import { buildGraph, type CweData, type Graph } from './lib/graph';
import { TreeDrawer } from './components/TreeDrawer';
import { GraphStage } from './components/GraphStage';
import { LandingPanel } from './components/LandingPanel';
import { NARROW_QUERY, useMediaQuery } from './lib/media';
import { DetailPanel } from './components/DetailPanel';
import { AppHeader } from './components/AppHeader';
import { Attribution } from './components/Attribution';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

function readSelectedIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('cwe');
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const narrow = useMediaQuery(NARROW_QUERY);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/cwe.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<CweData>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', graph: buildGraph(data) });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('cwe', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  }, []);

  if (state.status === 'loading') {
    return <div className="app-status">Loading CWE data…</div>;
  }
  if (state.status === 'error') {
    return <div className="app-status app-status--error">Failed to load CWE data: {state.message}</div>;
  }

  return (
    <div className="app">
      <AppHeader
        graph={state.graph}
        onSelect={selectNode}
        drawerOpen={drawerOpen}
        onToggleDrawer={() => setDrawerOpen((open) => !open)}
      />
      <main className="app-stage">
        {selectedId === null ? (
          <LandingPanel graph={state.graph} onSelect={selectNode} />
        ) : (
          <>
            <GraphStage
              graph={state.graph}
              selectedId={selectedId}
              onSelect={selectNode}
              onShowChildren={() => setDrawerOpen(true)}
              hops={narrow ? 1 : 2}
            />
            <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
          </>
        )}
        <TreeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          graph={state.graph}
          selectedId={selectedId}
          onSelect={selectNode}
        />
      </main>
      <Attribution />
    </div>
  );
}

export default App;
