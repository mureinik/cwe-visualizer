import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, readTokens } from '../helpers/contrast.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'tokens.css'), 'utf-8');

const THEMES = [
  { name: 'light', selector: ':root {' },
  { name: 'dark', selector: ":root[data-theme='dark'] {" },
];

const TEXT_ON_BG = ['--text', '--text-secondary', '--text-muted'];
const GRAPHICS = [
  '--abs-pillar', '--abs-class', '--abs-base', '--abs-variant', '--abs-compound',
  '--status-stable', '--status-draft', '--status-incomplete', '--status-deprecated',
  '--rel-hierarchy', '--rel-peer', '--rel-sequence', '--rel-requires',
];

describe.each(THEMES)('$name theme tokens', ({ selector }) => {
  const tokens = readTokens(css, selector);

  it('defines a background and every text token', () => {
    expect(tokens['--bg']).toMatch(/^#[0-9a-f]{6}$/i);
    for (const name of TEXT_ON_BG) expect(tokens[name]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(TEXT_ON_BG)('%s reaches 4.5:1 against --bg', (name) => {
    expect(contrastRatio(tokens[name], tokens['--bg'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAPHICS)('%s reaches 3:1 against --bg', (name) => {
    expect(contrastRatio(tokens[name], tokens['--bg'])).toBeGreaterThanOrEqual(3);
  });

  it.each(GRAPHICS)('%s reaches 3:1 against --surface', (name) => {
    expect(contrastRatio(tokens[name], tokens['--surface'])).toBeGreaterThanOrEqual(3);
  });
});
