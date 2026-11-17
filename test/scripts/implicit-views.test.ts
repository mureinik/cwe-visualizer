// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evaluateImplicitViews, OFFERED_IMPLICIT_VIEWS, SKIPPED_IMPLICIT_VIEWS } from '../../scripts/implicit-views.ts';
import type { RawView } from '../../scripts/views.ts';

const MOBILE = "/Weakness_Catalog/Weaknesses/Weakness[./Applicable_Platforms/Technology/@Class='Mobile']";

function catalog(weaknesses: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Weakness_Catalog Name="CWE" Version="5.0" xmlns="http://cwe.mitre.org/cwe-8">
  <Weaknesses>${weaknesses}</Weaknesses>
  <Categories><Category ID="5" Name="C" Status="Draft"/></Categories>
</Weakness_Catalog>`;
}

function weakness(id: string, mobile = false): string {
  const platforms = mobile ? '<Applicable_Platforms><Technology Class="Mobile" Prevalence="Often"/></Applicable_Platforms>' : '';
  return `<Weakness ID="${id}" Name="W${id}" Status="Draft">${platforms}</Weakness>`;
}

function view(id: string, filter: string, type = 'Implicit', status = 'Draft'): RawView {
  return { '@_ID': id, '@_Name': `V${id}`, '@_Type': type, '@_Status': status, Filter: filter };
}

const only = (...ids: string[]) => ({ offered: new Set(ids), skipped: {} as Record<string, string> });
const ids = (...list: string[]) => new Set(list);

describe('evaluateImplicitViews', () => {
  it('matches weaknesses through a namespaced catalog', () => {
    const xml = catalog(weakness('1', true) + weakness('2'));
    expect(evaluateImplicitViews(xml, [view('919', MOBILE)], ids('1', '2'), only('919'))).toEqual(
      new Map([['919', ['1']]]),
    );
  });

  it('sorts members numerically', () => {
    const xml = catalog(weakness('100', true) + weakness('20', true) + weakness('3', true));
    expect(evaluateImplicitViews(xml, [view('919', MOBILE)], ids('100', '20', '3'), only('919')).get('919')).toEqual([
      '3',
      '20',
      '100',
    ]);
  });

  it('ignores skipped and retired implicit views', () => {
    const xml = catalog(weakness('1', true));
    const lists = { offered: new Set<string>(), skipped: { '658': 'the Language filter' } };
    const views = [view('658', MOBILE), view('679', '/Weakness_Catalog[false()]', 'Implicit', 'Deprecated')];
    expect(evaluateImplicitViews(xml, views, ids('1'), lists)).toEqual(new Map());
  });

  it('fails on a live implicit view on neither list', () => {
    const xml = catalog(weakness('1', true));
    expect(() => evaluateImplicitViews(xml, [view('9999', MOBILE)], ids('1'), only())).toThrow(
      /View 9999: implicit view is neither offered nor skipped/,
    );
  });

  it('fails on an offered view missing from the catalog', () => {
    expect(() => evaluateImplicitViews(catalog(weakness('1')), [], ids('1'), only('919'))).toThrow(
      /View 919: offered implicit view is missing/,
    );
  });

  it('fails on an offered view that is retired or no longer implicit', () => {
    const xml = catalog(weakness('1', true));
    expect(() =>
      evaluateImplicitViews(xml, [view('919', MOBILE, 'Implicit', 'Deprecated')], ids('1'), only('919')),
    ).toThrow(/View 919: offered implicit view is Deprecated/);
    expect(() => evaluateImplicitViews(xml, [view('919', MOBILE, 'Graph')], ids('1'), only('919'))).toThrow(
      /View 919: offered implicit view is Graph/,
    );
  });

  it('fails on a filter that does not evaluate', () => {
    expect(() =>
      evaluateImplicitViews(catalog(weakness('1')), [view('919', '/Weakness_Catalog[')], ids('1'), only('919')),
    ).toThrow(/View 919: filter does not evaluate/);
  });

  it('fails on a filter that matches nothing', () => {
    expect(() =>
      evaluateImplicitViews(catalog(weakness('1')), [view('919', MOBILE)], ids('1'), only('919')),
    ).toThrow(/View 919: filter matches no weaknesses/);
  });

  it('fails on a match that is not a known weakness', () => {
    const filter = '/Weakness_Catalog/Categories/Category';
    expect(() =>
      evaluateImplicitViews(catalog(weakness('1')), [view('919', filter)], ids('1'), only('919')),
    ).toThrow(/View 919: filter matches .* which is not a weakness/);
  });

  it('fails on a weakness the catalog does not list', () => {
    expect(() =>
      evaluateImplicitViews(catalog(weakness('1', true) + weakness('2', true)), [view('919', MOBILE)], ids('1'), only('919')),
    ).toThrow(/View 919: filter matches .* which is not a weakness/);
  });
});

describe('the implicit view lists', () => {
  it('keep a view on one list only', () => {
    for (const id of OFFERED_IMPLICIT_VIEWS) {
      expect(SKIPPED_IMPLICIT_VIEWS).not.toHaveProperty(id);
    }
    expect([...OFFERED_IMPLICIT_VIEWS].sort()).toEqual(['1040', '1424', '678', '709', '919']);
  });
});
