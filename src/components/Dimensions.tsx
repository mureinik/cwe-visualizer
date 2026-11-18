import type { CweDimension } from '../lib/cwe-data';
import { dimensionRows } from '../lib/dimensions';

/** MITRE's Dimensions for a weakness, behind a disclosure that starts closed. */
export function Dimensions({ dimensions }: { dimensions: CweDimension[] }) {
  return (
    <details className="dimensions">
      <summary className="dimensions__summary">Dimensions</summary>
      <p className="dimensions__note">The parts MITRE built this weakness's name from.</p>
      <dl className="dimensions__list">
        {dimensionRows(dimensions).map((row) => (
          <div key={row.label} className="dimensions__row">
            <dt>{row.label}</dt>
            <dd>{row.values.join('; ')}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
