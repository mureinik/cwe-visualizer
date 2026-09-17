import { glyphFor, type ShapeName } from '../lib/shapes';

interface GlyphProps {
  abstraction: string;
  size?: number;
  deprecated?: boolean;
}

function shapeElements(shape: ShapeName, r: number) {
  switch (shape) {
    case 'diamond':
      return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill="currentColor" />;
    case 'ringed-circle':
      return (
        <>
          <circle r={r} fill="none" stroke="currentColor" strokeWidth={r * 0.3} />
          <circle r={r * 0.4} fill="currentColor" />
        </>
      );
    case 'circle':
      return <circle r={r * 0.8} fill="currentColor" />;
    case 'hollow-circle':
      return <circle r={r * 0.7} fill="none" stroke="currentColor" strokeWidth={r * 0.3} />;
    case 'hexagon': {
      const points = [0, 1, 2, 3, 4, 5]
        .map((i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
        })
        .join(' ');
      return <polygon points={points} fill="currentColor" />;
    }
    case 'square':
      return <rect x={-r * 0.7} y={-r * 0.7} width={r * 1.4} height={r * 1.4} fill="currentColor" />;
  }
}

export function Glyph({ abstraction, size = 16, deprecated = false }: GlyphProps) {
  const glyph = glyphFor(abstraction);
  const r = size / 2;
  return (
    <svg
      className={`glyph${deprecated ? ' glyph--deprecated' : ''}`}
      width={size}
      height={size}
      viewBox={`${-r} ${-r} ${size} ${size}`}
      aria-hidden="true"
      style={{ color: deprecated ? 'var(--status-deprecated)' : `var(${glyph.token})` }}
    >
      {shapeElements(glyph.shape, r)}
    </svg>
  );
}
