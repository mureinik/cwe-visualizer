import { useEffect, useRef } from 'react';
import type { Graph } from '../lib/graph';
import { Tree } from './Tree';

interface TreeDrawerProps {
  open: boolean;
  onClose: () => void;
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TreeDrawer({ open, onClose, graph, selectedId, onSelect }: TreeDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" data-testid="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Weakness tree">
        <div className="drawer__header">
          <button
            type="button"
            ref={closeRef}
            className="drawer__close"
            onClick={onClose}
            aria-label="Close the weakness tree"
          >
            ✕
          </button>
        </div>
        <div className="drawer__body">
          <Tree graph={graph} selectedId={selectedId} onSelect={onSelect} />
        </div>
      </div>
    </>
  );
}
