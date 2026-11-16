import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, readTokens } from '../helpers/contrast.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const styles = path.join(__dirname, '..', '..', 'src', 'styles');
// Comments out, so a selector is never read as part of the one above it.
const css = readFileSync(path.join(styles, 'graph.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');
const tokens = readFileSync(path.join(styles, 'tokens.css'), 'utf-8');

const THEMES = [
  { name: 'light', selector: ':root {' },
  { name: 'dark', selector: ':root[data-theme="dark"] {' },
];

/** Every rule whose selector list names `selector`, as [selector list, body]. */
function rulesFor(selector: string): [string, string][] {
  const found: [string, string][] = [];
  for (const match of css.matchAll(/(^|\n)([^{}@\s][^{}]*?)\s*\{([^{}]*)\}/g)) {
    const selectors = match[2].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) {
      found.push([match[2], match[3]]);
    }
  }
  return found;
}

function declaration(body: string, property: string): string | undefined {
  return new RegExp(`(?:^|[;{\\s])${property}:\\s*([^;]+);`).exec(body)?.[1].trim();
}

// Outside the filter, the graph fades a node's glyph and an edge's line, but
// not the text: half opacity took the labels to 2.3-3.9:1, under the 4.5:1
// floor tokens.test.ts holds every text token to.
describe('graph labels outside the filter', () => {
  const LABELS = [
    '.graph-node--unmatched .graph-node__id',
    '.graph-node--unmatched .graph-node__name',
    '.graph-edge-group--unmatched .graph-edge__label',
  ];

  it('fades no group that holds text', () => {
    for (const selector of ['.graph-node--unmatched', '.graph-edge-group--unmatched']) {
      for (const [, body] of rulesFor(selector)) {
        expect(declaration(body, 'opacity')).toBeUndefined();
      }
    }
  });

  it('fades the glyph and the edge line', () => {
    for (const selector of ['.graph-node--unmatched .graph-node__glyph', '.graph-edge-group--unmatched .graph-edge']) {
      const opacities = rulesFor(selector).map(([, body]) => declaration(body, 'opacity')).filter(Boolean);
      expect(opacities).toHaveLength(1);
      expect(Number(opacities[0])).toBeLessThan(1);
    }
  });

  describe.each(THEMES)('$name theme', ({ selector: themeSelector }) => {
    const theme = readTokens(tokens, themeSelector);

    it.each(LABELS)('%s reaches 4.5:1 against --bg', (selector) => {
      const fills = rulesFor(selector).map(([, body]) => declaration(body, 'fill')).filter(Boolean);
      expect(fills).toHaveLength(1);
      const token = /^var\((--[\w-]+)\)$/.exec(fills[0]!)?.[1];
      expect(token).toBeDefined();
      expect(contrastRatio(theme[token!], theme['--bg'])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
