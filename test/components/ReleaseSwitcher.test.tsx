import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReleaseSwitcher } from '../../src/components/ReleaseSwitcher';
import type { ReleaseManifest } from '../../src/lib/releases';

const manifest: ReleaseManifest = {
  releases: [
    { path: '/latest/', label: 'Latest', unreleased: true, cweVersion: '4.22' },
    { path: '/v1.1/', label: '1.1', unreleased: false, cweVersion: '4.21' },
    { path: '/v1/', label: '1.0', unreleased: false, cweVersion: '4.20' },
  ],
};

function serve(json: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(json) })));
}

async function renderAt(base: string) {
  vi.stubEnv('BASE_URL', base);
  render(<ReleaseSwitcher />);
  return screen.findByRole('button', { name: /^Release:/ });
}

describe('ReleaseSwitcher', () => {
  beforeEach(() => {
    serve(manifest);
  });

  it('reads the manifest from the site root, whatever release it is', async () => {
    await renderAt('/v1/');
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/data/releases.json');
  });

  it('shows only the current release until opened', async () => {
    const button = await renderAt('/v1.1/');
    expect(button).toHaveTextContent(/^1\.1/);
    expect(button).toHaveAccessibleName('Release: 1.1 (CWE 4.21)');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list', { name: 'Releases' })).not.toBeInTheDocument();
  });

  it('lists every release with the CWE version it serves, marking /latest/ unreleased', async () => {
    const button = await renderAt('/v1.1/');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Latest, unreleased (CWE 4.22)',
      '1.1 (CWE 4.21)',
      '1.0 (CWE 4.20)',
    ]);
    expect(links[1]).toHaveAttribute('aria-current', 'page');
    expect(links[0]).not.toHaveAttribute('aria-current');
  });

  it('labels /latest/ as Latest on the button', async () => {
    const button = await renderAt('/latest/');
    expect(button).toHaveTextContent(/^Latest/);
    expect(button).toHaveAccessibleName('Release: Latest, unreleased (CWE 4.22)');
  });

  it('keeps the selected CWE when switching', async () => {
    window.history.replaceState(null, '', '/v1.1/?cwe=79#x');
    await userEvent.click(await renderAt('/v1.1/'));
    expect(screen.getByRole('link', { name: '1.0 (CWE 4.20)' })).toHaveAttribute('href', '/v1/?cwe=79#x');
    expect(screen.getByRole('link', { name: /^Latest/ })).toHaveAttribute('href', '/latest/?cwe=79#x');
  });

  it('leaves out the CWE version of a release whose data was unreadable', async () => {
    serve({ releases: [{ path: '/v1/', label: '1.0', unreleased: false, cweVersion: null }] });
    await userEvent.click(await renderAt('/v1/'));
    expect(screen.getByRole('link', { name: '1.0' })).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the button', async () => {
    const button = await renderAt('/v1/');
    await userEvent.click(button);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('list', { name: 'Releases' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on a click outside, and on a second click of the button', async () => {
    render(<p>elsewhere</p>);
    const button = await renderAt('/v1/');
    await userEvent.click(button);
    await userEvent.click(screen.getByText('elsewhere'));
    expect(screen.queryByRole('list', { name: 'Releases' })).not.toBeInTheDocument();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(screen.queryByRole('list', { name: 'Releases' })).not.toBeInTheDocument();
  });

  it('stays open while tabbing through its releases, and closes when focus leaves', async () => {
    vi.stubEnv('BASE_URL', '/v1/');
    render(
      <>
        <ReleaseSwitcher />
        <button type="button">after</button>
      </>,
    );
    const button = await screen.findByRole('button', { name: /^Release:/ });
    await userEvent.click(button);
    await userEvent.tab();
    expect(screen.getByRole('link', { name: /^Latest/ })).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'after' })).toHaveFocus();
    expect(screen.queryByRole('list', { name: 'Releases' })).not.toBeInTheDocument();
  });

  describe('renders nothing', () => {
    async function expectHidden() {
      await waitFor(() => expect(fetch).toHaveBeenCalled());
      // Let the fetch settle before checking that nothing appeared.
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    }

    it('outside the production layout, where the root has no manifest', async () => {
      // A PR preview or the dev server: a 404, or the app's own index.html,
      // which isn't JSON.
      vi.stubEnv('BASE_URL', '/');
      serve(null, false);
      render(<ReleaseSwitcher />);
      await expectHidden();
    });

    it('when the root answers with something other than JSON', async () => {
      vi.stubEnv('BASE_URL', '/');
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('html')) })));
      render(<ReleaseSwitcher />);
      await expectHidden();
    });

    it('when the request fails', async () => {
      vi.stubEnv('BASE_URL', '/v1/');
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
      render(<ReleaseSwitcher />);
      await expectHidden();
    });

    it('when the app is not one of the releases listed', async () => {
      // A fork deployed under its own base path, with no manifest of its own.
      vi.stubEnv('BASE_URL', '/cwe-visualizer/');
      render(<ReleaseSwitcher />);
      await expectHidden();
    });
  });
});
