interface OverflowChipProps {
  x: number;
  y: number;
  /** How many items the chip stands for; drawn as "+N more". */
  count: number;
  label: string;
  onActivate: () => void;
}

/** A "+N more" chip on the graph, standing in for items it doesn't draw. */
export function OverflowChip({ x, y, count, label, onActivate }: OverflowChipProps) {
  return (
    <g
      className="graph-overflow"
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onActivate}
      onKeyDown={(event) => {
        // An SVG <g> is not a native button, so Enter and Space do nothing
        // unless we handle them.
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onActivate();
        }
      }}
    >
      <rect x={-34} y={-12} width={68} height={24} rx={12} />
      <text textAnchor="middle" y={4}>
        +{count} more
      </text>
    </g>
  );
}
