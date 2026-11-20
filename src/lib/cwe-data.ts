// The shape of public/data/cwe.json: written by scripts/prepare-data.ts at
// build time and read by the app at runtime. Both sides import these types
// from here, so the file's producer and consumer can't drift apart.

/** A stretch of text in a nuance line, bold when `bold` is set. */
export interface NuanceRun {
  text: string;
  bold?: true;
}

export type NuanceLine = NuanceRun[];

/** A block of MITRE's structured text (Technical_Nuance, an alternate term's Description). */
export type NuanceBlock =
  | { kind: 'paragraph'; lines: NuanceLine[] }
  | { kind: 'list'; items: NuanceLine[][] };

/** A phase of the software lifecycle; `domain` is set for a custom phase (AI, Hardware). */
export interface CwePhase {
  name: string;
  domain?: string;
}

/** A MITRE view the filter offers; view 1000 lists no members, as it constrains nothing. */
export interface CweView {
  id: string;
  name: string;
  groupIds: string[];
  memberIds: string[];
  /** Present only when non-empty. Names only, as nothing shows the dates. */
  previousNames?: string[];
}

/** A grouping (category) and the weaknesses beneath it, within each view that reaches it. */
export interface CweGroup {
  id: string;
  name: string;
  status: string;
  membersByView: Record<string, string[]>;
}

/**
 * The version of cwe.json's shape. Bump it whenever the build starts writing
 * something a cached file would lack, so a stale file is regenerated.
 */
export const DATA_FORMAT = 3;

/** One part MITRE built a weakness's name from (CWE 5.0 Dimensions). */
export interface CweDimension {
  /** One of the schema's 18 types, verbatim, e.g. "Behavior-Type". */
  type: string;
  /** MITRE's text, whitespace-collapsed and trimmed, otherwise verbatim. */
  value: string;
}

export interface CweAlternateTerm {
  /** MITRE's Term, whitespace-collapsed and trimmed, otherwise verbatim. */
  term: string;
  /** MITRE's Description, converted like Technical_Nuance. Present only when non-empty. */
  description?: NuanceBlock[];
}

export interface CwePreviousName {
  /** MITRE's Previous_Entry_Name text, whitespace-collapsed and trimmed. */
  name: string;
  /** The Date attribute (YYYY-MM-DD): when MITRE stopped using the name. */
  date: string;
}

export interface CweNode {
  id: string;
  name: string;
  abstraction: string;
  status: string;
  description: string;
  url: string;
  /**
   * MITRE's Technical_Nuance, converted to blocks. Present only when the
   * weakness has a non-empty nuance; built by scripts/nuance.ts.
   */
  technicalNuance?: NuanceBlock[];
  /**
   * The phases the weakness can be introduced in, from MITRE's
   * Modes_Of_Introduction. Present only when non-empty; built by
   * scripts/phases.ts.
   */
  phases?: CwePhase[];
  /** Present only when non-empty. In schema type order. */
  dimensions?: CweDimension[];
  /** Present only when non-empty. In MITRE's order. */
  alternateTerms?: CweAlternateTerm[];
  /** Present only when non-empty. In MITRE's order (oldest first). */
  previousNames?: CwePreviousName[];
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
  /** Present only when non-empty. In schema type order. */
  dimensions?: CweDimension[];
}

export interface CweMeta {
  cweVersion: string;
  /**
   * The catalog's own release date (YYYY-MM-DD), from MITRE's
   * Weakness_Catalog/Date. Its year ends the copyright range in the footer.
   */
  catalogDate: string;
  lastModified: string;
  generatedAt: string;
}

/** A programming language the filter offers, and the weaknesses that match it. */
export interface CweLanguage {
  name: string;
  /** The language classes mapped to it, such as Memory-Unsafe. */
  classes: string[];
  /** The weaknesses naming the language or one of its classes, sorted numerically. */
  memberIds: string[];
}

export interface CweData {
  /** The version of this file's shape; see DATA_FORMAT. Absent in files older than it. */
  dataFormat?: number;
  meta: CweMeta;
  nodes: Record<string, CweNode>;
  edges: CweEdge[];
  /**
   * Every phase some weakness is introduced in, in picker order. Optional so
   * hand-built test data stays valid; prepare-data always writes it.
   */
  phases?: CwePhase[];
  /**
   * The views the filter offers, view 1000 first. Optional so hand-built test
   * data stays valid; prepare-data always writes it. Built by scripts/views.ts.
   */
  views?: CweView[];
  /** The groupings some view in `views` reaches, by ID. Written with `views`. */
  groups?: Record<string, CweGroup>;
  /**
   * The programming languages the filter offers, sorted by name. Optional so
   * hand-built test data stays valid; prepare-data always writes it. Built by
   * scripts/languages.ts.
   */
  languages?: CweLanguage[];
  /**
   * The weaknesses MITRE marks Not Language-Specific, sorted numerically.
   * Written with `languages`.
   */
  languageAgnosticIds?: string[];
}
