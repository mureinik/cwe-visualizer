// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { archiveUrl, extractXmlFromZip, parseCatalog, readPinnedVersion, writeOutput, run } from '../../scripts/prepare-data.ts';
import type { CweData } from '../../src/lib/cwe-data';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_XML = path.join(__dirname, '..', 'fixtures', 'cwec-sample.xml');

describe('extractXmlFromZip', () => {
  it('extracts the XML entry text from a zip buffer', () => {
    const zip = new AdmZip();
    zip.addFile('cwec_latest.xml', readFileSync(FIXTURE_XML));
    const xmlText = extractXmlFromZip(zip.toBuffer());
    expect(xmlText).toContain('<Weakness_Catalog');
  });

  it('throws when the zip has no XML entry', () => {
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('no xml here'));
    expect(() => extractXmlFromZip(zip.toBuffer())).toThrow(/No XML entry/);
  });

  it('throws when the zip has more than one XML entry', () => {
    const zip = new AdmZip();
    zip.addFile('cwec_latest.xml', readFileSync(FIXTURE_XML));
    zip.addFile('extra.xml', readFileSync(FIXTURE_XML));
    expect(() => extractXmlFromZip(zip.toBuffer())).toThrow(/Expected exactly one XML entry/);
  });
});

describe('parseCatalog', () => {
  const xmlText = readFileSync(FIXTURE_XML, 'utf-8');
  const data = parseCatalog(xmlText, '"abc123"');

  it('extracts catalog metadata', () => {
    expect(data.meta.cweVersion).toBe('4.15');
    expect(data.meta.catalogDate).toBe('2024-11-19');
    expect(data.meta.lastModified).toBe('"abc123"');
    expect(data.meta.generatedAt).toEqual(expect.any(String));
  });

  it('records an empty lastModified when the source sent none', () => {
    expect(parseCatalog(xmlText, null).meta.lastModified).toBe('');
  });

  it('parses every weakness into a node', () => {
    expect(Object.keys(data.nodes).sort()).toEqual(['74', '79', '80', '89']);
    expect(data.nodes['79']).toMatchObject({
      id: '79',
      name: 'Cross-site Scripting',
      abstraction: 'Base',
      status: 'Stable',
      description: 'The product does not neutralize user-controllable input before it is placed in output.',
      url: 'https://cwe.mitre.org/data/definitions/79.html',
    });
  });

  it('builds an edge per Related_Weakness with its nature as the type', () => {
    const edgesFrom79 = data.edges.filter((e) => e.from === '79');
    expect(edgesFrom79).toEqual([
      { from: '79', to: '74', type: 'ChildOf', viewId: '1000' },
      { from: '79', to: '80', type: 'PeerOf', viewId: '1000' },
    ]);
  });

  it('has no edges for a weakness with no Related_Weaknesses element', () => {
    expect(data.edges.filter((e) => e.from === '74')).toEqual([]);
  });

  // MITRE can change its download format. That isn't a mistake and is outside
  // our control, and these checks fail the build rather than ship data the app
  // can't read.
  it('throws on a catalog missing the expected root element', () => {
    expect(() => parseCatalog('<NotACatalog/>', '"x"')).toThrow(/Unexpected CWE catalog format/);
  });

  it('throws on a catalog whose Date is missing or not YYYY-MM-DD', () => {
    for (const date of ['', ' Date="19 Nov 2024"']) {
      const xml = `<Weakness_Catalog Version="4.15"${date}><Weaknesses/></Weakness_Catalog>`;
      expect(() => parseCatalog(xml, '"x"'), date).toThrow(/Weakness_Catalog\/Date/);
    }
  });

  // The schema requires View_ID on every Related_Weakness, and Name,
  // Abstraction and Status on every Weakness.
  describe('attributes the schema requires', { tags: ['theoretical'] }, () => {
    it('leaves viewId undefined when a relation declares no View_ID', () => {
      const xml = `<Weakness_Catalog Version="4.15" Date="2024-11-19"><Weaknesses>
        <Weakness ID="1" Name="A" Abstraction="Base" Status="Draft"><Description>d</Description>
          <Related_Weaknesses><Related_Weakness Nature="ChildOf" CWE_ID="2"/></Related_Weaknesses>
        </Weakness></Weaknesses></Weakness_Catalog>`;
      expect(parseCatalog(xml, '"x"').edges[0].viewId).toBeUndefined();
    });

    it('defaults missing Weakness attributes to empty strings', () => {
      const xml = '<Weakness_Catalog Version="4.15" Date="2024-11-19"><Weaknesses><Weakness ID="5"/></Weaknesses></Weakness_Catalog>';
      expect(parseCatalog(xml, '"x"').nodes['5']).toMatchObject({ id: '5', name: '', abstraction: '', status: '', description: '' });
    });
  });
});

describe('writeOutput', () => {
  it('writes cwe.json and meta.json to the output directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
    try {
      const data: CweData = {
        meta: { cweVersion: '4.15', catalogDate: '2025-12-01', lastModified: '"abc"', generatedAt: '2026-01-01T00:00:00.000Z' },
        nodes: {},
        edges: [],
      };
      await writeOutput(dir, data);
      const cweJson: unknown = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8'));
      const metaJson: unknown = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf-8'));
      expect(cweJson).toEqual(data);
      expect(metaJson).toEqual({ meta: data.meta });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

function zipBuffer() {
  const zip = new AdmZip();
  zip.addFile('cwec_latest.xml', readFileSync(FIXTURE_XML));
  return zip.toBuffer();
}

function fakeFetch({ lastModified = '"v1"', getStatus = 200 }: { lastModified?: string | null; getStatus?: number } = {}) {
  return vi.fn<(url: string) => Promise<unknown>>(() => {
    if (getStatus !== 200) {
      return Promise.resolve({ ok: false, status: getStatus });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get: (name: string) => (name === 'last-modified' ? lastModified : null) },
      arrayBuffer: () => Promise.resolve(zipBuffer().buffer),
    });
  });
}

describe('archiveUrl', () => {
  it('names the archive file for a version', () => {
    expect(archiveUrl('4.20')).toBe('https://cwe.mitre.org/data/xml/cwec_v4.20.xml.zip');
    expect(archiveUrl('4.19.1')).toBe('https://cwe.mitre.org/data/xml/cwec_v4.19.1.xml.zip');
  });
});

describe('readPinnedVersion', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
    file = path.join(dir, 'cwe-version');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reads the version, ignoring surrounding whitespace', async () => {
    await writeFile(file, ' 4.20\r\n');
    await expect(readPinnedVersion(file)).resolves.toBe('4.20');
    await writeFile(file, '4.19.1\n');
    await expect(readPinnedVersion(file)).resolves.toBe('4.19.1');
  });

  it('rejects an empty or malformed pin, naming the file', async () => {
    for (const contents of ['', 'latest', '4', 'v4.20', '4.20 4.21']) {
      await writeFile(file, contents);
      await expect(readPinnedVersion(file), contents).rejects.toThrow(file);
    }
  });

  it('rejects a missing pin file, naming it', async () => {
    await expect(readPinnedVersion(file)).rejects.toThrow(file);
  });
});

describe('run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads and writes data on a fresh run with no cache', async () => {
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('"v1"');
    const cweJson = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8')) as CweData;
    expect(Object.keys(cweJson.nodes)).toContain('79');
  });

  it('downloads the pinned version from the archive', async () => {
    const fetchSpy = fakeFetch();
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fetchSpy as unknown as typeof fetch });
    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([archiveUrl('4.15')]);
    expect(result.meta.cweVersion).toBe('4.15');
  });

  it('throws when the archive holds a different version than the pin', async () => {
    await expect(
      run({ version: '4.16', outDir: dir, fetchImpl: fakeFetch() as unknown as typeof fetch }),
    ).rejects.toThrow(/4\.15.*4\.16|4\.16.*4\.15/);
    await expect(readFile(path.join(dir, 'cwe.json'), 'utf-8')).rejects.toThrow();
  });

  it('re-downloads data cached before catalogDate existed, even when last-modified matches', async () => {
    await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const metaPath = path.join(dir, 'meta.json');
    const { meta } = JSON.parse(await readFile(metaPath, 'utf-8')) as { meta: Record<string, unknown> };
    delete meta.catalogDate;
    await writeFile(metaPath, JSON.stringify({ meta }));

    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.catalogDate).toBe('2024-11-19');
  });

  it('skips the download, without any request, when the cached version matches the pin', async () => {
    await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch() as unknown as typeof fetch });
    const fetchSpy = fakeFetch();
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fetchSpy as unknown as typeof fetch });
    expect(result.updated).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  async function cacheAnotherVersion() {
    await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch() as unknown as typeof fetch });
    const metaPath = path.join(dir, 'meta.json');
    const { meta } = JSON.parse(await readFile(metaPath, 'utf-8')) as { meta: Record<string, unknown> };
    meta.cweVersion = '5.0';
    await writeFile(metaPath, JSON.stringify({ meta }));
  }

  it('re-downloads when the cached data is another version', async () => {
    await cacheAnotherVersion();
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch() as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.cweVersion).toBe('4.15');
  });

  it('throws, rather than reuse it, when the cache is another version and the source is unreachable', async () => {
    await cacheAnotherVersion();
    const failingFetch = vi.fn(() => Promise.reject(new Error('network down')));
    await expect(
      run({ version: '4.15', outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/network down/);
  });

  it('throws when the source is unreachable and there is no cache', async () => {
    const failingFetch = vi.fn(() => Promise.reject(new Error('network down')));
    await expect(
      run({ version: '4.15', outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch }),
    ).rejects.toThrow(/Could not download CWE 4\.15/);
  });

  it('regenerates when cwe.json is missing even though meta.json matches', async () => {
    await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    await rm(path.join(dir, 'cwe.json'));
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    await expect(readFile(path.join(dir, 'cwe.json'), 'utf-8')).resolves.toContain('"79"');
  });

  it('regenerates when cwe.json is truncated even though meta.json matches', async () => {
    await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    await writeFile(path.join(dir, 'cwe.json'), '{"meta":');
    const result = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
  });

  it("records the download's Last-Modified, or empty when absent", async () => {
    const withHeader = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(withHeader.meta.lastModified).toBe('"v1"');
    await rm(dir, { recursive: true, force: true });
    const without = await run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ lastModified: null }) as unknown as typeof fetch });
    expect(without.meta.lastModified).toBe('');
  });

  it('throws, naming the URL, when the archive returns a non-OK response', async () => {
    await expect(
      run({ version: '4.15', outDir: dir, fetchImpl: fakeFetch({ getStatus: 404 }) as unknown as typeof fetch }),
    ).rejects.toThrow(/HTTP 404.*cwec_v4\.15\.xml\.zip/);
  });

  it('throws when the download itself throws', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('connection reset')));
    await expect(run({ version: '4.15', outDir: dir, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/connection reset/);
  });
});
