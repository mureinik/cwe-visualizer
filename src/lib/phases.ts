import type { CwePhase } from './cwe-data';

/** Identifies a phase: its name, or domain:name for a custom phase. */
export function phaseKey(p: CwePhase): string {
  return p.domain === undefined ? p.name : `${p.domain}:${p.name}`;
}

/** A phase as the reader sees it: its name, plus the domain of a custom one. */
export function phaseLabel(p: CwePhase): string {
  return p.domain === undefined ? p.name : `${p.name} (${p.domain})`;
}
