import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tree } from '../../src/components/Tree';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
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
