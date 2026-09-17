import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeDrawer } from '../../src/components/TreeDrawer';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '284': { id: '284', name: 'Improper Access Control', abstraction: 'Pillar', status: 'Draft', description: '', url: '' },
    '285': { id: '285', name: 'Improper Authorization', abstraction: 'Class', status: 'Draft', description: '', url: '' },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
  },
  edges: [{ from: '285', to: '284', type: 'ChildOf' }],
};

const graph = buildGraph(data);

describe('TreeDrawer', () => {
  it('renders nothing accessible when closed', () => {
    render(<TreeDrawer open={false} onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
  });

  it('renders the tree when open', () => {
    render(<TreeDrawer open onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CWE-284: Improper Access Control' })).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<TreeDrawer open onClose={onClose} graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();
    render(<TreeDrawer open onClose={onClose} graph={graph} selectedId={null} onSelect={() => {}} />);
    await userEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });

  it('moves focus into the drawer when it opens', () => {
    render(<TreeDrawer open onClose={() => {}} graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close the weakness tree' })).toHaveFocus();
  });
});
