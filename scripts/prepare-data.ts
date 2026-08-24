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
  '@_CWE_ID': string | number;
}

interface RawWeakness {
  '@_ID': string | number;
  '@_Name'?: string;
  '@_Abstraction'?: string;
  '@_Status'?: string;
  Description?: unknown;
  Related_Weaknesses?: { Related_Weakness?: RawRelatedWeakness | RawRelatedWeakness[] };
}

export function extractXmlFromZip(buffer: Buffer): string {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.xml'));
  if (entries.length === 0) {
    throw new Error('No XML entry found in CWE zip archive');
  }
  return entries[0].getData().toString('utf-8');
}

export function parseCatalog(xmlText: string, lastModified: string | null): CweData {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const doc = parser.parse(xmlText);
  const catalog = doc.Weakness_Catalog;
  if (!catalog || !catalog['@_Version']) {
    throw new Error('Unexpected CWE catalog format: missing Weakness_Catalog/Version');
  }

  const rawWeaknesses: RawWeakness | RawWeakness[] | undefined = catalog.Weaknesses?.Weakness;
  const weaknessList = Array.isArray(rawWeaknesses) ? rawWeaknesses : rawWeaknesses ? [rawWeaknesses] : [];

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

    const rawRelated = w.Related_Weaknesses?.Related_Weakness;
    const relatedList = Array.isArray(rawRelated) ? rawRelated : rawRelated ? [rawRelated] : [];
    for (const rel of relatedList) {
      edges.push({
        from: id,
        to: String(rel['@_CWE_ID']),
        type: rel['@_Nature'],
      });
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
// requires >=24) and is what actually reflects whether this file is the CLI
// entrypoint, unlike comparing the percent-encoded import.meta.url against
// the raw process.argv[1] path. eslint-plugin-n's builtin-support data still
// classifies it as experimental (Node hasn't graduated its stability index
// yet), so the unsupported-features rule needs an explicit opt-out here.
// eslint-disable-next-line n/no-unsupported-features/node-builtins
if (import.meta.main) {
  run().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
