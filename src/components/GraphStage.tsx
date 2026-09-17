import { useEffect, useMemo, useRef, useState } from 'react';
import type { Graph } from '../lib/graph';
import { buildEgoGraph } from '../lib/ego';
import { layoutEgoGraph, type StageSize } from '../lib/layout';
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
  const size = useStageSize(stageRef);

  const ego = useMemo(
    () => (selectedId ? buildEgoGraph(graph, selectedId, { ancestorHops: hops }) : null),
    [graph, selectedId, hops]
  );
  const layout = useMemo(() => (ego ? layoutEgoGraph(ego, size) : null), [ego, size]);

  return (
    <div className="graph-stage" ref={stageRef}>
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
            {layout.edges.map((edge) => (
              <GraphEdge key={`${edge.from}-${edge.to}-${edge.type}`} edge={edge} />
            ))}
            {layout.nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                cweNode={graph.nodes[node.id]}
                label={describeNode(graph, node.id)}
                selected={node.id === ego?.centerId}
                onSelect={onSelect}
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
