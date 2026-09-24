import { useEffect, useRef } from 'react';
import type { Graph } from '../lib/graph';
import { Tree } from './Tree';

interface TreeDrawerProps {
  open: boolean;
  onClose: () => void;
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  revealId?: string | null;
}

export function TreeDrawer({ open, onClose, graph, selectedId, onSelect, revealId = null }: TreeDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Hand focus back on close, or a keyboard user is returned to the top of
    // the document having lost their place.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
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
          <Tree graph={graph} selectedId={selectedId} onSelect={onSelect} revealId={revealId} />
        </div>
      </div>
    </>
  );
}
