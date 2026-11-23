// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readViews } from '../../scripts/views.ts';
import type { RawGrouping, RawView } from '../../scripts/views.ts';

const WEAKNESSES = new Set(['79', '80', '89']);

function view(id: string, members: [string, string][], extra: Partial<RawView> = {}): RawView {
  return {
    '@_ID': id,
    '@_Name': `View ${id}`,
    '@_Type': 'Graph',
    '@_Status': 'Draft',
    Members: { Has_Member: members.map(([cwe, v]) => ({ '@_CWE_ID': cwe, '@_View_ID': v })) },
    ...extra,
  };
}

function grouping(id: string, members: [string, string][], extra: Partial<RawGrouping> = {}): RawGrouping {
  return {
    '@_ID': id,
    '@_Name': `Group ${id}`,
    '@_Status': 'Draft',
    Relationships: { Has_Member: members.map(([cwe, v]) => ({ '@_CWE_ID': cwe, '@_View_ID': v })) },
    ...extra,
  };
}

describe('readViews', () => {
  it("lists a view's weaknesses directly", () => {
    const { views } = readViews([view('1435', [['79', '1435'], ['89', '1435']])], [], WEAKNESSES);
    expect(views).toEqual([{ id: '1435', name: 'View 1435', groupIds: [], memberIds: ['79', '89'] }]);
  });

  it('resolves a view through nested groupings within that view only', () => {
    const { views, groups } = readViews(
      [view('699', [['100', '699']])],
      [grouping('100', [['79', '699'], ['101', '699'], ['89', '888']]), grouping('101', [['80', '699']])],
      WEAKNESSES,
    );
    expect(views[0].memberIds).toEqual(['79', '80']);
    expect(views[0].groupIds).toEqual(expect.arrayContaining(['100', '101']));
    expect(views[0].groupIds).toHaveLength(2);
    expect(groups['100'].membersByView['699']).toEqual(['79', '80']);
    expect(groups['101'].membersByView['699']).toEqual(['80']);
  });

  it('keeps a grouping that sits in two views, per view', () => {
    const { groups } = readViews(
      [view('699', [['100', '699']]), view('1344', [['100', '1344']])],
      [grouping('100', [['79', '699'], ['80', '1344'], ['89', '1344']])],
      WEAKNESSES,
    );
    expect(groups['100'].membersByView).toEqual({ '699': ['79'], '1344': ['80', '89'] });
  });

  it('offers deprecated groupings after live ones', () => {
    const { views } = readViews(
      [view('699', [['100', '699'], ['101', '699']])],
      [
        grouping('100', [['79', '699']], { '@_Name': 'A', '@_Status': 'Deprecated' }),
        grouping('101', [['80', '699']], { '@_Name': 'B', '@_Status': 'Draft' }),
      ],
      WEAKNESSES,
    );
    expect(views[0].groupIds).toEqual(['101', '100']);
  });

  it('counts deprecated weaknesses as members', () => {
    const { views } = readViews([view('1435', [['79', '1435']])], [], new Set(['79']));
    expect(views[0].memberIds).toEqual(['79']);
  });

  it('leaves out implicit, deprecated and obsolete views, and groupings only they reach', () => {
    const { views, groups } = readViews(
      [
        view('658', [], { '@_Type': 'Implicit' }),
        view('1', [['100', '1']], { '@_Status': 'Deprecated' }),
        view('2', [['100', '2']], { '@_Status': 'Obsolete' }),
      ],
      [grouping('100', [['79', '1'], ['79', '2']])],
      WEAKNESSES,
    );
    expect(views).toEqual([]);
    expect(groups).toEqual({});
  });

  it('offers an implicit view with the members it is given', () => {
    const { views } = readViews(
      [view('919', [], { '@_Type': 'Implicit' })],
      [],
      WEAKNESSES,
      new Map([['919', ['79']]]),
    );
    expect(views).toEqual([{ id: '919', name: 'View 919', groupIds: [], memberIds: ['79'] }]);
  });

  it('carries a view\'s former names, oldest first, and no key without any', () => {
    const { views } = readViews(
      [
        view('1435', [['79', '1435']], {
          Content_History: {
            Previous_Entry_Name: [
              { '#text': 'Old', '@_Date': '2020-01-01' },
              { '#text': 'Older', '@_Date': '2021-01-01' },
            ],
          },
        }),
        view('699', [['79', '699']]),
      ],
      [],
      WEAKNESSES,
    );
    expect(views.find((v) => v.id === '1435')?.previousNames).toEqual(['Old', 'Older']);
    expect(views.find((v) => v.id === '699')).not.toHaveProperty('previousNames');
  });

  it('writes view 1000 first, without members', () => {
    const { views } = readViews(
      [view('1435', [['79', '1435']]), view('1000', [['79', '1000']], { '@_Name': 'Complete Weakness Hierarchy' })],
      [],
      WEAKNESSES,
    );
    expect(views[0]).toEqual({ id: '1000', name: 'Complete Weakness Hierarchy', groupIds: [], memberIds: [] });
    expect(views[1].id).toBe('1435');
  });

  // CWE 5.0 has these: OWASP 2021 (1344) lists "Cryptographic Issues" (310),
  // whose members all sit in other views. An empty group would filter to nothing.
  it('leaves out of a view a grouping with no weaknesses in it', () => {
    const { views, groups } = readViews(
      [view('1344', [['310', '1344'], ['100', '1344']]), view('699', [['310', '699']])],
      [grouping('310', [['79', '699']]), grouping('100', [['80', '1344']])],
      WEAKNESSES,
    );
    expect(views.find((v) => v.id === '1344')?.groupIds).toEqual(['100']);
    expect(groups['310'].membersByView).toEqual({ '699': ['79'] });
  });

  it('leaves out a grouping that no view has weaknesses under', () => {
    const { views, groups } = readViews(
      [view('1344', [['310', '1344'], ['100', '1344']])],
      [grouping('310', [['79', '699']]), grouping('100', [['80', '1344']])],
      WEAKNESSES,
    );
    expect(views[0].groupIds).toEqual(['100']);
    expect(groups).not.toHaveProperty('310');
  });

  it('keeps a grouping whose weaknesses sit in a nested one', () => {
    const { views, groups } = readViews(
      [view('699', [['100', '699']])],
      [grouping('100', [['101', '699']]), grouping('101', [['80', '699']])],
      WEAKNESSES,
    );
    expect(views[0].groupIds).toEqual(expect.arrayContaining(['100', '101']));
    expect(groups['100'].membersByView['699']).toEqual(['80']);
  });

  // A mistake in MITRE's data the schema can't express: groupings that
  // contain each other. CWE 5.0 has none.
  describe('with a cycle of groupings', { tags: ['theoretical'] }, () => {
    it('survives a cycle of groupings', () => {
      const { views, groups } = readViews(
        [view('699', [['100', '699']])],
        [grouping('100', [['101', '699'], ['79', '699']]), grouping('101', [['100', '699'], ['80', '699']])],
        WEAKNESSES,
      );
      expect(views[0].memberIds).toEqual(['79', '80']);
      expect(groups['100'].membersByView['699']).toEqual(['79', '80']);
    });
  });

  describe('failures', () => {
    it('names a view member that is not in the catalog', () => {
      expect(() => readViews([view('699', [['12345', '699']])], [], WEAKNESSES)).toThrow(
        'View 699: member CWE-12345 is not in the catalog',
      );
    });

    it('names a grouping member that is not in the catalog', () => {
      expect(
        () => readViews([view('699', [['100', '699']])], [grouping('100', [['12345', '699']])], WEAKNESSES),
      ).toThrow('Grouping 100 (view 699): member CWE-12345 is not in the catalog');
    });

    // MITRE's schema forbids it: Has_Member's CWE_ID is required.
    describe('with a member that has no CWE_ID', { tags: ['theoretical'] }, () => {
      it('names a view member with no CWE_ID', () => {
        const raw = view('699', []);
        raw.Members = { Has_Member: { '@_View_ID': '699' } };
        expect(() => readViews([raw], [], WEAKNESSES)).toThrow('View 699: a member has no CWE_ID');
      });

      it('names a grouping member with no CWE_ID', () => {
        const raw = grouping('100', []);
        raw.Relationships = { Has_Member: { '@_View_ID': '699' } };
        expect(() => readViews([view('699', [['100', '699']])], [raw], WEAKNESSES)).toThrow(
          'Grouping 100 (view 699): a member has no CWE_ID',
        );
      });
    });
  });
});
