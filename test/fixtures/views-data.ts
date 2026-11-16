import type { CweData, CweNode } from '../../src/lib/graph';

function node(id: string, phases?: CweNode['phases']): CweNode {
  return { id, name: `CWE ${id}`, abstraction: 'Base', status: 'Stable', description: '', url: '', ...(phases && { phases }) };
}

/**
 * Views, groupings and phases named and ordered as prepare-data writes them
 * for the real catalog: view 1000 first, then by name, and a deprecated
 * grouping after the live ones.
 */
export const viewsData: CweData = {
  meta: { cweVersion: '4.20', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': node('79', [{ name: 'Implementation' }]),
    '89': node('89', [{ name: 'Implementation' }, { name: 'Testing', domain: 'AI' }]),
    '321': node('321', [{ name: 'Architecture and Design' }]),
  },
  edges: [],
  phases: [
    { name: 'Architecture and Design' },
    { name: 'Implementation' },
    { name: 'Testing' },
    { name: 'Testing', domain: 'AI' },
  ],
  views: [
    { id: '1000', name: 'Complete Weakness Hierarchy', groupIds: [], memberIds: [] },
    { id: '699', name: 'Software Development', groupIds: ['1228', '320'], memberIds: ['79', '89', '321'] },
    {
      id: '1435',
      name: 'Weaknesses in the 2025 CWE Top 25 Most Dangerous Software Weaknesses',
      groupIds: [],
      memberIds: ['79', '89'],
    },
  ],
  groups: {
    '1228': { id: '1228', name: 'API / Function Errors', status: 'Draft', membersByView: { '699': ['79', '89'] } },
    '320': { id: '320', name: 'Key Management Errors', status: 'Obsolete', membersByView: { '699': ['321'] } },
  },
};
