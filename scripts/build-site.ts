import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import AdmZip from 'adm-zip';
import escapeHtml from 'escape-html';
import type { Release, ReleaseManifest } from '../src/lib/releases.ts';

const RELEASE_PATTERN = /^v(\d+)(?:\.(\d+))?$/;
const DEFAULT_OWNER = 'mureinik';
const DEFAULT_REPO = 'cwe-visualizer';

export function parseRelease(name: string): { major: number; minor: number } | null {
  const match = RELEASE_PATTERN.exec(name);
  if (!match) {
    return null;
  }
  return { major: Number(match[1]), minor: Number(match[2] ?? 0) };
}

function compareReleases(a: string, b: string): number {
  const x = parseRelease(a);
  const y = parseRelease(b);
  if (!x || !y) {
    return 0;
  }
  return x.major - y.major || x.minor - y.minor;
}

// Where / sends visitors. It is /latest/ even once releases exist: the
// switcher in the header reaches every stable release from there.
export const ROOT_REDIRECT = '/latest/';

// The module cache keeps each import by URL, which is harmless here: a build
// reads each release's metadata once.
async function readCweVersion(appDir: string): Promise<string | null> {
  try {
    const url = pathToFileURL(path.join(appDir, 'data', 'meta.json')).href;
    const { default: data } = (await import(url, { with: { type: 'json' } })) as {
      default: { meta?: { cweVersion?: unknown } } | null;
    };
    const version = data?.meta?.cweVersion;
    return typeof version === 'string' ? version : null;
  } catch {
    return null;
  }
}

/**
 * The manifest of everything the site serves, read from the assembled
 * output: /latest/ first, then the releases from newest to oldest, each with
 * the CWE version its own data/meta.json names. A release whose data can't
 * be read is still listed, without a CWE version, rather than failing the
 * whole deployment.
 */
export async function buildManifest(outDir: string, releases: string[]): Promise<ReleaseManifest> {
  const entries: Release[] = [
    { path: '/latest/', label: 'Latest', unreleased: true, cweVersion: await readCweVersion(path.join(outDir, 'latest')) },
  ];
  for (const name of [...releases].sort(compareReleases).reverse()) {
    const parsed = parseRelease(name);
    if (!parsed) {
      continue;
    }
    entries.push({
      path: `/${name}/`,
      label: `${parsed.major}.${parsed.minor}`,
      unreleased: false,
      cweVersion: await readCweVersion(path.join(outDir, name)),
    });
  }
  return { releases: entries };
}

export function redirectPage(target: string): string {
  // The script reads the target back from the link, so it is only ever
  // embedded as HTML-escaped text and never inside JavaScript.
  const href = escapeHtml(target);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>CWE Visualizer</title>
    <noscript>
      <meta http-equiv="refresh" content="0; url=${href}">
    </noscript>
  </head>
  <body>
    <p><a id="target" href="${href}">Continue to the CWE Visualizer</a></p>
    <script>
      location.replace(document.getElementById('target').getAttribute('href') + location.search + location.hash);
    </script>
  </body>
</html>
`;
}

export function deployArchiveUrl(owner: string, repo: string): string {
  return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/deploy`;
}

export async function extractReleases(zip: Buffer, outDir: string): Promise<string[]> {
  const root = path.resolve(outDir);
  const found = new Set<string>();
  const writes: { target: string; data: Buffer }[] = [];
  for (const entry of new AdmZip(zip).getEntries()) {
    if (entry.isDirectory) {
      continue;
    }
    // GitHub zipballs wrap everything in a single "<repo>-<sha>/" folder.
    const [, release, ...rest] = entry.entryName.split('/');
    if (!release || rest.length === 0 || parseRelease(release) === null) {
      continue;
    }
    const target = path.resolve(root, release, ...rest);
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Refusing to extract "${entry.entryName}" outside ${outDir}`);
    }
    found.add(release);
    writes.push({ target, data: entry.getData() });
  }
  for (const { target, data } of writes) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
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
  manifest: ReleaseManifest | null;
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
    return { layout: 'single', releases: [], redirect: null, manifest: null };
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
  const releases = await extractReleases(Buffer.from(await response.arrayBuffer()), outDir);
  const manifest = await buildManifest(outDir, releases);
  // Every release fetches this from the root, so a release built before a
  // newer one was cut still lists it.
  await fs.mkdir(path.join(outDir, 'data'), { recursive: true });
  await fs.writeFile(path.join(outDir, 'data', 'releases.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(outDir, 'index.html'), redirectPage(ROOT_REDIRECT));
  console.log(`Releases found: ${releases.length > 0 ? releases.join(', ') : 'none'}`);
  console.log(`/ redirects to ${ROOT_REDIRECT}`);
  return { layout: 'releases', releases, redirect: ROOT_REDIRECT, manifest };
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
