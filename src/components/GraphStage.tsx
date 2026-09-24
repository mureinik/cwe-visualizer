import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { buildEgoGraph } from '../lib/ego';
import { EDGE_MARGIN, layoutEgoGraph, type StageSize } from '../lib/layout';
import { elideSharedPrefix, fitLabel, labelBudget } from '../lib/labels';
import { GraphEdge } from './GraphEdge';
import { GraphNode } from './GraphNode';
import { Legend } from './Legend';

const DEFAULT_STAGE: StageSize = { width: 960, height: 600 };

interface GraphStageProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowChildren: (parentId: string) => void;
  hops: number;
}

/**
 * Tracks the stage's own box so the layout can always fit it — which is why
 * the graph needs no pan or zoom. Falls back to a fixed size where
 * ResizeObserver is unavailable (jsdom, and very old browsers).
 */
function useStageSize(ref: React.RefObject<HTMLDivElement | null>): StageSize {
  const [size, setSize] = useState<StageSize>(DEFAULT_STAGE);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function describeNode(graph: Graph, id: string): string {
  const node = graph.nodes[id];
  const parents = (graph.parentsOf.get(id) ?? []).length;
  const children = (graph.childrenOf.get(id) ?? []).length;
  const parentText = `${parents} parent${parents === 1 ? '' : 's'}`;
  const childText = `${children} child${children === 1 ? '' : 'ren'}`;
  return `CWE-${id}: ${node.name}. ${node.abstraction}, ${node.status}. ${parentText}, ${childText}.`;
}

export function GraphStage({ graph, selectedId, onSelect, onShowChildren, hops }: GraphStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const size = useStageSize(stageRef);

  const ego = useMemo(
    () => (selectedId ? buildEgoGraph(graph, selectedId, { ancestorHops: hops }) : null),
    [graph, selectedId, hops]
  );
  const layout = useMemo(() => (ego ? layoutEgoGraph(ego, size) : null), [ego, size]);

  /**
   * Labels are shortened per band, not globally: siblings share far more
   * opening text than a parent and a child do, so eliding within a band
   * strips the most and keeps what distinguishes them. The budget comes from
   * how much horizontal room each node actually has, so a crowded band
   * truncates harder instead of overlapping.
   */
  const displayNames = useMemo(() => {
    const result = new Map<string, string>();
    const compact = new Map<string, boolean>();
    if (!layout) return { names: result, compact };

    const usable = Math.max(0, size.width - 2 * EDGE_MARGIN);
    for (const band of [-2, -1, 0, 1] as const) {
      const members = layout.nodes.filter((n) => n.band === band);
      if (members.length === 0) continue;

      // Budget each node from its own nearest neighbour in the band, not from
      // one figure for the whole band: band 0 pins the centre and spreads the
      // laterals across the halves either side, so a single tight pair
      // anywhere in it would otherwise starve every other label — including
      // the selected node's own name.
      const byX = members.slice().sort((a, b) => a.x - b.x);
      const elided = elideSharedPrefix(members.map((n) => graph.nodes[n.id].name));
      const nameOf = new Map(members.map((n, i) => [n.id, elided[i]]));

      byX.forEach((node, i) => {
        const left = i > 0 ? node.x - byX[i - 1].x : Infinity;
        const right = i < byX.length - 1 ? byX[i + 1].x - node.x : Infinity;
        const nearest = Math.min(left, right);
        const budget = labelBudget(Number.isFinite(nearest) ? nearest : usable);
        result.set(node.id, fitLabel(nameOf.get(node.id) ?? '', budget));
        // "CWE-1085" is eight characters; below that the ids of neighbouring
        // nodes run into each other, and the bare number still identifies it.
        compact.set(node.id, budget < 8);
      });
    }
    return { names: result, compact };
  }, [layout, graph, size.width]);

  // React fires no mouseleave or blur when the hovered node is unmounted by a
  // re-centre, so a stale id would survive and dim every node in the new
  // graph with nothing lit. Derive it rather than clear it in an effect.
  const active = hovered && layout?.nodes.some((n) => n.id === hovered) ? hovered : null;

  const incident = useMemo(() => {
    if (!layout || !active) return null;
    const edges = layout.edges.filter((e) => e.from === active || e.to === active);
    const nodes = new Set<string>([active]);
    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }
    return { nodes, edges: new Set(edges.map((e) => `${e.from}-${e.to}-${e.type}`)) };
  }, [layout, active]);

  function focusNode(id: string) {
    // CWE ids are numeric strings, so they need no selector escaping.
    const target = stageRef.current?.querySelector<SVGGElement>(`[data-node-id="${id}"]`);
    target?.focus();
  }

  /**
   * Arrow keys follow the layout's own axes rather than DOM order: up and
   * down move through the hierarchy, left and right along the current band.
   */
  function onNodeKeyDown(event: React.KeyboardEvent<SVGGElement>, id: string) {
    if (!layout) return;
    const current = layout.nodes.find((n) => n.id === id);
    if (!current) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
      return;
    }

    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (vertical !== 0) {
      event.preventDefault();
      const candidates = layout.nodes
        .filter((n) => (vertical < 0 ? n.y < current.y : n.y > current.y))
        .sort(
          (a, b) =>
            Math.abs(a.y - current.y) - Math.abs(b.y - current.y) ||
            Math.abs(a.x - current.x) - Math.abs(b.x - current.x)
        );
      if (candidates[0]) focusNode(candidates[0].id);
      return;
    }

    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (horizontal !== 0) {
      event.preventDefault();
      const sameBand = layout.nodes
        .filter((n) => n.band === current.band && (horizontal < 0 ? n.x < current.x : n.x > current.x))
        .sort((a, b) => Math.abs(a.x - current.x) - Math.abs(b.x - current.x));
      if (sameBand[0]) focusNode(sameBand[0].id);
    }
  }

  return (
    <div className="graph-stage" ref={stageRef}>
      <p className="visually-hidden" role="status" aria-live="polite">
        {selectedId && graph.nodes[selectedId] ? `Centred on ${describeNode(graph, selectedId)}` : ''}
      </p>
      {!layout || layout.nodes.length === 0 ? (
        <p className="graph-stage__empty">Select a CWE to see its neighbourhood.</p>
      ) : (
        <>
          {layout.nodes.length === 1 && <p className="graph-stage__note">No related weaknesses.</p>}
          <svg
            className="graph-stage__canvas"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="xMidYMid meet"
            role="group"
            aria-label="Weakness neighbourhood"
          >
            <defs>
              <marker id="graph-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--rel-sequence)" />
              </marker>
            </defs>
            {layout.edges.map((edge) => {
              const key = `${edge.from}-${edge.to}-${edge.type}`;
              const lit = !incident || incident.edges.has(key);
              return <GraphEdge key={key} edge={edge} dimmed={!lit} label={incident && lit ? edge.type : null} />;
            })}
            {layout.nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                cweNode={graph.nodes[node.id]}
                label={describeNode(graph, node.id)}
                displayName={displayNames.names.get(node.id) ?? ''}
                compactId={displayNames.compact.get(node.id) ?? false}
                selected={node.id === ego?.centerId}
                dimmed={!!incident && !incident.nodes.has(node.id)}
                onSelect={onSelect}
                onKeyDown={onNodeKeyDown}
                onHover={setHovered}
              />
            ))}
            {layout.lateralOverflow.map((marker) => (
              <text
                key={marker.side}
                className="graph-lateral-overflow"
                x={marker.x}
                y={marker.y + 4}
                textAnchor="middle"
              >
                <title>
                  {`${marker.hiddenCount} more related weaknesses — listed in the detail card`}
                </title>
                +{marker.hiddenCount} more
              </text>
            ))}
            {layout.overflow && (
              <g
                className="graph-overflow"
                transform={`translate(${layout.overflow.x} ${layout.overflow.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Show ${layout.overflow.hiddenCount} more children of CWE-${layout.overflow.parentId}`}
                onClick={() => onShowChildren(layout.overflow!.parentId)}
                onKeyDown={(event) => {
                  // An SVG <g> is not a native button, so Enter and Space do
                  // nothing unless we handle them.
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onShowChildren(layout.overflow!.parentId);
                  }
                }}
              >
                <rect x={-34} y={-12} width={68} height={24} rx={12} />
                <text textAnchor="middle" y={4}>
                  +{layout.overflow.hiddenCount} more
                </text>
              </g>
            )}
          </svg>
          <Legend />
        </>
      )}
    </div>
  );
}
