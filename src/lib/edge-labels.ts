export type EdgeLabels = 'shown' | 'hidden';

export const EDGE_LABELS_STORAGE_KEY = 'cwe-visualizer-edge-labels';

/** Storage can throw as well as return null, as explained in theme.ts. */
export function readStoredEdgeLabels(): EdgeLabels {
  try {
    return localStorage.getItem(EDGE_LABELS_STORAGE_KEY) === 'hidden' ? 'hidden' : 'shown';
  } catch {
    return 'shown';
  }
}

export function storeEdgeLabels(edgeLabels: EdgeLabels): void {
  try {
    localStorage.setItem(EDGE_LABELS_STORAGE_KEY, edgeLabels);
  } catch {
    // Preference simply won't persist; the session still honours it.
  }
}
