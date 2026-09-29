import { describe, it, expect, vi } from 'vitest';

// Vitest's unstubGlobals and restoreMocks options undo stubbed globals and
// spies after every test, so a test that forgets its own cleanup can't leak
// into the next one. The second test fails if either option is dropped.
// Tests in a file run in order, so the first always runs before the second.
describe('test isolation', () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;

  it('stubs a global and spies on a method without cleaning up', () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(Date, 'now').mockReturnValue(0);
    expect(globalThis.fetch).not.toBe(originalFetch);
    expect(Date.now()).toBe(0);
  });

  it('starts the next test with the originals restored', () => {
    expect(globalThis.fetch).toBe(originalFetch);
    expect(Date.now).toBe(originalNow);
  });
});
