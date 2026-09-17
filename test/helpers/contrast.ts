/** Relative luminance per WCAG 2.1, from a #rrggbb string. */
function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const channels = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pulls `--name: value;` declarations out of the block introduced by the
 * first occurrence of `selector`. Deliberately a dumb brace-matcher rather
 * than a CSS parser: the file is ours, and a dependency-free check is the
 * point.
 */
export function readTokens(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`Selector not found: ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const tokens: Record<string, string> = {};
  for (const line of body.split(';')) {
    const [rawName, ...rest] = line.split(':');
    const name = rawName.trim();
    if (name.startsWith('--')) tokens[name] = rest.join(':').trim();
  }
  return tokens;
}
