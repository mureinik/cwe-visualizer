import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from '../../src/components/FilterBar';
import { DEFAULT_FILTER } from '../../src/lib/filter';
import { buildGraph } from '../../src/lib/graph';
import { filterData } from '../fixtures/filter-data';

const graph = buildGraph(filterData);

describe('FilterBar', () => {
  it('renders nothing for the default filter', () => {
    const { container } = render(
      <FilterBar graph={graph} filter={DEFAULT_FILTER} matchCount={5} dropped={[]} onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a chip for the view and the phase, and how many CWEs match', () => {
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '10', groupId: null, phase: 'AI:Testing' }}
        matchCount={19}
        dropped={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Ten')).toHaveAttribute('title', 'Ten');
    expect(screen.getByText('Testing (AI)')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('19 CWEs');
  });

  it('says CWE, not CWEs, for a single match', () => {
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '10', groupId: '20', phase: null }}
        matchCount={1}
        dropped={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/^1 CWE$/);
  });

  it('returns the view to 1000 and clears the group when the view chip is removed', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '10', groupId: '20', phase: 'Implementation' }}
        matchCount={1}
        dropped={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Ten' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '1000', groupId: null, phase: 'Implementation' });
  });

  it('clears only the group when the group chip is removed', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '10', groupId: '20', phase: 'Implementation' }}
        matchCount={1}
        dropped={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Group' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '10', groupId: null, phase: 'Implementation' });
  });

  it('clears only the phase when the phase chip is removed', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '10', groupId: '20', phase: 'Implementation' }}
        matchCount={1}
        dropped={[]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove filter: Implementation' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '10', groupId: '20', phase: null });
  });

  it('shows only the phase chip on view 1000', () => {
    render(
      <FilterBar
        graph={graph}
        filter={{ viewId: '1000', groupId: null, phase: 'Implementation' }}
        matchCount={1}
        dropped={[]}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByRole('button', { name: /^Remove filter: / })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove filter: Implementation' })).toBeInTheDocument();
  });

  it('says which values from the address were ignored', () => {
    render(
      <FilterBar graph={graph} filter={DEFAULT_FILTER} matchCount={5} dropped={['view 9999', 'phase Nope']} onChange={() => {}} />,
    );
    expect(screen.getByText('Not in CWE 4.15, so ignored: view 9999, phase Nope')).toBeInTheDocument();
  });
});
