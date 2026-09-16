import { useCallback, useEffect, useState } from 'react';
import { buildGraph, type CweData, type Graph } from './lib/graph';
import { Tree } from './components/Tree';
import { SearchBox } from './components/SearchBox';
import { DetailPanel } from './components/DetailPanel';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; graph: Graph };

function readSelectedIdFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('cwe');
}

function Attribution() {
  return (
    <footer className="app-footer">
      CWE content is not original to this project. Copyright © 2006–2026,{' '}
      <a href="https://www.mitre.org/" target="_blank" rel="noreferrer">
        The MITRE Corporation
      </a>
      ; CWE is a trademark of The MITRE Corporation, reproduced here under its{' '}
      <a href="https://cwe.mitre.org/about/termsofuse.html" target="_blank" rel="noreferrer">
        Terms of Use
      </a>
      . This project is not affiliated with or endorsed by MITRE —{' '}
      <a href="https://cwe.mitre.org/" target="_blank" rel="noreferrer">
        cwe.mitre.org
      </a>{' '}
      is authoritative.
    </footer>
  );
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(() => readSelectedIdFromUrl());

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
      <header className="app-header">
        <h1>CWE Visualizer</h1>
        <SearchBox graph={state.graph} onSelect={selectNode} />
      </header>
      <main className="app-main">
        <Tree graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
        <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
      </main>
      <Attribution />
    </div>
  );
}

export default App;
