// The shape of public/data/cwe.json: written by scripts/prepare-data.ts at
// build time and read by the app at runtime. Both sides import these types
// from here, so the file's producer and consumer can't drift apart.

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
