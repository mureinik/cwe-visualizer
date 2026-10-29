// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { deployArchiveUrl, extractReleases, newestRelease, parseRelease, redirectPage, run } from '../../scripts/build-site.ts';

const ROOT = 'cwe-visualizer-0123abc/';

function zipOf(files: string[]): Buffer {
  const zip = new AdmZip();
  for (const file of files) {
    zip.addFile(`${ROOT}${file}`, Buffer.from(`content of ${file}`));
  }
  return zip.toBuffer();
}

function fakeFetch(zip: Buffer, status = 200) {
  return vi.fn<(url: string) => Promise<unknown>>(() =>
    Promise.resolve(
      status === 200
        ? { ok: true, status, arrayBuffer: () => Promise.resolve(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength)) }
        : { ok: false, status },
    ),
  );
}

function fakeBuild() {
  return vi.fn<(base: string, outDir: string) => Promise<void>>(() => Promise.resolve());
}

describe('parseRelease', () => {
  it('parses major and optional minor', () => {
    expect(parseRelease('v1')).toEqual({ major: 1, minor: 0 });
    expect(parseRelease('v1.1')).toEqual({ major: 1, minor: 1 });
    expect(parseRelease('v10.2')).toEqual({ major: 10, minor: 2 });
  });

  it('rejects anything else', () => {
    for (const name of ['latest', 'v1.1.1', 'v', '1.0', 'v1.', 'V1', 'v01x']) {
      expect(parseRelease(name)).toBeNull();
    }
  });
});

describe('newestRelease', () => {
  it('compares major then minor numerically', () => {
    expect(newestRelease(['v1', 'v1.9', 'v1.10', 'v1.2'])).toBe('v1.10');
    expect(newestRelease(['v1.10', 'v2'])).toBe('v2');
  });

  it('ignores non-release names and returns null when none', () => {
    expect(newestRelease(['latest', 'README.md'])).toBeNull();
    expect(newestRelease([])).toBeNull();
  });
});

describe('redirectPage', () => {
  it('redirects with the query string and hash', () => {
    expect(redirectPage('/v1.1/')).toContain('location.replace("/v1.1/" + location.search + location.hash)');
  });

  it('falls back without JavaScript', () => {
    const page = redirectPage('/v1.1/');
    expect(page).toContain('<meta http-equiv="refresh" content="0; url=/v1.1/">');
    expect(page).toMatch(/<noscript>\s*<meta http-equiv="refresh"[^>]*>\s*<\/noscript>/);
    expect(page).toContain('href="/v1.1/"');
  });
});

describe('deployArchiveUrl', () => {
  it('points at the deploy branch zipball', () => {
    expect(deployArchiveUrl('o', 'r')).toBe('https://codeload.github.com/o/r/zip/refs/heads/deploy');
  });
});

describe('extractReleases and run', () => {
  let dir: string;
  let outDir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-site-'));
    outDir = path.join(dir, 'dist');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  describe('extractReleases', () => {
    it('copies only release directories', () => {
      const zip = zipOf(['v1/index.html', 'v1.1/assets/a.js', 'README.md', 'vercel.json', 'notes/x.txt']);
      expect(extractReleases(zip, outDir)).toEqual(['v1', 'v1.1']);
      expect(existsSync(path.join(outDir, 'v1', 'index.html'))).toBe(true);
      expect(existsSync(path.join(outDir, 'v1.1', 'assets', 'a.js'))).toBe(true);
      expect(existsSync(path.join(outDir, 'README.md'))).toBe(false);
      expect(existsSync(path.join(outDir, 'vercel.json'))).toBe(false);
      expect(existsSync(path.join(outDir, 'notes'))).toBe(false);
    });

    it('never writes outside outDir', () => {
      const zip = new AdmZip();
      zip.addFile(`${ROOT}v1/index.html`, Buffer.from('ok'));
      zip.addFile(`${ROOT}v1/../../escape.txt`, Buffer.from('evil'));
      const entry = zip.getEntries().find((e) => e.entryName.endsWith('escape.txt'));
      // Some adm-zip versions normalize names on add; force the raw name.
      if (entry) entry.entryName = `${ROOT}v1/../../escape.txt`;
      expect(entry?.entryName).toContain('..');
      expect(() => extractReleases(zip.toBuffer(), outDir)).toThrow(/outside/);
      expect(existsSync(path.join(dir, 'escape.txt'))).toBe(false);
      expect(existsSync(path.join(dir, '..', 'escape.txt'))).toBe(false);
      expect(existsSync(path.join(outDir, '..', 'escape.txt'))).toBe(false);
    });
  });

  describe('run', () => {
    it('builds a single app at / outside production', async () => {
      const buildApp = fakeBuild();
      const fetchSpy = fakeFetch(zipOf([]));
      const result = await run({ env: {}, outDir, buildApp, fetchImpl: fetchSpy as unknown as typeof fetch });
      expect(buildApp.mock.calls).toEqual([['/', outDir]]);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.layout).toBe('single');
    });

    it('assembles releases in production', async () => {
      const buildApp = fakeBuild();
      const fetchSpy = fakeFetch(zipOf(['v1/index.html', 'v1.1/index.html']));
      const result = await run({
        env: { VERCEL_ENV: 'production' },
        outDir,
        buildApp,
        fetchImpl: fetchSpy as unknown as typeof fetch,
      });
      expect(buildApp.mock.calls).toEqual([['/latest/', path.join(outDir, 'latest')]]);
      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([deployArchiveUrl('mureinik', 'cwe-visualizer')]);
      expect(existsSync(path.join(outDir, 'v1', 'index.html'))).toBe(true);
      expect(await readFile(path.join(outDir, 'index.html'), 'utf-8')).toContain('"/v1.1/"');
      expect(result).toEqual({ layout: 'releases', releases: ['v1', 'v1.1'], redirect: '/v1.1/' });
    });

    it('uses the Vercel repository variables', async () => {
      const fetchSpy = fakeFetch(zipOf([]));
      await run({
        env: { VERCEL_ENV: 'production', VERCEL_GIT_REPO_OWNER: 'o', VERCEL_GIT_REPO_SLUG: 'r' },
        outDir,
        buildApp: fakeBuild(),
        fetchImpl: fetchSpy as unknown as typeof fetch,
      });
      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([deployArchiveUrl('o', 'r')]);
    });

    it('redirects to /latest/ when there is no release', async () => {
      const result = await run({
        env: { VERCEL_ENV: 'production' },
        outDir,
        buildApp: fakeBuild(),
        fetchImpl: fakeFetch(zipOf(['README.md'])) as unknown as typeof fetch,
      });
      expect(result).toEqual({ layout: 'releases', releases: [], redirect: '/latest/' });
      expect(await readFile(path.join(outDir, 'index.html'), 'utf-8')).toContain('"/latest/"');
    });

    it('assembles releases when SITE_LAYOUT is releases', async () => {
      const buildApp = fakeBuild();
      const result = await run({
        env: { SITE_LAYOUT: 'releases' },
        outDir,
        buildApp,
        fetchImpl: fakeFetch(zipOf(['v2/index.html'])) as unknown as typeof fetch,
      });
      expect(buildApp.mock.calls).toEqual([['/latest/', path.join(outDir, 'latest')]]);
      expect(result.redirect).toBe('/v2/');
    });

    it("fails when the deploy branch can't be downloaded", async () => {
      await expect(
        run({
          env: { VERCEL_ENV: 'production' },
          outDir,
          buildApp: fakeBuild(),
          fetchImpl: fakeFetch(zipOf([]), 404) as unknown as typeof fetch,
        }),
      ).rejects.toThrow(/deploy branch.*HTTP 404/);
      expect(existsSync(path.join(outDir, 'index.html'))).toBe(false);

      const rejecting = vi.fn<(url: string) => Promise<unknown>>(() => Promise.reject(new Error('network down')));
      await expect(
        run({ env: { VERCEL_ENV: 'production' }, outDir, buildApp: fakeBuild(), fetchImpl: rejecting as unknown as typeof fetch }),
      ).rejects.toThrow(/network down/);
      expect(existsSync(path.join(outDir, 'index.html'))).toBe(false);
    });
  });
});
