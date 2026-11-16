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

  // No entry in today's data is Obsolete, but the schema allows it.
  it('groups obsolete orphans with the deprecated ones', async () => {
    const graph = buildGraph({
      ...withDeprecated,
      nodes: {
        ...withDeprecated.nodes,
        '72': { id: '72', name: 'Superseded entry', abstraction: 'Variant', status: 'Obsolete', description: '', url: '' },
      },
    });
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('button', { name: 'CWE-72: Superseded entry' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Deprecated (2)' }));
    expect(screen.getByRole('button', { name: 'CWE-72: Superseded entry' })).toHaveClass('tree-label--deprecated');
  });

  it('marks a node that appears under more than one parent', async () => {
    const graph = buildGraph(withDeprecated);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByLabelText('CWE-79 also appears under 1 other parent')).toBeInTheDocument();
  });
});

describe('Tree with a hierarchy edge to an id outside the corpus', { tags: ['theoretical'] }, () => {
  // buildGraph keeps such edges (see graph.test.ts), so childrenOf and
  // parentsOf can name an id with no entry in graph.nodes. Today's data has no
  // such edge, and one would be a MITRE mistake.
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

describe('Tree with a graph that has no hierarchy lists', { tags: ['theoretical'] }, () => {
  // buildGraph gives every node both lists, but Tree accepts any Graph.
  it('renders a node with no childrenOf or parentsOf entry as a lone leaf', () => {
    const graph = { ...buildGraph(data), childrenOf: new Map<string, string[]>(), parentsOf: new Map<string, string[]>() };
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand CWE-74' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^CWE-74 also appears under/)).not.toBeInTheDocument();
  });

  it('reveals a node with no childrenOf entry under a filter as a lone leaf', () => {
    const graph = { ...buildGraph(data), childrenOf: new Map<string, string[]>(), parentsOf: new Map<string, string[]>() };
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} revealId="74" matches={new Set(['79'])} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection, outside the filter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand CWE-74' })).not.toBeInTheDocument();
  });
});

describe('Tree with a cycle in the hierarchy', { tags: ['theoretical'] }, () => {
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

describe('Tree under a filter', () => {
  const filtered: CweData = {
    meta: data.meta,
    nodes: {
      '284': { id: '284', name: 'Improper Access Control', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
      '285': { id: '285', name: 'Improper Authorization', abstraction: 'Class', status: 'Draft', description: '', url: '' },
      '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
      '707': { id: '707', name: 'Improper Neutralization', abstraction: 'Pillar', status: 'Incomplete', description: '', url: '' },
      '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
    },
    edges: [
      { from: '285', to: '284', type: 'ChildOf' },
      { from: '79', to: '285', type: 'ChildOf' },
    ],
  };
  const graph = buildGraph(filtered);

  it('opens the path to a match and subdues the rows outside the filter', () => {
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} matches={new Set(['79'])} />);
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting' })).not.toHaveClass('tree-label--context');
    expect(screen.getByRole('button', { name: 'CWE-284: Improper Access Control, outside the filter' })).toHaveClass('tree-label--context');
    expect(screen.getByRole('button', { name: 'CWE-285: Improper Authorization, outside the filter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^CWE-707/ })).not.toBeInTheDocument();
  });

  it('keeps the selected CWE on screen even when it is outside the filter', () => {
    render(<Tree graph={graph} selectedId="707" onSelect={() => {}} matches={new Set(['79'])} />);
    expect(screen.getByRole('button', { name: 'CWE-707: Improper Neutralization, outside the filter' })).toBeInTheDocument();
  });

  it('opens the Deprecated section for a deprecated match, and hides it otherwise', () => {
    const { unmount } = render(<Tree graph={graph} selectedId={null} onSelect={() => {}} matches={new Set(['71'])} />);
    expect(screen.getByRole('button', { name: 'Deprecated (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-71: DEPRECATED: DS_Store' })).toBeInTheDocument();
    unmount();
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} matches={new Set(['79'])} />);
    expect(screen.queryByRole('button', { name: /^Deprecated/ })).not.toBeInTheDocument();
  });

  it('says so when nothing matches', () => {
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} matches={new Set()} />);
    expect(screen.getByText('No CWEs match the filter.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^CWE-/ })).not.toBeInTheDocument();
  });

  it('shows the selected CWE and its path beside the message when nothing matches', () => {
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} matches={new Set()} />);
    expect(screen.getByText('No CWEs match the filter.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-284: Improper Access Control, outside the filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-285: Improper Authorization, outside the filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting, outside the filter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^CWE-707/ })).not.toBeInTheDocument();
  });

  // The graph's "+N more children" chip opens the drawer at a CWE to show
  // its children, which the filter would otherwise hide.
  it("opens a revealed CWE's children, as context rows unless they match", () => {
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} revealId="284" matches={new Set(['284'])} />);
    expect(screen.getByRole('button', { name: 'Collapse CWE-284' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-285: Improper Authorization, outside the filter' })).toHaveClass('tree-label--context');
    expect(screen.queryByRole('button', { name: /^CWE-79/ })).not.toBeInTheDocument();
  });

  it('lets the user collapse an auto-opened row', async () => {
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} matches={new Set(['79'])} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse CWE-285' }));
    expect(screen.queryByRole('button', { name: 'CWE-79: Cross-site Scripting' })).not.toBeInTheDocument();
  });
});
