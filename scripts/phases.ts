// Reads a weakness's Modes_Of_Introduction into phases, and orders the phases
// in use for the picker. Strict on purpose, like nuance.ts: a shape it doesn't
// know fails the build, so a MITRE format change is noticed.

import type { CwePhase } from '../src/lib/cwe-data.ts';
import { phaseKey } from '../src/lib/phases.ts';

/** An Introduction as fast-xml-parser gives it. */
export interface RawIntroduction {
  Phase?: unknown;
  Custom_Phase?: unknown;
}

const DOMAIN = '@_Domain';
const TEXT = '#text';

const STANDARD = [
  'Policy',
  'Requirements',
  'Architecture and Design',
  'Implementation',
  'Build and Compilation',
  'Testing',
  'Documentation',
  'Bundling',
  'Distribution',
  'Installation',
  'System Configuration',
  'Operation',
  'Patching and Maintenance',
  'Porting',
  'Integration',
  'Manufacturing',
  'Decommissioning and End-of-Life',
];

const AI = [
  'Data Collection',
  'Training',
  'Fine-tuning',
  'Testing',
  'Tokenization',
  'Prompting',
  'Output Processing',
  'Component Interaction',
  'Re-training / Feedback',
];

const HARDWARE = [
  'Hardware Requirements',
  'Hardware Architecture',
  'Hardware Microarchitecture',
  'Implementation & Physical Design',
  'Pre-Manufacturing Verification',
  'Hardware Manufacturing',
  'Post-Manufacturing Validation',
  'Device Configuration & Personalization',
  'Device / System Integration',
  'Field Operations & Sustainment',
  'Reuse',
  'Decommissioning',
];

function toList(x: unknown): unknown[] {
  return Array.isArray(x) ? x : x === undefined ? [] : [x];
}

function textOf(x: unknown): string {
  return typeof x === 'string' ? x.trim() : '';
}

function customPhase(raw: unknown, cweId: string): CwePhase {
  if (typeof raw === 'string') {
    if (raw.trim() === '') {
      throw new Error(`CWE-${cweId}: empty Custom_Phase in Modes_Of_Introduction`);
    }
    throw new Error(`CWE-${cweId}: Custom_Phase ${raw.trim()} has no Domain`);
  }
  const element = (raw ?? {}) as Record<string, unknown>;
  const name = textOf(element[TEXT]);
  if (name === '') {
    throw new Error(`CWE-${cweId}: empty Custom_Phase in Modes_Of_Introduction`);
  }
  const domain = textOf(element[DOMAIN]);
  if (domain === '') {
    throw new Error(`CWE-${cweId}: Custom_Phase ${name} has no Domain`);
  }
  return { name, domain };
}

/** The distinct phases of one weakness, in source order. */
export function readPhases(introductions: RawIntroduction[], cweId: string): CwePhase[] {
  const seen = new Set<string>();
  const phases: CwePhase[] = [];
  const add = (phase: CwePhase): void => {
    const key = phaseKey(phase);
    if (!seen.has(key)) {
      seen.add(key);
      phases.push(phase);
    }
  };
  for (const introduction of introductions) {
    for (const raw of toList(introduction.Phase)) {
      const name = textOf(raw);
      if (name === '') {
        throw new Error(`CWE-${cweId}: empty Phase in Modes_Of_Introduction`);
      }
      add({ name });
    }
    for (const raw of toList(introduction.Custom_Phase)) {
      add(customPhase(raw, cweId));
    }
  }
  return phases;
}

// Standard phases first, then AI, then Hardware, then any other domain by name.
function domainRank(domain: string | undefined): number {
  return domain === undefined ? 0 : domain === 'AI' ? 1 : domain === 'Hardware' ? 2 : 3;
}

function listFor(domain: string | undefined): string[] {
  return domain === undefined ? STANDARD : domain === 'AI' ? AI : domain === 'Hardware' ? HARDWARE : [];
}

function compare(a: CwePhase, b: CwePhase): number {
  const byDomain = domainRank(a.domain) - domainRank(b.domain);
  if (byDomain !== 0) {
    return byDomain;
  }
  if (domainRank(a.domain) === 3 && a.domain !== b.domain) {
    return a.domain! < b.domain! ? -1 : 1;
  }
  const list = listFor(a.domain);
  const indexA = list.indexOf(a.name);
  const indexB = list.indexOf(b.name);
  if (indexA !== -1 || indexB !== -1) {
    // A known name sorts before an unknown one.
    return (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB);
  }
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** The distinct phases in the order the picker lists them. */
export function orderPhases(phases: CwePhase[]): CwePhase[] {
  const distinct = new Map<string, CwePhase>();
  for (const phase of phases) {
    distinct.set(phaseKey(phase), phase);
  }
  return [...distinct.values()].sort(compare);
}
