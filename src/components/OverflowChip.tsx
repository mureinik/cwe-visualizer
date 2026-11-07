import { compactChipWidth, OVERFLOW_CHIP_HEIGHT, OVERFLOW_CHIP_WIDTH } from '../lib/shapes';

interface OverflowChipProps {
  x: number;
  y: number;
  /** How many items the chip stands for; drawn as "+N more". */
  count: number;
  label: string;
  onActivate: () => void;
  /** Shows just "+N", for where the full chip has no room. */
  compact?: boolean;
}

/** A "+N more" chip on the graph, standing in for items it doesn't draw. */
export function OverflowChip({ x, y, count, label, onActivate, compact = false }: OverflowChipProps) {
  const width = compact ? compactChipWidth(count) : OVERFLOW_CHIP_WIDTH;
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
      <rect
        x={-width / 2}
        y={-OVERFLOW_CHIP_HEIGHT / 2}
        width={width}
        height={OVERFLOW_CHIP_HEIGHT}
        rx={OVERFLOW_CHIP_HEIGHT / 2}
      />
      <text textAnchor="middle" y={4}>
        {compact ? `+${count}` : `+${count} more`}
      </text>
    </g>
  );
}
