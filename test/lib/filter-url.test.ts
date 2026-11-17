import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/lib/graph';
import { DEFAULT_FILTER } from '../../src/lib/filter';
import { readFilter, writeFilter } from '../../src/lib/filter-url';
import { filterData as data } from '../fixtures/filter-data';

const graph = buildGraph({
  ...data,
  phases: [...(data.phases ?? []), { name: 'Implementation & Physical Design', domain: 'Hardware' }],
});

describe('readFilter', () => {
  it('reads a valid view, group and phase', () => {
    expect(readFilter('?cwe=79&view=10&group=20&phase=AI%3ATesting', graph)).toEqual({
      filter: { viewId: '10', groupId: '20', phase: 'AI:Testing', language: null, anyLanguage: false },
      dropped: [],
    });
  });

  it('drops values the graph does not know', () => {
    expect(readFilter('?view=9999&group=5&phase=Nope', graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['view 9999', 'group 5', 'phase Nope'],
    });
  });

  // The address is anyone's to write, and the filter bar repeats what it
  // drops, so only a value that reads as an id or a phase name is repeated.
  it('names a non-numeric view or group only generically', () => {
    expect(readFilter('?view=Click%20here&group=evil.example', graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['an unrecognised view', 'an unrecognised group'],
    });
  });

  // Each is typed into the address, so each must be a numeric id before the
  // filter bar repeats it: markup, a script URL, a number with something
  // after a line break, and object keys are all named only generically.
  describe.each(['view', 'group'])('a non-numeric %s', (param) => {
    it.each([
      ['markup', '<img src=x onerror=alert(1)>'],
      ['a script tag', '<script>alert(1)</script>'],
      ['a script URL', 'javascript:alert(1)'],
      ['a number followed by markup after a line break', '10\n<b>x</b>'],
      ['a number followed by markup', '10<b>x</b>'],
      ['a signed number', '-10'],
      ['a decimal', '10.5'],
      ['non-ASCII digits', '\u0661\u0660'],
      ['an inherited object key', 'constructor'],
      ['the prototype key', '__proto__'],
    ])('is not applied, and %s is not repeated', (_, value) => {
      // A valid view, so a group is checked against real groups.
      const search = new URLSearchParams(param === 'group' ? { view: '10', group: value } : { view: value });
      const { filter, dropped } = readFilter(`?${search}`, graph);
      expect(filter[param === 'view' ? 'viewId' : 'groupId']).toBe(DEFAULT_FILTER[param === 'view' ? 'viewId' : 'groupId']);
      expect(dropped).toEqual([`an unrecognised ${param}`]);
    });

    it('names a numeric id it does not know', () => {
      const search = new URLSearchParams(param === 'group' ? { view: '10', group: '4242' } : { view: '4242' });
      expect(readFilter(`?${search}`, graph).dropped).toEqual([`${param} 4242`]);
    });
  });

  // Phases are names, not numbers, so they can't be held to digits; they
  // must instead avoid every character markup needs.
  it.each([
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a script tag', '<script>alert(1)</script>'],
    ['a quoted attribute', 'Testing" onmouseover="alert(1)'],
    ['a line break', 'Testing\n<b>x</b>'],
  ])('drops a phase holding %s and names it only generically', (_, value) => {
    expect(readFilter(`?${new URLSearchParams({ phase: value })}`, graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['an unrecognised phase'],
    });
  });

  it('names a long or unusual phase only generically', () => {
    const sentence = 'Your session has expired, sign in again at evil.example';
    expect(readFilter(`?phase=${encodeURIComponent(sentence)}`, graph).dropped).toEqual(['an unrecognised phase']);
    expect(readFilter('?phase=%3Cb%3EHi%3C%2Fb%3E', graph).dropped).toEqual(['an unrecognised phase']);
    expect(readFilter('?phase=Design%20%26%20Test%3A%20Old%20(v2)', graph).dropped).toEqual(['phase Design & Test: Old (v2)']);
  });

  it('reads a language and anyLanguage', () => {
    expect(readFilter('?language=C&anyLanguage=1', graph)).toEqual({
      filter: { ...DEFAULT_FILTER, language: 'C', anyLanguage: true },
      dropped: [],
    });
    expect(readFilter('?language=C', graph).filter).toEqual({ ...DEFAULT_FILTER, language: 'C' });
  });

  it('drops an unknown language, naming it', () => {
    expect(readFilter('?language=Kotlin', graph)).toEqual({ filter: DEFAULT_FILTER, dropped: ['language Kotlin'] });
  });

  it.each(['Click here', 'C sharp please sign in'])('names an unusual language (%s) only generically', (value) => {
    expect(readFilter(`?${new URLSearchParams({ language: value })}`, graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['an unrecognised language'],
    });
  });

  it('drops anyLanguage without a known language', () => {
    expect(readFilter('?anyLanguage=1', graph).dropped).toEqual(['any language']);
    expect(readFilter('?language=Kotlin&anyLanguage=1', graph)).toEqual({
      filter: DEFAULT_FILTER,
      dropped: ['language Kotlin', 'any language'],
    });
  });

  it('drops an anyLanguage other than 1', () => {
    expect(readFilter('?language=C&anyLanguage=0', graph)).toEqual({
      filter: { ...DEFAULT_FILTER, language: 'C' },
      dropped: ['any language'],
    });
  });

  it('keeps the language when the view is unknown', () => {
    expect(readFilter('?view=9999&language=C', graph)).toEqual({
      filter: { ...DEFAULT_FILTER, language: 'C' },
      dropped: ['view 9999'],
    });
  });

  // Typed into the address and repeated by the filter bar, so a language
  // must equal a name in the graph's list exactly.
  describe.each([
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a script tag', '<script>alert(1)</script>'],
    ['a script URL', 'javascript:alert(1)'],
    ['a quoted attribute', 'C" onmouseover="alert(1)'],
    ['a line break', 'C\n<b>x</b>'],
    ['a name followed by markup', 'C<b>x</b>'],
    ['the right name in the wrong case', 'c'],
    ['a name with a leading space', ' C'],
    ['an inherited object key', 'constructor'],
    ['the prototype key', '__proto__'],
    ['another inherited key', 'toString'],
  ])('a language holding %s', (_, value) => {
    const search = `?${new URLSearchParams({ language: value, anyLanguage: '1' })}`;

    it('is not applied, and is not repeated', () => {
      const { filter, dropped } = readFilter(`?${new URLSearchParams({ language: value })}`, graph);
      expect(filter.language).toBeNull();
      // A plain word passes the safe pattern, so it is named; it is still
      // never applied. Anything with markup or punctuation is not repeated.
      expect(dropped).toEqual([/^[A-Za-z0-9+#.]{1,12}$/.test(value) ? `language ${value}` : 'an unrecognised language']);
    });

    it('is not written back to the address', () => {
      const params = new URLSearchParams(search);
      writeFilter(params, readFilter(search, graph).filter);
      expect(params.has('language')).toBe(false);
      expect(params.has('anyLanguage')).toBe(false);
    });
  });

  describe.each([
    ['true', 'true'],
    ['yes', 'yes'],
    ['01', '01'],
    ['1 with a leading space', ' 1'],
    ['1 followed by markup', '1<b>x</b>'],
    ['markup', '<img src=x onerror=alert(1)>'],
    ['an inherited object key', 'constructor'],
  ])('an anyLanguage holding %s', (_, value) => {
    const search = `?${new URLSearchParams({ language: 'C', anyLanguage: value })}`;

    it('is not applied, and is not repeated', () => {
      const { filter, dropped } = readFilter(search, graph);
      expect(filter.anyLanguage).toBe(false);
      expect(filter.language).toBe('C');
      expect(dropped).toEqual(['any language']);
    });

    it('is not written back to the address', () => {
      const params = new URLSearchParams(search);
      writeFilter(params, readFilter(search, graph).filter);
      expect(params.get('language')).toBe('C');
      expect(params.has('anyLanguage')).toBe(false);
    });
  });

  it('drops a group with no view', () => {
    expect(readFilter('?group=20', graph)).toEqual({ filter: DEFAULT_FILTER, dropped: ['group 20'] });
  });

  it('accepts the default view silently', () => {
    expect(readFilter('?view=1000', graph)).toEqual({ filter: DEFAULT_FILTER, dropped: [] });
  });
});

describe('writeFilter', () => {
  it('round-trips a custom phase', () => {
    const filter = { viewId: '10', groupId: null, phase: 'Hardware:Implementation & Physical Design', language: null, anyLanguage: false };
    const params = new URLSearchParams();
    writeFilter(params, filter);
    expect(readFilter(`?${params.toString()}`, graph)).toEqual({ filter, dropped: [] });
  });

  it('round-trips a view with a group', () => {
    const filter = { viewId: '10', groupId: '20', phase: 'Testing', language: null, anyLanguage: false };
    const params = new URLSearchParams('cwe=79');
    writeFilter(params, filter);
    expect(params.get('group')).toBe('20');
    expect(readFilter(`?${params.toString()}`, graph)).toEqual({ filter, dropped: [] });
  });

  it.each(['C', 'C++', 'C#'])('round-trips %s', (name) => {
    const withLanguages = buildGraph({
      ...data,
      languages: [{ name: 'C', classes: [], memberIds: [] }, { name: 'C++', classes: [], memberIds: [] }, { name: 'C#', classes: [], memberIds: [] }],
    });
    const filter = { ...DEFAULT_FILTER, language: name, anyLanguage: true };
    const params = new URLSearchParams('cwe=79');
    writeFilter(params, filter);
    expect(params.get('anyLanguage')).toBe('1');
    expect(readFilter(`?${params.toString()}`, withLanguages)).toEqual({ filter, dropped: [] });
  });

  // Our own code never produces anyLanguage without a language: the panel,
  // the chip and readFilter all clear or refuse that state.
  describe('anyLanguage without a language', { tags: ['theoretical'] }, () => {
    it('is written only with a language', () => {
      const params = new URLSearchParams();
      writeFilter(params, { ...DEFAULT_FILTER, anyLanguage: true });
      expect(params.toString()).toBe('');
    });
  });

  it('removes all five parameters for the default filter and keeps cwe', () => {
    const params = new URLSearchParams('cwe=79&view=10&group=20&language=C&anyLanguage=1&phase=Testing');
    writeFilter(params, DEFAULT_FILTER);
    expect(params.toString()).toBe('cwe=79');
  });
});
