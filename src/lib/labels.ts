/**
 * CWE names share enormous opening phrases — seven of CWE-79's children all
 * begin "Improper Neutralization of" — so truncating from the left throws
 * away the only part that tells them apart. These helpers drop what the
 * labels on screen have in common and fit what's left to the space a node
 * actually has.
 */

/** Approximate advance width of one character at --text-xs. Deliberately generous. */
const CHAR_PX = 7;
/** Blank space kept between one node's label and the next. */
const LABEL_GUTTER_PX = 12;
/** Below this, eliding a shared prefix costs more clarity than it buys. */
const MIN_PREFIX = 8;
/** However much room a node has, a label past this is just noise. */
const MAX_CHARS = 34;

export function longestCommonPrefix(values: string[]): string {
  if (values.length < 2) return '';
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < value.length && prefix[i] === value[i]) i += 1;
    prefix = prefix.slice(0, i);
    if (prefix === '') return '';
  }
  return prefix;
}

/** Every word-boundary prefix of a name, longest last. */
function wordPrefixes(name: string): string[] {
  const prefixes: string[] = [];
  for (let i = 0; i < name.length; i += 1) {
    if (name[i] === ' ') prefixes.push(name.slice(0, i + 1));
  }
  return prefixes;
}

/**
 * The longest word-boundary prefix shared by most of these names.
 *
 * Requiring *every* name to share it is too brittle to be useful: among
 * CWE-79's seven children, six begin "Improper Neutralization of" and one is
 * "Doubled Character XSS Manipulations", and that single outlier would
 * otherwise force all seven to keep the prefix nobody needs to read.
 */
export function dominantPrefix(names: string[]): string {
  if (names.length < 2) return '';
  const threshold = Math.max(2, Math.ceil(names.length / 2));

  const counts = new Map<string, number>();
  for (const name of names) {
    for (const prefix of wordPrefixes(name)) {
      counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
    }
  }

  let best = '';
  for (const [prefix, count] of counts) {
    if (count >= threshold && prefix.length >= MIN_PREFIX && prefix.length > best.length) {
      best = prefix;
    }
  }
  return best;
}

/**
 * Replaces the prefix most of these names share with a leading ellipsis.
 * Names that don't carry it are left whole, and the elision is skipped where
 * it would leave nothing behind.
 */
export function elideSharedPrefix(names: string[]): string[] {
  const prefix = dominantPrefix(names);
  if (prefix === '') return names;

  const elided = names.map((name) =>
    name.startsWith(prefix) && name.length > prefix.length ? `…${name.slice(prefix.length)}` : name
  );
  return elided.every((label) => label !== '…') ? elided : names;
}

/** Truncates to at most `maxChars` characters, ellipsis included. */
export function fitLabel(text: string, maxChars: number): string {
  if (maxChars <= 0) return '';
  if (text.length <= maxChars) return text;
  if (maxChars === 1) return '…';
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * How many characters fit in a horizontal slot of `slotPx`, capped so a node
 * alone in its band doesn't stretch its full name across the whole stage.
 */
export function labelBudget(slotPx: number): number {
  return Math.min(MAX_CHARS, Math.max(0, Math.floor((slotPx - LABEL_GUTTER_PX) / CHAR_PX)));
}
