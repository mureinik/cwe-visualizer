import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html' },
  },
  edges: [{ from: '79', to: '74', type: 'ChildOf' }],
};

describe('DetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Select a CWE to see its details.')).toBeInTheDocument();
  });

  it("renders the selected node's name, description and metadata", () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('CWE-79: Cross-site Scripting')).toBeInTheDocument();
    expect(screen.getByText('XSS description')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
  });

  it('does not render a related-weaknesses section for a node with none', () => {
    const graph = buildGraph(data);
    render(<DetailPanel graph={graph} selectedId="74" onSelect={() => {}} />);
    expect(screen.queryByText('Related weaknesses')).not.toBeInTheDocument();
  });

  it('lists non-hierarchy relationships and jumps selection on click', async () => {
    const extended: CweData = {
      ...data,
      edges: [...data.edges, { from: '79', to: '80', type: 'PeerOf' }],
      nodes: {
        ...data.nodes,
        '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
      },
    };
    const graph = buildGraph(extended);
    const onSelect = vi.fn();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={onSelect} />);
    expect(screen.getByText('PeerOf')).toBeInTheDocument();
    await userEvent.click(screen.getByText('CWE-80: HTML Tag Neutralization'));
    expect(onSelect).toHaveBeenCalledWith('80');
  });
});
