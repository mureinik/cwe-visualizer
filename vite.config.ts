/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type CoverageMetric = 'statements' | 'branches' | 'functions' | 'lines';
type CoverageThresholds = Partial<Record<CoverageMetric, number>>;

// A floor a few points under the measured baseline, to catch untested code
// landing, not to chase a number. Raise it as coverage improves. It applies
// to the total and to every file on its own.
const COVERAGE_FLOOR: CoverageThresholds = {
  statements: 90,
  branches: 78,
  functions: 90,
  lines: 92,
};

// Files still under the floor, each held at today's coverage so it can't slip
// further. Only the metrics under the floor are listed; the rest use the
// floor. Remove an entry once its file reaches the floor; the issue next to
// each one tracks that.
const COVERAGE_EXCEPTIONS: Record<string, CoverageThresholds> = {
  'src/App.tsx': { functions: 81, lines: 88 }, // #170
  'src/components/GraphStage.tsx': { statements: 89, functions: 87, lines: 91 }, // #169
  'src/lib/graph.ts': { branches: 76 }, // #173
  'src/lib/media.ts': { functions: 83 }, // #174
};

/** The thresholds a file is held to: the floor, lowered by its exception if it has one. */
function fileThresholds(file: string): CoverageThresholds {
  return { ...COVERAGE_FLOOR, ...COVERAGE_EXCEPTIONS[file] };
}

// Vitest checks a file against every pattern that matches it, so an exception
// can't simply override a per-file rule for all of src/. Instead, the floor
// applies per file to everything except the exceptions, through a negated
// pattern, and each exception has a pattern of its own.
function coverageThresholds() {
  const exceptions = Object.keys(COVERAGE_EXCEPTIONS);
  const everyOtherFile = exceptions.length > 0 ? `!(${exceptions.join('|')})` : '**';
  return {
    ...COVERAGE_FLOOR,
    [everyOtherFile]: { ...COVERAGE_FLOOR, perFile: true },
    ...Object.fromEntries(exceptions.map((file) => [file, { ...fileThresholds(file), perFile: true }])),
  };
}

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
      // text for the log (it shows which file missed a threshold), html for
      // browsing locally, and lcovonly for Codecov. Codecov gets LCOV, not
      // clover, since it reads clover's branch counts the wrong way round
      // and showed fully covered branches as partial (#181).
      reporter: ['text', 'html', 'lcovonly'],
      // The app only. scripts/prepare-data.ts has tests, but doesn't ship,
      // so it isn't counted.
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts <App /> into the page, and cwe-data.ts holds
      // only types, so there's nothing in either to cover.
      exclude: ['src/main.tsx', 'src/lib/cwe-data.ts'],
      thresholds: coverageThresholds(),
    },
  },
});
