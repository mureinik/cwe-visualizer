import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import { GLYPHS } from '../lib/shapes';
import { Glyph } from './Glyph';

export function Legend() {
  return (
    <aside className="legend" aria-label="Legend">
      <h2 className="legend__heading">Relations</h2>
      <ul className="legend__list">
        {Object.values(EDGE_GROUPS).map(({ key, label, line }) => (
          <li key={key} className="legend__row">
            <svg className="legend__swatch" width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
              {line.arrow && (
                <marker
                  id={arrowMarkerId('legend', key)}
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
                strokeWidth={line.width}
                strokeDasharray={line.dash ?? undefined}
                markerEnd={line.arrow ? `url(#${arrowMarkerId('legend', key)})` : undefined}
              />
            </svg>
            <span>{label}</span>
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
