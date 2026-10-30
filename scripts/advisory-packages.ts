import { readFileSync } from 'node:fs';

const GHSA_PATTERN = /^GHSA(-[2-9cfghjmpqrvwx]{4}){3}$/;
const ADVISORY_URL = 'https://github.com/advisories/';
const ADVISORY_URL_PATTERN = /^https:\/\/github\.com\/advisories\/(.*)$/is;

export function isGhsaId(value: string): boolean {
  return GHSA_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the report's `vulnerabilities` object. Throws on anything that
 * isn't a successful report, so a failed audit never reads as "not
 * affected" or as "fixed".
 */
function vulnerabilitiesOf(report: unknown): Record<string, unknown> {
  if (!isRecord(report)) throw new Error('The audit report is not a JSON object');
  if ('error' in report) {
    const { error } = report;
    const detail = isRecord(error) && typeof error.summary === 'string' ? `: ${error.summary}` : '';
    throw new Error(`npm audit reported an error${detail}`);
  }
  const { vulnerabilities } = report;
  if (!isRecord(vulnerabilities)) throw new Error('The audit report has no "vulnerabilities" object');
  return vulnerabilities;
}

/** Every object `via` entry in the report: the ones that name an advisory. */
function* advisoryEntries(report: unknown): Generator<Record<string, unknown>> {
  for (const vulnerability of Object.values(vulnerabilitiesOf(report))) {
    if (!isRecord(vulnerability) || !Array.isArray(vulnerability.via)) continue;
    for (const via of vulnerability.via as unknown[]) {
      if (isRecord(via)) yield via;
    }
  }
}

/**
 * Names the packages an npm audit report lists as carrying the advisory
 * itself, not the packages that merely depend on them. Throws on anything
 * that isn't a successful report.
 */
export function advisoryPackages(report: unknown, ghsa: string): string[] {
  const url = `${ADVISORY_URL}${ghsa}`.toLowerCase();
  const names = new Set<string>();
  for (const via of advisoryEntries(report)) {
    if (typeof via.url === 'string' && typeof via.name === 'string' && via.url.toLowerCase() === url) {
      names.add(via.name);
    }
  }
  return [...names].sort();
}

/**
 * Lists the GHSA IDs of every advisory an npm audit report names, in
 * GitHub's form (`GHSA-` and lower case), sorted and deduplicated. Throws on
 * anything that isn't a successful report.
 */
export function advisoryIds(report: unknown): string[] {
  const ids = new Set<string>();
  for (const via of advisoryEntries(report)) {
    const rest = typeof via.url === 'string' ? ADVISORY_URL_PATTERN.exec(via.url)?.[1] : undefined;
    if (rest === undefined) continue;
    const id = `${rest.slice(0, 4).toUpperCase()}${rest.slice(4).toLowerCase()}`;
    if (isGhsaId(id)) ids.add(id);
  }
  return [...ids].sort();
}

const USAGE = `Usage: node scripts/advisory-packages.ts <GHSA ID> < report.json
       node scripts/advisory-packages.ts --ids < report.json`;

function main(args: string[]): void {
  const [arg] = args;
  if (args.length !== 1 || (arg !== '--ids' && !isGhsaId(arg))) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  try {
    const report: unknown = JSON.parse(readFileSync(0, 'utf8'));
    const lines = arg === '--ids' ? advisoryIds(report) : advisoryPackages(report, arg);
    for (const line of lines) console.log(line);
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
