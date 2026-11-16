import { useEffect, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { ancestorsOf, isDeprecated } from '../lib/graph';
import { withMatchPaths } from '../lib/filter';
import { Glyph } from './Glyph';

interface TreeProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Opened to this node and its ancestors, so its children are on screen. */
  revealId?: string | null;
  /** The filter's matches; null when not filtering. Give the Tree a new key when the filter changes. */
  matches?: Set<string> | null;
}

export function Tree({ graph, selectedId, onSelect, revealId = null, matches = null }: TreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Nodes the user has explicitly collapsed. This is what lets a manual
  // toggle override the auto-expand-ancestors behavior below: without it, an
  // ancestor of the current selection could never actually be collapsed,
  // since effectiveExpanded would keep re-adding it via ancestorsOf on every
  // render regardless of what `expanded` said.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // A filter opens the Deprecated section, since its rows are matches.
  const [showDeprecated, setShowDeprecated] = useState(matches !== null);

  // Rows on screen under a filter: the matches, their paths, the selected
  // CWE with its path (so the selection never vanishes), and the revealed CWE
  // with its path and children (so the graph's "+N more" chip shows what it
  // promised). Null shows everything.
  let visible: Set<string> | null = null;
  if (matches !== null) {
    visible = withMatchPaths(graph, matches);
    for (const id of [selectedId, revealId]) {
      if (id && id in graph.nodes) {
        visible.add(id);
        for (const ancestor of ancestorsOf(graph, id)) {
          visible.add(ancestor);
        }
      }
    }
    if (revealId && revealId in graph.nodes) {
      for (const child of graph.childrenOf.get(revealId) ?? []) {
        visible.add(child);
      }
    }
  }
  const roots = visible ? graph.roots.filter((id) => visible.has(id)) : graph.roots;
  const deprecatedRoots = visible
    ? graph.deprecatedRoots.filter((id) => visible.has(id))
    : graph.deprecatedRoots;

  // Ancestors of the current selection are always treated as expanded, in
  // addition to whatever the user has manually toggled open — unless the
  // user has explicitly collapsed them. Computed at render time (rather than
  // synced into state via an effect) to avoid the extra render pass a
  // setState-in-effect would trigger.
  const ancestors = selectedId ? ancestorsOf(graph, selectedId) : new Set<string>();
  // ancestorsOf excludes the node itself, so revealing a node's children means
  // expanding the node as well as the path down to it.
  const revealed = revealId ? [revealId, ...ancestorsOf(graph, revealId)] : [];
  const effectiveExpanded = new Set(
    [...expanded, ...ancestors, ...revealed, ...(visible ?? [])].filter((id) => !collapsed.has(id)),
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
    <>
      {matches !== null && matches.size === 0 && <p className="tree-empty">No CWEs match the filter.</p>}
      <ul className="tree" role="tree">
        {roots.map((id) => (
          <TreeNode
            key={id}
            id={id}
            graph={graph}
            expanded={effectiveExpanded}
            selectedId={selectedId}
            onToggle={toggle}
            onSelect={onSelect}
            ancestry={new Set()}
            visible={visible}
            matches={matches}
          />
        ))}
        {deprecatedRoots.length > 0 && (
          <li role="treeitem" aria-expanded={showDeprecated} aria-selected={false}>
            <div className="tree-row tree-row--group">
              <button
                type="button"
                className="tree-toggle"
                onClick={() => setShowDeprecated((open) => !open)}
                aria-label={`Deprecated (${deprecatedRoots.length})`}
              >
                {showDeprecated ? '▾' : '▸'} Deprecated ({deprecatedRoots.length})
              </button>
            </div>
            {showDeprecated && (
              <ul role="group">
                {deprecatedRoots.map((id) => (
                  <TreeNode
                    key={id}
                    id={id}
                    graph={graph}
                    expanded={effectiveExpanded}
                    selectedId={selectedId}
                    onToggle={toggle}
                    onSelect={onSelect}
                    ancestry={new Set()}
                    visible={visible}
                    matches={matches}
                  />
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </>
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
  /** Ids shown under a filter; null shows every child. */
  visible: Set<string> | null;
  matches: Set<string> | null;
}

function TreeNode({ id, graph, expanded, selectedId, onToggle, onSelect, ancestry, visible, matches }: TreeNodeProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const isSelected = selectedId === id;

  // Bring a newly selected row on screen; a search pick can land on a node
  // far outside the scrolled area. `nearest` leaves an already-visible row
  // alone. scrollIntoView is unimplemented in jsdom.
  useEffect(() => {
    if (isSelected) {
      rowRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isSelected]);

  // Defends against a cycle in the source data (should not happen with real
  // CWE data, but a malformed Related_Weaknesses entry could otherwise
  // recurse forever).
  if (ancestry.has(id)) {
    return null;
  }

  // Hierarchy edges can name an id outside the corpus, which buildGraph keeps
  // indexed, so only ids with a node to render count as children or parents.
  const known = (ids: string[] | undefined) => (ids ?? []).filter((other) => other in graph.nodes);
  const shown = (ids: string[] | undefined) => known(ids).filter((other) => visible === null || visible.has(other));

  const node = graph.nodes[id];
  const children = shown(graph.childrenOf.get(id));
  const isExpanded = expanded.has(id);
  const childAncestry = new Set(ancestry);
  childAncestry.add(id);

  const parentCount = known(graph.parentsOf.get(id)).length;
  const deprecated = isDeprecated(node);
  const outside = matches !== null && !matches.has(id);

  return (
    <li
      role="treeitem"
      aria-expanded={children.length > 0 ? isExpanded : undefined}
      aria-selected={isSelected}
    >
      <div ref={rowRef} className={`tree-row${isSelected ? ' tree-row--selected' : ''}`}>
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
        <button
          type="button"
          className={`tree-label${deprecated ? ' tree-label--deprecated' : ''}${outside ? ' tree-label--context' : ''}`}
          onClick={() => onSelect(id)}
          aria-label={`CWE-${id}: ${node.name}${outside ? ', outside the filter' : ''}`}
        >
          <Glyph abstraction={node.abstraction} size={14} deprecated={deprecated} />
          <span className="tree-label__id">CWE-{id}</span>
          <span className="tree-label__name">{node.name}</span>
        </button>
        {parentCount > 1 && (
          <span
            className="tree-row__multi"
            aria-label={`CWE-${id} also appears under ${parentCount - 1} other parent`}
          >
            ⧉
          </span>
        )}
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
              visible={visible}
              matches={matches}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
