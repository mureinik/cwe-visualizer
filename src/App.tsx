import { useCallback, useEffect, useRef, useState } from 'react';
import { buildGraph, type CweData, type Graph } from './lib/graph';
import { TreeDrawer } from './components/TreeDrawer';
import { GraphStage } from './components/GraphStage';
import { LandingPanel } from './components/LandingPanel';
import { NARROW_QUERY, useMediaQuery } from './lib/media';
import { DetailPanel, type RelationFlash } from './components/DetailPanel';
import { AppHeader } from './components/AppHeader';
import { Attribution } from './components/Attribution';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

// CWE ids are numeric. Anything else would be echoed back as "not found"
// text, so treat it as no selection. (`graph.nodes` has no prototype, so a
// key like `constructor` wouldn't resolve as a CWE anyway; this is a second
// guard, not the only one.)
function readSelectedIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('cwe');
  return id !== null && /^\d+$/.test(id) ? id : null;
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [flash, setFlash] = useState<RelationFlash | null>(null);
  // Never reset, so every flash, even the first after a re-centre, is new to
  // the detail card.
  const flashCount = useRef(0);
  const narrow = useMediaQuery(NARROW_QUERY);

  useEffect(() => {
    let cancelled = false;
    // Relative to Vite's base path, so the data is found wherever the app is
    // served from, not only at the domain root.
    fetch(`${import.meta.env.BASE_URL}data/cwe.json`)
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
    // The flashed relations belong to the CWE being left.
    setFlash(null);
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
          <LandingPanel
            graph={state.graph}
            onSelect={selectNode}
            onOpenTree={() => {
              setRevealId(null);
              setDrawerOpen(true);
            }}
          />
        ) : (
          <>
            <GraphStage
              graph={state.graph}
              selectedId={selectedId}
              onSelect={selectNode}
              onShowChildren={(parentId) => {
                setRevealId(parentId);
                setDrawerOpen(true);
              }}
              onShowRelations={(hidden) => {
                // The capped relations are already in the detail card, so
                // point them out there rather than crowding them back onto
                // the canvas. The card scrolls to them itself.
                flashCount.current += 1;
                setFlash({ relations: hidden, token: flashCount.current });
              }}
              hops={narrow ? 1 : 2}
            />
            <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} flash={flash} />
          </>
        )}
        <TreeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          graph={state.graph}
          selectedId={selectedId}
          onSelect={(id) => {
            selectNode(id);
            // Below the breakpoint the drawer covers the whole screen, so the
            // pick would re-centre a graph nobody can see. Wider, the graph
            // shows beside it and the drawer stays open for browsing.
            if (narrow) setDrawerOpen(false);
          }}
          revealId={revealId}
        />
      </main>
      <Attribution catalogDate={state.graph.meta.catalogDate} />
    </div>
  );
}

export default App;
