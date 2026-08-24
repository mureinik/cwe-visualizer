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
  etag: string;
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

export function parseCatalog(xmlText: string, etag: string | null): CweData {
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
      etag: etag ?? '',
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
