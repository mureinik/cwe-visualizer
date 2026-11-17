// Evaluates the XPath filters of MITRE's implicit views into member lists.
// Strict on purpose, like views.ts: an implicit view it hasn't decided on, or
// a filter that goes wrong, fails the build, so a MITRE change is noticed.

import { DOMParser } from '@xmldom/xmldom';
import xpath from 'xpath';
import type { RawView } from './views.ts';

/** Implicit views the app offers, by ID. */
export const OFFERED_IMPLICIT_VIEWS: ReadonlySet<string> = new Set(['919', '1424', '678', '709', '1040']);

/** Live implicit views the app doesn't offer, by ID, each with the reason. */
export const SKIPPED_IMPLICIT_VIEWS: Readonly<Record<string, string>> = {
  // 658, 659, 660 and 661 select by programming language, which the Language filter does better.
  '658': 'the Language filter covers it',
  '659': 'the Language filter covers it',
  '660': 'the Language filter covers it',
  '661': 'the Language filter covers it',
  // 701 and 702 select by phase of introduction, which the Phase filter does better.
  '701': 'the Phase filter covers it',
  '702': 'the Phase filter covers it',
  '677': 'an abstraction, not a set',
  '2000': 'it holds everything',
  '604': "it is the tree's Deprecated section",
  '1081': 'an editorial list',
};

const RETIRED_STATUSES = new Set(['Deprecated', 'Obsolete']);
const IMPLICIT = 'Implicit';

interface Lists {
  offered: ReadonlySet<string>;
  skipped: Readonly<Record<string, string>>;
}

function numerically(a: string, b: string): number {
  return Number(a) - Number(b);
}

// MITRE writes its filters without a prefix, so an XPath 1.0 engine matches
// nothing while the root element sits in a default namespace.
function withoutDefaultNamespace(xmlText: string): string {
  return xmlText.replace(/(<Weakness_Catalog\b[^>]*?)\s+xmlns="[^"]*"/, '$1');
}

function describeNode(node: unknown): string {
  const { nodeName, nodeValue } = node as { nodeName?: string; nodeValue?: string | null };
  return nodeValue ? `${nodeName} "${nodeValue}"` : (nodeName ?? String(node));
}

/** The members of each offered implicit view, as sorted weakness IDs. */
export function evaluateImplicitViews(
  xmlText: string,
  views: RawView[],
  weaknessIds: Set<string>,
  lists: Lists = { offered: OFFERED_IMPLICIT_VIEWS, skipped: SKIPPED_IMPLICIT_VIEWS },
): Map<string, string[]> {
  const byId = new Map<string, RawView>();
  for (const view of views) {
    byId.set(String(view['@_ID']), view);
  }

  for (const [id, view] of byId) {
    const live = view['@_Type'] === IMPLICIT && !RETIRED_STATUSES.has(view['@_Status'] ?? '');
    if (live && !lists.offered.has(id) && !(id in lists.skipped)) {
      throw new Error(`View ${id}: implicit view is neither offered nor skipped`);
    }
  }

  const result = new Map<string, string[]>();
  let document: Document | undefined;
  for (const id of lists.offered) {
    const view = byId.get(id);
    if (view === undefined) {
      throw new Error(`View ${id}: offered implicit view is missing from the catalog`);
    }
    if (RETIRED_STATUSES.has(view['@_Status'] ?? '')) {
      throw new Error(`View ${id}: offered implicit view is ${view['@_Status']}`);
    }
    if (view['@_Type'] !== IMPLICIT) {
      throw new Error(`View ${id}: offered implicit view is ${view['@_Type']}, not Implicit`);
    }

    document ??= new DOMParser().parseFromString(withoutDefaultNamespace(xmlText), 'text/xml') as unknown as Document;
    let selected: unknown;
    try {
      selected = xpath.select(view.Filter ?? '', document);
    } catch (error) {
      throw new Error(`View ${id}: filter does not evaluate (${(error as Error).message})`, { cause: error });
    }
    if (!Array.isArray(selected)) {
      throw new Error(`View ${id}: filter does not evaluate to nodes`);
    }

    const members = new Set<string>();
    for (const node of selected as Element[]) {
      const weaknessId = node.nodeName === 'Weakness' ? node.getAttribute('ID') : null;
      if (weaknessId === null || !weaknessIds.has(weaknessId)) {
        throw new Error(`View ${id}: filter matches ${describeNode(node)} which is not a weakness in the catalog`);
      }
      members.add(weaknessId);
    }
    if (members.size === 0) {
      throw new Error(`View ${id}: filter matches no weaknesses`);
    }
    result.set(id, [...members].sort(numerically));
  }
  return result;
}
