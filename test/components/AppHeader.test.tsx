import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from '../../src/components/AppHeader';
import { buildGraph, type CweData } from '../../src/lib/graph';

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
