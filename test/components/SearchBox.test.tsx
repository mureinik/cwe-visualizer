import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from '../../src/components/SearchBox';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { searchNodes } from '../../src/lib/search';

// The real search, wrapped so a test can count how often it runs.
vi.mock('../../src/lib/search', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/search')>();
  return { ...actual, searchNodes: vi.fn(actual.searchNodes) };
});

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
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('lists matching nodes as the user types', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'injection');
    expect(screen.getByRole('option', { name: 'CWE-89: SQL Injection' })).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('option', { name: 'CWE-89: SQL Injection' }));
    expect(onSelect).toHaveBeenCalledWith('89');
    expect(input).toHaveValue('');
  });
});

describe('SearchBox keyboard behaviour', () => {
  it('marks the input as a combobox that expands on results', async () => {
    render(<SearchBox graph={buildGraph(data)} onSelect={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await userEvent.type(input, 'sql');
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('moves the active option with the arrow keys', async () => {
    render(<SearchBox graph={buildGraph(data)} onSelect={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'injection');
    await userEvent.keyboard('{ArrowDown}');
    const first = screen.getAllByRole('option')[0];
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('does not search again when the arrow keys only move the active option', async () => {
    const graph = buildGraph(data);
    render(<SearchBox graph={graph} onSelect={() => {}} />);
    await userEvent.type(screen.getByLabelText('Search CWEs'), 'i');
    vi.mocked(searchNodes).mockClear();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}');
    expect(screen.getByRole('option', { name: 'CWE-79: Cross-site Scripting' })).toHaveAttribute('aria-selected', 'true');
    expect(searchNodes).not.toHaveBeenCalled();
  });

  it('selects the active option on Enter', async () => {
    const onSelect = vi.fn();
    render(<SearchBox graph={buildGraph(data)} onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'SQL');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('89');
    expect(input).toHaveValue('');
  });

  it('dismisses the list on Escape without selecting', async () => {
    const onSelect = vi.fn();
    render(<SearchBox graph={buildGraph(data)} onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'SQL');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('SearchBox with no matches', () => {
  it('can be dismissed with Escape even when the list is empty', async () => {
    render(<SearchBox graph={buildGraph(data)} onSelect={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Search CWEs' });
    await userEvent.type(input, 'zzzzz');
    expect(screen.getByText('No matches')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('No matches')).not.toBeInTheDocument();
  });
});
