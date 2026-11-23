import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/App';

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

  it('fetches the prebuilt data from the domain root by default', () => {
    render(<App />);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/data/cwe.json');
  });

  it('fetches the prebuilt data from under the base path the app is built for', () => {
    // Vite's `base` option. vite.config.ts doesn't set it today, but a deploy
    // under a sub-path (a fork on GitHub Pages, say) would, so this is real.
    vi.stubEnv('BASE_URL', '/cwe-visualizer/');
    render(<App />);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/cwe-visualizer/data/cwe.json');
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

  describe('edge labels toggle', () => {
    const related = {
      ...sampleData,
      nodes: {
        ...sampleData.nodes,
        '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'd', url: '' },
      },
      edges: [{ from: '79', to: '74', type: 'ChildOf' }],
    };

    beforeEach(() => {
      localStorage.clear();
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(related) })));
      window.history.replaceState(null, '', '/?cwe=79');
    });

    it('hides the graph\'s labels, and shows them again', async () => {
      const { container } = render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Hide edge labels' }));
      expect(container.querySelector('.graph-edge__label')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Show edge labels' }));
      expect(container.querySelector('.graph-edge__label')).not.toBeNull();
    });

    it('remembers the choice on the next visit', async () => {
      const first = render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Hide edge labels' }));
      first.unmount();

      const { container } = render(<App />);
      expect(await screen.findByRole('button', { name: 'Show edge labels' })).toBeInTheDocument();
      expect(container.querySelector('.graph-edge')).not.toBeNull();
      expect(container.querySelector('.graph-edge__label')).toBeNull();
    });
  });

  describe('?cwe= parameter', () => {
    it('selects the CWE it names', async () => {
      window.history.replaceState(null, '', '/?cwe=74');
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'CWE-74: Injection' })).toBeInTheDocument());
    });

    it('records a pick in the address, keeping its other parameters', async () => {
      window.history.replaceState(null, '', '/?ref=share');
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Weakness tree' }));
      await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
      const params = new URLSearchParams(window.location.search);
      expect(params.get('cwe')).toBe('74');
      expect(params.get('ref')).toBe('share');
    });

    it('replaces the history entry on a pick instead of adding one', async () => {
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Weakness tree' }));
      const entries = window.history.length;
      await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
      expect(window.history.length).toBe(entries);
    });

    it('restores a pick when the page is loaded again', async () => {
      const { unmount } = render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Weakness tree' }));
      await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
      unmount();
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'CWE-74: Injection' })).toBeInTheDocument();
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
      ['a script tag', '<script>alert(1)</script>'],
      ['a number followed by markup', '74<b>x</b>'],
      ['a number followed by markup after a line break', '74\n<b>x</b>'],
      ['a signed number', '-74'],
      ['non-ASCII digits', '\u0667\u0664'],
    ])('ignores %s and shows the landing page', async (_, value) => {
      window.history.replaceState(null, '', `/?${new URLSearchParams({ cwe: value })}`);
      render(<App />);
      await waitFor(() => expect(screen.getByRole('heading', { name: 'Start from a pillar' })).toBeInTheDocument());
      expect(screen.queryByText(/was not found/)).not.toBeInTheDocument();
    });
  });

  describe('filter parameters', () => {
    const node = (id: string, name: string, phases?: { name: string }[]) => ({
      id,
      name,
      abstraction: 'Base',
      status: 'Draft',
      description: '',
      url: '',
      ...(phases && { phases }),
    });
    const filtered = {
      meta: sampleData.meta,
      nodes: {
        '74': node('74', 'Injection'),
        '79': node('79', 'Cross-site Scripting', [{ name: 'Implementation' }]),
      },
      edges: [{ from: '79', to: '74', type: 'ChildOf' }],
      phases: [{ name: 'Implementation' }],
      views: [
        { id: '1000', name: 'Research Concepts', groupIds: [], memberIds: [] },
        { id: '10', name: 'Top Ten', groupIds: [], memberIds: ['79'] },
      ],
      groups: {},
    };

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(filtered) })));
    });

    it('drops a view this release lacks from the address, says so, and still selects the CWE', async () => {
      window.history.replaceState(null, '', '/?cwe=79&view=9999');
      render(<App />);
      expect(await screen.findByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
      expect(screen.getByText('Not in CWE 4.15, so ignored: view 9999')).toBeInTheDocument();
      const params = new URLSearchParams(window.location.search);
      expect(params.has('view')).toBe(false);
      expect(params.get('cwe')).toBe('79');
    });

    it.each(['view', 'group', 'phase'])('renders markup in %s as nothing but a generic notice', async (param) => {
      const search = new URLSearchParams({ cwe: '79', [param]: '<img src=x onerror=alert(1)><b>bold</b>' });
      window.history.replaceState(null, '', `/?${search}`);
      const { container } = render(<App />);
      expect(await screen.findByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
      expect(screen.getByText(`Not in CWE 4.15, so ignored: an unrecognised ${param}`)).toBeInTheDocument();
      expect(container.querySelector('img, b, [onerror]')).toBeNull();
      expect(container.innerHTML).not.toContain('onerror');
      expect(new URLSearchParams(window.location.search).has(param)).toBe(false);
    });

    describe('language parameters', () => {
      const withLanguages = { ...filtered, languages: [{ name: 'C', classes: [], memberIds: ['79'] }], languageAgnosticIds: [] };

      beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(withLanguages) })));
      });

      // The tree remembers what the reader collapsed; a new filter starts it afresh.
      it('remounts the tree when the language changes through the filter panel', async () => {
        const twoLanguages = {
          ...withLanguages,
          languages: [...withLanguages.languages, { name: 'SQL', classes: [], memberIds: ['79'] }],
        };
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(twoLanguages) })));
        window.history.replaceState(null, '', '/?language=C');
        render(<App />);
        await userEvent.click(await screen.findByRole('button', { name: 'Weakness tree' }));
        await userEvent.click(screen.getByRole('button', { name: 'Collapse CWE-74' }));
        expect(screen.getByRole('button', { name: 'Expand CWE-74' })).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Filter, 1 set' }));
        await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'SQL');
        expect(await screen.findByRole('button', { name: 'Collapse CWE-74' })).toBeInTheDocument();
      });

      it('renders markup in language as nothing but a generic notice', async () => {
        const search = new URLSearchParams({ cwe: '79', language: '<img src=x onerror=alert(1)><b>bold</b>' });
        window.history.replaceState(null, '', `/?${search}`);
        const { container } = render(<App />);
        expect(await screen.findByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
        expect(screen.getByText('Not in CWE 4.15, so ignored: an unrecognised language')).toBeInTheDocument();
        expect(container.querySelector('img, b, [onerror]')).toBeNull();
        expect(container.innerHTML).not.toContain('onerror');
        expect(new URLSearchParams(window.location.search).has('language')).toBe(false);
      });

      it('renders markup in anyLanguage as nothing but a generic notice', async () => {
        const search = new URLSearchParams({ cwe: '79', language: 'C', anyLanguage: '<img src=x onerror=alert(1)><b>bold</b>' });
        window.history.replaceState(null, '', `/?${search}`);
        const { container } = render(<App />);
        expect(await screen.findByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
        expect(screen.getByText('Not in CWE 4.15, so ignored: any language')).toBeInTheDocument();
        expect(container.querySelector('img, b, [onerror]')).toBeNull();
        expect(container.innerHTML).not.toContain('onerror');
        const params = new URLSearchParams(window.location.search);
        expect(params.get('language')).toBe('C');
        expect(params.has('anyLanguage')).toBe(false);
      });

      it('labels the chip C when anyLanguage is dropped from the address', async () => {
        const search = new URLSearchParams({ cwe: '79', language: 'C', anyLanguage: '<img src=x onerror=alert(1)>' });
        window.history.replaceState(null, '', `/?${search}`);
        render(<App />);
        expect(await screen.findByRole('button', { name: 'Remove filter: C' })).toBeInTheDocument();
        expect(screen.queryByText('C + any language')).not.toBeInTheDocument();
      });
    });

    it('shows the view it names in the filter bar', async () => {
      window.history.replaceState(null, '', '/?view=10');
      render(<App />);
      expect(await screen.findByRole('button', { name: 'Remove filter: Top Ten' })).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('1 CWE');
    });

    it('filters the landing panel by the view it names', async () => {
      window.history.replaceState(null, '', '/?view=10');
      render(<App />);
      expect(
        await screen.findByRole('button', { name: 'CWE-74: Injection, 1 of 1 weaknesses beneath it match the filter' }),
      ).toHaveClass('pillar-card--context');
    });

    it('drops view 1000 from the address without reporting it', async () => {
      window.history.replaceState(null, '', '/?view=1000&ref=share');
      render(<App />);
      await screen.findByRole('heading', { name: 'Start from a pillar' });
      expect(window.location.search).toBe('?ref=share');
      expect(screen.queryByText(/so ignored/)).not.toBeInTheDocument();
    });

    it('updates the address when a filter is removed, keeping the selected CWE', async () => {
      window.history.replaceState(null, '', '/?cwe=79&view=10&phase=Implementation');
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Remove filter: Top Ten' }));
      const params = new URLSearchParams(window.location.search);
      expect(params.has('view')).toBe(false);
      expect(params.get('phase')).toBe('Implementation');
      expect(params.get('cwe')).toBe('79');
    });

    it('stops reporting dropped values once the filter changes', async () => {
      window.history.replaceState(null, '', '/?view=9999&phase=Implementation');
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Remove filter: Implementation' }));
      expect(screen.queryByText(/so ignored/)).not.toBeInTheDocument();
    });

    it('keeps the filter in the address when a CWE is picked', async () => {
      window.history.replaceState(null, '', '/?view=10');
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: /^CWE-74: Injection/ }));
      const params = new URLSearchParams(window.location.search);
      expect(params.get('view')).toBe('10');
      expect(params.get('cwe')).toBe('74');
    });

    it('clears the filter from the landing panel when nothing matches', async () => {
      // Valid on its own, but no CWE in view 10 is introduced in this phase.
      const noneMatch = {
        ...filtered,
        nodes: { ...filtered.nodes, '74': node('74', 'Injection', [{ name: 'Testing' }]) },
        phases: [{ name: 'Implementation' }, { name: 'Testing' }],
      };
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(noneMatch) })));
      window.history.replaceState(null, '', '/?view=10&phase=Testing');
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: 'Clear filter' }));
      expect(window.location.search).toBe('');
      expect(screen.getByRole('button', { name: 'CWE-74: Injection, 1 weaknesses beneath it' })).toBeInTheDocument();
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

    it('scrolls the detail card to the first hidden relation when the hidden relations are asked for', async () => {
      // Not to the top of the list: on CWE-119 that stops among 37 parents
      // and children, and on a phone the flash played out of sight (#260).
      const scrollIntoView = vi.fn();
      Object.defineProperty(Element.prototype, 'scrollIntoView', { value: scrollIntoView, configurable: true });
      try {
        render(<App />);
        await userEvent.click(await screen.findByRole('button', { name: /Show \d+ more related weaknesses/ }));
        expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'center', behavior: 'smooth' });
        expect(scrollIntoView.mock.contexts[0]).toBe(screen.getByRole('button', { name: 'CanFollow CWE-504: Lateral 4' }));
      } finally {
        delete (Element.prototype as Partial<Element>).scrollIntoView;
      }
    });

    it('flashes the hidden relations in the detail card, and only those', async () => {
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: /Show \d+ more related weaknesses/ }));
      // The stage draws four laterals a side, so 504-508 are the hidden ones.
      const hidden = screen.getByRole('button', { name: 'CanFollow CWE-504: Lateral 4' });
      expect(hidden).toHaveClass('relation-chip--flash');
      expect(hidden).toHaveFocus();
      expect(screen.getByRole('button', { name: 'CanFollow CWE-508: Lateral 8' })).toHaveClass('relation-chip--flash');
      expect(screen.getByRole('button', { name: 'CanFollow CWE-500: Lateral 0' })).not.toHaveClass('relation-chip--flash');
    });

    it('drops the flash when another CWE is selected', async () => {
      render(<App />);
      await userEvent.click(await screen.findByRole('button', { name: /Show \d+ more related weaknesses/ }));
      await userEvent.click(screen.getByRole('button', { name: 'CWE-300: Child 0' }));
      expect(document.querySelector('.relation-chip--flash')).toBeNull();
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
