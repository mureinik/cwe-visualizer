import type { CweLanguage } from './cwe-data';

/** A class as it reads in a sentence: lowercased, without a final word "language". */
function classPhrase(name: string): string {
  return name.toLowerCase().replace(/\s*\blanguage$/, '');
}

/** "a", "a or b", "a, b or c". */
function joinOr(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** What the reader needs to know about what a language includes: the classes are our grouping, not MITRE's. */
export function languageNote(language: CweLanguage): string {
  if (language.classes.length === 0) {
    return `Weaknesses MITRE ties to ${language.name}.`;
  }
  const classes = joinOr(language.classes.map(classPhrase));
  return `Weaknesses MITRE ties to ${language.name}, or to ${classes} languages. Which languages count as which is our call, not MITRE's.`;
}
