// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  renderCoverageSummary,
  run,
  type CoverageSummary,
  type ThresholdConfig,
} from '../../.github/scripts/coverage-summary.ts';

const ROOT = '/repo';

function metrics(pct: number) {
  const m = { total: 100, covered: pct, pct };
  return { statements: m, branches: m, functions: m, lines: m };
}

const SUMMARY: CoverageSummary = {
  total: {
    statements: { total: 200, covered: 190, pct: 95 },
    branches: { total: 100, covered: 70, pct: 70 },
    functions: { total: 50, covered: 50, pct: 100 },
    lines: { total: 180, covered: 171, pct: 95 },
  },
  '/repo/src/lib/graph.ts': metrics(98),
  '/repo/src/App.tsx': metrics(80),
  '/repo/src/lib/search.ts': metrics(85),
};

const FLOOR = { statements: 90, branches: 78, functions: 90, lines: 92 };

const CONFIG: ThresholdConfig = {
  floor: FLOOR,
  forFile: (file) => (file === 'src/App.tsx' ? { ...FLOOR, lines: 75, statements: 75, branches: 75, functions: 75 } : FLOOR),
  exceptions: ['src/App.tsx'],
};

const NO_THRESHOLDS: ThresholdConfig = { floor: {}, forFile: () => ({}), exceptions: [] };

describe('renderCoverageSummary', () => {
  it('marks each total against the floor', () => {
    const md = renderCoverageSummary(SUMMARY, CONFIG, ROOT);
    expect(md).toContain('| Statements | 95.00% (190/200) | 90% | ✅ |');
    expect(md).toContain('| Branches | 70.00% (70/100) | 78% | ❌ |');
    expect(md).toContain('| Functions | 100.00% (50/50) | 90% | ✅ |');
  });

  it('shows no verdict for a metric without a threshold', () => {
    const md = renderCoverageSummary(SUMMARY, NO_THRESHOLDS, ROOT);
    expect(md).toContain('| Lines | 95.00% (171/180) | – |  |');
    expect(md).toContain('| `src/App.tsx` | 80.00% | 80.00% | 80.00% | 80.00% |');
  });

  it('marks each file against its own thresholds', () => {
    const md = renderCoverageSummary(SUMMARY, CONFIG, ROOT);
    expect(md).toContain('| `src/lib/graph.ts` | 98.00% ✅ | 98.00% ✅ | 98.00% ✅ | 98.00% ✅ |');
    // 85% meets the branches floor (78) but none of the others.
    expect(md).toContain('| `src/lib/search.ts` | 85.00% ❌ | 85.00% ✅ | 85.00% ❌ | 85.00% ❌ |');
    // Under the floor, but above its exception.
    expect(md).toContain('| `src/App.tsx` † | 80.00% ✅ | 80.00% ✅ | 80.00% ✅ | 80.00% ✅ |');
  });

  it('counts the files under their thresholds and explains the exception marker', () => {
    const md = renderCoverageSummary(SUMMARY, CONFIG, ROOT);
    expect(md).toContain('<summary>Per file (3, 1 under their thresholds)</summary>');
    expect(md).toContain('† Held to lower thresholds');
    expect(renderCoverageSummary(SUMMARY, NO_THRESHOLDS, ROOT)).not.toContain('† Held');
  });

  it('lists files relative to the repo root, least-covered first', () => {
    const md = renderCoverageSummary(SUMMARY, CONFIG, ROOT);
    const app = md.indexOf('`src/App.tsx`');
    const search = md.indexOf('`src/lib/search.ts`');
    const graph = md.indexOf('`src/lib/graph.ts`');
    expect(app).toBeGreaterThan(-1);
    expect(search).toBeGreaterThan(app);
    expect(graph).toBeGreaterThan(search);
  });

  it('leaves out the per-file table when there are no files', () => {
    expect(renderCoverageSummary({ total: SUMMARY.total }, CONFIG, ROOT)).not.toContain('<details>');
  });

  it('rejects a report without totals', () => {
    expect(() => renderCoverageSummary({}, CONFIG, ROOT)).toThrow(/no "total"/);
  });
});

describe('run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'coverage-summary-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('renders the report file', async () => {
    const file = path.join(dir, 'coverage-summary.json');
    await writeFile(file, JSON.stringify(SUMMARY));
    expect(await run(file, CONFIG, ROOT)).toContain('| Lines | 95.00% (171/180) | 92% | ✅ |');
  });

  it('renders a note instead of failing when there is no report', async () => {
    expect(await run(path.join(dir, 'missing.json'), CONFIG, ROOT)).toMatch(/No coverage report was produced/);
  });
});
