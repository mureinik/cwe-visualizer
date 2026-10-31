import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html' },
    '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '' },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
    // No entry in today's data is Obsolete or Usable, but the schema allows both.
    '72': { id: '72', name: 'Superseded entry', abstraction: 'Variant', status: 'Obsolete', description: '', url: '' },
    '73': { id: '73', name: 'Usable entry', abstraction: 'Base', status: 'Usable', description: '', url: '' },
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
      'https://cwe.mitre.org/data/definitions/79.html',
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

  it('warns when the selected entry is obsolete', () => {
    render(<DetailPanel graph={graph} selectedId="72" onSelect={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('MITRE has marked this entry obsolete.');
  });

  it('shows a usable entry like a stable one, with its status and no warning', () => {
    render(<DetailPanel graph={graph} selectedId="73" onSelect={() => {}} />);
    expect(screen.getByText('Usable')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

// The graph's lateral "+N more" chip on CWE-123 hides two relations whose
// chips are already on screen, so scrolling alone shows nothing (issue #260).
describe('DetailPanel flashing relations', () => {
  const flashOf = (token: number) => ({ relations: [{ id: '20', type: 'CanFollow' }], token });
  const chip = (name: string) => screen.getByRole('button', { name });
  const canFollow20 = 'CanFollow CWE-20: Improper Input Validation';

  it('flashes only the relations it is given', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(chip(canFollow20)).toHaveClass('relation-chip--flash');
    expect(chip('PeerOf CWE-80: HTML Tag Neutralization')).not.toHaveClass('relation-chip--flash');
    expect(chip('CWE-74: Injection')).not.toHaveClass('relation-chip--flash');
  });

  it('flashes nothing without a flash', () => {
    const { container } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(container.querySelector('.relation-chip--flash')).toBeNull();
  });

  it('moves focus to the first flashed relation', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(chip(canFollow20)).toHaveFocus();
  });

  it('opens the bottom sheet, whose peek shows no relations', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(screen.getByRole('button', { name: 'Collapse details' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets the sheet be collapsed after a flash', async () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse details' }));
    expect(screen.getByRole('button', { name: 'Expand details' })).toBeInTheDocument();
  });

  it('flashes again when asked again, with a fresh chip whose animation restarts', () => {
    const { rerender } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    const first = chip(canFollow20);
    rerender(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(2)} />);
    const second = chip(canFollow20);
    expect(second).not.toBe(first);
    expect(second).toHaveClass('relation-chip--flash');
    expect(second).toHaveFocus();
  });
});

describe('DetailPanel relation direction', () => {
  it('names the relation on each lateral chip, since the heading cannot', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    // "Sequence" covers both CanPrecede and CanFollow, so the chip must say which.
    expect(screen.getByRole('button', { name: 'CanFollow CWE-20: Improper Input Validation' })).toBeInTheDocument();
  });

  it('leaves hierarchy chips unadorned, because the heading already says it', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
  });
});
