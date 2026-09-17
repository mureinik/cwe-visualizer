# Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visualizer's unstyled default markup with a design token system, a graph-first shell built around an ego-graph canvas, a restyled tree drawer, ranked search, and a card-based detail panel.

**Architecture:** All new logic lands as pure functions in `src/lib/` (`theme`, `shapes`, `search`, `ego`, `layout`), each unit-tested with no DOM, and thin React components render them. The ego graph is hand-rolled layered SVG — no force simulation, no graph library, no new runtime dependency. Styling is plain CSS driven by custom properties, using the BEM convention already in the codebase.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict), Vitest 4 + jsdom, React Testing Library, plain CSS custom properties.

**Spec:** [`docs/superpowers/specs/2026-09-16-visual-redesign-design.md`](../specs/2026-09-16-visual-redesign-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **The app must never contact MITRE at runtime.** It reads the prebuilt `public/data/cwe.json` and nothing else.
- **No new runtime dependencies.** No graph library, no force simulation, no CSS framework, no CSS-in-JS, no web fonts.
- **`public/data/` is gitignored build output.** Never edit it by hand; regenerate with `npm run prepare-data`. Test fixtures go in `test/fixtures/`.
- **Keep the MITRE attribution.** `NOTICE`, the attribution sections of `README.md` and `LICENSE`, and the `<Attribution>` footer must survive, and the footer must stay reachable wherever CWE data is displayed.
- **Never use `--no-verify`.** The pre-commit hook runs `lint-staged` and the full test suite. If it blocks you, fix the cause.
- **Verification gate:** `npm run lint && npx tsc --noEmit && npm test` — run before claiming any task is done. Prefer this over `npm run build`, which re-downloads the CWE corpus.
- **CSS class naming is BEM**, matching the existing `tree-row--selected`, `search-results__empty`, `detail-panel--empty`.
- **Colour is never the only encoder.** Abstraction is always shape *and* colour.
- **Contrast:** text ≥ 4.5:1, node strokes and edges ≥ 3:1, **in both themes**.
- **`prefers-reduced-motion` disables all transitions.**
- **TypeScript is strict** with `noUnusedLocals` and `noUnusedParameters` — unused imports and parameters are build failures, not warnings.
- **Branch:** all work goes on the existing `docs/visual-redesign-design` branch (PR #30, issue #29). **PR #30 stays a draft** for the duration of this plan.
- **Commit trailer:** end every commit message with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Do not add a `Claude-Session` line.

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/styles/tokens.css` | Every colour defined twice (light + dark), plus space, radius, type, and motion scales |
| `src/styles/base.css` | Reset, `body`, `:focus-visible`, reduced-motion guard |
| `src/styles/app.css` | Shell grid, header, stage, footer |
| `src/lib/theme.ts` | Read, persist, and apply the theme preference |
| `src/lib/shapes.ts` | Registry mapping abstraction → glyph shape + colour token |
| `src/lib/search.ts` | Ranked search, lifted out of `graph.ts` |
| `src/lib/ego.ts` | `buildEgoGraph` — asymmetric-radius neighbourhood extraction |
| `src/lib/layout.ts` | `layoutEgoGraph` — bands → x/y coordinates and edge paths |
| `src/components/Glyph.tsx` | Renders one abstraction glyph as SVG |
| `src/components/AppHeader.tsx` | Drawer toggle, wordmark, search slot, version chip, theme toggle |
| `src/components/ThemeToggle.tsx` | The ☀/☾ control |
| `src/components/Attribution.tsx` | The MITRE footer, extracted from `App.tsx` |
| `src/components/TreeDrawer.tsx` | Off-canvas panel wrapping `Tree`, with focus trap |
| `src/components/GraphStage.tsx` | `ResizeObserver`, SVG root, keyboard model, live region |
| `src/components/GraphNode.tsx` | One positioned node |
| `src/components/GraphEdge.tsx` | One positioned edge |

**Modified:** `scripts/prepare-data.ts` (carry `View_ID`), `src/lib/graph.ts` (explicit roots, `viewId`, drop `searchNodes`), `src/App.tsx` (shell), `src/components/Tree.tsx` (presentation only), `src/components/SearchBox.tsx` (combobox), `src/components/DetailPanel.tsx` (card), `src/main.tsx` (stylesheet imports), `src/index.css` (deleted, superseded).

**Phases** (from the spec's Delivery section): Tasks 1–3 foundation · Tasks 4–6 data seams · Tasks 7–10 shell and restyle · Tasks 11–13 the graph · Tasks 14–16 accessibility, responsive, and interaction.

---

### Task 1: Design tokens and base stylesheet

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Create: `test/helpers/contrast.ts`, `test/styles/tokens.test.ts`
- Modify: `src/main.tsx`
- Delete: `src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: the CSS custom properties every later task styles against — `--bg`, `--surface`, `--surface-raised`, `--border`, `--border-strong`, `--text`, `--text-secondary`, `--text-muted`, `--abs-pillar|class|base|variant|compound`, `--status-stable|draft|incomplete|deprecated`, `--rel-hierarchy|peer|sequence|requires`, `--space-1..6`, `--radius-sm|md|lg`, `--text-xs..3xl`, `--dur-fast`, `--dur`, `--ease`. Also `test/helpers/contrast.ts` exporting `contrastRatio(hexA, hexB): number` and `readTokens(css, selector): Record<string, string>`.

- [ ] **Step 1: Write the failing contrast test helper and test**

Create `test/helpers/contrast.ts`:

```ts
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
```

Create `test/styles/tokens.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/styles/tokens.test.ts`
Expected: FAIL — `ENOENT: no such file or directory` for `src/styles/tokens.css`.

- [ ] **Step 3: Write `src/styles/tokens.css`**

Note the dark block is written **twice**: once under `prefers-color-scheme` guarded by `:root:not([data-theme='light'])`, and once under `:root[data-theme='dark']`. That pairing is what lets a manual override coexist with the OS setting. The test reads the `[data-theme='dark']` block, so the two must stay in sync.

```css
:root {
  color-scheme: light;

  --bg: #ffffff;
  --surface: #f4f4f5;
  --surface-raised: #ffffff;
  --border: #d4d4d8;
  --border-strong: #a1a1aa;

  --text: #09090b;
  --text-secondary: #3f3f46;
  --text-muted: #52525b;

  --abs-pillar: #6d28d9;
  --abs-class: #1d4ed8;
  --abs-base: #047857;
  --abs-variant: #a16207;
  --abs-compound: #be123c;

  --status-stable: #047857;
  --status-draft: #1d4ed8;
  --status-incomplete: #6d28d9;
  --status-deprecated: #52525b;

  --rel-hierarchy: #3f3f46;
  --rel-peer: #6d28d9;
  --rel-sequence: #1d4ed8;
  --rel-requires: #a16207;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --text-xs: 0.75rem;
  --text-sm: 0.8125rem;
  --text-md: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5rem;
  --text-2xl: 2rem;
  --text-3xl: 2.5rem;

  --dur-fast: 120ms;
  --dur: 200ms;
  --ease: cubic-bezier(0.2, 0, 0.2, 1);

  --font-sans: system-ui, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    color-scheme: dark;

    --bg: #18181b;
    --surface: #27272a;
    --surface-raised: #323238;
    --border: #3f3f46;
    --border-strong: #71717a;

    --text: #fafafa;
    --text-secondary: #d4d4d8;
    --text-muted: #a1a1aa;

    --abs-pillar: #c4b5fd;
    --abs-class: #93c5fd;
    --abs-base: #6ee7b7;
    --abs-variant: #fcd34d;
    --abs-compound: #fda4af;

    --status-stable: #6ee7b7;
    --status-draft: #93c5fd;
    --status-incomplete: #c4b5fd;
    --status-deprecated: #a1a1aa;

    --rel-hierarchy: #d4d4d8;
    --rel-peer: #c4b5fd;
    --rel-sequence: #93c5fd;
    --rel-requires: #fcd34d;
  }
}

:root[data-theme='dark'] {
  color-scheme: dark;

  --bg: #18181b;
  --surface: #27272a;
  --surface-raised: #323238;
  --border: #3f3f46;
  --border-strong: #71717a;

  --text: #fafafa;
  --text-secondary: #d4d4d8;
  --text-muted: #a1a1aa;

  --abs-pillar: #c4b5fd;
  --abs-class: #93c5fd;
  --abs-base: #6ee7b7;
  --abs-variant: #fcd34d;
  --abs-compound: #fda4af;

  --status-stable: #6ee7b7;
  --status-draft: #93c5fd;
  --status-incomplete: #c4b5fd;
  --status-deprecated: #a1a1aa;

  --rel-hierarchy: #d4d4d8;
  --rel-peer: #c4b5fd;
  --rel-sequence: #93c5fd;
  --rel-requires: #fcd34d;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/styles/tokens.test.ts`
Expected: PASS.

If any assertion fails, adjust that token's lightness — darken for light theme, lighten for dark — and re-run. Do not lower the thresholds.

- [ ] **Step 5: Write `src/styles/base.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: 1.5;
}

:focus-visible {
  outline: 2px solid var(--abs-class);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

- [ ] **Step 6: Swap the stylesheet imports**

In `src/main.tsx`, replace `import './index.css';` with:

```ts
import './styles/tokens.css';
import './styles/base.css';
```

Then delete the superseded file: `git rm src/index.css`

- [ ] **Step 7: Run the full gate**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass. The existing 44 tests are unaffected — none of them assert on styling.

- [ ] **Step 8: Commit**

```bash
git add src/styles test/helpers test/styles src/main.tsx
git add -u src/index.css
git commit -m "$(cat <<'EOF'
feat: add design tokens and base stylesheet

Define every colour twice, for light and dark, with the dark block written
under both prefers-color-scheme and an explicit data-theme override so a
manual toggle can coexist with the OS setting.

Contrast is enforced by test rather than by eye: tokens.test.ts parses the
stylesheet and asserts 4.5:1 for text and 3:1 for graphics against both
--bg and --surface, in both themes. An untested contrast requirement drifts
the first time someone nudges a hue.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Theme preference and toggle

**Files:**
- Create: `src/lib/theme.ts`, `test/lib/theme.test.ts`
- Create: `src/components/ThemeToggle.tsx`, `test/components/ThemeToggle.test.tsx`

**Interfaces:**
- Consumes: the tokens from Task 1 (specifically that `:root[data-theme='dark']` exists).
- Produces:
  - `export type Theme = 'light' | 'dark'`
  - `export const THEME_STORAGE_KEY = 'cwe-visualizer-theme'`
  - `export function readStoredTheme(): Theme | null`
  - `export function storeTheme(theme: Theme): void`
  - `export function applyTheme(theme: Theme): void` — sets `data-theme` on `document.documentElement`
  - `export function systemTheme(): Theme`
  - `<ThemeToggle />` — takes no props.

- [ ] **Step 1: Write the failing test for `theme.ts`**

Create `test/lib/theme.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  readStoredTheme,
  storeTheme,
  applyTheme,
  systemTheme,
} from '../../src/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing has been stored', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('round-trips a stored preference', () => {
    storeTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignores a stored value that is not a known theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    expect(readStoredTheme()).toBeNull();
  });

  it('returns null rather than throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    expect(readStoredTheme()).toBeNull();
  });

  it('does not throw when storage rejects a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeTheme('dark')).not.toThrow();
  });

  it('applies the theme to the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reads the system preference from matchMedia', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('dark'), media: query }))
    );
    expect(systemTheme()).toBe('dark');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(systemTheme()).toBe('light');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/theme.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/theme`.

- [ ] **Step 3: Write `src/lib/theme.ts`**

```ts
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cwe-visualizer-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

/**
 * Every storage access is wrapped: a private window, cleared site data, or a
 * blocked-cookies setting makes these throw rather than return null, and a
 * theme preference is never worth breaking the app over.
 */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Preference simply won't persist; the session still honours it.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function systemTheme(): Theme {
  if (typeof matchMedia !== 'function') return 'light';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/theme.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Write the failing test for `ThemeToggle`**

Create `test/components/ThemeToggle.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { THEME_STORAGE_KEY } from '../../src/lib/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('exposes the theme it will switch to', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument();
  });

  it('flips the document theme and persists it when clicked', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run test/components/ThemeToggle.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/ThemeToggle`.

- [ ] **Step 7: Write `src/components/ThemeToggle.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { applyTheme, readStoredTheme, storeTheme, systemTheme, type Theme } from '../lib/theme';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? systemTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Switch to ${next} theme`}
      onClick={() => {
        storeTheme(next);
        setTheme(next);
      }}
    >
      <span aria-hidden="true">{theme === 'dark' ? '☾' : '☀'}</span>
    </button>
  );
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run test/components/ThemeToggle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/theme.ts src/components/ThemeToggle.tsx test/lib/theme.test.ts test/components/ThemeToggle.test.tsx
git commit -m "$(cat <<'EOF'
feat: add theme preference and toggle

Persist a light/dark override in localStorage, falling back to the OS
preference. Every storage access is wrapped in try/catch: a private window
or blocked site data makes these throw, and a theme preference is never
worth breaking the app over.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Abstraction glyph registry

**Files:**
- Create: `src/lib/shapes.ts`, `test/lib/shapes.test.ts`
- Create: `src/components/Glyph.tsx`, `test/components/Glyph.test.tsx`

**Interfaces:**
- Consumes: the `--abs-*` and `--status-deprecated` tokens from Task 1.
- Produces:
  - `export type ShapeName = 'diamond' | 'ringed-circle' | 'circle' | 'hollow-circle' | 'hexagon' | 'square'`
  - `export interface Glyph { shape: ShapeName; token: string; label: string }`
  - `export const GLYPHS: Record<string, Glyph>` — keyed by abstraction
  - `export const FALLBACK_GLYPH: Glyph`
  - `export function glyphFor(abstraction: string): Glyph`
  - `<Glyph abstraction={string} size={number} deprecated={boolean} />` — renders SVG, `aria-hidden`.

This is the registry the spec calls for: adding a `Category` entry later is a one-line data addition here, not a code change.

- [ ] **Step 1: Write the failing test for `shapes.ts`**

Create `test/lib/shapes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GLYPHS, FALLBACK_GLYPH, glyphFor } from '../../src/lib/shapes';

describe('glyphFor', () => {
  it('maps each CWE abstraction to a distinct shape', () => {
    const shapes = ['Pillar', 'Class', 'Base', 'Variant', 'Compound'].map((a) => glyphFor(a).shape);
    expect(new Set(shapes).size).toBe(5);
  });

  it('gives each abstraction its own colour token', () => {
    expect(glyphFor('Pillar').token).toBe('--abs-pillar');
    expect(glyphFor('Class').token).toBe('--abs-class');
    expect(glyphFor('Base').token).toBe('--abs-base');
    expect(glyphFor('Variant').token).toBe('--abs-variant');
    expect(glyphFor('Compound').token).toBe('--abs-compound');
  });

  it('distinguishes Class from Base by shape, not only by colour', () => {
    expect(glyphFor('Class').shape).not.toBe(glyphFor('Base').shape);
  });

  it('falls back for an unknown abstraction rather than throwing', () => {
    expect(glyphFor('Category')).toEqual(FALLBACK_GLYPH);
    expect(glyphFor('')).toEqual(FALLBACK_GLYPH);
  });

  it('keeps the registry open for future node kinds', () => {
    expect(Object.keys(GLYPHS)).toEqual(['Pillar', 'Class', 'Base', 'Variant', 'Compound']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/shapes.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/shapes`.

- [ ] **Step 3: Write `src/lib/shapes.ts`**

```ts
export type ShapeName = 'diamond' | 'ringed-circle' | 'circle' | 'hollow-circle' | 'hexagon' | 'square';

export interface Glyph {
  shape: ShapeName;
  /** CSS custom property supplying this glyph's colour. */
  token: string;
  /** Human-readable name, used in accessible labels. */
  label: string;
}

/**
 * Keyed by CWE abstraction. Adding MITRE's Category or View constructs later
 * is an entry here plus a token, not a change to any consumer — every
 * renderer goes through glyphFor().
 */
export const GLYPHS: Record<string, Glyph> = {
  Pillar: { shape: 'diamond', token: '--abs-pillar', label: 'Pillar' },
  Class: { shape: 'ringed-circle', token: '--abs-class', label: 'Class' },
  Base: { shape: 'circle', token: '--abs-base', label: 'Base' },
  Variant: { shape: 'hollow-circle', token: '--abs-variant', label: 'Variant' },
  Compound: { shape: 'hexagon', token: '--abs-compound', label: 'Compound' },
};

export const FALLBACK_GLYPH: Glyph = {
  shape: 'square',
  token: '--text-muted',
  label: 'Unknown',
};

export function glyphFor(abstraction: string): Glyph {
  return GLYPHS[abstraction] ?? FALLBACK_GLYPH;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/shapes.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing test for `Glyph`**

Create `test/components/Glyph.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Glyph } from '../../src/components/Glyph';

describe('Glyph', () => {
  it('renders a polygon for a Pillar diamond', () => {
    const { container } = render(<Glyph abstraction="Pillar" size={16} />);
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders two circles for the Class ring', () => {
    const { container } = render(<Glyph abstraction="Class" size={16} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('is hidden from assistive technology, since its meaning is in the text label', () => {
    const { container } = render(<Glyph abstraction="Base" size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks deprecated glyphs with a modifier class', () => {
    const { container } = render(<Glyph abstraction="Base" size={16} deprecated />);
    expect(container.querySelector('svg')).toHaveClass('glyph--deprecated');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run test/components/Glyph.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/Glyph`.

- [ ] **Step 7: Write `src/components/Glyph.tsx`**

```tsx
import { glyphFor, type ShapeName } from '../lib/shapes';

interface GlyphProps {
  abstraction: string;
  size?: number;
  deprecated?: boolean;
}

function shapeElements(shape: ShapeName, r: number) {
  switch (shape) {
    case 'diamond':
      return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill="currentColor" />;
    case 'ringed-circle':
      return (
        <>
          <circle r={r} fill="none" stroke="currentColor" strokeWidth={r * 0.3} />
          <circle r={r * 0.4} fill="currentColor" />
        </>
      );
    case 'circle':
      return <circle r={r * 0.8} fill="currentColor" />;
    case 'hollow-circle':
      return <circle r={r * 0.7} fill="none" stroke="currentColor" strokeWidth={r * 0.3} />;
    case 'hexagon': {
      const points = [0, 1, 2, 3, 4, 5]
        .map((i) => {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          return `${(r * Math.cos(angle)).toFixed(2)},${(r * Math.sin(angle)).toFixed(2)}`;
        })
        .join(' ');
      return <polygon points={points} fill="currentColor" />;
    }
    case 'square':
      return <rect x={-r * 0.7} y={-r * 0.7} width={r * 1.4} height={r * 1.4} fill="currentColor" />;
  }
}

export function Glyph({ abstraction, size = 16, deprecated = false }: GlyphProps) {
  const glyph = glyphFor(abstraction);
  const r = size / 2;
  return (
    <svg
      className={`glyph${deprecated ? ' glyph--deprecated' : ''}`}
      width={size}
      height={size}
      viewBox={`${-r} ${-r} ${size} ${size}`}
      aria-hidden="true"
      style={{ color: deprecated ? 'var(--status-deprecated)' : `var(${glyph.token})` }}
    >
      {shapeElements(glyph.shape, r)}
    </svg>
  );
}
```

Add to `src/styles/base.css`:

```css
.glyph {
  flex: none;
  vertical-align: middle;
}

.glyph--deprecated {
  opacity: 0.6;
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run test/components/Glyph.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/shapes.ts src/components/Glyph.tsx src/styles/base.css test/lib/shapes.test.ts test/components/Glyph.test.tsx
git commit -m "$(cat <<'EOF'
feat: add abstraction glyph registry

Encode abstraction by shape as well as colour, so the tree and graph stay
legible to a colourblind reader and survive the hue shifts between light and
dark. Class and Base get genuinely different shapes rather than two sizes of
the same circle.

The registry is keyed by abstraction and every renderer goes through
glyphFor(), so adding MITRE's Category construct later is a data addition
rather than a change to any consumer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---
### Task 4: Carry `View_ID` through the data pipeline

**Files:**
- Modify: `scripts/prepare-data.ts:33-36` (`RawRelatedWeakness`), `scripts/prepare-data.ts:15-19` (`CweEdge`), `scripts/prepare-data.ts:88-94` (edge construction)
- Modify: `src/lib/graph.ts:10-14` (`CweEdge`)
- Modify: `test/scripts/prepare-data.test.ts:58-64`

**Interfaces:**
- Consumes: nothing.
- Produces: `CweEdge` gains `viewId?: string` in **both** `scripts/prepare-data.ts` and `src/lib/graph.ts`. The two interfaces are intentionally duplicated today (the script is Node, `src/` is browser) — keep them in sync.

This is seam #1 from the spec. `View_ID` is already present on every `Related_Weakness` in MITRE's XML — including the test fixture, which needs no change — and `parseCatalog` currently drops it. Nothing consumes `viewId` in this plan; it is carried so that adding Categories and Views later never has to touch the pipeline.

- [ ] **Step 1: Update the existing edge assertion to expect `viewId`**

In `test/scripts/prepare-data.test.ts`, replace the body of `'builds an edge per Related_Weakness with its nature as the type'`:

```ts
  it('builds an edge per Related_Weakness with its nature as the type', () => {
    const edgesFrom79 = data.edges.filter((e) => e.from === '79');
    expect(edgesFrom79).toEqual([
      { from: '79', to: '74', type: 'ChildOf', viewId: '1000' },
      { from: '79', to: '80', type: 'PeerOf', viewId: '1000' },
    ]);
  });

  it('leaves viewId undefined when a relation declares no View_ID', () => {
    const xml = `<Weakness_Catalog Version="4.15" Date="2024-11-19"><Weaknesses>
      <Weakness ID="1" Name="A" Abstraction="Base" Status="Draft"><Description>d</Description>
        <Related_Weaknesses><Related_Weakness Nature="ChildOf" CWE_ID="2"/></Related_Weaknesses>
      </Weakness></Weaknesses></Weakness_Catalog>`;
    expect(parseCatalog(xml, '"x"').edges[0].viewId).toBeUndefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: FAIL — the first assertion reports missing `viewId: '1000'` on both edges.

- [ ] **Step 3: Carry the attribute through `prepare-data.ts`**

Change `CweEdge`:

```ts
export interface CweEdge {
  from: string;
  to: string;
  type: string;
  /**
   * MITRE scopes each relation to a view (1000 = Research Concepts, and so
   * on). Nothing reads this yet; it is carried so that adding Categories and
   * Views later is additive rather than a pipeline change.
   */
  viewId?: string;
}
```

Change `RawRelatedWeakness`:

```ts
interface RawRelatedWeakness {
  '@_Nature': string;
  '@_CWE_ID': string;
  '@_View_ID'?: string;
}
```

Change the edge construction inside the `for (const rel of relatedList)` loop:

```ts
    for (const rel of relatedList) {
      const edge: CweEdge = {
        from: id,
        to: String(rel['@_CWE_ID']),
        type: rel['@_Nature'],
      };
      if (rel['@_View_ID'] !== undefined) {
        edge.viewId = String(rel['@_View_ID']);
      }
      edges.push(edge);
    }
```

Assigning conditionally rather than unconditionally keeps `viewId` genuinely absent (not `undefined`) when MITRE omits it.

- [ ] **Step 4: Mirror the type in `src/lib/graph.ts`**

```ts
export interface CweEdge {
  from: string;
  to: string;
  type: string;
  /** See the matching comment in scripts/prepare-data.ts. */
  viewId?: string;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/scripts/prepare-data.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add scripts/prepare-data.ts src/lib/graph.ts test/scripts/prepare-data.test.ts
git commit -m "$(cat <<'EOF'
feat: carry View_ID through the data pipeline

MITRE scopes every Related_Weakness to a view, and parseCatalog was dropping
the attribute. Nothing reads viewId yet — it is carried so that adding
Categories and Views later is purely additive instead of a pipeline change
plus a re-derivation of the whole graph.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Explicit roots, with deprecated entries separated

**Files:**
- Modify: `src/lib/graph.ts:28-36` (`Graph`), `src/lib/graph.ts:66-97` (`buildGraph`)
- Modify: `test/lib/graph.test.ts`

**Interfaces:**
- Consumes: `CweEdge.viewId` from Task 4 (present but unused here).
- Produces:
  - `export interface BuildGraphOptions { rootIds?: string[] }`
  - `export function buildGraph(data: CweData, options?: BuildGraphOptions): Graph`
  - `Graph.roots: string[]` — top-level entries to display, deprecated excluded
  - `Graph.deprecatedRoots: string[]` — orphaned deprecated entries, for a collapsed group

This is seam #2. Against the real 4.20 corpus the split is exact: 35 parentless nodes = 10 Pillars + 25 entries with `status === 'Deprecated'`, and all 25 deprecated entries are parentless. Status is the signal — not the `DEPRECATED:` name prefix, which merely happens to correlate.

- [ ] **Step 1: Write the failing tests**

Append to `test/lib/graph.test.ts`:

```ts
describe('buildGraph roots', () => {
  const withDeprecated: CweData = {
    meta: sampleData.meta,
    nodes: {
      '284': { id: '284', name: 'Improper Access Control', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
      '285': { id: '285', name: 'Improper Authorization', abstraction: 'Class', status: 'Draft', description: '', url: '' },
      '71': { id: '71', name: "DEPRECATED: Apple '.DS_Store'", abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
    },
    edges: [{ from: '285', to: '284', type: 'ChildOf' }],
  };

  it('keeps live parentless nodes in roots', () => {
    expect(buildGraph(withDeprecated).roots).toEqual(['284']);
  });

  it('moves parentless deprecated nodes into deprecatedRoots', () => {
    expect(buildGraph(withDeprecated).deprecatedRoots).toEqual(['71']);
  });

  it('sorts both root lists numerically', () => {
    const data: CweData = {
      meta: sampleData.meta,
      nodes: {
        '1000': { id: '1000', name: 'A', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
        '99': { id: '99', name: 'B', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
      },
      edges: [],
    };
    expect(buildGraph(data).roots).toEqual(['99', '1000']);
  });

  it('accepts an explicit root set, which a view would supply', () => {
    const graph = buildGraph(withDeprecated, { rootIds: ['285'] });
    expect(graph.roots).toEqual(['285']);
    expect(graph.deprecatedRoots).toEqual([]);
  });

  it('ignores explicit root ids that are not in the corpus', () => {
    expect(buildGraph(withDeprecated, { rootIds: ['285', '99999'] }).roots).toEqual(['285']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/lib/graph.test.ts`
Expected: FAIL — `graph.deprecatedRoots` is `undefined`, and `buildGraph` takes one argument.

- [ ] **Step 3: Implement explicit roots**

In `src/lib/graph.ts`, add `deprecatedRoots` to `Graph`:

```ts
export interface Graph {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  childrenOf: Map<string, string[]>;
  parentsOf: Map<string, string[]>;
  relatedTo: Map<string, CweEdge[]>;
  /** Top-level entries to display. Deprecated orphans are not here. */
  roots: string[];
  /**
   * Parentless entries MITRE has deprecated. Kept separate so they can be
   * shown in one collapsed group instead of interleaved by ID at the top of
   * the tree, which is what they do today.
   */
  deprecatedRoots: string[];
  all: CweNode[];
}

export interface BuildGraphOptions {
  /**
   * Declared top-level entries. A view supplies its members here; with no
   * options, roots are derived as "has no parent", which is what the
   * Research Concepts hierarchy amounts to.
   */
  rootIds?: string[];
}
```

Replace the root derivation near the end of `buildGraph` with:

```ts
  const byId = (a: string, b: string) => Number(a) - Number(b);
  const isDeprecated = (id: string) => data.nodes[id]?.status === 'Deprecated';

  let roots: string[];
  let deprecatedRoots: string[];

  if (options?.rootIds) {
    roots = options.rootIds.filter((id) => id in data.nodes).sort(byId);
    deprecatedRoots = [];
  } else {
    const parentless = Object.keys(data.nodes).filter((id) => (parentsOf.get(id) ?? []).length === 0);
    roots = parentless.filter((id) => !isDeprecated(id)).sort(byId);
    deprecatedRoots = parentless.filter(isDeprecated).sort(byId);
  }
```

and update the signature and return:

```ts
export function buildGraph(data: CweData, options?: BuildGraphOptions): Graph {
```

```ts
  return { meta: data.meta, nodes: data.nodes, childrenOf, parentsOf, relatedTo, roots, deprecatedRoots, all };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/lib/graph.test.ts`
Expected: PASS. The pre-existing root assertions still hold — node `74` has status `Incomplete` and node `1` has status `''`, so neither is deprecated.

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/graph.ts test/lib/graph.test.ts
git commit -m "$(cat <<'EOF'
feat: make graph roots explicit and separate deprecated orphans

The tree derived its roots as "has no parent", which puts 35 entries at the
top level of the real corpus — 10 Pillars and 25 deprecated orphans,
interleaved by ID, so the first screen is a run of DEPRECATED entries.

Split them: roots holds the live top-level entries, deprecatedRoots holds
the orphans for a collapsed group. buildGraph also now accepts an explicit
root set, which is the seam a view switcher needs — a view's roots are its
declared members rather than an artefact of edge direction.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Ranked search

**Files:**
- Create: `src/lib/search.ts`, `test/lib/search.test.ts`
- Modify: `src/lib/graph.ts` (remove `searchNodes`), `src/components/SearchBox.tsx:3` (import path)
- Modify: `test/lib/graph.test.ts` (remove the `searchNodes` describe block and its import)

**Interfaces:**
- Consumes: `Graph`, `CweNode` from `src/lib/graph.ts`.
- Produces: `export function searchNodes(graph: Graph, query: string): CweNode[]` — same signature as the old one, now ordered by relevance and capped by the caller as before.

Today `searchNodes` is an unranked substring filter over `graph.all`, which is ID-ascending — so typing `79` returns CWE-79 buried among 179, 279, 379, 579.

- [ ] **Step 1: Write the failing test**

Create `test/lib/search.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { searchNodes } from '../../src/lib/search';

const node = (id: string, name: string, status = 'Stable') => ({
  id, name, abstraction: 'Base', status, description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': node('79', 'Cross-site Scripting'),
    '179': node('179', 'Incorrect Behavior Order'),
    '279': node('279', 'Incorrect Execution-Assigned Permissions'),
    '789': node('789', 'Memory Allocation with Excessive Size Value'),
    '89': node('89', 'SQL Injection'),
    '943': node('943', 'Improper Neutralization in Data Query Logic'),
    '71': node('71', 'DEPRECATED: Apple .DS_Store', 'Deprecated'),
  },
  edges: [],
};

const graph = buildGraph(data);
const ids = (query: string) => searchNodes(graph, query).map((n) => n.id);

describe('searchNodes', () => {
  it('ranks an exact id match first', () => {
    expect(ids('79')[0]).toBe('79');
  });

  it('ranks id-prefix matches above mere substring matches', () => {
    expect(ids('79').indexOf('789')).toBeLessThan(ids('79').indexOf('179'));
  });

  it('ranks a name-start match above a name-contains match', () => {
    const result = ids('sql');
    expect(result[0]).toBe('89');
  });

  it('matches names case-insensitively', () => {
    expect(ids('INJECTION')).toContain('89');
  });

  it('ranks deprecated entries last', () => {
    expect(ids('a').at(-1)).toBe('71');
  });

  it('returns an empty array for a blank query', () => {
    expect(ids('   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(ids('zzzzz')).toEqual([]);
  });

  it('breaks ties by ascending id, so results are stable', () => {
    expect(ids('incorrect')).toEqual(['179', '279']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/search.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/search`.

- [ ] **Step 3: Write `src/lib/search.ts`**

```ts
import type { CweNode, Graph } from './graph';

/** Lower sorts first. */
function rank(node: CweNode, query: string): number {
  const id = node.id;
  const name = node.name.toLowerCase();

  if (id === query) return 0;
  if (id.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (id.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function searchNodes(graph: Graph, query: string): CweNode[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === '') return [];

  return graph.all
    .map((node) => ({ node, rank: rank(node, trimmed) }))
    .filter((scored) => scored.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => {
      // Deprecated entries are still findable, but never ahead of a live one.
      const aDeprecated = a.node.status === 'Deprecated' ? 1 : 0;
      const bDeprecated = b.node.status === 'Deprecated' ? 1 : 0;
      if (aDeprecated !== bDeprecated) return aDeprecated - bDeprecated;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return Number(a.node.id) - Number(b.node.id);
    })
    .map((scored) => scored.node);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/search.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Remove the old implementation and repoint its consumers**

In `src/lib/graph.ts`, delete the entire `searchNodes` function (the last export in the file).

In `src/components/SearchBox.tsx`, replace:

```ts
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/graph';
```

with:

```ts
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/search';
```

In `test/lib/graph.test.ts`, delete the whole `describe('searchNodes', ...)` block and drop `searchNodes` from the import at the top, leaving:

```ts
import { buildGraph, ancestorsOf, type CweData } from '../../src/lib/graph';
```

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass. `SearchBox.test.tsx` is unchanged and still passes — the signature is identical, only the ordering improved.

```bash
git add src/lib/search.ts src/lib/graph.ts src/components/SearchBox.tsx test/lib/search.test.ts test/lib/graph.test.ts
git commit -m "$(cat <<'EOF'
feat: rank search results

searchNodes was an unranked substring filter over an ID-ascending list, so
typing "79" returned CWE-79 buried among 179, 279, 379 and 579. Rank by
exact id, id prefix, name start, then substring, with deprecated entries
last and ties broken by id so results are stable.

Moved out of graph.ts into its own module: graph.ts builds indices, and
relevance ranking is a separate concern with its own tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---
### Task 7: Application shell and header

**Files:**
- Create: `src/styles/app.css`, `src/components/AppHeader.tsx`, `src/components/Attribution.tsx`
- Create: `test/components/AppHeader.test.tsx`
- Modify: `src/App.tsx` (extract `Attribution`, adopt the shell), `src/main.tsx` (import `app.css`)
- Modify: `test/App.test.tsx`

**Interfaces:**
- Consumes: `ThemeToggle` (Task 2), `SearchBox` (existing), `Graph` (Task 5).
- Produces:
  - `<AppHeader graph={Graph} onSelect={(id: string) => void} />`
  - `<Attribution />` — the MITRE footer, moved out of `App.tsx` unchanged in content.

The footer stays visible: `CLAUDE.md` requires the attribution to remain reachable wherever CWE data is displayed, and a full-viewport stage has no document flow to host it. It becomes a pinned 28px bar.

- [ ] **Step 1: Write the failing header test**

Create `test/components/AppHeader.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../../src/components/AppHeader';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [],
};

describe('AppHeader', () => {
  it('shows the product name', () => {
    render(<AppHeader graph={buildGraph(data)} onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument();
  });

  it('shows which corpus version is loaded', () => {
    render(<AppHeader graph={buildGraph(data)} onSelect={() => {}} />);
    expect(screen.getByText('CWE 4.20')).toBeInTheDocument();
  });

  it('includes the search box and the theme toggle', () => {
    render(<AppHeader graph={buildGraph(data)} onSelect={() => {}} />);
    expect(screen.getByLabelText('Search CWEs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to (light|dark) theme/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/components/AppHeader.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/AppHeader`.

- [ ] **Step 3: Write `src/components/AppHeader.tsx`**

```tsx
import type { Graph } from '../lib/graph';
import { SearchBox } from './SearchBox';
import { ThemeToggle } from './ThemeToggle';

interface AppHeaderProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

export function AppHeader({ graph, onSelect }: AppHeaderProps) {
  return (
    <header className="app-header">
      <h1 className="app-header__title">CWE Visualizer</h1>
      <div className="app-header__search">
        <SearchBox graph={graph} onSelect={onSelect} />
      </div>
      <span className="app-header__version">CWE {graph.meta.cweVersion}</span>
      <ThemeToggle />
    </header>
  );
}
```

- [ ] **Step 4: Write `src/components/Attribution.tsx`**

Move the `Attribution` function out of `src/App.tsx` verbatim — same JSX, same links, same `<footer className="app-footer">` — into its own file with `export function Attribution()`. Do not reword it; `test/App.test.tsx` asserts on its text, and `CLAUDE.md` requires it kept.

- [ ] **Step 5: Write `src/styles/app.css`**

```css
.app {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100dvh;
  overflow: hidden;
}

.app-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.app-header__title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: 600;
  white-space: nowrap;
}

.app-header__search {
  flex: 1;
  min-width: 0;
  max-width: 32rem;
}

.app-header__version {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  white-space: nowrap;
}

.theme-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  cursor: pointer;
  font-size: var(--text-base);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
}

.app-stage {
  position: relative;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.app-footer {
  padding: var(--space-2) var(--space-4);
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--text-xs);
  line-height: 1.4;
}

.app-footer a {
  color: inherit;
}

.app-status {
  display: grid;
  place-items: center;
  height: 100dvh;
  color: var(--text-muted);
}

.app-status--error {
  color: var(--abs-compound);
}
```

Add `import './styles/app.css';` to `src/main.tsx`, after the `base.css` import.

- [ ] **Step 6: Adopt the shell in `src/App.tsx`**

Delete the local `Attribution` function, import the component, and replace the returned JSX:

```tsx
  return (
    <div className="app">
      <AppHeader graph={state.graph} onSelect={selectNode} />
      <main className="app-stage">
        <Tree graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
        <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
      </main>
      <Attribution />
    </div>
  );
```

with imports:

```tsx
import { AppHeader } from './components/AppHeader';
import { Attribution } from './components/Attribution';
```

and drop the now-unused `SearchBox` import from `App.tsx` — `noUnusedLocals` makes a leftover import a type-check failure.

- [ ] **Step 7: Run the full gate**

Run: `npm run lint && npx tsc --noEmit && npm test`
Expected: all pass, including the three existing `App` tests — the heading, the tree label, and the `contentinfo` footer assertions all still hold.

- [ ] **Step 8: Commit**

```bash
git add src/styles/app.css src/components/AppHeader.tsx src/components/Attribution.tsx src/App.tsx src/main.tsx test/components/AppHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat: add the application shell

Three fixed rows — header, stage, footer — so the stage can own its own
scrolling and, later, a full-height graph canvas.

The header surfaces the corpus version, which the app has been loading into
graph.meta and never displaying. The MITRE attribution becomes a pinned bar
rather than a document-flow footer: a full-viewport stage has nothing to
push it down, and hiding a legal attribution behind a disclosure isn't worth
the pixels saved.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Tree drawer and restyled rows

**Files:**
- Create: `src/components/TreeDrawer.tsx`, `src/styles/tree.css`
- Create: `test/components/TreeDrawer.test.tsx`
- Modify: `src/components/Tree.tsx` (presentation and the deprecated group only), `src/components/AppHeader.tsx` (drawer toggle), `src/App.tsx` (drawer state)
- Modify: `test/components/Tree.test.tsx`, `test/App.test.tsx`, `test/components/AppHeader.test.tsx`

**Interfaces:**
- Consumes: `Glyph` (Task 3), `Graph.roots` / `Graph.deprecatedRoots` (Task 5).
- Produces:
  - `<TreeDrawer open={boolean} onClose={() => void} graph={Graph} selectedId={string | null} onSelect={(id: string) => void} />`
  - `<AppHeader>` gains `onToggleDrawer: () => void` and `drawerOpen: boolean`.
  - Every tree label button carries `aria-label={`CWE-${id}: ${name}`}`, which is how tests address it now that the row is several elements.

**Do not touch** the `expanded`/`collapsed` state machine in `Tree.tsx`. Its override logic is subtle, correct, and commented; this task changes what a row looks like and which roots it starts from.

- [ ] **Step 1: Write the failing tests**

Create `test/components/TreeDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeDrawer } from '../../src/components/TreeDrawer';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '284': { id: '284', name: 'Improper Access Control', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
    '285': { id: '285', name: 'Improper Authorization', abstraction: 'Class', status: 'Draft', description: '', url: '' },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
  },
  edges: [{ from: '285', to: '284', type: 'ChildOf' }],
};

const graph = buildGraph(data);

describe('TreeDrawer', () => {
  it('renders nothing accessible when closed', () => {
    render(<TreeDrawer open={false} onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('renders the tree when open', () => {
    render(<TreeDrawer open onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-284: Improper Access Control' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<TreeDrawer open onClose={onClose} graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<TreeDrawer open onClose={onClose} graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the drawer when it opens', () => {
    render(<TreeDrawer open onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close the weakness tree' })).toHaveFocus();
  });
});
```

Append to `test/components/Tree.test.tsx`:

```tsx
describe('Tree presentation', () => {
  const withDeprecated: CweData = {
    meta: data.meta,
    nodes: {
      ...data.nodes,
      '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
      '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    },
    edges: [...data.edges, { from: '79', to: '20', type: 'ChildOf' }],
  };

  it('keeps deprecated orphans out of the top level', () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: 'CWE-71: DEPRECATED: DS_Store' })).not.toBeInTheDocument();
  });

  it('offers deprecated orphans in a collapsed group, with a count', async () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Deprecated (1)' }));
    expect(screen.getByRole('button', { name: 'CWE-71: DEPRECATED: DS_Store' })).toBeInTheDocument();
  });

  it('marks a node that appears under more than one parent', async () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByLabelText('CWE-79 also appears under 1 other parent')).toBeInTheDocument();
  });
});
```

Then update the four pre-existing `Tree` tests and the one `App` test that address rows by text: replace every `screen.getByText('CWE-74: Injection')` with `screen.getByRole('button', { name: 'CWE-74: Injection' })`, and likewise for `'CWE-79: Cross-site Scripting'` (using `queryByRole` where the original used `queryByText`).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/TreeDrawer.test.tsx test/components/Tree.test.tsx`
Expected: FAIL — cannot resolve `TreeDrawer`; the Tree tests fail on the missing `Deprecated (1)` group and the missing `aria-label`s.

- [ ] **Step 3: Restyle the tree row**

In `src/components/Tree.tsx`, import the glyph and replace the row markup inside `TreeNode`:

```tsx
import { Glyph } from './Glyph';
```

```tsx
  const parentCount = (graph.parentsOf.get(id) ?? []).length;
  const deprecated = node.status === 'Deprecated';

  return (
    <li role="treeitem" aria-expanded={children.length > 0 ? isExpanded : undefined}>
      <div className={`tree-row${isSelected ? ' tree-row--selected' : ''}`}>
        {children.length > 0 ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => onToggle(id)}
            aria-label={isExpanded ? `Collapse CWE-${id}` : `Expand CWE-${id}`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button
          type="button"
          className={`tree-label${deprecated ? ' tree-label--deprecated' : ''}`}
          onClick={() => onSelect(id)}
          aria-label={`CWE-${id}: ${node.name}`}
        >
          <Glyph abstraction={node.abstraction} size={14} deprecated={deprecated} />
          <span className="tree-label__id">CWE-{id}</span>
          <span className="tree-label__name">{node.name}</span>
        </button>
        {parentCount > 1 && (
          <span
            className="tree-row__multi"
            aria-label={`CWE-${id} also appears under ${parentCount - 1} other parent`}
          >
            ⧉
          </span>
        )}
      </div>
      {isExpanded && children.length > 0 && (
        <ul role="group">
          {children.map((childId) => (
            <TreeNode
              key={childId}
              id={childId}
              graph={graph}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              ancestry={childAncestry}
            />
          ))}
        </ul>
      )}
    </li>
  );
```

- [ ] **Step 4: Add the deprecated group**

In the `Tree` component's return, after mapping `graph.roots`, add a group driven by local state. Add `const [showDeprecated, setShowDeprecated] = useState(false);` beside the existing state hooks, then:

```tsx
  return (
    <ul className="tree" role="tree">
      {graph.roots.map((id) => (
        <TreeNode
          key={id}
          id={id}
          graph={graph}
          expanded={effectiveExpanded}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={onSelect}
          ancestry={new Set()}
        />
      ))}
      {graph.deprecatedRoots.length > 0 && (
        <li role="treeitem" aria-expanded={showDeprecated}>
          <div className="tree-row tree-row--group">
            <button
              type="button"
              className="tree-toggle"
              onClick={() => setShowDeprecated((open) => !open)}
              aria-label={`Deprecated (${graph.deprecatedRoots.length})`}
            >
              {showDeprecated ? '▾' : '▸'} Deprecated ({graph.deprecatedRoots.length})
            </button>
          </div>
          {showDeprecated && (
            <ul role="group">
              {graph.deprecatedRoots.map((id) => (
                <TreeNode
                  key={id}
                  id={id}
                  graph={graph}
                  expanded={effectiveExpanded}
                  selectedId={selectedId}
                  onToggle={toggle}
                  onSelect={onSelect}
                  ancestry={new Set()}
                />
              ))}
            </ul>
          )}
        </li>
      )}
    </ul>
  );
```

- [ ] **Step 5: Write `src/styles/tree.css`**

```css
.tree,
.tree ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.tree ul {
  margin-left: var(--space-4);
  border-left: 1px solid var(--border);
}

.tree-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-sm);
}

.tree-row--selected {
  background: var(--surface-raised);
  outline: 1px solid var(--border-strong);
}

.tree-toggle,
.tree-label {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: var(--space-1);
  text-align: left;
}

.tree-toggle,
.tree-toggle-spacer {
  flex: none;
  width: 1.5rem;
  color: var(--text-muted);
}

.tree-row--group .tree-toggle {
  width: auto;
  font-size: var(--text-sm);
}

.tree-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.tree-label:hover {
  background: var(--surface);
}

.tree-label__id {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex: none;
}

.tree-label__name {
  font-size: var(--text-md);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-label--deprecated .tree-label__name {
  color: var(--text-muted);
  text-decoration: line-through;
}

.tree-row__multi {
  flex: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
}
```

- [ ] **Step 6: Write `src/components/TreeDrawer.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { Graph } from '../lib/graph';
import { Tree } from './Tree';

interface TreeDrawerProps {
  open: boolean;
  onClose: () => void;
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TreeDrawer({ open, onClose, graph, selectedId, onSelect }: TreeDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" data-testid="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label="Weakness tree">
        <div className="drawer__header">
          <button
            type="button"
            ref={closeRef}
            className="drawer__close"
            onClick={onClose}
            aria-label="Close the weakness tree"
          >
            ✕
          </button>
        </div>
        <div className="drawer__body">
          <Tree graph={graph} selectedId={selectedId} onSelect={onSelect} />
        </div>
      </div>
    </>
  );
}
```

Append to `src/styles/tree.css`:

```css
.drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 40%);
  z-index: 1;
}

.drawer {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: min(22rem, 85vw);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-inline-end: 1px solid var(--border);
  z-index: 2;
}

.drawer__header {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-2);
}

.drawer__close {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: inherit;
  cursor: pointer;
  padding: var(--space-1) var(--space-2);
}

.drawer__body {
  overflow: auto;
  padding: var(--space-2);
}
```

- [ ] **Step 7: Wire the drawer into the shell**

In `src/components/AppHeader.tsx`, add the props and the toggle as the first child of the header:

```tsx
interface AppHeaderProps {
  graph: Graph;
  onSelect: (id: string) => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}
```

```tsx
      <button
        type="button"
        className="app-header__drawer-toggle"
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        aria-label="Weakness tree"
      >
        ☰
      </button>
```

In `src/App.tsx`, add `const [drawerOpen, setDrawerOpen] = useState(false);`, pass the two new props to `AppHeader`, and replace the bare `<Tree .../>` in the stage with:

```tsx
        <TreeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          graph={state.graph}
          selectedId={selectedId}
          onSelect={selectNode}
        />
```

swapping the `Tree` import for `TreeDrawer`. Add to `src/styles/app.css`:

```css
.app-header__drawer-toggle {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: inherit;
  cursor: pointer;
  font-size: var(--text-base);
  line-height: 1;
  padding: var(--space-1) var(--space-2);
}
```

and `import './styles/tree.css';` to `src/main.tsx`.

- [ ] **Step 8: Update the App tests for the drawer**

The tree is no longer visible on load. In `test/App.test.tsx`, change `'renders the header and tree once data has loaded'` to open the drawer first:

```tsx
  it('renders the header, and the tree once the drawer is opened', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Weakness tree' }));
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
  });
```

adding `import userEvent from '@testing-library/user-event';` at the top. Update `test/components/AppHeader.test.tsx` to pass the two new props (`drawerOpen={false} onToggleDrawer={() => {}}`) in all three renders.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/components/TreeDrawer.tsx src/components/Tree.tsx src/components/AppHeader.tsx src/App.tsx src/main.tsx src/styles test/components test/App.test.tsx
git commit -m "$(cat <<'EOF'
feat: move the tree into a drawer and restyle its rows

Rows now carry an abstraction glyph, a monospace id, and a marker on the 279
nodes that appear under more than one parent — the hierarchy is a DAG, and
the tree never admitted it.

Deprecated orphans move into one collapsed group. They are 25 of the corpus's
35 parentless entries, and sorting by id put them at the very top, so the
first screen was a run of DEPRECATED rows.

The expand/collapse state machine is untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---
### Task 9: Relation grouping and the detail card

**Files:**
- Create: `src/lib/relations.ts`, `test/lib/relations.test.ts`, `src/styles/detail.css`
- Modify: `src/components/DetailPanel.tsx` (rewritten), `test/components/DetailPanel.test.tsx` (rewritten), `src/main.tsx`

**Interfaces:**
- Consumes: `Glyph` (Task 3), `Graph` (Task 5).
- Produces:
  - `export type RelationGroup = 'sequence' | 'peer' | 'requires'`
  - `export interface RelationGroupSpec { key: RelationGroup; label: string; token: string }`
  - `export const RELATION_GROUPS: Record<RelationGroup, RelationGroupSpec>`
  - `export function relationGroup(type: string): RelationGroup`
  - `export function baseRelationType(type: string): string` — strips the `" (inverse)"` suffix `buildGraph` synthesizes

`relations.ts` is consumed again by `ego.ts` in Task 11, which is why it lands here rather than inside the component.

- [ ] **Step 1: Write the failing test for `relations.ts`**

Create `test/lib/relations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RELATION_GROUPS, relationGroup, baseRelationType } from '../../src/lib/relations';

describe('baseRelationType', () => {
  it('strips the synthesized inverse suffix', () => {
    expect(baseRelationType('StartsWith (inverse)')).toBe('StartsWith');
  });

  it('leaves a plain type alone', () => {
    expect(baseRelationType('PeerOf')).toBe('PeerOf');
  });
});

describe('relationGroup', () => {
  it.each([
    ['CanPrecede', 'sequence'],
    ['CanFollow', 'sequence'],
    ['StartsWith', 'sequence'],
    ['StartsWith (inverse)', 'sequence'],
    ['PeerOf', 'peer'],
    ['CanAlsoBe', 'peer'],
    ['Requires', 'requires'],
    ['RequiredBy', 'requires'],
  ])('groups %s as %s', (type, expected) => {
    expect(relationGroup(type)).toBe(expected);
  });

  it('falls back to peer for an unrecognised type rather than throwing', () => {
    expect(relationGroup('SomethingMitreAddsLater')).toBe('peer');
  });

  it('gives every group a label and a colour token', () => {
    for (const spec of Object.values(RELATION_GROUPS)) {
      expect(spec.label).toBeTruthy();
      expect(spec.token).toMatch(/^--rel-/);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/relations.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/relations`.

- [ ] **Step 3: Write `src/lib/relations.ts`**

```ts
export type RelationGroup = 'sequence' | 'peer' | 'requires';

export interface RelationGroupSpec {
  key: RelationGroup;
  label: string;
  token: string;
}

export const RELATION_GROUPS: Record<RelationGroup, RelationGroupSpec> = {
  sequence: { key: 'sequence', label: 'Sequence', token: '--rel-sequence' },
  peer: { key: 'peer', label: 'Peers', token: '--rel-peer' },
  requires: { key: 'requires', label: 'Requires', token: '--rel-requires' },
};

const BY_TYPE: Record<string, RelationGroup> = {
  CanPrecede: 'sequence',
  CanFollow: 'sequence',
  StartsWith: 'sequence',
  PeerOf: 'peer',
  CanAlsoBe: 'peer',
  Requires: 'requires',
  RequiredBy: 'requires',
};

/**
 * buildGraph synthesizes the missing direction of one-sided relations and
 * labels anything with no known inverse "<Type> (inverse)". Group by the
 * underlying type so a synthesized edge lands with its counterpart.
 */
export function baseRelationType(type: string): string {
  return type.replace(/ \(inverse\)$/, '');
}

export function relationGroup(type: string): RelationGroup {
  return BY_TYPE[baseRelationType(type)] ?? 'peer';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/relations.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the detail panel test**

Replace the whole of `test/components/DetailPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html' },
    '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '80', to: '79', type: 'ChildOf' },
    { from: '79', to: '20', type: 'CanFollow' },
    { from: '79', to: '80', type: 'PeerOf' },
  ],
};

const graph = buildGraph(data);

describe('DetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<DetailPanel graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Select a CWE to see its details.')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    render(<DetailPanel graph={graph} selectedId="99999" onSelect={() => {}} />);
    expect(screen.getByText('CWE-99999 was not found.')).toBeInTheDocument();
  });

  it("renders the selected node's identity, badges and description", () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    expect(screen.getByText('XSS description')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('links out to the authoritative MITRE page', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('link', { name: 'View on cwe.mitre.org' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/data/definitions/79.html'
    );
  });

  it('groups relations into labelled sections with counts', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.getByText('Children (1)')).toBeInTheDocument();
    expect(screen.getByText('Peers (1)')).toBeInTheDocument();
    expect(screen.getByText('Sequence (1)')).toBeInTheDocument();
  });

  it('omits a section a node has no relations for', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.queryByText(/^Requires/)).not.toBeInTheDocument();
  });

  it('jumps the selection when a relation chip is clicked', async () => {
    const onSelect = vi.fn();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('warns when the selected entry is deprecated', () => {
    render(<DetailPanel graph={graph} selectedId="71" onSelect={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('MITRE has deprecated this entry.');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run test/components/DetailPanel.test.tsx`
Expected: FAIL — no `Parents (1)` section, no `role="status"` warning, heading is plain text not a heading role match.

- [ ] **Step 7: Rewrite `src/components/DetailPanel.tsx`**

```tsx
import type { Graph } from '../lib/graph';
import { RELATION_GROUPS, relationGroup, type RelationGroup } from '../lib/relations';
import { Glyph } from './Glyph';

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Section {
  label: string;
  ids: string[];
}

function relationSections(graph: Graph, id: string): Section[] {
  const sections: Section[] = [
    { label: 'Parents', ids: graph.parentsOf.get(id) ?? [] },
    { label: 'Children', ids: graph.childrenOf.get(id) ?? [] },
  ];

  const related = graph.relatedTo.get(id) ?? [];
  const byGroup = new Map<RelationGroup, string[]>();
  for (const edge of related) {
    const group = relationGroup(edge.type);
    const list = byGroup.get(group) ?? [];
    if (!list.includes(edge.to)) list.push(edge.to);
    byGroup.set(group, list);
  }

  for (const key of ['peer', 'sequence', 'requires'] as const) {
    sections.push({ label: RELATION_GROUPS[key].label, ids: byGroup.get(key) ?? [] });
  }

  return sections.filter((section) => section.ids.length > 0);
}

function RelationChip({ graph, id, onSelect }: { graph: Graph; id: string; onSelect: (id: string) => void }) {
  const node = graph.nodes[id];
  const label = node ? `CWE-${id}: ${node.name}` : `CWE-${id}`;
  return (
    <li>
      <button type="button" className="relation-chip" onClick={() => onSelect(id)} aria-label={label}>
        <Glyph abstraction={node?.abstraction ?? ''} size={12} deprecated={node?.status === 'Deprecated'} />
        <span className="relation-chip__id">CWE-{id}</span>
        {node && <span className="relation-chip__name">{node.name}</span>}
      </button>
    </li>
  );
}

export function DetailPanel({ graph, selectedId, onSelect }: DetailPanelProps) {
  if (!selectedId) {
    return <div className="detail-panel detail-panel--empty">Select a CWE to see its details.</div>;
  }

  const node = graph.nodes[selectedId];
  if (!node) {
    return <div className="detail-panel detail-panel--empty">CWE-{selectedId} was not found.</div>;
  }

  const deprecated = node.status === 'Deprecated';
  const sections = relationSections(graph, selectedId);

  return (
    <div className="detail-panel">
      <h2 className="detail-panel__title" aria-label={`CWE-${node.id}: ${node.name}`}>
        <Glyph abstraction={node.abstraction} size={18} deprecated={deprecated} />
        <span className="detail-panel__id">CWE-{node.id}</span>
        <span className="detail-panel__name">{node.name}</span>
      </h2>

      <p className="badges">
        <span className="badge badge--abstraction">{node.abstraction}</span>
        <span className="badge badge--status">{node.status}</span>
      </p>

      {deprecated && (
        <p className="detail-panel__warning" role="status">
          MITRE has deprecated this entry.
        </p>
      )}

      {node.description && <p className="detail-panel__description">{node.description}</p>}

      <a className="detail-panel__link" href={node.url} target="_blank" rel="noreferrer">
        View on cwe.mitre.org
      </a>

      {sections.map((section) => (
        <section key={section.label} className="relation-section">
          <h3 className="relation-section__heading">
            {section.label} ({section.ids.length})
          </h3>
          <ul className="relation-list">
            {section.ids.map((id) => (
              <RelationChip key={`${section.label}-${id}`} graph={graph} id={id} onSelect={onSelect} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

The heading carries an explicit `aria-label` rather than relying on how the accessible name gets assembled from the glyph and the two spans — that keeps `getByRole('heading', { name: 'CWE-79: Cross-site Scripting' })` exact instead of whitespace-sensitive.

- [ ] **Step 8: Write `src/styles/detail.css`**

```css
.detail-panel {
  position: absolute;
  inset-block-start: var(--space-4);
  inset-inline-end: var(--space-4);
  width: min(24rem, calc(100% - var(--space-6)));
  max-height: calc(100% - var(--space-6));
  overflow: auto;
  padding: var(--space-4);
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}

.detail-panel--empty {
  color: var(--text-muted);
  font-size: var(--text-md);
}

.detail-panel__title {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  font-size: var(--text-lg);
}

.detail-panel__id {
  font-family: var(--font-mono);
  font-size: var(--text-md);
  color: var(--text-muted);
}

.badges {
  display: flex;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
}

.badge {
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  padding: 0 var(--space-2);
}

.badge--abstraction { color: var(--abs-class); }
.badge--status { color: var(--status-draft); }

.detail-panel__warning {
  color: var(--status-deprecated);
  font-size: var(--text-sm);
  margin: 0 0 var(--space-3);
}

.detail-panel__description {
  margin: 0 0 var(--space-3);
  max-width: 60ch;
  color: var(--text-secondary);
  font-size: var(--text-md);
}

.detail-panel__link {
  color: var(--abs-class);
  font-size: var(--text-sm);
}

.relation-section {
  margin-top: var(--space-4);
}

.relation-section__heading {
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.relation-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}

.relation-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-2);
}

.relation-chip:hover {
  border-color: var(--border-strong);
}

.relation-chip__id {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.relation-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

Add `import './styles/detail.css';` to `src/main.tsx`.

- [ ] **Step 9: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/relations.ts src/components/DetailPanel.tsx src/styles/detail.css src/main.tsx test/lib/relations.test.ts test/components/DetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat: group relations in a detail card

Parents and children were invisible in the panel and every other relation
was one flat bullet list under a single "Related weaknesses" heading. Group
them into labelled sections with counts, each entry a chip carrying its
abstraction glyph.

relationGroup lives in its own module because the graph canvas needs the
same mapping to colour its edges.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Search as a combobox

**Files:**
- Modify: `src/components/SearchBox.tsx` (rewritten), `test/components/SearchBox.test.tsx` (extended)
- Create: `src/styles/search.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: `searchNodes` (Task 6), `Glyph` (Task 3).
- Produces: `<SearchBox graph={Graph} onSelect={(id: string) => void} />` — unchanged props, now implementing the ARIA combobox pattern.

- [ ] **Step 1: Write the failing tests**

Append to `test/components/SearchBox.test.tsx`:

```tsx
describe('SearchBox keyboard behaviour', () => {
  it('marks the input as a combobox that expands on results', async () => {
    render(<SearchBox graph={buildGraph(data)} onSelect={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.type(input, 'sql');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('moves the active option with the arrow keys', async () => {
    render(<SearchBox graph={buildGraph(data)} onSelect={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'injection');
    await userEvent.keyboard('{ArrowDown}');
    const first = screen.getAllByRole('option')[0];
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('selects the active option on Enter', async () => {
    const onSelect = vi.fn();
    render(<SearchBox graph={buildGraph(data)} onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'SQL');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('89');
    expect(input).toHaveValue('');
  });

  it('dismisses the list on Escape without selecting', async () => {
    const onSelect = vi.fn();
    render(<SearchBox graph={buildGraph(data)} onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'SQL');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```

The four pre-existing `SearchBox` tests need two adjustments: `queryByRole('list')` becomes `queryByRole('listbox')`, and `screen.getByText('CWE-89: SQL Injection')` becomes `screen.getByRole('option', { name: 'CWE-89: SQL Injection' })`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/SearchBox.test.tsx`
Expected: FAIL — the input has no `role="combobox"`, no `aria-expanded`, no `aria-activedescendant`.

- [ ] **Step 3: Rewrite `src/components/SearchBox.tsx`**

```tsx
import { useId, useState } from 'react';
import type { Graph } from '../lib/graph';
import { searchNodes } from '../lib/search';
import { Glyph } from './Glyph';

interface SearchBoxProps {
  graph: Graph;
  onSelect: (id: string) => void;
}

const MAX_RESULTS = 20;

export function SearchBox({ graph, onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const listId = useId();

  const results = searchNodes(graph, query).slice(0, MAX_RESULTS);
  const open = query.trim() !== '' && !dismissed;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(index: number) {
    const node = results[index];
    if (!node) return;
    onSelect(node.id);
    setQuery('');
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
      setActive(-1);
    }
  }

  return (
    <div className="search-box">
      <input
        type="search"
        role="combobox"
        placeholder="Search CWEs by ID or name…"
        value={query}
        aria-label="Search CWEs"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setDismissed(false);
        }}
      />
      {open && (
        <ul className="search-results" id={listId} role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <li className="search-results__empty">No matches</li>
          ) : (
            results.map((node, index) => (
              <li
                key={node.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                aria-label={`CWE-${node.id}: ${node.name}`}
                className={`search-result${index === active ? ' search-result--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(index);
                }}
              >
                <Glyph abstraction={node.abstraction} size={12} deprecated={node.status === 'Deprecated'} />
                <span className="search-result__id">CWE-{node.id}</span>
                <span className="search-result__name">{node.name}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

The options are `<li role="option">` rather than buttons: a `listbox` may only contain `option` children, and the combobox keeps focus on the input throughout. `onMouseDown` with `preventDefault` selects before the input can blur.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/components/SearchBox.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Write `src/styles/search.css`**

```css
.search-box {
  position: relative;
}

.search-box input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font: inherit;
  font-size: var(--text-md);
}

.search-results {
  position: absolute;
  inset-inline: 0;
  top: calc(100% + var(--space-1));
  z-index: 3;
  max-height: 24rem;
  overflow: auto;
  margin: 0;
  padding: var(--space-1);
  list-style: none;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.search-result {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.search-result--active,
.search-result:hover {
  background: var(--surface);
}

.search-result__id {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex: none;
}

.search-result__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-results__empty {
  padding: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-md);
}
```

Add `import './styles/search.css';` to `src/main.tsx`.

- [ ] **Step 6: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/components/SearchBox.tsx src/styles/search.css src/main.tsx test/components/SearchBox.test.tsx
git commit -m "$(cat <<'EOF'
feat: make search a keyboard-navigable combobox

Implement the ARIA combobox pattern: arrow keys move an active option,
Enter selects it, Escape dismisses without selecting, and the input keeps
focus throughout via aria-activedescendant. Each result now shows its
abstraction glyph and a monospace id.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---
### Task 11: `buildEgoGraph`

**Files:**
- Create: `src/lib/ego.ts`, `test/lib/ego.test.ts`

**Interfaces:**
- Consumes: `Graph` (Task 5), `relationGroup` / `RelationGroup` (Task 9).
- Produces:

```ts
export type Band = -2 | -1 | 0 | 1;
export type Side = 'left' | 'center' | 'right';
export interface EgoNode { id: string; band: Band; side: Side }
export interface EgoOverflow { parentId: string; hiddenCount: number }
export interface EgoEdge { from: string; to: string; type: string; group: 'hierarchy' | RelationGroup }
export interface EgoGraph { centerId: string; nodes: EgoNode[]; edges: EgoEdge[]; overflow: EgoOverflow | null }
export interface EgoOptions { ancestorHops?: number; childCap?: number }
export function buildEgoGraph(graph: Graph, centerId: string, options?: EgoOptions): EgoGraph
```

The radius is asymmetric by design — see the spec. Defaults: `ancestorHops: 2`, `childCap: 10`.

- [ ] **Step 1: Write the failing test**

Create `test/lib/ego.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { buildEgoGraph } from '../../src/lib/ego';

const node = (id: string) => ({
  id, name: `Name ${id}`, abstraction: 'Base', status: 'Draft', description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: Object.fromEntries(
    ['1', '2', '3', '10', '11', '12', '20', '30', '40'].map((id) => [id, node(id)])
  ),
  edges: [
    { from: '2', to: '1', type: 'ChildOf' },   // 1 is grandparent of 3
    { from: '3', to: '2', type: 'ChildOf' },   // 2 is parent of 3
    { from: '10', to: '3', type: 'ChildOf' },  // children of 3
    { from: '11', to: '3', type: 'ChildOf' },
    { from: '12', to: '3', type: 'ChildOf' },
    { from: '3', to: '20', type: 'CanFollow' },   // 20 leads to 3  → left
    { from: '3', to: '30', type: 'CanPrecede' },  // 3 leads to 30  → right
    { from: '3', to: '40', type: 'PeerOf' },      // non-directional
  ],
};

const graph = buildGraph(data);
const bandOf = (ego: ReturnType<typeof buildEgoGraph>, id: string) =>
  ego.nodes.find((n) => n.id === id)?.band;

describe('buildEgoGraph', () => {
  const ego = buildEgoGraph(graph, '3');

  it('puts the centre on band 0', () => {
    expect(ego.centerId).toBe('3');
    expect(ego.nodes.find((n) => n.id === '3')).toEqual({ id: '3', band: 0, side: 'center' });
  });

  it('puts parents one band up and grandparents two', () => {
    expect(bandOf(ego, '2')).toBe(-1);
    expect(bandOf(ego, '1')).toBe(-2);
  });

  it('puts children one band down', () => {
    expect(bandOf(ego, '10')).toBe(1);
    expect(bandOf(ego, '12')).toBe(1);
  });

  it('stops at one hop down — a grandchild is not included', () => {
    const deeper = buildGraph({
      ...data,
      edges: [...data.edges, { from: '99', to: '10', type: 'ChildOf' }],
      nodes: { ...data.nodes, '99': node('99') },
    });
    expect(bandOf(buildEgoGraph(deeper, '3'), '99')).toBeUndefined();
  });

  it('honours ancestorHops: 1 by dropping grandparents', () => {
    expect(bandOf(buildEgoGraph(graph, '3', { ancestorHops: 1 }), '1')).toBeUndefined();
  });

  it('places a CanFollow relation to the left and CanPrecede to the right', () => {
    expect(ego.nodes.find((n) => n.id === '20')?.side).toBe('left');
    expect(ego.nodes.find((n) => n.id === '30')?.side).toBe('right');
    expect(bandOf(ego, '20')).toBe(0);
  });

  it('gives non-directional relations a side, since position there carries no meaning', () => {
    expect(['left', 'right']).toContain(ego.nodes.find((n) => n.id === '40')?.side);
  });

  it('groups each edge by relation kind', () => {
    const groups = Object.fromEntries(ego.edges.map((e) => [`${e.from}->${e.to}`, e.group]));
    expect(groups['3->2']).toBe('hierarchy');
    expect(groups['3->30']).toBe('sequence');
    expect(groups['3->40']).toBe('peer');
  });

  it('caps children and reports the remainder', () => {
    const many: CweData = {
      ...data,
      nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`${200 + i}`, node(`${200 + i}`)])) },
      edges: [...data.edges, ...Array.from({ length: 15 }, (_, i) => ({ from: `${200 + i}`, to: '3', type: 'ChildOf' }))],
    };
    const capped = buildEgoGraph(buildGraph(many), '3', { childCap: 10 });
    expect(capped.nodes.filter((n) => n.band === 1)).toHaveLength(10);
    expect(capped.overflow).toEqual({ parentId: '3', hiddenCount: 8 });
  });

  it('reports no overflow when every child fits', () => {
    expect(ego.overflow).toBeNull();
  });

  it('returns a lone node for an entry with no relations at all', () => {
    const isolated = buildGraph({ ...data, edges: [] });
    const lone = buildEgoGraph(isolated, '3');
    expect(lone.nodes).toEqual([{ id: '3', band: 0, side: 'center' }]);
    expect(lone.edges).toEqual([]);
  });

  it('skips relation targets that are not in the corpus', () => {
    const dangling = buildGraph({
      ...data,
      edges: [...data.edges, { from: '3', to: '99999', type: 'PeerOf' }],
    });
    expect(bandOf(buildEgoGraph(dangling, '3'), '99999')).toBeUndefined();
  });

  it('returns an empty graph for an unknown centre', () => {
    const missing = buildEgoGraph(graph, '99999');
    expect(missing.nodes).toEqual([]);
    expect(missing.edges).toEqual([]);
  });

  it('is deterministic — same input, same output', () => {
    expect(buildEgoGraph(graph, '3')).toEqual(buildEgoGraph(graph, '3'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/ego.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/ego`.

- [ ] **Step 3: Write `src/lib/ego.ts`**

```ts
import type { Graph } from './graph';
import { relationGroup, type RelationGroup } from './relations';

export type Band = -2 | -1 | 0 | 1;
export type Side = 'left' | 'center' | 'right';

export interface EgoNode {
  id: string;
  band: Band;
  side: Side;
}

export interface EgoOverflow {
  parentId: string;
  hiddenCount: number;
}

export interface EgoEdge {
  from: string;
  to: string;
  type: string;
  group: 'hierarchy' | RelationGroup;
}

export interface EgoGraph {
  centerId: string;
  nodes: EgoNode[];
  edges: EgoEdge[];
  overflow: EgoOverflow | null;
}

export interface EgoOptions {
  /** How many hops up the hierarchy to include. Default 2. */
  ancestorHops?: number;
  /** Maximum children rendered before the rest collapse into overflow. Default 10. */
  childCap?: number;
}

const byId = (a: string, b: string) => Number(a) - Number(b);

/** Types whose direction means "this can lead to X" — X belongs on the right. */
const LEADS_TO = new Set(['CanPrecede', 'StartsWith', 'Requires']);
/** Types whose direction means "X can lead to this" — X belongs on the left. */
const LEADS_FROM = new Set(['CanFollow', 'RequiredBy']);

export function buildEgoGraph(graph: Graph, centerId: string, options?: EgoOptions): EgoGraph {
  const ancestorHops = options?.ancestorHops ?? 2;
  const childCap = options?.childCap ?? 10;

  if (!(centerId in graph.nodes)) {
    return { centerId, nodes: [], edges: [], overflow: null };
  }

  const nodes: EgoNode[] = [{ id: centerId, band: 0, side: 'center' }];
  const edges: EgoEdge[] = [];
  const seen = new Set<string>([centerId]);

  const add = (id: string, band: Band, side: Side) => {
    if (seen.has(id) || !(id in graph.nodes)) return false;
    seen.add(id);
    nodes.push({ id, band, side });
    return true;
  };

  // Ancestors, one band per hop upward.
  let frontier = [centerId];
  for (let hop = 1; hop <= ancestorHops && hop <= 2; hop += 1) {
    const band = (hop === 1 ? -1 : -2) as Band;
    const next: string[] = [];
    for (const childId of frontier) {
      for (const parentId of [...(graph.parentsOf.get(childId) ?? [])].sort(byId)) {
        if (!(parentId in graph.nodes)) continue;
        if (add(parentId, band, 'center')) next.push(parentId);
        edges.push({ from: childId, to: parentId, type: 'ChildOf', group: 'hierarchy' });
      }
    }
    frontier = next;
  }

  // Children, one hop down, ranked so the structurally significant ones
  // survive the cap: most direct children first, ties by ascending id.
  const allChildren = [...(graph.childrenOf.get(centerId) ?? [])]
    .filter((id) => id in graph.nodes)
    .sort((a, b) => {
      const byFanout = (graph.childrenOf.get(b) ?? []).length - (graph.childrenOf.get(a) ?? []).length;
      return byFanout !== 0 ? byFanout : byId(a, b);
    });

  for (const childId of allChildren.slice(0, childCap)) {
    add(childId, 1, 'center');
    edges.push({ from: childId, to: centerId, type: 'ChildOf', group: 'hierarchy' });
  }

  const hiddenCount = allChildren.length - Math.min(allChildren.length, childCap);
  const overflow = hiddenCount > 0 ? { parentId: centerId, hiddenCount } : null;

  // Lateral relations stay on band 0. Direction carries meaning where the
  // relation has one; everything else is placed to balance the row.
  let left = 0;
  let right = 0;
  for (const edge of [...(graph.relatedTo.get(centerId) ?? [])].sort((a, b) => byId(a.to, b.to))) {
    if (!(edge.to in graph.nodes) || edge.to === centerId) continue;
    const base = edge.type.replace(/ \(inverse\)$/, '');
    let side: Side;
    if (LEADS_TO.has(base)) side = 'right';
    else if (LEADS_FROM.has(base)) side = 'left';
    else side = left <= right ? 'left' : 'right';

    if (add(edge.to, 0, side)) {
      if (side === 'left') left += 1;
      else right += 1;
    }
    edges.push({ from: centerId, to: edge.to, type: edge.type, group: relationGroup(edge.type) });
  }

  return { centerId, nodes, edges, overflow };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/ego.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/ego.ts test/lib/ego.test.ts
git commit -m "$(cat <<'EOF'
feat: extract the ego graph around a selected CWE

Asymmetric radius on purpose: two hops up, one hop down capped at ten
children, one hop lateral. A symmetric two-hop radius explodes on a pillar —
CWE-284 alone has 45 children — while ancestors top out at five across the
whole corpus. Against the real 4.20 data this yields a median of 4 nodes and
a p99 of 22.

Pure and deterministic, so band assignment, the cap, the lone-node case and
side placement are all ordinary unit tests.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `layoutEgoGraph`

**Files:**
- Create: `src/lib/layout.ts`, `test/lib/layout.test.ts`

**Interfaces:**
- Consumes: `EgoGraph`, `EgoNode`, `EgoEdge`, `Band` (Task 11).
- Produces:

```ts
export interface StageSize { width: number; height: number }
export interface PositionedNode extends EgoNode { x: number; y: number }
export interface PositionedEdge extends EgoEdge { path: string }
export interface PositionedOverflow extends EgoOverflow { x: number; y: number }
export interface Layout { nodes: PositionedNode[]; edges: PositionedEdge[]; overflow: PositionedOverflow | null }
export function bandY(band: Band): number
export function layoutEgoGraph(ego: EgoGraph, size: StageSize): Layout
```

- [ ] **Step 1: Write the failing test**

Create `test/lib/layout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { layoutEgoGraph } from '../../src/lib/layout';
import type { EgoGraph } from '../../src/lib/ego';

const size = { width: 1000, height: 800 };

const ego: EgoGraph = {
  centerId: '3',
  nodes: [
    { id: '3', band: 0, side: 'center' },
    { id: '2', band: -1, side: 'center' },
    { id: '1', band: -2, side: 'center' },
    { id: '10', band: 1, side: 'center' },
    { id: '11', band: 1, side: 'center' },
    { id: '20', band: 0, side: 'left' },
    { id: '30', band: 0, side: 'right' },
  ],
  edges: [
    { from: '3', to: '2', type: 'ChildOf', group: 'hierarchy' },
    { from: '3', to: '30', type: 'CanPrecede', group: 'sequence' },
  ],
  overflow: { parentId: '3', hiddenCount: 8 },
};

const at = (id: string) => layoutEgoGraph(ego, size).nodes.find((n) => n.id === id)!;

describe('layoutEgoGraph', () => {
  it('centres the selected node horizontally', () => {
    expect(at('3').x).toBe(500);
  });

  it('stacks bands so more abstract sits higher', () => {
    expect(at('1').y).toBeLessThan(at('2').y);
    expect(at('2').y).toBeLessThan(at('3').y);
    expect(at('3').y).toBeLessThan(at('10').y);
  });

  it('keeps every node inside the stage', () => {
    for (const node of layoutEgoGraph(ego, size).nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(size.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(size.height);
    }
  });

  it('distributes siblings evenly across a band', () => {
    expect(at('10').x).not.toBe(at('11').x);
    expect(at('10').x + at('11').x).toBeCloseTo(size.width, 5);
  });

  it('puts a left-side lateral left of centre and a right-side one right', () => {
    expect(at('20').x).toBeLessThan(at('3').x);
    expect(at('30').x).toBeGreaterThan(at('3').x);
    expect(at('20').y).toBe(at('3').y);
  });

  it('emits a cubic path per edge', () => {
    const paths = layoutEgoGraph(ego, size).edges.map((e) => e.path);
    expect(paths).toHaveLength(2);
    for (const path of paths) expect(path).toMatch(/^M [\d.-]+ [\d.-]+ C /);
  });

  it('positions the overflow chip on the children band', () => {
    const { overflow } = layoutEgoGraph(ego, size);
    expect(overflow?.hiddenCount).toBe(8);
    expect(overflow?.y).toBe(at('10').y);
  });

  it('is deterministic', () => {
    expect(layoutEgoGraph(ego, size)).toEqual(layoutEgoGraph(ego, size));
  });

  it('does not divide by zero on an empty ego graph', () => {
    const empty = layoutEgoGraph({ centerId: 'x', nodes: [], edges: [], overflow: null }, size);
    expect(empty.nodes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/layout.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/layout`.

- [ ] **Step 3: Write `src/lib/layout.ts`**

```ts
import type { Band, EgoEdge, EgoGraph, EgoNode, EgoOverflow } from './ego';

export interface StageSize {
  width: number;
  height: number;
}

export interface PositionedNode extends EgoNode {
  x: number;
  y: number;
}

export interface PositionedEdge extends EgoEdge {
  path: string;
}

export interface PositionedOverflow extends EgoOverflow {
  x: number;
  y: number;
}

export interface Layout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  overflow: PositionedOverflow | null;
}

/** Vertical position of each band, as a fraction of stage height. */
export function bandY(band: Band): number {
  switch (band) {
    case -2:
      return 0.12;
    case -1:
      return 0.32;
    case 0:
      return 0.55;
    case 1:
      return 0.82;
  }
}

/** Spreads n items evenly across [start, end], centred. */
function spread(index: number, count: number, start: number, end: number): number {
  if (count <= 0) return (start + end) / 2;
  return start + ((end - start) * (index + 0.5)) / count;
}

function cubic(from: PositionedNode | PositionedOverflow, to: PositionedNode): string {
  const sameBand = Math.abs(from.y - to.y) < 1;
  const [c1x, c1y, c2x, c2y] = sameBand
    ? [(from.x + to.x) / 2, from.y, (from.x + to.x) / 2, to.y]
    : [from.x, (from.y + to.y) / 2, to.x, (from.y + to.y) / 2];
  const n = (v: number) => Number(v.toFixed(2));
  return `M ${n(from.x)} ${n(from.y)} C ${n(c1x)} ${n(c1y)}, ${n(c2x)} ${n(c2y)}, ${n(to.x)} ${n(to.y)}`;
}

export function layoutEgoGraph(ego: EgoGraph, size: StageSize): Layout {
  const { width, height } = size;
  const positioned = new Map<string, PositionedNode>();

  // Bands -2, -1 and 1 distribute across the full width. Band 0 is special:
  // the centre is pinned mid-stage, and laterals fill the halves either side,
  // because horizontal position there encodes sequence direction.
  for (const band of [-2, -1, 1] as const) {
    const members = ego.nodes.filter((n) => n.band === band);
    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(i, members.length, 0, width), y: height * bandY(band) });
    });
  }

  const centerY = height * bandY(0);
  const center = ego.nodes.find((n) => n.band === 0 && n.side === 'center');
  if (center) positioned.set(center.id, { ...center, x: width / 2, y: centerY });

  for (const side of ['left', 'right'] as const) {
    const members = ego.nodes.filter((n) => n.band === 0 && n.side === side);
    const [start, end] = side === 'left' ? [0, width / 2] : [width / 2, width];
    members.forEach((node, i) => {
      positioned.set(node.id, { ...node, x: spread(i, members.length, start, end), y: centerY });
    });
  }

  const childBandY = height * bandY(1);
  const childCount = ego.nodes.filter((n) => n.band === 1).length;
  const overflow: PositionedOverflow | null = ego.overflow
    ? { ...ego.overflow, x: spread(childCount, childCount + 1, 0, width), y: childBandY }
    : null;

  const nodes = ego.nodes.map((n) => positioned.get(n.id)!).filter(Boolean);

  const edges: PositionedEdge[] = ego.edges.flatMap((edge) => {
    const from = positioned.get(edge.from);
    const to = positioned.get(edge.to);
    return from && to ? [{ ...edge, path: cubic(from, to) }] : [];
  });

  return { nodes, edges, overflow };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/layout.test.ts`
Expected: PASS (9 tests).

Note the even-distribution assertion holds because `spread` is symmetric: two children land at 0.25·width and 0.75·width, summing to `width`.

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/layout.ts test/lib/layout.test.ts
git commit -m "$(cat <<'EOF'
feat: lay the ego graph out in bands

Position carries meaning: the vertical axis is hierarchy, so up is more
abstract, and the horizontal axis is sequence, so a CanFollow relation sits
left of centre and CanPrecede sits right. A force simulation would have
discarded exactly that, settling parents below their children.

A pure function of (ego, stageSize), which is what makes coordinates
testable and makes pan/zoom unnecessary — the layout is always sized to fit.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---
### Task 13: The graph stage

**Files:**
- Create: `src/components/GraphStage.tsx`, `src/components/GraphNode.tsx`, `src/components/GraphEdge.tsx`, `src/styles/graph.css`
- Create: `test/components/GraphStage.test.tsx`
- Modify: `src/components/Glyph.tsx` (extract `GlyphShape`), `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: `buildEgoGraph` (Task 11), `layoutEgoGraph` (Task 12), `glyphFor` (Task 3), `RELATION_GROUPS` (Task 9).
- Produces:
  - `export function GlyphShape({ abstraction, r, deprecated }: { abstraction: string; r: number; deprecated?: boolean })` — the shape elements alone, for embedding in an existing `<svg>`.
  - `<GraphStage graph={Graph} selectedId={string | null} onSelect={(id: string) => void} onShowChildren={(parentId: string) => void} hops={number} />`
  - `<GraphNode node={PositionedNode} cweNode={CweNode} selected={boolean} onSelect={(id) => void} />`
  - `<GraphEdge edge={PositionedEdge} />`
  - `export const DEFAULT_STAGE: StageSize` — `{ width: 960, height: 600 }`

- [ ] **Step 1: Extract `GlyphShape` from `Glyph.tsx`**

A nested `<svg>` inside the graph canvas is awkward, so the shape elements need to be usable on their own. In `src/components/Glyph.tsx`, rename the local `shapeElements` helper into an exported component and have `Glyph` delegate to it:

```tsx
export function GlyphShape({ abstraction, r, deprecated = false }: { abstraction: string; r: number; deprecated?: boolean }) {
  const glyph = glyphFor(abstraction);
  return (
    <g style={{ color: deprecated ? 'var(--status-deprecated)' : `var(${glyph.token})` }}>
      {shapeElements(glyph.shape, r)}
    </g>
  );
}
```

Keep `shapeElements` exactly as written in Task 3, and keep `Glyph` rendering its own `<svg>` wrapper around `<GlyphShape>`. The four existing `Glyph` tests must still pass unchanged.

- [ ] **Step 2: Write the failing test**

Create `test/components/GraphStage.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphStage } from '../../src/components/GraphStage';
import { buildGraph, type CweData } from '../../src/lib/graph';

const node = (id: string, name: string) => ({
  id, name, abstraction: 'Base', status: 'Draft', description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': node('74', 'Injection'),
    '79': node('79', 'Cross-site Scripting'),
    '80': node('80', 'HTML Tag Neutralization'),
    '71': node('71', 'DEPRECATED: DS_Store'),
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '80', to: '79', type: 'ChildOf' },
  ],
};

const graph = buildGraph(data);

function renderStage(selectedId: string | null, onSelect = vi.fn()) {
  render(
    <GraphStage graph={graph} selectedId={selectedId} onSelect={onSelect} onShowChildren={() => {}} hops={2} />
  );
  return onSelect;
}

describe('GraphStage', () => {
  it('prompts when nothing is selected', () => {
    renderStage(null);
    expect(screen.getByText('Select a CWE to see its neighbourhood.')).toBeInTheDocument();
  });

  it('renders the centre and its neighbours as labelled nodes', () => {
    renderStage('79');
    expect(screen.getByRole('button', { name: /^CWE-79: Cross-site Scripting/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CWE-74: Injection/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CWE-80: HTML Tag Neutralization/ })).toBeInTheDocument();
  });

  it('describes a node so the label stands alone without the picture', () => {
    renderStage('79');
    expect(
      screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting. Base, Draft. 1 parent, 1 child.' })
    ).toBeInTheDocument();
  });

  it('re-centres when another node is clicked', async () => {
    const onSelect = renderStage('79');
    await userEvent.click(screen.getByRole('button', { name: /^CWE-74: Injection/ }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('draws one path per edge', () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
    );
    expect(container.querySelectorAll('path.graph-edge')).toHaveLength(2);
  });

  it('says so when the selected entry has no relations at all', () => {
    renderStage('71');
    expect(screen.getByText('No related weaknesses.')).toBeInTheDocument();
  });

  it('offers the hidden children when the cap engages', async () => {
    const wide: CweData = {
      ...data,
      nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`${300 + i}`, node(`${300 + i}`, `Child ${i}`)])) },
      edges: [...data.edges, ...Array.from({ length: 14 }, (_, i) => ({ from: `${300 + i}`, to: '79', type: 'ChildOf' }))],
    };
    const onShowChildren = vi.fn();
    render(
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} hops={2} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show 5 more children of CWE-79' }));
    expect(onShowChildren).toHaveBeenCalledWith('79');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/components/GraphStage.test.tsx`
Expected: FAIL — cannot resolve `../../src/components/GraphStage`.

- [ ] **Step 4: Write `src/components/GraphEdge.tsx`**

```tsx
import { RELATION_GROUPS } from '../lib/relations';
import type { PositionedEdge } from '../lib/layout';

export function GraphEdge({ edge }: { edge: PositionedEdge }) {
  const stroke =
    edge.group === 'hierarchy' ? 'var(--rel-hierarchy)' : `var(${RELATION_GROUPS[edge.group].token})`;
  return (
    <path
      className={`graph-edge graph-edge--${edge.group}`}
      d={edge.path}
      fill="none"
      stroke={stroke}
      strokeWidth={edge.group === 'hierarchy' ? 2 : 1.5}
      strokeDasharray={edge.group === 'peer' ? '4 3' : undefined}
      markerEnd={edge.group === 'sequence' ? 'url(#graph-arrow)' : undefined}
    >
      <title>{edge.type}</title>
    </path>
  );
}
```

- [ ] **Step 5: Write `src/components/GraphNode.tsx`**

```tsx
import type { CweNode } from '../lib/graph';
import type { PositionedNode } from '../lib/layout';
import { GlyphShape } from './Glyph';

const MAX_LABEL = 24;

export function truncate(text: string, max = MAX_LABEL): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

interface GraphNodeProps {
  node: PositionedNode;
  cweNode: CweNode;
  label: string;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function GraphNode({ node, cweNode, label, selected, onSelect }: GraphNodeProps) {
  const deprecated = cweNode.status === 'Deprecated';
  const r = selected ? 13 : 9;

  return (
    <g
      className={`graph-node${selected ? ' graph-node--selected' : ''}`}
      transform={`translate(${node.x} ${node.y})`}
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(node.id)}
    >
      {selected && <circle className="graph-node__halo" r={r + 7} />}
      <GlyphShape abstraction={cweNode.abstraction} r={r} deprecated={deprecated} />
      <text className="graph-node__id" y={r + 16} textAnchor="middle">
        CWE-{node.id}
      </text>
      <text className="graph-node__name" y={r + 30} textAnchor="middle">
        {truncate(cweNode.name)}
      </text>
      <title>{`CWE-${node.id}: ${cweNode.name}`}</title>
    </g>
  );
}
```

- [ ] **Step 6: Write `src/components/GraphStage.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { buildEgoGraph } from '../lib/ego';
import { layoutEgoGraph, type StageSize } from '../lib/layout';
import { GraphEdge } from './GraphEdge';
import { GraphNode } from './GraphNode';

export const DEFAULT_STAGE: StageSize = { width: 960, height: 600 };

interface GraphStageProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowChildren: (parentId: string) => void;
  hops: number;
}

/**
 * Tracks the stage's own box so the layout can always fit it — which is why
 * the graph needs no pan or zoom. Falls back to a fixed size where
 * ResizeObserver is unavailable (jsdom, and very old browsers).
 */
function useStageSize(ref: React.RefObject<HTMLDivElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>(DEFAULT_STAGE);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function describe(graph: Graph, id: string): string {
  const node = graph.nodes[id];
  const parents = (graph.parentsOf.get(id) ?? []).length;
  const children = (graph.childrenOf.get(id) ?? []).length;
  const parentText = `${parents} parent${parents === 1 ? '' : 's'}`;
  const childText = `${children} child${children === 1 ? '' : 'ren'}`;
  return `CWE-${id}: ${node.name}. ${node.abstraction}, ${node.status}. ${parentText}, ${childText}.`;
}

export function GraphStage({ graph, selectedId, onSelect, onShowChildren, hops }: GraphStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const size = useStageSize(stageRef);

  const ego = useMemo(
    () => (selectedId ? buildEgoGraph(graph, selectedId, { ancestorHops: hops }) : null),
    [graph, selectedId, hops]
  );
  const layout = useMemo(() => (ego ? layoutEgoGraph(ego, size) : null), [ego, size]);

  return (
    <div className="graph-stage" ref={stageRef}>
      {!layout || layout.nodes.length === 0 ? (
        <p className="graph-stage__empty">Select a CWE to see its neighbourhood.</p>
      ) : (
        <>
          {layout.nodes.length === 1 && <p className="graph-stage__note">No related weaknesses.</p>}
          <svg
            className="graph-stage__canvas"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="Weakness neighbourhood"
          >
            <defs>
              <marker id="graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--rel-sequence)" />
              </marker>
            </defs>
            {layout.edges.map((edge) => (
              <GraphEdge key={`${edge.from}-${edge.to}-${edge.type}`} edge={edge} />
            ))}
            {layout.nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                cweNode={graph.nodes[node.id]}
                label={describe(graph, node.id)}
                selected={node.id === ego?.centerId}
                onSelect={onSelect}
              />
            ))}
            {layout.overflow && (
              <g
                className="graph-overflow"
                transform={`translate(${layout.overflow.x} ${layout.overflow.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Show ${layout.overflow.hiddenCount} more children of CWE-${layout.overflow.parentId}`}
                onClick={() => onShowChildren(layout.overflow!.parentId)}
              >
                <rect x={-34} y={-12} width={68} height={24} rx={12} />
                <text textAnchor="middle" y={4}>
                  +{layout.overflow.hiddenCount} more
                </text>
              </g>
            )}
          </svg>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `src/styles/graph.css`**

```css
.graph-stage {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
}

.graph-stage__canvas {
  width: 100%;
  height: 100%;
}

.graph-stage__empty,
.graph-stage__note {
  position: absolute;
  inset-block-start: var(--space-4);
  inset-inline-start: 50%;
  transform: translateX(-50%);
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-md);
}

.graph-node {
  cursor: pointer;
}

.graph-node__halo {
  fill: none;
  stroke: var(--border-strong);
  stroke-width: 2;
}

.graph-node__id {
  fill: var(--text-muted);
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.graph-node__name {
  fill: var(--text-secondary);
  font-size: var(--text-xs);
}

.graph-node,
.graph-edge {
  transition: opacity var(--dur) var(--ease);
}

.graph-node:hover .graph-node__name {
  fill: var(--text);
}

.graph-overflow {
  cursor: pointer;
}

.graph-overflow rect {
  fill: var(--surface);
  stroke: var(--border);
}

.graph-overflow text {
  fill: var(--text-secondary);
  font-size: var(--text-xs);
}
```

Add `import './styles/graph.css';` to `src/main.tsx`.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run test/components/GraphStage.test.tsx test/components/Glyph.test.tsx`
Expected: PASS — 7 new tests plus the 4 unchanged `Glyph` tests.

- [ ] **Step 9: Wire the stage into the shell**

In `src/App.tsx`, put the stage behind the panel and drawer, and let the overflow chip open the drawer:

```tsx
      <main className="app-stage">
        <GraphStage
          graph={state.graph}
          selectedId={selectedId}
          onSelect={selectNode}
          onShowChildren={() => setDrawerOpen(true)}
          hops={2}
        />
        <DetailPanel graph={state.graph} selectedId={selectedId} onSelect={selectNode} />
        <TreeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          graph={state.graph}
          selectedId={selectedId}
          onSelect={selectNode}
        />
      </main>
```

with `import { GraphStage } from './components/GraphStage';`.

- [ ] **Step 10: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/components/GraphStage.tsx src/components/GraphNode.tsx src/components/GraphEdge.tsx src/components/Glyph.tsx src/styles/graph.css src/App.tsx src/main.tsx test/components/GraphStage.test.tsx
git commit -m "$(cat <<'EOF'
feat: render the ego graph on a stage

Hand-rolled SVG over the pure ego/layout pair: hierarchy edges solid,
sequence edges arrowed, peer edges dashed, and relation names in titles
rather than on the canvas — showing every label at rest is the
text-heaviness this redesign exists to remove.

The stage observes its own box and the layout is sized to fit, so there is
no pan or zoom to get lost in. Where the child cap engages, the remainder
becomes a chip that opens the tree drawer instead of silently vanishing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Graph keyboard navigation and announcements

**Files:**
- Modify: `src/components/GraphStage.tsx`, `src/styles/graph.css`
- Modify: `test/components/GraphStage.test.tsx`

**Interfaces:**
- Consumes: everything from Task 13.
- Produces: no new exports. `GraphStage` gains arrow-key navigation along the layout's axes and a polite live region.

The tree drawer remains the authoritative accessible structure; this makes the canvas operable rather than making it the only route.

- [ ] **Step 1: Write the failing tests**

Append to `test/components/GraphStage.test.tsx`:

```tsx
describe('GraphStage keyboard model', () => {
  it('moves focus up the hierarchy with ArrowUp', async () => {
    renderStage('79');
    const centre = screen.getByRole('button', { name: /^CWE-79/ });
    centre.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: /^CWE-74/ })).toHaveFocus();
  });

  it('moves focus down the hierarchy with ArrowDown', async () => {
    renderStage('79');
    screen.getByRole('button', { name: /^CWE-79/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^CWE-80/ })).toHaveFocus();
  });

  it('re-centres on Enter', async () => {
    const onSelect = renderStage('79');
    screen.getByRole('button', { name: /^CWE-79/ }).focus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('announces the new centre politely', () => {
    renderStage('79');
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Centred on CWE-79: Cross-site Scripting. Base, Draft. 1 parent, 1 child.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/GraphStage.test.tsx`
Expected: FAIL — arrow keys do nothing; there is no `role="status"` element.

- [ ] **Step 3: Add the keyboard model and live region**

In `src/components/GraphStage.tsx`, add above the `return`:

```tsx
  function focusNode(id: string) {
    // CWE ids are numeric strings, so they need no selector escaping.
    const target = stageRef.current?.querySelector<SVGGElement>(`[data-node-id="${id}"]`);
    target?.focus();
  }

  /**
   * Arrow keys follow the layout's own axes rather than DOM order: up and
   * down move through the hierarchy, left and right along the current band.
   */
  function onNodeKeyDown(event: React.KeyboardEvent<SVGGElement>, id: string) {
    if (!layout) return;
    const current = layout.nodes.find((n) => n.id === id);
    if (!current) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
      return;
    }

    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (vertical !== 0) {
      event.preventDefault();
      const candidates = layout.nodes
        .filter((n) => (vertical < 0 ? n.y < current.y : n.y > current.y))
        .sort((a, b) => Math.abs(a.y - current.y) - Math.abs(b.y - current.y) || Math.abs(a.x - current.x) - Math.abs(b.x - current.x));
      if (candidates[0]) focusNode(candidates[0].id);
      return;
    }

    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (horizontal !== 0) {
      event.preventDefault();
      const sameBand = layout.nodes
        .filter((n) => n.band === current.band && (horizontal < 0 ? n.x < current.x : n.x > current.x))
        .sort((a, b) => Math.abs(a.x - current.x) - Math.abs(b.x - current.x));
      if (sameBand[0]) focusNode(sameBand[0].id);
    }
  }
```

Pass the handler through `GraphNode` — add `onKeyDown: (event: React.KeyboardEvent<SVGGElement>, id: string) => void` to `GraphNodeProps`, wire it as `onKeyDown={(e) => onKeyDown(e, node.id)}` on the `<g>`, and add `data-node-id={node.id}` to the same element so `focusNode` can find it.

Add the live region as the first child of the `.graph-stage` div:

```tsx
      <p className="visually-hidden" role="status" aria-live="polite">
        {selectedId && graph.nodes[selectedId] ? `Centred on ${describe(graph, selectedId)}` : ''}
      </p>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run test/components/GraphStage.test.tsx`
Expected: PASS (11 tests).

Note `DetailPanel` also renders a `role="status"` for deprecated entries; these tests render `GraphStage` alone, so `getByRole('status')` is unambiguous here. If you later write a test rendering both, address them with `getAllByRole`.

- [ ] **Step 5: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/components/GraphStage.tsx src/components/GraphNode.tsx test/components/GraphStage.test.tsx
git commit -m "$(cat <<'EOF'
feat: make the graph keyboard-operable

Arrow keys follow the layout's own axes — up and down move through the
hierarchy, left and right along the band — and Enter re-centres. Each node
carries a label that stands alone without the picture, and a polite live
region announces the new centre, because a canvas that silently redraws is
invisible to a screen reader.

The tree drawer stays the authoritative structure; this makes the canvas
operable rather than making it the only route.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: Responsive layout and bottom sheet

**Files:**
- Create: `src/lib/media.ts`, `test/lib/media.test.ts`
- Modify: `src/App.tsx`, `src/styles/app.css`, `src/styles/detail.css`, `src/styles/graph.css`
- Modify: `test/App.test.tsx`

**Interfaces:**
- Consumes: `GraphStage.hops` (Task 13).
- Produces:
  - `export const NARROW_QUERY = '(max-width: 900px)'`
  - `export function useMediaQuery(query: string): boolean`

Below 900px the detail card becomes a bottom sheet, the drawer goes full-width, and the graph drops to one ancestor hop.

- [ ] **Step 1: Write the failing test**

Create `test/lib/media.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery, NARROW_QUERY } from '../../src/lib/media';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a match', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(true);
  });

  it('reports no match', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
  });

  it('returns false rather than throwing where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/lib/media.test.ts`
Expected: FAIL — cannot resolve `../../src/lib/media`.

- [ ] **Step 3: Write `src/lib/media.ts`**

```ts
import { useEffect, useState } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof matchMedia === 'function' ? matchMedia(query).matches : false
  );

  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const list = matchMedia(query);
    const onChange = () => setMatches(list.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/lib/media.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Reduce the hop count on narrow screens**

In `src/App.tsx`:

```tsx
import { NARROW_QUERY, useMediaQuery } from './lib/media';
```

```tsx
  const narrow = useMediaQuery(NARROW_QUERY);
```

and pass `hops={narrow ? 1 : 2}` to `GraphStage`.

- [ ] **Step 6: Add the responsive styles**

Append to `src/styles/detail.css`:

```css
@media (max-width: 900px) {
  .detail-panel {
    inset-block-start: auto;
    inset-block-end: 0;
    inset-inline: 0;
    width: 100%;
    max-height: 70dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-inline: none;
    border-block-end: none;
    box-shadow: 0 -4px 16px rgb(0 0 0 / 15%);
  }

  .detail-panel::before {
    content: '';
    display: block;
    width: 2.5rem;
    height: 4px;
    margin: 0 auto var(--space-3);
    border-radius: 2px;
    background: var(--border-strong);
  }

  .detail-panel--empty {
    display: none;
  }
}
```

Hiding the empty state on narrow screens is deliberate: a bottom sheet saying only "Select a CWE" would eat a third of a phone screen to say nothing.

Append to `src/styles/app.css`:

```css
@media (max-width: 900px) {
  .app-header {
    flex-wrap: wrap;
  }

  .app-header__version {
    display: none;
  }

  .app-header__search {
    order: 1;
    flex-basis: 100%;
    max-width: none;
  }
}
```

Append to `src/styles/tree.css`:

```css
@media (max-width: 900px) {
  .drawer {
    width: 100%;
  }
}
```

- [ ] **Step 7: Verify the App still renders under the narrow branch**

Append to `test/App.test.tsx`:

```tsx
  it('still renders the shell when the viewport reports as narrow', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
```

The existing `afterEach(() => vi.unstubAllGlobals())` already cleans this up.

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/lib/media.ts src/App.tsx src/styles test/lib/media.test.ts test/App.test.tsx
git commit -m "$(cat <<'EOF'
feat: adapt the layout to narrow screens

Below 900px the detail card becomes a bottom sheet, the drawer goes
full-width, the version chip gives up its space to search, and the graph
drops to one ancestor hop so the canvas stays legible on a phone.

The empty detail state is hidden on narrow screens rather than shrunk: a
bottom sheet that says only "Select a CWE" would spend a third of a phone
screen saying nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Graph highlighting and motion

**Depends on Task 13 only** — it can be done any time after the stage exists.

**Files:**
- Modify: `src/components/GraphStage.tsx`, `src/components/GraphNode.tsx`, `src/components/GraphEdge.tsx`, `src/styles/graph.css`
- Modify: `test/components/GraphStage.test.tsx`

**Interfaces:**
- Consumes: Task 13's components.
- Produces:
  - `<GraphNode>` gains `dimmed: boolean`, `onHover: (id: string | null) => void`
  - `<GraphEdge>` gains `dimmed: boolean` and `label: string | null`

Three spec requirements land here: hovering or focusing a node highlights its incident edges and dims the rest; edge labels appear **only** on hover or focus, never at rest; and nodes that survive a re-center animate to their new position rather than hard-cutting.

- [ ] **Step 1: Write the failing tests**

Append to `test/components/GraphStage.test.tsx`:

```tsx
describe('GraphStage highlighting', () => {
  it('shows no edge labels at rest', () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
    );
    expect(container.querySelectorAll('.graph-edge__label')).toHaveLength(0);
  });

  it('labels the incident edges when a node is hovered', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(container.querySelectorAll('.graph-edge__label').length).toBeGreaterThan(0);
  });

  it('dims the nodes that are not incident to the hovered one', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    // 74 and its neighbour 79 stay lit; 80 is not incident to 74, so it dims.
    expect(container.querySelector('[data-node-id="80"]')).toHaveClass('graph-node--dimmed');
    expect(container.querySelector('[data-node-id="74"]')).not.toHaveClass('graph-node--dimmed');
  });

  it('clears the highlight when the pointer leaves', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
    );
    const target = screen.getByRole('button', { name: /^CWE-74/ });
    await userEvent.hover(target);
    await userEvent.unhover(target);
    expect(container.querySelectorAll('.graph-node--dimmed')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run test/components/GraphStage.test.tsx`
Expected: FAIL — no `.graph-edge__label` elements and no `graph-node--dimmed` class exist.

- [ ] **Step 3: Track the highlighted node in `GraphStage`**

Add the state and the incidence sets above the `return`:

```tsx
  const [hovered, setHovered] = useState<string | null>(null);

  const incident = useMemo(() => {
    if (!layout || !hovered) return null;
    const edges = layout.edges.filter((e) => e.from === hovered || e.to === hovered);
    const nodes = new Set<string>([hovered]);
    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }
    return { nodes, edges: new Set(edges.map((e) => `${e.from}-${e.to}-${e.type}`)) };
  }, [layout, hovered]);
```

Pass the results down. For edges:

```tsx
            {layout.edges.map((edge) => {
              const key = `${edge.from}-${edge.to}-${edge.type}`;
              const lit = !incident || incident.edges.has(key);
              return (
                <GraphEdge
                  key={key}
                  edge={edge}
                  dimmed={!lit}
                  label={incident && lit ? edge.type : null}
                />
              );
            })}
```

and for nodes, add `dimmed={!!incident && !incident.nodes.has(node.id)}` and `onHover={setHovered}`.

- [ ] **Step 4: Highlight on hover and on focus in `GraphNode`**

Add `dimmed: boolean` and `onHover: (id: string | null) => void` to `GraphNodeProps`, then on the `<g>`:

```tsx
      className={`graph-node${selected ? ' graph-node--selected' : ''}${dimmed ? ' graph-node--dimmed' : ''}`}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
```

Focus is wired alongside hover deliberately: a keyboard user arrowing through the graph gets the same edge labels a mouse user gets.

- [ ] **Step 5: Render the label in `GraphEdge`**

Add `dimmed: boolean` and `label: string | null` to the props, put the path and label in a `<g>`, and place the label at the path's midpoint. The midpoint is cheap to recover from the path's start and end coordinates:

```tsx
export function GraphEdge({ edge, dimmed, label }: { edge: PositionedEdge; dimmed: boolean; label: string | null }) {
  const stroke =
    edge.group === 'hierarchy' ? 'var(--rel-hierarchy)' : `var(${RELATION_GROUPS[edge.group].token})`;
  const numbers = edge.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const [x1, y1] = [numbers[0] ?? 0, numbers[1] ?? 0];
  const [x2, y2] = [numbers.at(-2) ?? 0, numbers.at(-1) ?? 0];

  return (
    <g className={`graph-edge-group${dimmed ? ' graph-edge-group--dimmed' : ''}`}>
      <path
        className={`graph-edge graph-edge--${edge.group}`}
        d={edge.path}
        fill="none"
        stroke={stroke}
        strokeWidth={edge.group === 'hierarchy' ? 2 : 1.5}
        strokeDasharray={edge.group === 'peer' ? '4 3' : undefined}
        markerEnd={edge.group === 'sequence' ? 'url(#graph-arrow)' : undefined}
      >
        <title>{edge.type}</title>
      </path>
      {label && (
        <text className="graph-edge__label" x={(x1 + x2) / 2} y={(y1 + y2) / 2} textAnchor="middle">
          {label}
        </text>
      )}
    </g>
  );
}
```

- [ ] **Step 6: Add the dimming and motion styles**

Replace the `.graph-node, .graph-edge { transition: opacity … }` rule in `src/styles/graph.css` with:

```css
.graph-node {
  transition: transform var(--dur) var(--ease), opacity var(--dur-fast) var(--ease);
}

.graph-edge-group {
  transition: opacity var(--dur-fast) var(--ease);
}

.graph-node--dimmed,
.graph-edge-group--dimmed {
  opacity: 0.25;
}

.graph-edge__label {
  fill: var(--text-muted);
  font-size: var(--text-xs);
  paint-order: stroke;
  stroke: var(--bg);
  stroke-width: 3;
}
```

Transitioning `transform` is what makes a re-center read as movement: nodes are keyed by CWE id, so React reuses the element and the browser tweens it to the new band position. The global `prefers-reduced-motion` rule from Task 1 already reduces both durations to near-zero, so this needs no separate guard.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run test/components/GraphStage.test.tsx`
Expected: PASS (15 tests).

- [ ] **Step 8: Run the full gate and commit**

Run: `npm run lint && npx tsc --noEmit && npm test`

```bash
git add src/components/GraphStage.tsx src/components/GraphNode.tsx src/components/GraphEdge.tsx src/styles/graph.css test/components/GraphStage.test.tsx
git commit -m "$(cat <<'EOF'
feat: highlight the hovered neighbourhood and animate re-centring

Hovering or focusing a node lights its incident edges, names the relation,
and dims everything else. Labels appear only on hover or focus — drawing all
of them at rest is the text-heaviness this redesign exists to remove — and
focus is wired alongside hover so a keyboard user gets the same information
a mouse user does.

Nodes are keyed by CWE id and transition on transform, so the ones that
survive a re-centre move to their new band instead of hard-cutting.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final verification

After Task 16, confirm the whole thing before taking PR #30 out of draft:

- [ ] `npm run lint && npx tsc --noEmit && npm test` — all green
- [ ] `npm run dev`, then check by hand: the tree opens onto 10 Pillars with `Deprecated (25)` collapsed at the bottom; selecting CWE-79 draws a readable neighbourhood; selecting CWE-284 (45 children) shows the `+35 more` chip; selecting CWE-71 shows the lone-node state
- [ ] Toggle the theme both ways, and confirm the OS setting is honoured with no stored preference
- [ ] Tab through the app with the mouse untouched: header, search, graph nodes, panel chips, drawer
- [ ] Confirm the MITRE attribution is visible at the bottom on both a wide and a narrow viewport
- [ ] Update the PR #30 progress checklist, then take it out of draft

## Notes for the executor

- **Do not rewrite `Tree.tsx`'s expand/collapse state machine.** Tasks 8 changes row markup and root sources only.
- **`noUnusedLocals` is on.** A leftover import after a refactor fails `tsc`, not just lint.
- **`public/data/` is gitignored.** If a test needs corpus-shaped data, build a fixture object in the test file the way every existing test does.
- **The spec's measured numbers** (969 nodes, 35 roots, 279 multi-parent, ego median 4 / p99 22, cap engaging for 37 nodes) came from CWE 4.20. Re-running `npm run prepare-data` after MITRE publishes a new version may shift them; they are context, not assertions, and no test depends on them.
