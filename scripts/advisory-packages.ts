import { readFileSync } from 'node:fs';

const GHSA_PATTERN = /^GHSA(-[2-9cfghjmpqrvwx]{4}){3}$/;
const ADVISORY_URL = 'https://github.com/advisories/';

export function isGhsaId(value: string): boolean {
  return GHSA_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Names the packages an npm audit report lists as carrying the advisory
 * itself, not the packages that merely depend on them. Throws on anything
 * that isn't a successful report, so a failed audit never reads as "not
 * affected".
 */
export function advisoryPackages(report: unknown, ghsa: string): string[] {
  if (!isRecord(report)) throw new Error('The audit report is not a JSON object');
  if ('error' in report) {
    const { error } = report;
    const detail = isRecord(error) && typeof error.summary === 'string' ? `: ${error.summary}` : '';
    throw new Error(`npm audit reported an error${detail}`);
  }
  const { vulnerabilities } = report;
  if (!isRecord(vulnerabilities)) throw new Error('The audit report has no "vulnerabilities" object');

  const url = `${ADVISORY_URL}${ghsa}`.toLowerCase();
  const names = new Set<string>();
  for (const vulnerability of Object.values(vulnerabilities)) {
    if (!isRecord(vulnerability) || !Array.isArray(vulnerability.via)) continue;
    for (const via of vulnerability.via as unknown[]) {
      if (isRecord(via) && typeof via.url === 'string' && typeof via.name === 'string' && via.url.toLowerCase() === url) {
        names.add(via.name);
      }
    }
  }
  return [...names].sort();
}

function main(args: string[]): void {
  const [ghsa] = args;
  if (args.length !== 1 || !isGhsaId(ghsa)) {
    console.error('Usage: node scripts/advisory-packages.ts <GHSA ID> < report.json');
    process.exitCode = 2;
    return;
  }
  try {
    const report: unknown = JSON.parse(readFileSync(0, 'utf8'));
    for (const name of advisoryPackages(report, ghsa)) console.log(name);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

// See scripts/prepare-data.ts for why this uses import.meta.main and the
// eslint opt-out below.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  main(process.argv.slice(2));
}
