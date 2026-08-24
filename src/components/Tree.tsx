import { useState } from 'react';
import type { Graph } from '../lib/graph';
import { ancestorsOf } from '../lib/graph';

interface TreeProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Tree({ graph, selectedId, onSelect }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Ancestors of the current selection are always treated as expanded, in
  // addition to whatever the user has manually toggled open. Computed at
  // render time (rather than synced into state via an effect) to avoid the
  // extra render pass a setState-in-effect would trigger.
  const effectiveExpanded = selectedId
    ? new Set([...expanded, ...ancestorsOf(graph, selectedId)])
    : expanded;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ul className="tree" role="tree">
      {graph.roots.map((id) => (
        <TreeNode
          key={id}
          id={id}
          graph={graph}
          expanded={effectiveExpanded}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={onSelect}
          ancestry={new Set()}
        />
      ))}
    </ul>
  );
}

interface TreeNodeProps {
  id: string;
  graph: Graph;
  expanded: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  ancestry: Set<string>;
}

function TreeNode({ id, graph, expanded, selectedId, onToggle, onSelect, ancestry }: TreeNodeProps) {
  // Defends against a cycle in the source data (should not happen with real
  // CWE data, but a malformed Related_Weaknesses entry could otherwise
  // recurse forever).
  if (ancestry.has(id)) {
    return null;
  }

  const node = graph.nodes[id];
  const children = graph.childrenOf.get(id) ?? [];
  const isExpanded = expanded.has(id);
  const isSelected = selectedId === id;
  const childAncestry = new Set(ancestry);
  childAncestry.add(id);

  return (
    <li role="treeitem" aria-expanded={children.length > 0 ? isExpanded : undefined}>
      <div className={`tree-row${isSelected ? ' tree-row--selected' : ''}`}>
        {children.length > 0 ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => onToggle(id)}
            aria-label={isExpanded ? `Collapse CWE-${id}` : `Expand CWE-${id}`}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle-spacer" />
        )}
        <button type="button" className="tree-label" onClick={() => onSelect(id)}>
          CWE-{id}: {node.name}
        </button>
      </div>
      {isExpanded && children.length > 0 && (
        <ul role="group">
          {children.map((childId) => (
            <TreeNode
              key={childId}
              id={childId}
              graph={graph}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              ancestry={childAncestry}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
