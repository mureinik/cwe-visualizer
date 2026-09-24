import { GLYPHS } from '../lib/shapes';
import { Glyph } from './Glyph';

interface LineSample {
  label: string;
  token: string;
  dashed?: boolean;
  arrow?: boolean;
}

const LINES: LineSample[] = [
  { label: 'Parent / child', token: '--rel-hierarchy' },
  { label: 'Can precede', token: '--rel-sequence', arrow: true },
  { label: 'Peer, can also be', token: '--rel-peer', dashed: true },
  { label: 'Requires', token: '--rel-requires' },
];

export function Legend() {
  return (
    <aside className="legend" aria-label="Legend">
      <h2 className="legend__heading">Relations</h2>
      <ul className="legend__list">
        {LINES.map((line) => (
          <li key={line.label} className="legend__row">
            <svg className="legend__swatch" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
              {line.arrow && (
                <marker
                  id={`legend-arrow-${line.token.replace(/[^a-z]/g, '')}`}
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill={`var(${line.token})`} />
                </marker>
              )}
              <line
                x1="1"
                y1="5"
                x2={line.arrow ? 22 : 27}
                y2="5"
                stroke={`var(${line.token})`}
                strokeWidth="2"
                strokeDasharray={line.dashed ? '4 3' : undefined}
                markerEnd={line.arrow ? `url(#legend-arrow-${line.token.replace(/[^a-z]/g, '')})` : undefined}
              />
            </svg>
            <span>{line.label}</span>
          </li>
        ))}
      </ul>

      <h2 className="legend__heading">Abstraction</h2>
      <ul className="legend__list">
        {Object.values(GLYPHS).map((glyph) => (
          <li key={glyph.label} className="legend__row">
            <span className="legend__swatch legend__swatch--glyph">
              <Glyph abstraction={glyph.label} size={12} />
            </span>
            <span>{glyph.label}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
