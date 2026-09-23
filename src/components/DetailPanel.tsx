import { useState } from 'react';
import type { Graph } from '../lib/graph';
import { RELATION_GROUPS, relationGroup, type RelationGroup } from '../lib/relations';
import { Glyph } from './Glyph';

interface DetailPanelProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Section {
  label: string;
  ids: string[];
}

function relationSections(graph: Graph, id: string): Section[] {
  const sections: Section[] = [
    { label: 'Parents', ids: graph.parentsOf.get(id) ?? [] },
    { label: 'Children', ids: graph.childrenOf.get(id) ?? [] },
  ];

  const related = graph.relatedTo.get(id) ?? [];
  const byGroup = new Map<RelationGroup, string[]>();
  for (const edge of related) {
    const group = relationGroup(edge.type);
    const list = byGroup.get(group) ?? [];
    if (!list.includes(edge.to)) list.push(edge.to);
    byGroup.set(group, list);
  }

  for (const key of ['peer', 'sequence', 'requires'] as const) {
    sections.push({ label: RELATION_GROUPS[key].label, ids: byGroup.get(key) ?? [] });
  }

  return sections.filter((section) => section.ids.length > 0);
}

function RelationChip({ graph, id, onSelect }: { graph: Graph; id: string; onSelect: (id: string) => void }) {
  const node = graph.nodes[id];
  const label = node ? `CWE-${id}: ${node.name}` : `CWE-${id}`;
  return (
    <li>
      <button type="button" className="relation-chip" onClick={() => onSelect(id)} aria-label={label}>
        <Glyph abstraction={node?.abstraction ?? ''} size={12} deprecated={node?.status === 'Deprecated'} />
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
            {section.label} ({section.ids.length})
          </h3>
          <ul className="relation-list">
            {section.ids.map((id) => (
              <RelationChip key={`${section.label}-${id}`} graph={graph} id={id} onSelect={onSelect} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
