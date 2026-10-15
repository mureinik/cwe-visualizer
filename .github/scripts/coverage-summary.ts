import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CoverageThresholds } from '../../vite.config.ts';

// Turns the json-summary coverage report into Markdown for the CI job
// summary, so coverage shows on the run's Summary page instead of only in the
// test:coverage step's log. Prints to stdout; the workflow appends it to
// $GITHUB_STEP_SUMMARY.

export const METRICS = ['statements', 'branches', 'functions', 'lines'] as const;
export type Metric = (typeof METRICS)[number];

interface MetricSummary {
  total: number;
  covered: number;
  pct: number;
}

/** The shape of coverage/coverage-summary.json: `total`, then one entry per file. */
export type CoverageSummary = Record<string, Record<Metric, MetricSummary>>;

/** The thresholds the run enforced, as vite.config.ts defines them. */
export interface ThresholdConfig {
  /** Applies to the total. */
  floor: CoverageThresholds;
  /** The thresholds a file, relative to the repo root, is held to. */
  forFile: (file: string) => CoverageThresholds;
  /** Files held to lower thresholds than the floor. */
  exceptions: readonly string[];
}

const LABELS: Record<Metric, string> = {
  statements: 'Statements',
  branches: 'Branches',
  functions: 'Functions',
  lines: 'Lines',
};

function percent(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

function mark(pct: number, threshold: number | undefined): string {
  if (threshold === undefined) return '';
  return pct >= threshold ? '✅' : '❌';
}

export function renderCoverageSummary(summary: CoverageSummary, config: ThresholdConfig, rootDir: string): string {
  const { total, ...files } = summary;
  if (!total) throw new Error('Coverage summary has no "total" entry');

  const lines = [
    '## Coverage',
    '',
    '| Metric | Covered | Threshold | |',
    '|---|---:|---:|:---:|',
    ...METRICS.map((metric) => {
      const { pct, covered, total: count } = total[metric];
      const threshold = config.floor[metric];
      const floor = threshold === undefined ? '–' : `${threshold}%`;
      return `| ${LABELS[metric]} | ${percent(pct)} (${covered}/${count}) | ${floor} | ${mark(pct, threshold)} |`;
    }),
    '',
  ];

  // Least-covered lines first, since those are the files worth a look.
  const rows = Object.entries(files)
    .map(([file, metrics]) => ({ file: path.relative(rootDir, file), metrics }))
    .sort((a, b) => a.metrics.lines.pct - b.metrics.lines.pct || a.file.localeCompare(b.file));

  if (rows.length > 0) {
    const failing = rows.filter(({ file, metrics }) =>
      METRICS.some((m) => mark(metrics[m].pct, config.forFile(file)[m]) === '❌'),
    ).length;
    const exceptions = new Set(config.exceptions);
    lines.push(
      `<details><summary>Per file (${rows.length}, ${failing} under their thresholds)</summary>`,
      '',
      `| File | ${METRICS.map((metric) => LABELS[metric]).join(' | ')} |`,
      `|---|${METRICS.map(() => '---:').join('|')}|`,
      ...rows.map(({ file, metrics }) => {
        const thresholds = config.forFile(file);
        const name = exceptions.has(file) ? `\`${file}\` †` : `\`${file}\``;
        const cells = METRICS.map((m) => `${percent(metrics[m].pct)} ${mark(metrics[m].pct, thresholds[m])}`.trimEnd());
        return `| ${name} | ${cells.join(' | ')} |`;
      }),
      '',
    );
    if (exceptions.size > 0) {
      lines.push('† Held to lower thresholds until its coverage reaches the floor; see `COVERAGE_EXCEPTIONS` in `vite.config.ts`.', '');
    }
    lines.push('</details>', '');
  }

  return lines.join('\n');
}

/**
 * Reads the report and renders it. A missing report (the test run died
 * before writing one) renders a note instead of failing, so this step never
 * hides the real failure in the step before it.
 */
export async function run(summaryPath: string, config: ThresholdConfig, rootDir: string): Promise<string> {
  let raw: string;
  try {
    raw = await fs.readFile(summaryPath, 'utf8');
  } catch {
    return '## Coverage\n\nNo coverage report was produced; see the test:coverage step.\n';
  }
  return renderCoverageSummary(JSON.parse(raw) as CoverageSummary, config, rootDir);
}

// See the matching comment in scripts/prepare-data.ts.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  const rootDir = path.resolve(import.meta.dirname, '..', '..');
  // The thresholds come from the coverage config itself, so the table can't
  // disagree with what the test run actually enforced.
  const { COVERAGE_FLOOR, COVERAGE_EXCEPTIONS, fileThresholds } = await import('../../vite.config.ts');
  const config: ThresholdConfig = {
    floor: COVERAGE_FLOOR,
    forFile: fileThresholds,
    exceptions: Object.keys(COVERAGE_EXCEPTIONS),
  };
  try {
    process.stdout.write(await run(path.join(rootDir, 'coverage', 'coverage-summary.json'), config, rootDir));
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}
