import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../../src/components/SearchBox';
import { buildGraph, type CweData } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '89': { id: '89', name: 'SQL Injection', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [],
};

describe('SearchBox', () => {
  it('shows no results list before typing', () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('lists matching nodes as the user types', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'injection');
    expect(screen.getByText('CWE-89: SQL Injection')).toBeInTheDocument();
  });

  it('shows a no-matches message for an unmatched query', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'zzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('calls onSelect and clears the query when a result is picked', async () => {
    const graph = buildGraph(data);
    const onSelect = vi.fn();
    render(<SearchBox graph={graph} onSelect={onSelect} />);
    const input = screen.getByLabelText('Search CWEs');
    await userEvent.type(input, 'SQL');
    await userEvent.click(screen.getByText('CWE-89: SQL Injection'));
    expect(onSelect).toHaveBeenCalledWith('89');
    expect(input).toHaveValue('');
  });
});
