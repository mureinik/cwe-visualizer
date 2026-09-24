import { useState } from 'react';
import type { Graph } from '../lib/graph';
import { RELATION_GROUPS, relationGroup, type RelationGroup } from '../lib/relations';
import { Glyph } from './Glyph';

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Entry {
  id: string;
  /**
   * The relation's own name. A family heading alone loses direction —
   * "Sequence" covers both CanPrecede and CanFollow — so each chip carries
   * its type. Hierarchy sections don't need it; the heading says it.
   */
  type?: string;
}

interface Section {
  label: string;
  entries: Entry[];
}

function relationSections(graph: Graph, id: string): Section[] {
  const sections: Section[] = [
    { label: 'Parents', entries: (graph.parentsOf.get(id) ?? []).map((to) => ({ id: to })) },
    { label: 'Children', entries: (graph.childrenOf.get(id) ?? []).map((to) => ({ id: to })) },
  ];

  const related = graph.relatedTo.get(id) ?? [];
  const byGroup = new Map<RelationGroup, Entry[]>();
  for (const edge of related) {
    const group = relationGroup(edge.type);
    const list = byGroup.get(group) ?? [];
    if (!list.some((entry) => entry.id === edge.to && entry.type === edge.type)) {
      list.push({ id: edge.to, type: edge.type });
    }
    byGroup.set(group, list);
  }

  for (const key of ['peer', 'sequence', 'requires'] as const) {
    sections.push({ label: RELATION_GROUPS[key].label, entries: byGroup.get(key) ?? [] });
  }

  return sections.filter((section) => section.entries.length > 0);
}

function RelationChip({
  graph,
  entry,
  onSelect,
}: {
  graph: Graph;
  entry: Entry;
  onSelect: (id: string) => void;
}) {
  const { id, type } = entry;
  const node = graph.nodes[id];
  const name = node ? `CWE-${id}: ${node.name}` : `CWE-${id}`;
  return (
    <li>
      <button
        type="button"
        className="relation-chip"
        onClick={() => onSelect(id)}
        aria-label={type ? `${type} ${name}` : name}
      >
        <Glyph abstraction={node?.abstraction ?? ''} size={12} deprecated={node?.status === 'Deprecated'} />
        {type && <span className="relation-chip__type">{type}</span>}
        <span className="relation-chip__id">CWE-{id}</span>
        {node && <span className="relation-chip__name">{node.name}</span>}
      </button>
    </li>
  );
}

export function DetailPanel({ graph, selectedId, onSelect }: DetailPanelProps) {
  // Narrow screens show this as a bottom sheet with two heights: a peek
  // showing the title and badges, and an expanded read. The grabber is
  // hidden by CSS on wide screens, where the card is simply a card.
  const [expanded, setExpanded] = useState(false);

  if (!selectedId) {
    return <div className="detail-panel detail-panel--empty">Select a CWE to see its details.</div>;
  }

  const node = graph.nodes[selectedId];
  if (!node) {
    return <div className="detail-panel detail-panel--empty">CWE-{selectedId} was not found.</div>;
  }

  const deprecated = node.status === 'Deprecated';
  const sections = relationSections(graph, selectedId);

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
          MITRE has deprecated this entry.
        </p>
      )}

      {node.description && <p className="detail-panel__description">{node.description}</p>}

      <a className="detail-panel__link" href={node.url} target="_blank" rel="noreferrer">
        View on cwe.mitre.org
      </a>

      {sections.map((section) => (
        <section key={section.label} className="relation-section">
          <h3 className="relation-section__heading">
            {section.label} ({section.entries.length})
          </h3>
          <ul className="relation-list">
            {section.entries.map((entry) => (
              <RelationChip
                key={`${section.label}-${entry.id}-${entry.type ?? ''}`}
                graph={graph}
                entry={entry}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
