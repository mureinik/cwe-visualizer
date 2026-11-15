// Converts the inner XML of a weakness's Technical_Nuance into the blocks the
// detail panel renders. Strict on purpose: markup it doesn't know fails the
// build, so a MITRE format change is noticed instead of silently mangled.

import { XMLParser } from 'fast-xml-parser';
import type { NuanceBlock, NuanceLine, NuanceRun } from '../src/lib/cwe-data.ts';

type XmlNode = Record<string, unknown>;

const ROOT = 'Technical_Nuance';
const ATTRIBUTES = ':@';
const ATTRIBUTE_PREFIX = '@_';
const TEXT = '#text';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  htmlEntities: true,
});

function tagOf(node: XmlNode): string {
  return Object.keys(node).find((key) => key !== ATTRIBUTES)!;
}

function childrenOf(node: XmlNode): XmlNode[] {
  return node[tagOf(node)] as XmlNode[];
}

function isBlank(text: string): boolean {
  return /^[ \t\r\n]*$/.test(text);
}

function bare(tag: string): string {
  return tag.replace(/^xhtml:/, '');
}

function failure(cweId: string, message: string, path: string[]): Error {
  return new Error(`CWE-${cweId}: ${message} in ${path.join(' > ')}`);
}

// Throws on any attribute, except `style` where `allowStyle` says so (its
// value is ignored: the indent it asks for isn't rendered).
function checkAttributes(node: XmlNode, cweId: string, path: string[], allowStyle = false): void {
  const attributes = (node[ATTRIBUTES] ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(attributes)) {
    const name = key.slice(ATTRIBUTE_PREFIX.length);
    if (!(allowStyle && name === 'style')) {
      throw failure(cweId, `unsupported attribute ${name} on <${tagOf(node)}>`, path);
    }
  }
}

function unsupported(node: XmlNode, cweId: string, path: string[]): Error {
  return failure(cweId, `unsupported <${tagOf(node)}>`, path);
}

function unexpectedText(cweId: string, path: string[]): Error {
  return failure(cweId, 'unexpected text', path);
}

// Applies the whitespace rules to one line: runs collapse to single spaces,
// a space is never kept twice across a run boundary, and the line is trimmed.
function tidyLine(runs: NuanceRun[]): NuanceLine {
  const kept: NuanceRun[] = [];
  for (const run of runs) {
    let text = run.text.replace(/[ \t\r\n]+/g, ' ');
    if (text.startsWith(' ') && kept.at(-1)?.text.endsWith(' ')) {
      text = text.slice(1);
    }
    if (text !== '') {
      kept.push({ ...run, text });
    }
  }
  if (kept.length > 0) {
    kept[0].text = kept[0].text.replace(/^ /, '');
    kept[kept.length - 1].text = kept.at(-1)!.text.replace(/ $/, '');
  }
  return kept.filter((run) => run.text !== '');
}

// Text and `b` (which holds only text), as runs of one line.
function inlineRuns(children: XmlNode[], cweId: string, path: string[]): NuanceRun[] {
  const runs: NuanceRun[] = [];
  for (const child of children) {
    if (TEXT in child) {
      runs.push({ text: child[TEXT] as string });
    } else if (tagOf(child) === 'xhtml:b') {
      checkAttributes(child, cweId, path);
      const boldPath = [...path, 'b'];
      for (const inner of childrenOf(child)) {
        if (!(TEXT in inner)) {
          throw unsupported(inner, cweId, boldPath);
        }
        runs.push({ text: inner[TEXT] as string, bold: true });
      }
    } else {
      throw unsupported(child, cweId, path);
    }
  }
  return runs;
}

// A line div or p: inline content only.
function lineOf(node: XmlNode, cweId: string, path: string[]): NuanceLine {
  return tidyLine(inlineRuns(childrenOf(node), cweId, [...path, bare(tagOf(node))]));
}

function listItem(li: XmlNode, cweId: string, path: string[]): NuanceLine[] {
  checkAttributes(li, cweId, path);
  const liPath = [...path, 'li'];
  const lines: NuanceLine[] = [];
  let pending: XmlNode[] = [];
  const flush = (): void => {
    lines.push(tidyLine(inlineRuns(pending, cweId, liPath)));
    pending = [];
  };
  for (const child of childrenOf(li)) {
    const tag = TEXT in child ? undefined : tagOf(child);
    if (tag === 'xhtml:div' || tag === 'xhtml:p') {
      flush();
      checkAttributes(child, cweId, liPath);
      lines.push(lineOf(child, cweId, liPath));
    } else {
      pending.push(child);
    }
  }
  flush();
  return lines.filter((line) => line.length > 0);
}

function list(ul: XmlNode, cweId: string, path: string[]): NuanceBlock {
  checkAttributes(ul, cweId, path);
  const ulPath = [...path, 'ul'];
  const items: NuanceLine[][] = [];
  for (const child of childrenOf(ul)) {
    if (TEXT in child) {
      if (!isBlank(child[TEXT] as string)) {
        throw unexpectedText(cweId, ulPath);
      }
    } else if (tagOf(child) === 'xhtml:li') {
      items.push(listItem(child, cweId, ulPath));
    } else {
      throw unsupported(child, cweId, ulPath);
    }
  }
  return { kind: 'list', items: items.filter((item) => item.length > 0) };
}

// An indented block: a div holding nothing but divs, one line each.
function indentedBlock(div: XmlNode, cweId: string, path: string[]): NuanceBlock {
  checkAttributes(div, cweId, path, true);
  const divPath = [...path, 'div'];
  const lines: NuanceLine[] = [];
  for (const child of childrenOf(div)) {
    if (TEXT in child) {
      if (!isBlank(child[TEXT] as string)) {
        throw unexpectedText(cweId, divPath);
      }
    } else if (tagOf(child) === 'xhtml:div') {
      checkAttributes(child, cweId, divPath);
      lines.push(lineOf(child, cweId, divPath));
    } else {
      throw unsupported(child, cweId, divPath);
    }
  }
  return { kind: 'paragraph', lines: lines.filter((line) => line.length > 0) };
}

function isEmpty(block: NuanceBlock): boolean {
  return block.kind === 'list' ? block.items.length === 0 : block.lines.length === 0;
}

export function parseNuance(raw: string, cweId: string): NuanceBlock[] {
  const root = [ROOT];
  const tree = parser.parse(`<${ROOT}>${raw}</${ROOT}>`) as XmlNode[];
  const blocks: NuanceBlock[] = [];
  for (const node of childrenOf(tree[0])) {
    if (TEXT in node) {
      blocks.push({ kind: 'paragraph', lines: [tidyLine([{ text: node[TEXT] as string }])] });
      continue;
    }
    switch (tagOf(node)) {
      case 'xhtml:p':
        checkAttributes(node, cweId, root);
        blocks.push({ kind: 'paragraph', lines: [lineOf(node, cweId, root)] });
        break;
      case 'xhtml:div':
        blocks.push(indentedBlock(node, cweId, root));
        break;
      case 'xhtml:ul':
        blocks.push(list(node, cweId, root));
        break;
      default:
        throw unsupported(node, cweId, root);
    }
  }
  return blocks
    .map((block) => block.kind === 'paragraph'
      ? { ...block, lines: block.lines.filter((line) => line.length > 0) }
      : block)
    .filter((block) => !isEmpty(block));
}
