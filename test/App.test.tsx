import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

const sampleData = {
  meta: { cweVersion: '4.15', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'd', url: '' },
  },
  edges: [],
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => sampleData }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a loading state before data arrives', () => {
    render(<App />);
    expect(screen.getByText('Loading CWE data…')).toBeInTheDocument();
  });

  it('renders the header, and the tree once the drawer is opened', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Weakness tree' }));
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
  });

  it('credits MITRE for the CWE content once data has loaded', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('contentinfo')).toBeInTheDocument());
    expect(screen.getByRole('contentinfo')).toHaveTextContent(
      /not original to this project.*The MITRE Corporation/
    );
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/about/termsofuse.html'
    );
  });

  it('shows an error message when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Failed to load CWE data/)).toBeInTheDocument());
  });
});
