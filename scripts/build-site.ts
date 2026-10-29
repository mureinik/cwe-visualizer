import { promises as fs, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';

const RELEASE_PATTERN = /^v(\d+)(?:\.(\d+))?$/;
const DEFAULT_OWNER = 'mureinik';
const DEFAULT_REPO = 'cwe-visualizer';

export function parseRelease(name: string): { major: number; minor: number } | null {
  const match = RELEASE_PATTERN.exec(name);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function compareReleases(a: string, b: string): number {
  const x = parseRelease(a);
  const y = parseRelease(b);
  if (!x || !y) return 0;
  return x.major - y.major || x.minor - y.minor;
}

export function newestRelease(names: string[]): string | null {
  const releases = names.filter((name) => parseRelease(name) !== null).sort(compareReleases);
  return releases.at(-1) ?? null;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function redirectPage(target: string): string {
  // "<" is escaped so the target can never close the script element.
  const script = JSON.stringify(target).replace(/</g, '\\u003c');
  const attr = escapeAttribute(target);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>CWE Visualizer</title>
    <meta http-equiv="refresh" content="0; url=${attr}">
    <script>
      location.replace(${script} + location.search + location.hash);
    </script>
  </head>
  <body>
    <p><a href="${attr}">Continue to the CWE Visualizer</a></p>
  </body>
</html>
`;
}

export function deployArchiveUrl(owner: string, repo: string): string {
  return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/deploy`;
}

export function extractReleases(zip: Buffer, outDir: string): string[] {
  const root = path.resolve(outDir);
  const found = new Set<string>();
  const writes: { target: string; data: Buffer }[] = [];
  for (const entry of new AdmZip(zip).getEntries()) {
    if (entry.isDirectory) continue;
    // GitHub zipballs wrap everything in a single "<repo>-<sha>/" folder.
    const [, release, ...rest] = entry.entryName.split('/');
    if (!release || rest.length === 0 || parseRelease(release) === null) continue;
    const target = path.resolve(root, release, ...rest);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Refusing to extract "${entry.entryName}" outside ${outDir}`);
    }
    found.add(release);
    writes.push({ target, data: entry.getData() });
  }
  for (const { target, data } of writes) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, data);
  }
  return [...found].sort(compareReleases);
}

async function defaultBuildApp(base: string, outDir: string): Promise<void> {
  const { build } = await import('vite');
  await build({ base, build: { outDir, emptyOutDir: true } });
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
  outDir?: string;
  fetchImpl?: typeof fetch;
  buildApp?: (base: string, outDir: string) => Promise<void>;
}

export interface RunResult {
  layout: 'single' | 'releases';
  releases: string[];
  redirect: string | null;
}

export async function run({
  env = process.env,
  outDir = path.join(process.cwd(), 'dist'),
  fetchImpl = fetch,
  buildApp = defaultBuildApp,
}: RunOptions = {}): Promise<RunResult> {
  if (env.VERCEL_ENV !== 'production' && env.SITE_LAYOUT !== 'releases') {
    console.log('Layout: single app at /');
    await buildApp('/', outDir);
    return { layout: 'single', releases: [], redirect: null };
  }

  console.log('Layout: releases (/latest/ plus published releases)');
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  await buildApp('/latest/', path.join(outDir, 'latest'));

  const url = deployArchiveUrl(env.VERCEL_GIT_REPO_OWNER || DEFAULT_OWNER, env.VERCEL_GIT_REPO_SLUG || DEFAULT_REPO);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Failed to download the deploy branch (HTTP ${response.status}): ${url}`);
  }
  const releases = extractReleases(Buffer.from(await response.arrayBuffer()), outDir);
  const redirect = `/${newestRelease(releases) ?? 'latest'}/`;
  await fs.writeFile(path.join(outDir, 'index.html'), redirectPage(redirect));
  console.log(`Releases found: ${releases.length > 0 ? releases.join(', ') : 'none'}`);
  console.log(`/ redirects to ${redirect}`);
  return { layout: 'releases', releases, redirect };
}

// See scripts/prepare-data.ts for why this uses import.meta.main and the
// eslint opt-out below.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
