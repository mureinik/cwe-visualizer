// Resolves MITRE's views and groupings into what the filter needs: which
// weaknesses and groupings each view offers. Strict on purpose, like
// nuance.ts and phases.ts: a member it can't place fails the build, so a
// MITRE format change is noticed.

import type { CweGroup, CweView } from '../src/lib/cwe-data.ts';

/** A Has_Member as fast-xml-parser gives it. */
export interface RawHasMember {
  '@_CWE_ID'?: string;
  '@_View_ID'?: string;
}

export interface RawGrouping {
  '@_ID': string;
  '@_Name'?: string;
  '@_Status'?: string;
  Relationships?: { Has_Member?: RawHasMember | RawHasMember[] };
}

export interface RawView {
  '@_ID': string;
  '@_Name'?: string;
  '@_Type'?: string;
  '@_Status'?: string;
  Members?: { Has_Member?: RawHasMember | RawHasMember[] };
}

/** The view the app shows by default: it constrains nothing, so it lists no members. */
export const DEFAULT_VIEW_ID = '1000';

const INCLUDED_TYPES = new Set(['Graph', 'Explicit']);
const RETIRED_STATUSES = new Set(['Deprecated', 'Obsolete']);

function toList<T>(x: T | T[] | undefined): T[] {
  return Array.isArray(x) ? x : x === undefined ? [] : [x];
}

function numerically(a: string, b: string): number {
  return Number(a) - Number(b);
}

function byName(a: { name: string }, b: { name: string }): number {
  const x = a.name.toLowerCase();
  const y = b.name.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

export function readViews(
  views: RawView[],
  groupings: RawGrouping[],
  weaknessIds: Set<string>,
): { views: CweView[]; groups: Record<string, CweGroup> } {
  const rawGroups = new Map<string, RawGrouping>();
  for (const grouping of groupings) {
    rawGroups.set(String(grouping['@_ID']), grouping);
  }

  const groups: Record<string, CweGroup> = {};
  const result: CweView[] = [];

  for (const raw of views) {
    if (!INCLUDED_TYPES.has(raw['@_Type'] ?? '') || RETIRED_STATUSES.has(raw['@_Status'] ?? '')) {
      continue;
    }
    const id = String(raw['@_ID']);
    const view: CweView = { id, name: raw['@_Name'] ?? '', groupIds: [], memberIds: [] };
    result.push(view);
    if (id === DEFAULT_VIEW_ID) {
      continue;
    }

    const members = new Set<string>();
    const reached = new Set<string>();
    // The weaknesses beneath one grouping, at any depth, within this view.
    const beneath = (groupId: string, seen: Set<string>): Set<string> => {
      seen.add(groupId);
      const found = new Set<string>();
      for (const member of linksOf(groupId)) {
        if (weaknessIds.has(member)) {
          found.add(member);
        } else if (!seen.has(member)) {
          for (const weakness of beneath(member, seen)) {
            found.add(weakness);
          }
        }
      }
      return found;
    };
    // The members of a grouping that belong to this view; each must be known.
    const linksOf = (groupId: string): string[] => {
      const prefix = `Grouping ${groupId} (view ${id})`;
      const ids: string[] = [];
      for (const link of toList(rawGroups.get(groupId)?.Relationships?.Has_Member)) {
        if (String(link['@_View_ID']) !== id) {
          continue;
        }
        const member = link['@_CWE_ID'];
        if (member === undefined) {
          throw new Error(`${prefix}: a member has no CWE_ID`);
        }
        const memberId = String(member);
        if (!weaknessIds.has(memberId) && !rawGroups.has(memberId)) {
          throw new Error(`${prefix}: member CWE-${memberId} is not in the catalog`);
        }
        ids.push(memberId);
      }
      return ids;
    };

    const queue: string[] = [];
    for (const link of toList(raw.Members?.Has_Member)) {
      const member = link['@_CWE_ID'];
      if (member === undefined) {
        throw new Error(`View ${id}: a member has no CWE_ID`);
      }
      const memberId = String(member);
      if (weaknessIds.has(memberId)) {
        members.add(memberId);
      } else if (rawGroups.has(memberId)) {
        queue.push(memberId);
      } else {
        throw new Error(`View ${id}: member CWE-${memberId} is not in the catalog`);
      }
    }
    while (queue.length > 0) {
      const groupId = queue.pop()!;
      if (reached.has(groupId)) {
        continue;
      }
      reached.add(groupId);
      for (const member of linksOf(groupId)) {
        if (weaknessIds.has(member)) {
          members.add(member);
        } else {
          queue.push(member);
        }
      }
    }

    // A grouping with no weaknesses under it in this view would filter to
    // nothing, so the view doesn't offer it (CWE 5.0 has dozens).
    const offered: string[] = [];
    for (const groupId of reached) {
      const weaknesses = [...beneath(groupId, new Set())].sort(numerically);
      if (weaknesses.length === 0) {
        continue;
      }
      const rawGroup = rawGroups.get(groupId)!;
      groups[groupId] ??= {
        id: groupId,
        name: rawGroup['@_Name'] ?? '',
        status: rawGroup['@_Status'] ?? '',
        membersByView: {},
      };
      groups[groupId].membersByView[id] = weaknesses;
      offered.push(groupId);
    }
    view.memberIds = [...members].sort(numerically);
    view.groupIds = offered.sort((a, b) => {
      const retired = Number(RETIRED_STATUSES.has(groups[a].status)) - Number(RETIRED_STATUSES.has(groups[b].status));
      return retired !== 0 ? retired : byName(groups[a], groups[b]);
    });
  }

  return {
    views: [
      ...result.filter((v) => v.id === DEFAULT_VIEW_ID),
      ...result.filter((v) => v.id !== DEFAULT_VIEW_ID).sort(byName),
    ],
    groups,
  };
}
