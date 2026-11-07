import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'detail.css'), 'utf-8');

/** The declarations of the rule whose selector is exactly `selector`. */
function declarations(selector: string): Record<string, string> {
  const start = `\n${css}`.indexOf(`\n${selector} {`);
  if (start === -1) {
    throw new Error(`Rule not found: ${selector}`);
  }
  const open = css.indexOf('{', start);
  const body = css.slice(open + 1, css.indexOf('}', open));
  const result: Record<string, string> = {};
  for (const line of body.split(';')) {
    const [name, ...rest] = line.split(':');
    if (rest.length) {
      result[name.trim()] = rest.join(':').trim();
    }
  }
  return result;
}

// jsdom does no layout, so these check the rules that keep a CWE id such
// as "CWE-119" on one line when a long name next to it needs the room
// (issue #270, seen on CWE-787's relation chips).
describe('detail panel CWE ids', () => {
  it.each(['.relation-chip__id', '.detail-panel__id'])('%s never wraps or shrinks', (selector) => {
    const rule = declarations(selector);
    expect(rule['white-space']).toBe('nowrap');
    expect(rule.flex).toBe('none');
  });
});

// base.css shortens every animation to nothing under reduced motion, which
// would leave the flash from the graph's "+N more" chip invisible (issue #260).
describe('relation flash under reduced motion', () => {
  it('keeps a tint that fades in place, without the pulse', () => {
    const start = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(start).not.toBe(-1);
    const block = css.slice(start, css.indexOf('\n}', start));
    expect(block).toMatch(/\.relation-chip--flash \{\s*animation: relation-chip-tint [^;]*!important;/);
    expect(block).not.toContain('relation-chip-pulse');
  });
});

// On a real phone the header, footer and resting sheet left the graph about
// 250px, too short for its labels (issue #298).
describe('phone sheet at rest', () => {
  const narrow = (file: string, selector: string, property: string) => {
    const sheet = file === 'detail.css' ? css : readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', file), 'utf-8');
    const block = sheet.slice(sheet.indexOf('@media (max-width: 900px)'));
    const rule = new RegExp(`\\n  ${selector.replace('.', '\\.')} \\{[^}]*?${property}: ([\\d.]+)dvh;`).exec(block);
    if (!rule) {
      throw new Error(`No ${property} for ${selector} in ${file}`);
    }
    return Number(rule[1]);
  };

  it('takes at most 22% of the screen', () => {
    expect(narrow('detail.css', '.detail-panel', 'max-height')).toBeLessThanOrEqual(22);
  });

  it('is cleared by the graph, a little more than it covers', () => {
    const peek = narrow('detail.css', '.detail-panel', 'max-height');
    expect(narrow('graph.css', '.graph-stage', 'padding-block-end')).toBe(peek + 2);
  });
});
