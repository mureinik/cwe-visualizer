import type { CwePreviousName } from '../lib/cwe-data';

// Newest first. MITRE lists oldest first, so reversing before a stable sort
// puts the later-listed name first on a tie.
function newestFirst(names: CwePreviousName[]): CwePreviousName[] {
  return [...names].reverse().sort((a, b) => b.date.localeCompare(a.date));
}

/** The names MITRE used for a weakness before, behind a disclosure that starts closed. */
export function FormerNames({ names }: { names: CwePreviousName[] }) {
  return (
    <details className="former-names">
      <summary className="former-names__summary">Former names ({names.length})</summary>
      <ul className="former-names__list">
        {newestFirst(names).map((entry, i) => (
          <li key={i}>
            <span className="former-names__name">{entry.name}</span>{' '}
            <span className="former-names__until">until {entry.date}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
