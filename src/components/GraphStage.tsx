import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { buildEgoGraph } from '../lib/ego';
import { EDGE_MARGIN, layoutEgoGraph, type StageSize } from '../lib/layout';
import { elideSharedPrefix, fitLabel, labelBudget } from '../lib/labels';
import { GraphEdge } from './GraphEdge';
import { GraphNode } from './GraphNode';

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
    if (!layout) return result;

    const usable = Math.max(0, size.width - 2 * EDGE_MARGIN);
    for (const band of [-2, -1, 0, 1] as const) {
      const members = layout.nodes.filter((n) => n.band === band);
      if (members.length === 0) continue;

      // Budget from the tightest actual gap in the band rather than from an
      // even share of it. Band 0 pins the centre and splits the laterals
      // between the halves either side, so its nodes are not evenly spaced
      // and an even share would overestimate the room they have.
      const xs = members.map((n) => n.x).sort((a, b) => a - b);
      let gap = usable;
      for (let i = 1; i < xs.length; i += 1) gap = Math.min(gap, xs[i] - xs[i - 1]);

      const budget = labelBudget(gap);
      const elided = elideSharedPrefix(members.map((n) => graph.nodes[n.id].name));
      members.forEach((node, i) => {
        result.set(node.id, fitLabel(elided[i], budget));
      });
    }
    return result;
  }, [layout, graph, size.width]);

  const incident = useMemo(() => {
    if (!layout || !hovered) return null;
    const edges = layout.edges.filter((e) => e.from === hovered || e.to === hovered);
    const nodes = new Set<string>([hovered]);
    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }
    return { nodes, edges: new Set(edges.map((e) => `${e.from}-${e.to}-${e.type}`)) };
  }, [layout, hovered]);

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
                displayName={displayNames.get(node.id) ?? ''}
                selected={node.id === ego?.centerId}
                dimmed={!!incident && !incident.nodes.has(node.id)}
                onSelect={onSelect}
                onKeyDown={onNodeKeyDown}
                onHover={setHovered}
              />
            ))}
            {layout.overflow && (
              <g
                className="graph-overflow"
                transform={`translate(${layout.overflow.x} ${layout.overflow.y})`}
                role="button"
                tabIndex={0}
                aria-label={`Show ${layout.overflow.hiddenCount} more children of CWE-${layout.overflow.parentId}`}
                onClick={() => onShowChildren(layout.overflow!.parentId)}
              >
                <rect x={-34} y={-12} width={68} height={24} rx={12} />
                <text textAnchor="middle" y={4}>
                  +{layout.overflow.hiddenCount} more
                </text>
              </g>
            )}
          </svg>
        </>
      )}
    </div>
  );
}
