import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useMediaQuery, NARROW_QUERY } from '../../src/lib/media';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

/** A matchMedia whose result can be flipped, notifying its listeners like a real one. */
function stubChangingMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return {
    listeners,
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useMediaQuery', () => {
  it('reports a match', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(true);
  });

  it('reports no match', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
  });

  it('updates when the query starts or stops matching', () => {
    const media = stubChangingMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(NARROW_QUERY));
    act(() => media.set(true));
    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);
  });

  it('stops listening once unmounted', () => {
    const media = stubChangingMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery(NARROW_QUERY));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  // Every supported browser has matchMedia (only jsdom lacks it), and the app
  // only renders in the browser. The guard stays: most component tests run
  // without a matchMedia stub and rely on it.
  describe('outside a browser', { tags: ['theoretical'] }, () => {
    it('returns false rather than throwing where matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);
      expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
    });

    it('assumes the wide layout when rendered on the server', () => {
      stubMatchMedia(true);
      function Probe() {
        return useMediaQuery(NARROW_QUERY) ? 'narrow' : 'wide';
      }
      expect(renderToString(<Probe />)).toBe('wide');
    });
  });
});
