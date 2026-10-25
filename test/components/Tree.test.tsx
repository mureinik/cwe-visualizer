import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from '../../src/components/Tree';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: '', url: '' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [{ from: '79', to: '74', type: 'ChildOf' }],
};

describe('Tree', () => {
  it('renders root nodes, collapsed by default', () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'CWE-79: Cross-site Scripting' })).not.toBeInTheDocument();
  });

  it('expands to reveal children when the toggle is clicked', async () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
  });

  it('calls onSelect with the node id when a label is clicked', async () => {
    const graph = buildGraph(data);
    const onSelect = vi.fn();
    render(<Tree graph={graph} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('auto-expands ancestors of the selected node', () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
  });

  it('lets the user collapse an auto-expanded ancestor of the selected node', async () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse CWE-74' }));
    expect(screen.queryByRole('button', { name: 'CWE-79: Cross-site Scripting' })).not.toBeInTheDocument();
  });
});

describe('Tree presentation', () => {
  const withDeprecated: CweData = {
    meta: data.meta,
    nodes: {
      ...data.nodes,
      '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
      '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    },
    edges: [...data.edges, { from: '79', to: '20', type: 'ChildOf' }],
  };

  it('keeps deprecated orphans out of the top level', () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: 'CWE-71: DEPRECATED: DS_Store' })).not.toBeInTheDocument();
  });

  it('offers deprecated orphans in a collapsed group, with a count', async () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Deprecated (1)' }));
    expect(screen.getByRole('button', { name: 'CWE-71: DEPRECATED: DS_Store' })).toBeInTheDocument();
  });

  it('marks a node that appears under more than one parent', async () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByLabelText('CWE-79 also appears under 1 other parent')).toBeInTheDocument();
  });
});

describe('Tree with a hierarchy edge to an id outside the corpus', () => {
  // buildGraph keeps such edges (see graph.test.ts), so childrenOf and
  // parentsOf can name an id with no entry in graph.nodes.
  const dangling: CweData = {
    meta: data.meta,
    nodes: {
      ...data.nodes,
      '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    },
    edges: [
      ...data.edges,
      { from: '74', to: '99999', type: 'ParentOf' },
      { from: '20', to: '99998', type: 'ParentOf' },
      { from: '79', to: '99997', type: 'ChildOf' },
    ],
  };

  it('skips the missing child and still renders the known ones', async () => {
    const graph = buildGraph(dangling);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    expect(screen.queryByText('CWE-99999')).not.toBeInTheDocument();
  });

  it('offers no toggle on a node whose only child is missing', () => {
    const graph = buildGraph(dangling);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-20: Improper Input Validation' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand CWE-20' })).not.toBeInTheDocument();
  });

  it('does not count a missing parent as another place the node appears', async () => {
    const graph = buildGraph(dangling);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.queryByLabelText(/^CWE-79 also appears under/)).not.toBeInTheDocument();
  });
});

describe('Tree with a graph that has no hierarchy lists', () => {
  it('renders a node with no childrenOf or parentsOf entry as a lone leaf', () => {
    // buildGraph gives every node both lists, but Tree accepts any Graph.
    const graph = { ...buildGraph(data), childrenOf: new Map<string, string[]>(), parentsOf: new Map<string, string[]>() };
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand CWE-74' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^CWE-74 also appears under/)).not.toBeInTheDocument();
  });
});

describe('Tree with a cycle in the hierarchy', () => {
  // 79 and 80 are each other's child, under the root 74. MITRE's data has no
  // such loop, but a malformed relation could make one.
  const cyclic: CweData = {
    meta: data.meta,
    nodes: {
      ...data.nodes,
      '80': { id: '80', name: 'Improper Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    },
    edges: [
      ...data.edges,
      { from: '80', to: '79', type: 'ChildOf' },
      { from: '79', to: '80', type: 'ChildOf' },
    ],
  };

  it('stops at a node already on the path instead of recursing', () => {
    const graph = buildGraph(cyclic);
    // Selecting 80 expands its ancestors, 74 and 79, and 80 itself through
    // the loop, so every row on the cycle is open.
    render(<Tree graph={graph} selectedId="80" onSelect={() => {}} />);
    expect(screen.getAllByRole('button', { name: 'CWE-79: Cross-site Scripting' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'CWE-80: Improper Neutralization' })).toHaveLength(1);
  });
});
