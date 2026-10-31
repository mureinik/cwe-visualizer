import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const css = readFileSync(path.join(__dirname, '..', '..', 'src', 'styles', 'detail.css'), 'utf-8');

/** The declarations of the rule whose selector is exactly `selector`. */
function declarations(selector: string): Record<string, string> {
  const start = `\n${css}`.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`Rule not found: ${selector}`);
  const open = css.indexOf('{', start);
  const body = css.slice(open + 1, css.indexOf('}', open));
  const result: Record<string, string> = {};
  for (const line of body.split(';')) {
    const [name, ...rest] = line.split(':');
    if (rest.length) result[name.trim()] = rest.join(':').trim();
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
