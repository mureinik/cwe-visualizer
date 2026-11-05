import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { buildEgoGraph, edgeKey, type AncestorHops, type LateralRelation } from '../lib/ego';
import { childCapFor, edgeMargin, lateralCapFor, layoutEgoGraph, type PositionedNode, type StageSize } from '../lib/layout';
import { elideSharedPrefix, fitLabel, labelBudget } from '../lib/labels';
import { arrowMarkerId, EDGE_GROUPS } from '../lib/relations';
import { HALO_GAP, NODE_RADIUS, SELECTED_NODE_RADIUS } from '../lib/shapes';
import { GraphEdge, GraphEdgeLabel } from './GraphEdge';
import { GraphNode } from './GraphNode';
import { Legend } from './Legend';
import { OverflowChip } from './OverflowChip';

const DEFAULT_STAGE: StageSize = { width: 960, height: 600 };

/** Children drawn before the rest collapse into the overflow chip, where the stage has room. */
const CHILD_CAP = 10;

/** Laterals drawn on each side before the rest collapse into a marker, where the stage has room. */
const LATERAL_CAP = 4;

const ARROW_SIZE = 9;
/** How far an arrow's tip stops outside whatever it points at. */
const ARROW_CLEARANCE = 3;
/**
 * An edge runs to its node's centre, so each arrow stops short of that by
 * enough for the glyph not to cover it.
 */
const ARROW_STOPS = [
  { scope: 'graph', inset: NODE_RADIUS + ARROW_CLEARANCE },
  { scope: 'graph-center', inset: SELECTED_NODE_RADIUS + HALO_GAP + ARROW_CLEARANCE },
] as const;

interface GraphStageProps {
  graph: Graph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onShowChildren: (parentId: string) => void;
  /** Invoked by a lateral "+N more" marker with the relations it stands
   *  for, which the detail card already lists in full. */
  onShowRelations: (hidden: LateralRelation[]) => void;
  hops: AncestorHops;
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
    if (!element || typeof ResizeObserver !== 'function') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
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

export function GraphStage({
  graph,
  selectedId,
  onSelect,
  onShowChildren,
  onShowRelations,
  hops,
}: GraphStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const size = useStageSize(stageRef);

  // A phone has room for far fewer children than a desktop, and ten packed
  // into it overlap; the chip still offers the rest.
  const childCap = childCapFor(size.width, CHILD_CAP);
  const lateralCap = lateralCapFor(size.width, LATERAL_CAP);
  const ego = useMemo(
    () => (selectedId ? buildEgoGraph(graph, selectedId, { ancestorHops: hops, childCap, lateralCap }) : null),
    [graph, selectedId, hops, childCap, lateralCap],
  );
  const layout = useMemo(() => (ego ? layoutEgoGraph(ego, size) : null), [ego, size]);
  // A local const, so the chip's click handler keeps the narrowing to non-null.
  const childOverflow = layout?.overflow;

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
    if (!layout) {
      return { names: result, compact };
    }

    const usable = Math.max(0, size.width - 2 * edgeMargin(size.width));
    for (const band of [-2, -1, 0, 1] as const) {
      const members = layout.nodes.filter((n) => n.band === band);
      if (members.length === 0) {
        continue;
      }

      // Elide in band order, before sorting: dominantPrefix breaks ties by
      // the order it sees the names in.
      const elided = elideSharedPrefix(members.map((n) => graph.nodes[n.id].name));

      // Budget each node from its own nearest neighbour in the band, not from
      // one figure for the whole band: band 0 pins the centre and spreads the
      // laterals across the halves either side, so a single tight pair
      // anywhere in it would otherwise starve every other label — including
      // the selected node's own name.
      const byX = members.map((n, i) => ({ ...n, name: elided[i] })).sort((a, b) => a.x - b.x);

      byX.forEach((node, i) => {
        const left = i > 0 ? node.x - byX[i - 1].x : Infinity;
        const right = i < byX.length - 1 ? byX[i + 1].x - node.x : Infinity;
        const nearest = Math.min(left, right);
        const budget = labelBudget(Number.isFinite(nearest) ? nearest : usable);
        result.set(node.id, fitLabel(node.name, budget));
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
    if (!layout || !active) {
      return null;
    }
    const edges = layout.edges.filter((e) => e.from === active || e.to === active);
    const nodes = new Set<string>([active]);
    for (const edge of edges) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }
    return { nodes, edges: new Set(edges.map(edgeKey)) };
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
  function onNodeKeyDown(event: React.KeyboardEvent<SVGGElement>, current: PositionedNode, nodes: PositionedNode[]) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(current.id);
      return;
    }

    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (vertical !== 0) {
      event.preventDefault();
      const candidates = nodes
        .filter((n) => (vertical < 0 ? n.y < current.y : n.y > current.y))
        .sort(
          (a, b) =>
            Math.abs(a.y - current.y) - Math.abs(b.y - current.y) ||
            Math.abs(a.x - current.x) - Math.abs(b.x - current.x),
        );
      if (candidates[0]) {
        focusNode(candidates[0].id);
      }
      return;
    }

    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (horizontal !== 0) {
      event.preventDefault();
      const sameBand = nodes
        .filter((n) => n.band === current.band && (horizontal < 0 ? n.x < current.x : n.x > current.x))
        .sort((a, b) => Math.abs(a.x - current.x) - Math.abs(b.x - current.x));
      if (sameBand[0]) {
        focusNode(sameBand[0].id);
      }
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
              {Object.values(EDGE_GROUPS)
                .filter(({ line }) => line.arrow)
                .flatMap(({ key, line }) =>
                  ARROW_STOPS.map(({ scope, inset }) => (
                    <marker
                      key={`${scope}-${key}`}
                      id={arrowMarkerId(scope, key)}
                      viewBox={`0 0 ${ARROW_SIZE} ${ARROW_SIZE}`}
                      refX={ARROW_SIZE + inset}
                      refY={ARROW_SIZE / 2}
                      markerUnits="userSpaceOnUse"
                      markerWidth={ARROW_SIZE}
                      markerHeight={ARROW_SIZE}
                      orient="auto"
                    >
                      <path d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} z`} fill={`var(${line.token})`} />
                    </marker>
                  )),
                )}
            </defs>
            {layout.edges.map((edge) => {
              const key = edgeKey(edge);
              const dimmed = incident !== null && !incident.edges.has(key);
              return <GraphEdge key={key} edge={edge} dimmed={dimmed} intoCenter={edge.to === ego?.centerId} />;
            })}
            {layout.edges.map((edge) => {
              const key = edgeKey(edge);
              return <GraphEdgeLabel key={key} edge={edge} dimmed={incident !== null && !incident.edges.has(key)} />;
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
                onKeyDown={(event) => onNodeKeyDown(event, node, layout.nodes)}
                onHover={setHovered}
              />
            ))}
            {layout.lateralOverflow.map((marker) => (
              <OverflowChip
                key={marker.side}
                x={marker.x}
                y={marker.y}
                count={marker.hiddenCount}
                label={`Show ${marker.hiddenCount} more related weaknesses`}
                onActivate={() => onShowRelations(marker.hidden)}
              />
            ))}
            {childOverflow && (
              <OverflowChip
                x={childOverflow.x}
                y={childOverflow.y}
                count={childOverflow.hiddenCount}
                label={`Show ${childOverflow.hiddenCount} more children of CWE-${childOverflow.parentId}`}
                onActivate={() => onShowChildren(childOverflow.parentId)}
              />
            )}
          </svg>
          <Legend />
        </>
      )}
    </div>
  );
}
