// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { extractXmlFromZip, parseCatalog, writeOutput, run, type CweData } from '../../scripts/prepare-data.ts';

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
    expect(data.meta.lastModified).toBe('"abc123"');
    expect(data.meta.generatedAt).toEqual(expect.any(String));
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

  it('leaves viewId undefined when a relation declares no View_ID', () => {
    const xml = `<Weakness_Catalog Version="4.15" Date="2024-11-19"><Weaknesses>
      <Weakness ID="1" Name="A" Abstraction="Base" Status="Draft"><Description>d</Description>
        <Related_Weaknesses><Related_Weakness Nature="ChildOf" CWE_ID="2"/></Related_Weaknesses>
      </Weakness></Weaknesses></Weakness_Catalog>`;
    expect(parseCatalog(xml, '"x"').edges[0].viewId).toBeUndefined();
  });

  it('has no edges for a weakness with no Related_Weaknesses element', () => {
    expect(data.edges.filter((e) => e.from === '74')).toEqual([]);
  });

  it('defaults missing optional Weakness attributes to empty strings', () => {
    const xml = `<Weakness_Catalog Version="4.15"><Weaknesses><Weakness ID="5"/></Weaknesses></Weakness_Catalog>`;
    expect(parseCatalog(xml, '"x"').nodes['5']).toMatchObject({ id: '5', name: '', abstraction: '', status: '', description: '' });
  });

  it('throws on a catalog missing the expected root element', () => {
    expect(() => parseCatalog('<NotACatalog/>', '"x"')).toThrow(/Unexpected CWE catalog format/);
  });
});

describe('writeOutput', () => {
  it('writes cwe.json and meta.json to the output directory', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
    try {
      const data: CweData = {
        meta: { cweVersion: '4.15', lastModified: '"abc"', generatedAt: '2026-01-01T00:00:00.000Z' },
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
  return vi.fn((_url: string, options?: { method?: string }) => {
    if (options?.method === 'HEAD') {
      return Promise.resolve({ ok: true, status: 200, headers: { get: (name: string) => (name === 'last-modified' ? lastModified : null) } });
    }
    if (getStatus !== 200) {
      return Promise.resolve({ ok: false, status: getStatus });
    }
    return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(zipBuffer().buffer) });
  });
}

describe('run', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'cwe-visualizer-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('downloads and writes data on a fresh run with no cache', async () => {
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('"v1"');
    const cweJson = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8')) as CweData;
    expect(Object.keys(cweJson.nodes)).toContain('79');
  });

  it('skips the download when the cached last-modified matches', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const fetchSpy = fakeFetch({ lastModified: '"v1"' });
    const result = await run({ outDir: dir, fetchImpl: fetchSpy as unknown as typeof fetch });
    expect(result.updated).toBe(false);
    const getCalls = fetchSpy.mock.calls.filter(([, options]) => options?.method !== 'HEAD');
    expect(getCalls).toHaveLength(0);
  });

  it('re-downloads when the last-modified has changed', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v2"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('"v2"');
  });

  it('reuses cached data when the source is unreachable and a cache exists', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const failingFetch = vi.fn(() => Promise.reject(new Error('network down')));
    const result = await run({ outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch });
    expect(result.updated).toBe(false);
    expect(result.meta.lastModified).toBe('"v1"');
  });

  it('throws when the source is unreachable and there is no cache', async () => {
    const failingFetch = vi.fn(() => Promise.reject(new Error('network down')));
    await expect(
      run({ outDir: dir, fetchImpl: failingFetch as unknown as typeof fetch })
    ).rejects.toThrow(/no cached data/);
  });

  it('regenerates when cwe.json is missing even though meta.json matches', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    await rm(path.join(dir, 'cwe.json'));
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    await expect(readFile(path.join(dir, 'cwe.json'), 'utf-8')).resolves.toContain('"79"');
  });

  it('regenerates when cwe.json is truncated even though meta.json matches', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    await writeFile(path.join(dir, 'cwe.json'), '{"meta":');
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
  });

  it('downloads when the HEAD response has no Last-Modified header', async () => {
    await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: '"v1"' }) as unknown as typeof fetch });
    const result = await run({ outDir: dir, fetchImpl: fakeFetch({ lastModified: null }) as unknown as typeof fetch });
    expect(result.updated).toBe(true);
    expect(result.meta.lastModified).toBe('');
  });

  it('throws when the GET returns a non-OK response after a successful HEAD', async () => {
    await expect(
      run({ outDir: dir, fetchImpl: fakeFetch({ getStatus: 503 }) as unknown as typeof fetch })
    ).rejects.toThrow(/Failed to download CWE data \(HTTP 503\)/);
  });

  it('throws when the GET itself throws after a successful HEAD', async () => {
    const base = fakeFetch();
    const fetchImpl = vi.fn((url: string, options?: { method?: string }) =>
      options?.method === 'HEAD' ? base(url, options) : Promise.reject(new Error('connection reset'))
    );
    await expect(run({ outDir: dir, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/connection reset/);
  });
});
