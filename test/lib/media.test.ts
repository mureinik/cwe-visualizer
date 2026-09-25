import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMediaQuery, NARROW_QUERY } from '../../src/lib/media';

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

describe('useMediaQuery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a match', () => {
    stubMatchMedia(true);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(true);
  });

  it('reports no match', () => {
    stubMatchMedia(false);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
  });

  it('returns false rather than throwing where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(renderHook(() => useMediaQuery(NARROW_QUERY)).result.current).toBe(false);
  });
});
