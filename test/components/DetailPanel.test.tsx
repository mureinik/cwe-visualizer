import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html' },
    '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '80', to: '79', type: 'ChildOf' },
    { from: '79', to: '20', type: 'CanFollow' },
    { from: '79', to: '80', type: 'PeerOf' },
  ],
};

const graph = buildGraph(data);

describe('DetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<DetailPanel graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Select a CWE to see its details.')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    render(<DetailPanel graph={graph} selectedId="99999" onSelect={() => {}} />);
    expect(screen.getByText('CWE-99999 was not found.')).toBeInTheDocument();
  });

  it("renders the selected node's identity, badges and description", () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    expect(screen.getByText('XSS description')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('links out to the authoritative MITRE page', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('link', { name: 'View on cwe.mitre.org' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/data/definitions/79.html'
    );
  });

  it('groups relations into labelled sections with counts', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.getByText('Children (1)')).toBeInTheDocument();
    expect(screen.getByText('Peers (1)')).toBeInTheDocument();
    expect(screen.getByText('Sequence (1)')).toBeInTheDocument();
  });

  it('omits a section a node has no relations for', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.queryByText(/^Requires/)).not.toBeInTheDocument();
  });

  it('jumps the selection when a relation chip is clicked', async () => {
    const onSelect = vi.fn();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('warns when the selected entry is deprecated', () => {
    render(<DetailPanel graph={graph} selectedId="71" onSelect={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('MITRE has deprecated this entry.');
  });
});

describe('DetailPanel as a bottom sheet', () => {
  it('starts collapsed, with a control that says it will expand', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    const grabber = screen.getByRole('button', { name: 'Expand details' });
    expect(grabber).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands and collapses again when the grabber is used', async () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand details' }));
    const expanded = screen.getByRole('button', { name: 'Collapse details' });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(expanded);
    expect(screen.getByRole('button', { name: 'Expand details' })).toBeInTheDocument();
  });
});
