import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppHeader } from '../../src/components/AppHeader';
import { TreeDrawer } from '../../src/components/TreeDrawer';
import { DEFAULT_FILTER, matchingIds } from '../../src/lib/filter';
import { buildGraph, type CweData } from '../../src/lib/graph';
import { viewsData } from '../fixtures/views-data';

const data: CweData = {
  meta: { cweVersion: '4.20', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: '', url: '' },
  },
  edges: [],
};

const props = {
  graph: buildGraph(data),
  onSelect: () => {},
  drawerOpen: false,
  onToggleDrawer: () => {},
  edgeLabels: 'shown',
  onEdgeLabelsChange: () => {},
} as const;

describe('AppHeader', () => {
  it('shows the product name', () => {
    render(<AppHeader {...props} />);
    expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument();
  });

  it('shows which corpus version is loaded', () => {
    render(<AppHeader {...props} />);
    expect(screen.getByText('CWE 4.20')).toBeInTheDocument();
  });

  it('includes the search box and the theme toggle', () => {
    render(<AppHeader {...props} />);
    expect(screen.getByLabelText('Search CWEs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Switch to (light|dark) theme/ })).toBeInTheDocument();
  });

  it('puts the edge labels toggle to the left of the theme toggle', () => {
    render(<AppHeader {...props} />);
    const toggle = screen.getByRole('button', { name: 'Hide edge labels' });
    const theme = screen.getByRole('button', { name: /Switch to (light|dark) theme/ });
    expect(toggle.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links to the source repo on GitHub', () => {
    render(<AppHeader {...props} />);
    const link = screen.getByRole('link', { name: 'Source on GitHub' });
    expect(link).toHaveAttribute('href', 'https://github.com/mureinik/cwe-visualizer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('puts the release switcher to the left of the CWE version', async () => {
    vi.stubEnv('BASE_URL', '/v1/');
    const releases = [{ path: '/v1/', label: '1.0', unreleased: false, cweVersion: '4.20' }];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ releases }) })));
    render(<AppHeader {...props} />);
    const switcher = await screen.findByRole('button', { name: /^Release:/ });
    expect(switcher.compareDocumentPosition(screen.getByText('CWE 4.20')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('AppHeader filter button', () => {
  const graph = buildGraph(viewsData);

  function renderWithFilter(filter = DEFAULT_FILTER, onFilterChange = vi.fn()) {
    render(
      <AppHeader
        {...props}
        graph={graph}
        filter={filter}
        matches={matchingIds(graph, filter)}
        onFilterChange={onFilterChange}
      />,
    );
    return screen.getByRole('button', { name: /^Filter/ });
  }

  it('reads Filter, with no badge, for the default filter', () => {
    const button = renderWithFilter();
    expect(button).toHaveAccessibleName('Filter');
    expect(button).toHaveTextContent(/^Filter$/);
  });

  it('counts what is set for a view plus a phase', () => {
    const button = renderWithFilter({ viewId: '1435', groupId: null, phase: 'Implementation' });
    expect(button).toHaveAccessibleName('Filter, 2 set');
    expect(button).toHaveTextContent(/^Filter2$/);
  });

  it('comes after the search box', () => {
    const button = renderWithFilter();
    expect(screen.getByLabelText('Search CWEs').compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('opens the panel; Escape closes it and focuses the button', async () => {
    const button = renderWithFilter();
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'Filter' });
    expect(button).toHaveAttribute('aria-controls', panel.id);
    await userEvent.click(screen.getByRole('combobox', { name: 'View' }));
    await userEvent.keyboard('{Escape}');
    // The first Escape only closes the open list.
    expect(screen.getByRole('dialog', { name: 'Filter' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('takes one Escape at a time over the open tree drawer: list, then panel, then drawer', async () => {
    const onCloseDrawer = vi.fn();
    render(
      <>
        <TreeDrawer open onClose={onCloseDrawer} graph={graph} selectedId={null} onSelect={() => {}} />
        <AppHeader {...props} graph={graph} drawerOpen onFilterChange={() => {}} />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    await userEvent.click(screen.getByRole('combobox', { name: 'View' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Filter' })).toBeInTheDocument();
    expect(onCloseDrawer).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filter' })).not.toBeInTheDocument();
    expect(onCloseDrawer).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onCloseDrawer).toHaveBeenCalledOnce();
  });

  it('toggles the panel from the button', async () => {
    const button = renderWithFilter();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the panel on a click outside it, but not inside it', async () => {
    const button = renderWithFilter();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('dialog', { name: 'Filter' }));
    expect(screen.getByRole('dialog', { name: 'Filter' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('heading', { name: 'CWE Visualizer' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the panel when focus tabs out of it', async () => {
    const button = renderWithFilter({ ...DEFAULT_FILTER, phase: 'Implementation' });
    await userEvent.click(button);
    screen.getByRole('button', { name: 'Clear all' }).focus();
    await userEvent.tab();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('changes the filter in place from the panel', async () => {
    const onFilterChange = vi.fn();
    const button = renderWithFilter(DEFAULT_FILTER, onFilterChange);
    await userEvent.click(button);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phase' }), 'Implementation');
    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_FILTER, phase: 'Implementation' });
    expect(screen.getByRole('dialog', { name: 'Filter' })).toBeInTheDocument();
  });

  it('shows the panel as a sheet, with a close button that focuses the button, when narrow', async () => {
    render(
      <AppHeader {...props} graph={graph} filter={DEFAULT_FILTER} narrow onFilterChange={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'Filter' });
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Filter' })).toHaveClass('filter-panel--sheet');
    await userEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('has no filter button without a filter to change', () => {
    render(<AppHeader {...props} />);
    expect(screen.queryByRole('button', { name: /^Filter/ })).not.toBeInTheDocument();
  });
});
