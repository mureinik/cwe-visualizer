// Reads a weakness's Applicable_Platforms languages into the languages the
// filter offers. Strict on purpose, like phases.ts: a language or class it
// doesn't know fails the build, so a new one is a decision.

import type { CweLanguage } from '../src/lib/cwe-data.ts';
import { byName } from './views.ts';

/** A Language as fast-xml-parser gives it. */
export interface RawLanguage {
  '@_Name'?: string;
  '@_Class'?: string;
  '@_Prevalence'?: string;
}

/** Which languages each MITRE language class stands for. This mapping is ours, not MITRE's. */
export const LANGUAGE_CLASSES: Readonly<Record<string, readonly string[]>> = {
  'Memory-Unsafe': ['C', 'C++'],
  Compiled: ['C', 'C++', 'Go', 'Rust'],
  Interpreted: ['Python', 'PHP', 'Perl', 'Ruby', 'JavaScript'],
  'Object-Oriented': [
    'C++',
    'Java',
    'C#',
    'Python',
    'PHP',
    'Ruby',
    'VB.NET',
    'JavaScript',
  ],
  'Hardware Description Language': ['Verilog', 'VHDL'],
  // The checkbox, not a language.
  'Not Language-Specific': [],
  // No named language is assembly.
  Assembly: [],
};

/** Every language name MITRE uses. "Other" is known but never offered. */
export const KNOWN_LANGUAGES: ReadonlySet<string> = new Set([
  'C',
  'C++',
  'Java',
  'Python',
  'Go',
  'PHP',
  'C#',
  'Verilog',
  'VHDL',
  'Perl',
  'JavaScript',
  'ASP.NET',
  'SQL',
  'Ruby',
  'XML',
  'Rust',
  'VB.NET',
  'Other',
]);

const AGNOSTIC_CLASS = 'Not Language-Specific';
const OTHER = 'Other';

function numerically(a: string, b: string): number {
  return Number(a) - Number(b);
}

/** The languages some weakness matches, and the weaknesses marked Not Language-Specific. */
export function readLanguages(
  weaknesses: { id: string; languages: RawLanguage[] }[],
): {
  languages: CweLanguage[];
  languageAgnosticIds: string[];
} {
  const members = new Map<string, Set<string>>();
  const agnostic = new Set<string>();
  const add = (name: string, id: string): void => {
    if (name === OTHER) {
      return;
    }
    let ids = members.get(name);
    if (ids === undefined) {
      ids = new Set();
      members.set(name, ids);
    }
    ids.add(id);
  };

  for (const { id, languages } of weaknesses) {
    for (const raw of languages) {
      const name = raw['@_Name']?.trim() ?? '';
      const cls = raw['@_Class']?.trim() ?? '';
      if (name === '' && cls === '') {
        throw new Error(`CWE-${id}: a Language has no Name or Class`);
      }
      if (name !== '') {
        if (!KNOWN_LANGUAGES.has(name)) {
          throw new Error(`CWE-${id}: unknown language "${name}"`);
        }
        add(name, id);
      }
      if (cls !== '') {
        if (!Object.hasOwn(LANGUAGE_CLASSES, cls)) {
          throw new Error(`CWE-${id}: unknown language class "${cls}"`);
        }
        if (cls === AGNOSTIC_CLASS) {
          agnostic.add(id);
        }
        for (const language of LANGUAGE_CLASSES[cls]) {
          add(language, id);
        }
      }
    }
  }

  const languages = [...members]
    .map(([name, ids]) => ({
      name,
      classes: Object.keys(LANGUAGE_CLASSES).filter(
        (cls) => LANGUAGE_CLASSES[cls].includes(name),
      ),
      memberIds: [...ids].sort(numerically),
    }))
    .sort(byName);

  return { languages, languageAgnosticIds: [...agnostic].sort(numerically) };
}
