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
  // Nodes the user has explicitly collapsed. This is what lets a manual
  // toggle override the auto-expand-ancestors behavior below: without it, an
  // ancestor of the current selection could never actually be collapsed,
  // since effectiveExpanded would keep re-adding it via ancestorsOf on every
  // render regardless of what `expanded` said.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Ancestors of the current selection are always treated as expanded, in
  // addition to whatever the user has manually toggled open — unless the
  // user has explicitly collapsed them. Computed at render time (rather than
  // synced into state via an effect) to avoid the extra render pass a
  // setState-in-effect would trigger.
  const ancestors = selectedId ? ancestorsOf(graph, selectedId) : new Set<string>();
  const effectiveExpanded = new Set(
    [...expanded, ...ancestors].filter((id) => !collapsed.has(id))
  );

  function toggle(id: string) {
    if (effectiveExpanded.has(id)) {
      // Collapsing: drop any manual "expanded" flag and record an explicit
      // collapse so it overrides auto-expand-via-ancestry too.
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setCollapsed((prev) => new Set(prev).add(id));
    } else {
      // Expanding: clear any explicit collapse and record a manual expand.
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setExpanded((prev) => new Set(prev).add(id));
    }
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
