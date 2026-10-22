import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';
import { RELATIONS_ANCHOR_ID } from '../src/components/DetailPanel';

const sampleData = {
  meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'd', url: '' },
  },
  edges: [],
};

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(sampleData) })),
    );
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
      /not original to this project.*The MITRE Corporation/,
    );
    expect(screen.getByRole('link', { name: 'Terms of Use' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/about/termsofuse.html',
    );
  });

  it('still renders the shell when the viewport reports as narrow', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('opens the tree from the hamburger named in the landing text', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    expect(screen.queryByRole('tree')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Browse the full tree' }));
    expect(screen.getByRole('tree')).toBeInTheDocument();
  });

  it('closes the tree once a CWE is picked on a narrow viewport', async () => {
    // Below the breakpoint the drawer covers the whole screen, so leaving it
    // open hides the graph the pick just re-centred.
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Weakness tree' }));
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(screen.queryByRole('dialog', { name: 'Weakness tree' })).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('cwe')).toBe('74');
  });

  it('keeps the tree open after a pick on a wide viewport, where the graph shows beside it', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE Visualizer' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Weakness tree' }));
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(screen.getByRole('dialog', { name: 'Weakness tree' })).toBeInTheDocument();
  });

  describe('?cwe= parameter', () => {
    it('selects the CWE it names', async () => {
      window.history.replaceState(null, '', '/?cwe=74');
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE-74: Injection' })).toBeInTheDocument());
    });

    it('still reports a numeric id that is not in the data as not found', async () => {
      window.history.replaceState(null, '', '/?cwe=99999');
      render(<App />);
      await waitFor(() => expect(screen.getByText('CWE-99999 was not found.')).toBeInTheDocument());
    });

    it.each([
      ['text that would be echoed back', 'evil text'],
      ['markup', '<img src=x onerror=alert(1)>'],
      ['an inherited object key', 'constructor'],
      ['the prototype key', '__proto__'],
    ])('ignores %s and shows the landing page', async (_, value) => {
      window.history.replaceState(null, '', `/?${new URLSearchParams({ cwe: value })}`);
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Start from a pillar' })).toBeInTheDocument());
      expect(screen.queryByText(/was not found/)).not.toBeInTheDocument();
    });
  });

  describe('graph overflow', () => {
    const node = (id: string, name: string) => ({ id, name, abstraction: 'Base', status: 'Draft', description: '', url: '' });
    // More children and more laterals than the stage shows, so it offers
    // the rest through its overflow chips.
    const crowded = {
      meta: sampleData.meta,
      nodes: Object.fromEntries(
        [
          node('1', 'Parent'),
          ...Array.from({ length: 14 }, (_, i) => node(`${300 + i}`, `Child ${i}`)),
          ...Array.from({ length: 9 }, (_, i) => node(`${500 + i}`, `Lateral ${i}`)),
        ].map((n) => [n.id, n]),
      ),
      edges: [
        ...Array.from({ length: 14 }, (_, i) => ({ from: `${300 + i}`, to: '1', type: 'ChildOf' })),
        ...Array.from({ length: 9 }, (_, i) => ({ from: '1', to: `${500 + i}`, type: 'CanFollow' })),
      ],
    };

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(crowded) })));
      window.history.replaceState(null, '', '/?cwe=1');
    });

    it('opens the tree at the parent whose hidden children were asked for', async () => {
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: /Show \d+ more children of CWE-1$/ }));
      const tree = screen.getByRole('dialog', { name: 'Weakness tree' });
      expect(within(tree).getByRole('button', { name: 'CWE-313: Child 13' })).toBeInTheDocument();
    });

    it('scrolls the detail card to its relations when the hidden relations are asked for', async () => {
      const scrollIntoView = vi.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrollIntoView, configurable: true });
      try {
        render(<App />);
        await userEvent.click(await screen.findByRole('button', { name: /Show \d+ more related weaknesses/ }));
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'start', behavior: 'smooth' });
        expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById(RELATIONS_ANCHOR_ID));
      } finally {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    });
  });

  it('closes the tree from its close button', async () => {
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Weakness tree' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close the weakness tree' }));
    expect(screen.queryByRole('dialog', { name: 'Weakness tree' })).not.toBeInTheDocument();
  });

  it('shows an error message when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })));
    render(<App />);
    await waitFor(() => expect(screen.getByText(/Failed to load CWE data/)).toBeInTheDocument());
  });
});
