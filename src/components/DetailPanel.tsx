import { useEffect, useRef, useState } from 'react';
import type { LateralRelation } from '../lib/ego';
import { chipDimensionLine, differsBy, type TypedDimensions } from '../lib/dimensions';
import { compareIds, isDeprecated, relationDimensions, type Graph } from '../lib/graph';
import { RELATION_GROUPS, relationGroup, type RelationGroup } from '../lib/relations';
import { Glyph } from './Glyph';
import { Dimensions } from './Dimensions';
import { TechnicalNuance } from './TechnicalNuance';

/** Relations to point out, for the graph's lateral "+N more" chip. */
export interface RelationFlash {
  relations: readonly LateralRelation[];
  /** New for every flash, so asking again flashes them again. */
  token: number;
}

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  flash?: RelationFlash | null;
  /** Ids the filter keeps; null when not filtering. Relations outside it are subdued, not hidden. */
  matches?: Set<string> | null;
}

const flashKey = (id: string, type: string) => `${id} ${type}`;

interface Entry {
  id: string;
  /**
   * The relations' own names. A family heading alone loses direction —
   * "Sequence" covers both CanPrecede and CanFollow — so each chip carries
   * its types: one chip per CWE, naming every relation the section has to
   * it. Hierarchy sections don't need them; the heading says it.
   */
  types?: string[];
  /** What MITRE says differs along each relation; only set when some type has any. */
  dimensions?: TypedDimensions[];
}

interface Section {
  label: string;
  entries: Entry[];
}

// Sets the entry's dimensions when any of the relation types has some, keeping
// every such type in the order given.
function attachDimensions(graph: Graph, id: string, entry: Entry, types: string[]) {
  const groups: TypedDimensions[] = [];
  for (const type of types) {
    const dimensions = relationDimensions(graph, id, entry.id, type);
    if (dimensions.length > 0) {
      groups.push({ type, dimensions });
    }
  }
  if (groups.length > 0) {
    entry.dimensions = groups;
  }
}

// A hierarchy chip has no types of its own; the relation's type, named from
// this CWE's side, is only used to look its dimensions up.
function hierarchyEntries(graph: Graph, id: string, ids: string[], type: string): Entry[] {
  return ids.map((to) => {
    const entry: Entry = { id: to };
    attachDimensions(graph, id, entry, [type]);
    return entry;
  });
}

// Every section lists by CWE number, as everywhere else ids are listed: the
// data's own order is lexicographic, which puts CWE-1257 before CWE-128.
function relationSections(graph: Graph, id: string): Section[] {
  const sections: Section[] = [
    { label: 'Parents', entries: hierarchyEntries(graph, id, graph.parentsOf.get(id) ?? [], 'ChildOf') },
    { label: 'Children', entries: hierarchyEntries(graph, id, graph.childrenOf.get(id) ?? [], 'ParentOf') },
  ];
  for (const section of sections) {
    section.entries.sort((x, y) => compareIds(x.id, y.id));
  }

  // buildGraph already records each relation once per target and type, but
  // a CWE can still be related under two types in one group. It gets one
  // chip naming both, in type order to keep it stable.
  const related = graph.relatedTo.get(id) ?? [];
  const byIdThenType = [...related].sort((x, y) => compareIds(x.to, y.to) || x.type.localeCompare(y.type));
  const byGroup = new Map<RelationGroup, Entry[]>();
  for (const edge of byIdThenType) {
    const group = relationGroup(edge.type);
    const list = byGroup.get(group) ?? [];
    const last = list.at(-1);
    if (last?.id === edge.to) {
      last.types?.push(edge.type);
    } else {
      list.push({ id: edge.to, types: [edge.type] });
    }
    byGroup.set(group, list);
  }

  for (const key of ['peer', 'sequence', 'requires'] as const) {
    sections.push({ label: RELATION_GROUPS[key].label, entries: byGroup.get(key) ?? [] });
  }

  for (const section of sections.slice(2)) {
    for (const entry of section.entries) {
      attachDimensions(graph, id, entry, entry.types ?? []);
    }
  }

  return sections.filter((section) => section.entries.length > 0);
}

function RelationChip({
  graph,
  entry,
  flashed,
  outside,
  onSelect,
}: {
  graph: Graph;
  entry: Entry;
  flashed: boolean;
  outside: boolean;
  onSelect: (id: string) => void;
}) {
  const { id, types, dimensions } = entry;
  const type = types?.join(', ');
  const node = graph.nodes[id];
  const name = node ? `CWE-${id}: ${node.name}` : `CWE-${id}`;
  const label = type ? `${type} ${name}` : name;
  const outsideLabel = outside ? `${label}, outside the filter` : label;
  const differs = dimensions && differsBy(dimensions);
  const row = (
    <>
      <Glyph abstraction={node?.abstraction ?? ''} size={12} deprecated={isDeprecated(node)} />
      {type && <span className="relation-chip__type">{type}</span>}
      <span className="relation-chip__id">CWE-{id}</span>
      {node && <span className="relation-chip__name">{node.name}</span>}
    </>
  );
  return (
    <li>
      <button
        type="button"
        className={`relation-chip${flashed ? ' relation-chip--flash' : ''}${outside ? ' relation-chip--outside' : ''}${dimensions ? ' relation-chip--dimensions' : ''}`}
        onClick={() => onSelect(id)}
        aria-label={differs ? `${outsideLabel}. ${differs}` : outsideLabel}
        title={differs}
      >
        {dimensions ? <span className="relation-chip__row">{row}</span> : row}
        {dimensions && <span className="relation-chip__dimensions">{chipDimensionLine(dimensions)}</span>}
      </button>
    </li>
  );
}

export function DetailPanel({ graph, selectedId, onSelect, flash = null, matches = null }: DetailPanelProps) {
  // Narrow screens show this as a bottom sheet with two heights: a peek
  // showing the title and badges, and an expanded read. The grabber is
  // hidden by CSS on wide screens, where the card is simply a card.
  const [expanded, setExpanded] = useState(false);
  const relationsRef = useRef<HTMLDivElement>(null);

  // The peek shows no relations, so a flash there would go unseen: open the
  // sheet, once per flash, which still lets the reader collapse it again.
  const [seenFlash, setSeenFlash] = useState<number | null>(null);
  if (flash && flash.token !== seenFlash) {
    setSeenFlash(flash.token);
    setExpanded(true);
  }

  // Bring the first flashed relation into view and focus it, so a keyboard
  // or screen-reader user lands on what the chip stood for. Scroll to it,
  // not to the top of the list: on CWE-119, 37 parents and children come
  // first, and on a phone the flash played out of sight below them. Focus
  // without scrolling, or the jump would cut the smooth scroll short.
  // scrollIntoView is unimplemented in jsdom.
  useEffect(() => {
    if (!flash) {
      return;
    }
    const first = relationsRef.current?.querySelector<HTMLButtonElement>('.relation-chip--flash');
    first?.focus({ preventScroll: true });
    first?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [flash]);

  if (!selectedId) {
    return <div className="detail-panel detail-panel--empty">Select a CWE to see its details.</div>;
  }

  const node = graph.nodes[selectedId];
  if (!node) {
    return <div className="detail-panel detail-panel--empty">CWE-{selectedId} was not found.</div>;
  }

  const deprecated = isDeprecated(node);
  const sections = relationSections(graph, selectedId);
  const flashed = new Set(flash?.relations.map((r) => flashKey(r.id, r.type)));

  return (
    <div className={`detail-panel${expanded ? ' detail-panel--expanded' : ''}`}>
      <button
        type="button"
        className="detail-panel__grabber"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Collapse details' : 'Expand details'}
      />
      <h2 className="detail-panel__title" aria-label={`CWE-${node.id}: ${node.name}`}>
        <Glyph abstraction={node.abstraction} size={18} deprecated={deprecated} />
        <span className="detail-panel__id">CWE-{node.id}</span>
        <span className="detail-panel__name">{node.name}</span>
      </h2>

      <p className="badges">
        <span className="badge badge--abstraction">{node.abstraction}</span>
        <span className="badge badge--status">{node.status}</span>
      </p>

      {deprecated && (
        <p className="detail-panel__warning" role="status">
          {node.status === 'Obsolete' ? 'MITRE has marked this entry obsolete.' : 'MITRE has deprecated this entry.'}
        </p>
      )}

      {node.description && <p className="detail-panel__description">{node.description}</p>}

      {node.dimensions && <Dimensions key={`dimensions-${node.id}`} dimensions={node.dimensions} />}
      {node.technicalNuance && <TechnicalNuance key={node.id} blocks={node.technicalNuance} />}

      <a className="detail-panel__link" href={node.url} target="_blank" rel="noreferrer">
        View on cwe.mitre.org
      </a>

      <div className="detail-panel__relations" ref={relationsRef}>
        {sections.map((section) => (
          <section key={section.label} className="relation-section">
            <h3 className="relation-section__heading">
              {section.label} ({section.entries.length})
            </h3>
            <ul className="relation-list">
              {section.entries.map((entry) => {
                const isFlashed = entry.types?.some((type) => flashed.has(flashKey(entry.id, type))) ?? false;
                // A new key per flash remounts the chip, which restarts its
                // animation when the same relations are flashed again.
                const key = `${section.label}-${entry.id}${isFlashed ? `-flash${flash?.token}` : ''}`;
                return (
                  <RelationChip
                    key={key}
                    graph={graph}
                    entry={entry}
                    flashed={isFlashed}
                    outside={matches !== null && !matches.has(entry.id)}
                    onSelect={onSelect}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
