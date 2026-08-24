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
    expect(screen.getByText('CWE-74: Injection')).toBeInTheDocument();
    expect(screen.queryByText('CWE-79: Cross-site Scripting')).not.toBeInTheDocument();
  });

  it('expands to reveal children when the toggle is clicked', async () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand CWE-74' }));
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
  });

  it('calls onSelect with the node id when a label is clicked', async () => {
    const graph = buildGraph(data);
    const onSelect = vi.fn();
    render(<Tree graph={graph} selectedId={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText('CWE-74: Injection'));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('auto-expands ancestors of the selected node', () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
  });

  it('lets the user collapse an auto-expanded ancestor of the selected node', async () => {
    const graph = buildGraph(data);
    render(<Tree graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse CWE-74' }));
    expect(screen.queryByText('CWE-79: Cross-site Scripting')).not.toBeInTheDocument();
  });
});
