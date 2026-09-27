/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      // main.tsx only mounts <App /> into the page.
      exclude: ['src/main.tsx'],
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
