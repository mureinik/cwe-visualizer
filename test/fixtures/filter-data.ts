import type { CweData, CweNode } from '../../src/lib/graph';

function node(id: string, phases?: CweNode['phases']): CweNode {
  return { id, name: `CWE ${id}`, abstraction: 'Base', status: 'Stable', description: '', url: '', ...(phases && { phases }) };
}

export const filterData: CweData = {
  meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '1': node('1'),
    '2': node('2', [{ name: 'Implementation' }]),
    '3': node('3', [{ name: 'Testing', domain: 'AI' }]),
    '4': node('4'),
    '5': node('5', [{ name: 'Testing' }]),
  },
  edges: [
    { from: '2', to: '1', type: 'ChildOf' },
    { from: '3', to: '2', type: 'ChildOf' },
    { from: '5', to: '4', type: 'ChildOf' },
  ],
  phases: [{ name: 'Implementation' }, { name: 'Testing' }, { name: 'Testing', domain: 'AI' }],
  views: [
    { id: '1000', name: 'Research Concepts', groupIds: [], memberIds: [] },
    { id: '10', name: 'Ten', groupIds: ['20'], memberIds: ['3', '5'] },
  ],
  groups: { '20': { id: '20', name: 'Group', status: 'Draft', membersByView: { '10': ['3'] } } },
};
