import { promises as fs } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { XMLParser } from 'fast-xml-parser';

export interface CweNode {
  id: string;
  name: string;
  abstraction: string;
  status: string;
  description: string;
  url: string;
}

export interface CweEdge {
  from: string;
  to: string;
  type: string;
  /**
   * MITRE scopes each relation to a view (1000 = Research Concepts, and so
   * on). Nothing reads this yet; it is carried so that adding Categories and
   * Views later is additive rather than a pipeline change.
   */
  viewId?: string;
}

export interface CweMeta {
  cweVersion: string;
  lastModified: string;
  generatedAt: string;
}

export interface CweData {
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  edges: CweEdge[];
}

interface RawRelatedWeakness {
  '@_Nature': string;
  '@_CWE_ID': string;
  '@_View_ID'?: string;
}

interface RawWeakness {
  '@_ID': string;
  '@_Name'?: string;
  '@_Abstraction'?: string;
  '@_Status'?: string;
  Description?: unknown;
  Related_Weaknesses?: { Related_Weakness?: RawRelatedWeakness | RawRelatedWeakness[] };
}

interface RawDocument {
  Weakness_Catalog?: {
    '@_Version'?: string;
    Weaknesses?: { Weakness?: RawWeakness | RawWeakness[] };
  };
}

function toArray<T>(x: T | T[] | undefined): T[] {
  return Array.isArray(x) ? x : x ? [x] : [];
}

export function extractXmlFromZip(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (entries.length === 0) {
    throw new Error('No XML entry found in CWE zip archive');
  }
  if (entries.length > 1) {
    throw new Error(
      `Expected exactly one XML entry in CWE zip archive, found ${entries.length}: ${entries.map((e) => e.entryName).join(', ')}`
    );
  }
  return entries[0].getData().toString('utf-8');
}

export function parseCatalog(xmlText: string, lastModified: string | null): CweData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xmlText) as RawDocument;
  const catalog = doc.Weakness_Catalog;
  if (!catalog?.['@_Version']) {
    throw new Error('Unexpected CWE catalog format: missing Weakness_Catalog/Version');
  }

  const weaknessList = toArray(catalog.Weaknesses?.Weakness);

  const nodes: Record<string, CweNode> = {};
  const edges: CweEdge[] = [];

  for (const w of weaknessList) {
    const id = String(w['@_ID']);
    nodes[id] = {
      id,
      name: w['@_Name'] ?? '',
      abstraction: w['@_Abstraction'] ?? '',
      status: w['@_Status'] ?? '',
      description: typeof w.Description === 'string' ? w.Description.trim() : '',
      url: `https://cwe.mitre.org/data/definitions/${id}.html`,
    };

    for (const rel of toArray(w.Related_Weaknesses?.Related_Weakness)) {
      const edge: CweEdge = {
        from: id,
        to: String(rel['@_CWE_ID']),
        type: rel['@_Nature'],
      };
      // Assigned conditionally so viewId stays genuinely absent, rather than
      // present-and-undefined, when MITRE omits the attribute.
      if (rel['@_View_ID'] !== undefined) {
        edge.viewId = String(rel['@_View_ID']);
      }
      edges.push(edge);
    }
  }

  return {
    meta: {
      cweVersion: String(catalog['@_Version']),
      lastModified: lastModified ?? '',
      generatedAt: new Date().toISOString(),
    },
    nodes,
    edges,
  };
}

export async function writeOutput(outDir: string, data: CweData): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'cwe.json'), JSON.stringify(data, null, 2));
  await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify({ meta: data.meta }, null, 2));
}

const SOURCE_URL = 'https://cwe.mitre.org/data/xml/cwec_latest.xml.zip';

export async function readLocalMeta(outDir: string): Promise<CweMeta | null> {
  try {
    // meta.json alone isn't proof the data is intact: if cwe.json is missing
    // or truncated, report no local meta so the slow path regenerates it.
    JSON.parse(await fs.readFile(path.join(outDir, 'cwe.json'), 'utf-8'));
    const raw = await fs.readFile(path.join(outDir, 'meta.json'), 'utf-8');
    return (JSON.parse(raw) as { meta: CweMeta }).meta;
  } catch {
    return null;
  }
}

interface RunOptions {
  sourceUrl?: string;
  outDir?: string;
  fetchImpl?: typeof fetch;
}

export async function run({
  sourceUrl = SOURCE_URL,
  outDir = path.join(process.cwd(), 'public', 'data'),
  fetchImpl = fetch,
}: RunOptions = {}): Promise<{ updated: boolean; meta: CweMeta }> {
  const localMeta = await readLocalMeta(outDir);

  let currentLastModified: string | null;
  try {
    const headResponse = await fetchImpl(sourceUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      throw new Error(`HTTP ${headResponse.status}`);
    }
    currentLastModified = headResponse.headers.get('last-modified');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (localMeta) {
      console.warn(`Could not reach CWE source (${message}); reusing cached data from ${localMeta.generatedAt}.`);
      return { updated: false, meta: localMeta };
    }
    throw new Error(`Could not reach CWE source and no cached data exists: ${message}`, { cause: err });
  }

  if (localMeta && currentLastModified && localMeta.lastModified === currentLastModified) {
    console.log(`CWE data already up to date (last-modified ${currentLastModified}). Skipping download.`);
    return { updated: false, meta: localMeta };
  }

  const getResponse = await fetchImpl(sourceUrl);
  if (!getResponse.ok) {
    throw new Error(`Failed to download CWE data (HTTP ${getResponse.status}): ${sourceUrl}`);
  }
  const zipBuffer = Buffer.from(await getResponse.arrayBuffer());
  const xmlText = extractXmlFromZip(zipBuffer);
  const data = parseCatalog(xmlText, currentLastModified ?? '');

  await writeOutput(outDir, data);
  console.log(`CWE data updated to version ${data.meta.cweVersion} (last-modified ${currentLastModified}).`);
  return { updated: true, meta: data.meta };
}

// import.meta.main works unflagged on Node >=22.18 / >=24.2 (this project
// requires >=24.2, and pins @types/node to match) and is what actually
// reflects whether this file is the CLI entrypoint, unlike comparing the
// percent-encoded import.meta.url against the raw process.argv[1] path.
// eslint-plugin-n's builtin-support data still classifies it as experimental
// (Node hasn't graduated its stability index yet), so the
// unsupported-features rule needs an explicit opt-out here.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
