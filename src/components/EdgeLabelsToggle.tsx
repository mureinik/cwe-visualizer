import { storeEdgeLabels, type EdgeLabels } from '../lib/edge-labels';

interface EdgeLabelsToggleProps {
  edgeLabels: EdgeLabels;
  onChange: (edgeLabels: EdgeLabels) => void;
}

export function EdgeLabelsToggle({ edgeLabels, onChange }: EdgeLabelsToggleProps) {
  const hidden = edgeLabels === 'hidden';
  const action = `${hidden ? 'Show' : 'Hide'} edge labels`;

  return (
    <button
      type="button"
      className="edge-labels-toggle"
      aria-label={action}
      title={action}
      onClick={() => {
        const next = hidden ? 'shown' : 'hidden';
        storeEdgeLabels(next);
        onChange(next);
      }}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        <path d="M2 2h5.5L14 8.5 8.5 14 2 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="5.25" cy="5.25" r="1.1" fill="currentColor" />
        {hidden && (
          <path className="edge-labels-toggle__strike" d="M1.5 14.5 14.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
