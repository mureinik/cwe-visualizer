import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  readStoredTheme,
  storeTheme,
  applyTheme,
  systemTheme,
} from '../../src/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns null when nothing has been stored', () => {
    expect(readStoredTheme()).toBeNull();
  });

  it('round-trips a stored preference', () => {
    storeTheme('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('ignores a stored value that is not a known theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'chartreuse');
    expect(readStoredTheme()).toBeNull();
  });

  it('returns null rather than throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    expect(readStoredTheme()).toBeNull();
  });

  it('does not throw when storage rejects a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storeTheme('dark')).not.toThrow();
  });

  it('applies the theme to the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('reads the system preference from matchMedia', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: query.includes('dark'), media: query }))
    );
    expect(systemTheme()).toBe('dark');
  });

  it('falls back to light when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(systemTheme()).toBe('light');
  });
});
