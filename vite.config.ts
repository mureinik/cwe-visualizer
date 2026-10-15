/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Undo vi.stubGlobal and vi.spyOn after every test, so a test that
    // forgets its own cleanup can't leak into the next one.
    unstubGlobals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // The app only. scripts/prepare-data.ts and the CI helpers in
      // .github/scripts/ have tests, but don't ship, so they aren't counted.
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts <App /> into the page, and cwe-data.ts holds
      // only types, so there's nothing in either to cover.
      exclude: ['src/main.tsx', 'src/lib/cwe-data.ts'],
      // A floor a few points under the measured baseline, to catch untested
      // code landing, not to chase a number. Raise it as coverage improves.
      thresholds: {
        statements: 90,
        branches: 78,
        functions: 90,
        lines: 92,
      },
    },
  },
});
