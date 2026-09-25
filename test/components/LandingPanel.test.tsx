import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingPanel } from '../../src/components/LandingPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const node = (id: string, name: string, abstraction: string, status = 'Draft') => ({
  id, name, abstraction, status, description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '284': node('284', 'Improper Access Control', 'Pillar'),
    '707': node('707', 'Improper Neutralization', 'Pillar'),
    '285': node('285', 'Improper Authorization', 'Class'),
    '79': node('79', 'Cross-site Scripting', 'Base'),
    '71': node('71', 'DEPRECATED: DS_Store', 'Variant', 'Deprecated'),
  },
  edges: [
    { from: '285', to: '284', type: 'ChildOf' },
    { from: '79', to: '285', type: 'ChildOf' },
  ],
};

const graph = buildGraph(data);

describe('LandingPanel', () => {
  it('says how large the corpus is, and which version', () => {
    render(<LandingPanel graph={graph} onSelect={() => {}} onOpenTree={() => {}} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/4\.20/)).toBeInTheDocument();
  });

  it('offers every pillar as a starting point, and no deprecated orphan', () => {
    render(<LandingPanel graph={graph} onSelect={() => {}} onOpenTree={() => {}} />);
    expect(screen.getByRole('button', { name: /^CWE-284: Improper Access Control/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CWE-707: Improper Neutralization/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /CWE-71/ })).not.toBeInTheDocument();
  });

  it('shows how much of the corpus sits beneath each pillar', () => {
    render(<LandingPanel graph={graph} onSelect={() => {}} onOpenTree={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'CWE-284: Improper Access Control, 2 weaknesses beneath it' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'CWE-707: Improper Neutralization, 0 weaknesses beneath it' })
    ).toBeInTheDocument();
  });

  it('selects the pillar when its card is clicked', async () => {
    const onSelect = vi.fn();
    render(<LandingPanel graph={graph} onSelect={onSelect} onOpenTree={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /^CWE-284/ }));
    expect(onSelect).toHaveBeenCalledWith('284');
  });
  it('makes the hamburger it mentions actually open the tree', async () => {
    const onOpenTree = vi.fn();
    render(<LandingPanel graph={graph} onSelect={() => {}} onOpenTree={onOpenTree} />);
    await userEvent.click(screen.getByRole('button', { name: 'Browse the full tree' }));
    expect(onOpenTree).toHaveBeenCalled();
  });

  it('does not select a CWE when the tree control is used', async () => {
    const onSelect = vi.fn();
    render(<LandingPanel graph={graph} onSelect={onSelect} onOpenTree={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Browse the full tree' }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
