// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { extractXmlFromZip, parseCatalog, writeOutput, type CweData } from '../../scripts/prepare-data.ts';

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
});

describe('parseCatalog', () => {
  const xmlText = readFileSync(FIXTURE_XML, 'utf-8');
  const data = parseCatalog(xmlText, '"abc123"');

  it('extracts catalog metadata', () => {
    expect(data.meta.cweVersion).toBe('4.15');
    expect(data.meta.etag).toBe('"abc123"');
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
      { from: '79', to: '74', type: 'ChildOf' },
      { from: '79', to: '80', type: 'PeerOf' },
    ]);
  });

  it('has no edges for a weakness with no Related_Weaknesses element', () => {
    expect(data.edges.filter((e) => e.from === '74')).toEqual([]);
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
        meta: { cweVersion: '4.15', etag: '"abc"', generatedAt: '2026-01-01T00:00:00.000Z' },
        nodes: {},
        edges: [],
      };
      await writeOutput(dir, data);
      const cweJson = JSON.parse(await readFile(path.join(dir, 'cwe.json'), 'utf-8'));
      const metaJson = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf-8'));
      expect(cweJson).toEqual(data);
      expect(metaJson).toEqual({ meta: data.meta });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
