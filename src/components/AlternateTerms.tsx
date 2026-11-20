import type { CweAlternateTerm } from '../lib/cwe-data';
import { NuanceBlocks } from './TechnicalNuance';

/** MITRE's Alternate_Terms for a weakness, behind a disclosure that starts closed. */
export function AlternateTerms({ terms }: { terms: CweAlternateTerm[] }) {
  return (
    <details className="alternate-terms">
      <summary className="alternate-terms__summary">Alternate terms ({terms.length})</summary>
      <dl className="alternate-terms__list">
        {terms.map((entry, i) => (
          // MITRE can list a term twice, and the content is static per CWE.
          <div key={i}>
            <dt>{entry.term}</dt>
            {entry.description && (
              <dd>
                <NuanceBlocks blocks={entry.description} />
              </dd>
            )}
          </div>
        ))}
      </dl>
    </details>
  );
}
