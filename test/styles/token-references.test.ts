import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDGE_GROUPS } from '../../src/lib/relations.ts';
import { FALLBACK_GLYPH, GLYPHS } from '../../src/lib/shapes.ts';

// A misspelt name in var() makes its declaration invalid at computed-value
// time, which the browser handles silently, and Stylelint can't see the
// definitions in tokens.css from the other stylesheets (#315). So this
// checks every reference against every definition across src/.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', '..', 'src');
const STYLES = path.join(SRC, 'styles');

/** Every file under `dir` whose name ends with one of `extensions`. */
function filesUnder(dir: string, extensions: string[]): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((name) => extensions.some((ext) => name.endsWith(ext)))
    .map((name) => path.join(dir, name))
    .sort();
}

function read(file: string): string {
  return readFileSync(file, 'utf-8');
}

/** CSS without its comments, so a commented-out line neither defines nor uses a name. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The custom properties `css` declares, as in `--name: value`. */
function definedIn(css: string): string[] {
  return [...stripComments(css).matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)].map((m) => m[1]);
}

/**
 * The custom properties `source` reads through var(). A fallback, as in
 * `var(--x, 4px)`, doesn't excuse `--x` from being defined: the fallback
 * would hide the typo just as silently.
 */
function referencedIn(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
}

const stylesheets = filesUnder(STYLES, ['.css']);
const defined = new Set(stylesheets.flatMap((file) => definedIn(read(file))));

/** The var() references in `source` that give a fallback, as `var(--name,`. */
function fallbacksIn(source: string): string[] {
  return [...source.matchAll(/var\(\s*(--[\w-]+)\s*,/g)].map((m) => m[1]);
}

/** Every stylesheet (without comments) and every TS module, with its text. */
function sources(): { file: string; text: string }[] {
  return [
    ...stylesheets.map((file) => ({ file, text: stripComments(read(file)) })),
    ...filesUnder(SRC, ['.ts', '.tsx']).map((file) => ({ file, text: read(file) })),
  ];
}

/** The references in `refs` to names nothing defines, as `file: --name`. */
function undefinedReferences(refs: { file: string; name: string }[]): string[] {
  return refs
    .filter(({ name }) => !defined.has(name))
    .map(({ file, name }) => `${path.relative(SRC, file)}: ${name}`);
}

describe('custom property references', () => {
  it('finds the definitions and the stylesheets that use them', () => {
    // Guards the scan itself: an empty set would make every check below vacuous.
    expect(defined).toContain('--bg');
    expect(stylesheets.map((file) => path.basename(file))).toContain('tokens.css');
  });

  it('every var() in a stylesheet names a defined custom property', () => {
    const refs = stylesheets.flatMap((file) =>
      referencedIn(stripComments(read(file))).map((name) => ({ file, name })));
    expect(refs.length).toBeGreaterThan(0);
    expect(undefinedReferences(refs)).toEqual([]);
  });

  it('every var() in a component or module names a defined custom property', () => {
    const refs = filesUnder(SRC, ['.ts', '.tsx']).flatMap((file) =>
      referencedIn(read(file)).map((name) => ({ file, name })));
    expect(refs.length).toBeGreaterThan(0);
    expect(undefinedReferences(refs)).toEqual([]);
  });

  // The tests above require every name to be defined, so a fallback could
  // never apply: it would be dead code that suggests a case needing it, and
  // without those tests it would hide a typo again. A property left
  // undefined on purpose, as a hook some elements set, needs these tests
  // changed first.
  it('no var() gives a fallback', () => {
    const withFallback = sources().flatMap(({ file, text }) =>
      fallbacksIn(text).map((name) => `${path.relative(SRC, file)}: ${name}`));
    expect(withFallback).toEqual([]);
  });

  // These names reach var() only at runtime, as `var(${glyph.token})`, so
  // the scan above can't see them.
  it.each([
    ...Object.entries(GLYPHS).map(([key, glyph]) => [`glyph ${key}`, glyph.token]),
    ['the fallback glyph', FALLBACK_GLYPH.token],
    ...Object.values(EDGE_GROUPS).map((group) => [`edge group ${group.key}`, group.line.token]),
  ])('%s uses a defined token (%s)', (_label, token) => {
    expect(defined).toContain(token);
  });
});
