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
  matches?: Set<string> | null;
  /** Changes with the filter, so the tree starts afresh. */
  filterKey?: string;
}

export function TreeDrawer({ open, onClose, graph, selectedId, onSelect, revealId = null, matches = null, filterKey }: TreeDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Hand focus back on close, or a keyboard user is returned to the top of
    // the document having lost their place.
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => opener?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      // A picker or the filter panel that took this Escape marks it handled,
      // so one Escape closes only the innermost thing.
      if (event.key === 'Escape' && !event.defaultPrevented) {
        onClose();
      }
    }
    // On window, not document: the drawer sits under everything else that
    // closes on Escape, so it hears the key last, after the filter panel's
    // document listener whichever was added first.
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <>
      {/* Pointer-only affordance: keyboard users close with Escape or the close button. */}
      <div
        className="drawer-backdrop"
        data-testid="drawer-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
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
          <Tree
            key={filterKey}
            graph={graph}
            selectedId={selectedId}
            onSelect={onSelect}
            revealId={revealId}
            matches={matches}
          />
        </div>
      </div>
    </>
  );
}
