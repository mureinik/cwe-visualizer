import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphStage } from '../../src/components/GraphStage';
import { buildGraph, type CweData } from '../../src/lib/graph';

const node = (id: string, name: string) => ({
  id, name, abstraction: 'Base', status: 'Draft', description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': node('74', 'Injection'),
    '79': node('79', 'Cross-site Scripting'),
    '80': node('80', 'HTML Tag Neutralization'),
    '71': node('71', 'DEPRECATED: DS_Store'),
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '80', to: '79', type: 'ChildOf' },
  ],
};

const graph = buildGraph(data);

function renderStage(selectedId: string | null, onSelect = vi.fn()) {
  render(
    <GraphStage graph={graph} selectedId={selectedId} onSelect={onSelect} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
  );
  return onSelect;
}

describe('GraphStage', () => {
  it('prompts when nothing is selected', () => {
    renderStage(null);
    expect(screen.getByText('Select a CWE to see its neighbourhood.')).toBeInTheDocument();
  });

  it('renders the centre and its neighbours as labelled nodes', () => {
    renderStage('79');
    expect(screen.getByRole('button', { name: /^CWE-79: Cross-site Scripting/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CWE-74: Injection/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^CWE-80: HTML Tag Neutralization/ })).toBeInTheDocument();
  });

  it('describes a node so the label stands alone without the picture', () => {
    renderStage('79');
    expect(
      screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting. Base, Draft. 1 parent, 1 child.' }),
    ).toBeInTheDocument();
  });

  it('re-centres when another node is clicked', async () => {
    const onSelect = renderStage('79');
    await userEvent.click(screen.getByRole('button', { name: /^CWE-74: Injection/ }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('draws one path per edge', () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    expect(container.querySelectorAll('path.graph-edge')).toHaveLength(2);
  });

  it('says so when the selected entry has no relations at all', () => {
    renderStage('71');
    expect(screen.getByText('No related weaknesses.')).toBeInTheDocument();
  });

  it('offers the hidden children when the cap engages', async () => {
    const wide: CweData = {
      ...data,
      nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`${300 + i}`, node(`${300 + i}`, `Child ${i}`)])) },
      edges: [...data.edges, ...Array.from({ length: 14 }, (_, i) => ({ from: `${300 + i}`, to: '79', type: 'ChildOf' }))],
    };
    const onShowChildren = vi.fn();
    render(
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Show 5 more children of CWE-79' }));
    expect(onShowChildren).toHaveBeenCalledWith('79');
  });
});

describe('GraphStage keyboard model', () => {
  it('moves focus up the hierarchy with ArrowUp', async () => {
    renderStage('79');
    const centre = screen.getByRole('button', { name: /^CWE-79/ });
    centre.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('button', { name: /^CWE-74/ })).toHaveFocus();
  });

  it('moves focus down the hierarchy with ArrowDown', async () => {
    renderStage('79');
    screen.getByRole('button', { name: /^CWE-79/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^CWE-80/ })).toHaveFocus();
  });

  it('moves focus along a band with ArrowLeft and ArrowRight, stopping at its ends', async () => {
    // Two children, so the children band has somewhere to move to.
    const siblings = buildGraph({
      ...data,
      nodes: { ...data.nodes, '81': node('81', 'Script in Attributes') },
      edges: [...data.edges, { from: '81', to: '79', type: 'ChildOf' }],
    });
    render(
      <GraphStage graph={siblings} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    const first = screen.getByRole('button', { name: /^CWE-80/ });
    const second = screen.getByRole('button', { name: /^CWE-81/ });
    first.focus();

    await userEvent.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(first).toHaveFocus();
  });

  // Three children, so a move along or down onto their band has to pick
  // the nearest of several.
  const threeChildren = buildGraph({
    ...data,
    nodes: { ...data.nodes, '81': node('81', 'Script in Attributes'), '82': node('82', 'Script in IMG Tags') },
    edges: [...data.edges, { from: '81', to: '79', type: 'ChildOf' }, { from: '82', to: '79', type: 'ChildOf' }],
  });

  function renderThreeChildren() {
    render(
      <GraphStage graph={threeChildren} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
  }

  it('moves along a band to the nearest node, not the farthest', async () => {
    renderThreeChildren();
    screen.getByRole('button', { name: /^CWE-82/ }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('button', { name: /^CWE-81/ })).toHaveFocus();
  });

  it('moves down to the node most directly below', async () => {
    renderThreeChildren();
    screen.getByRole('button', { name: /^CWE-79/ }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('button', { name: /^CWE-81/ })).toHaveFocus();
  });

  it('keeps focus where it is at the top of the hierarchy', async () => {
    renderStage('79');
    const top = screen.getByRole('button', { name: /^CWE-74/ });
    top.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(top).toHaveFocus();
  });

  it('re-centres on Enter', async () => {
    const onSelect = renderStage('79');
    screen.getByRole('button', { name: /^CWE-79/ }).focus();
    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('announces the new centre politely', () => {
    renderStage('79');
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Centred on CWE-79: Cross-site Scripting. Base, Draft. 1 parent, 1 child.');
  });
});

describe('GraphStage highlighting', () => {
  it('shows no edge labels at rest', () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    expect(container.querySelectorAll('.graph-edge__label')).toHaveLength(0);
  });

  it('labels the incident edges when a node is hovered', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(container.querySelectorAll('.graph-edge__label').length).toBeGreaterThan(0);
  });

  it('labels no edges when the centre itself is hovered', async () => {
    // Every edge on the stage meets the centre, so labelling them all piles
    // one label per edge on top of each other around it. On a phone this is
    // the resting state: the node just tapped keeps focus as it re-centres.
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-79/ }));
    expect(container.querySelectorAll('.graph-edge__label')).toHaveLength(0);
  });

  it('dims the nodes that are not incident to the hovered one', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(container.querySelector('[data-node-id="80"]')).toHaveClass('graph-node--dimmed');
    expect(container.querySelector('[data-node-id="74"]')).not.toHaveClass('graph-node--dimmed');
  });

  it('clears the highlight when the pointer leaves', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    const target = screen.getByRole('button', { name: /^CWE-74/ });
    await userEvent.hover(target);
    await userEvent.unhover(target);
    expect(container.querySelectorAll('.graph-node--dimmed')).toHaveLength(0);
  });
});

describe('GraphStage overflow chip and stale hover', () => {
  const wide: CweData = {
    ...data,
    nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`${300 + i}`, node(`${300 + i}`, `Child ${i}`)])) },
    edges: [...data.edges, ...Array.from({ length: 14 }, (_, i) => ({ from: `${300 + i}`, to: '79', type: 'ChildOf' }))],
  };

  it('activates the overflow chip from the keyboard', async () => {
    const onShowChildren = vi.fn();
    render(
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} onShowRelations={() => {}} hops={2} />,
    );
    const chip = screen.getByRole('button', { name: /Show \d+ more children of CWE-79/ });
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(onShowChildren).toHaveBeenCalledWith('79');
  });

  it('does not dim the whole graph when the hovered node leaves the layout', async () => {
    const { container, rerender } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-80/ }));
    expect(container.querySelectorAll('.graph-node--dimmed').length).toBeGreaterThan(0);

    // Re-centre somewhere CWE-80 is absent. React fires no mouseleave for an
    // unmounted node, so a stale hover would dim every node with nothing lit.
    rerender(
      <GraphStage graph={graph} selectedId="71" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    expect(container.querySelectorAll('.graph-node--dimmed')).toHaveLength(0);
  });
});

describe('GraphStage lateral overflow marker', () => {
  // CWE-119's shape: more laterals on one side than the cap allows.
  const crowded: CweData = {
    ...data,
    nodes: { ...data.nodes, ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${500 + i}`, node(`${500 + i}`, `Lateral ${i}`)])) },
    edges: [...data.edges, ...Array.from({ length: 9 }, (_, i) => ({ from: '79', to: `${500 + i}`, type: 'CanFollow' }))],
  };

  function renderCrowded(onShowRelations = vi.fn()) {
    render(
      <GraphStage
        graph={buildGraph(crowded)}
        selectedId="79"
        onSelect={() => {}}
        onShowChildren={() => {}}
        onShowRelations={onShowRelations}
        hops={2}
      />,
    );
    return onShowRelations;
  }

  it('offers the capped relations as a control, not a dead label', () => {
    renderCrowded();
    expect(screen.getByRole('button', { name: /Show \d+ more related weaknesses/ })).toBeInTheDocument();
  });

  it('acts when clicked', async () => {
    const onShowRelations = renderCrowded();
    await userEvent.click(screen.getByRole('button', { name: /Show \d+ more related weaknesses/ }));
    expect(onShowRelations).toHaveBeenCalled();
  });

  it('hands over the relations it stands for, so the detail card can point them out', async () => {
    const onShowRelations = renderCrowded();
    await userEvent.click(screen.getByRole('button', { name: /Show \d+ more related weaknesses/ }));
    expect(onShowRelations).toHaveBeenCalledExactlyOnceWith(
      ['504', '505', '506', '507', '508'].map((id) => ({ id, type: 'CanFollow' })),
    );
  });

  it('acts on Enter, since an SVG group is not a native button', async () => {
    const onShowRelations = renderCrowded();
    screen.getByRole('button', { name: /Show \d+ more related weaknesses/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onShowRelations).toHaveBeenCalled();
  });

  it('shows no marker when every relation fits', () => {
    renderStage('79');
    expect(screen.queryByRole('button', { name: /more related weaknesses/ })).not.toBeInTheDocument();
  });
});

describe('GraphStage sizing', () => {
  /** A ResizeObserver that reports whatever size the test tells it to. */
  function stubResizeObserver() {
    const observers: { callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect = vi.fn();
        constructor(callback: ResizeObserverCallback) {
          observers.push({ callback, disconnect: this.disconnect });
        }

        observe() {}
      },
    );
    return {
      observers,
      resize(width: number, height: number) {
        act(() => {
          for (const { callback } of observers) {
            callback([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
          }
        });
      },
    };
  }

  function canvas(container: HTMLElement) {
    return container.querySelector('svg.graph-stage__canvas');
  }

  it('fits the layout to the stage\'s measured size', () => {
    const stage = stubResizeObserver();
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    stage.resize(640, 360);
    expect(canvas(container)).toHaveAttribute('viewBox', '0 0 640 360');
  });

  it('shows fewer laterals a side on a phone, and offers the rest', () => {
    // CWE-119 in CWE 5.0 has eleven, all to its left.
    const crowded = buildGraph({
      meta: data.meta,
      nodes: Object.fromEntries(['119', '120', '121', '122', '123'].map((id) => [id, node(id, `Name ${id}`)])),
      edges: ['120', '121', '122', '123'].map((from) => ({ from, to: '119', type: 'CanPrecede' })),
    });
    const stage = stubResizeObserver();
    render(
      <GraphStage graph={crowded} selectedId="119" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    stage.resize(1000, 600);
    expect(screen.queryByRole('button', { name: /more related weaknesses/ })).not.toBeInTheDocument();
    stage.resize(390, 330);
    expect(screen.getByRole('button', { name: 'Show 2 more related weaknesses' })).toBeInTheDocument();
  });

  it('ignores a size of zero, as a hidden stage reports', () => {
    const stage = stubResizeObserver();
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    stage.resize(640, 360);
    stage.resize(0, 0);
    expect(canvas(container)).toHaveAttribute('viewBox', '0 0 640 360');
  });

  it('stops observing once unmounted', () => {
    const stage = stubResizeObserver();
    const { unmount } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    expect(stage.observers).toHaveLength(1);
    unmount();
    expect(stage.observers[0].disconnect).toHaveBeenCalledOnce();
  });
});

describe('GraphStage edges between the same pair', () => {
  // CWE 5.0: 126 ChildOf 788, and 788 Overlaps 126.
  const pair = buildGraph({
    meta: data.meta,
    nodes: { '126': node('126', 'Buffer Over-read'), '788': node('788', 'Access of Memory Location After End of Buffer') },
    edges: [
      { from: '126', to: '788', type: 'ChildOf' },
      { from: '788', to: '126', type: 'Overlaps' },
    ],
  });

  it('labels both when the other end is hovered, on opposite sides', async () => {
    const { container } = render(
      <GraphStage graph={pair} selectedId="788" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-126/ }));
    const labels = Array.from(container.querySelectorAll('.graph-edge__label'), (l) => [l.textContent, l.getAttribute('text-anchor')]);
    expect(labels.map(([text]) => text).sort()).toEqual(['ChildOf', 'Overlaps']);
    expect(labels.map(([, anchor]) => anchor).sort()).toEqual(['end', 'start']);
  });
});

// The schema allows two relations in one group between the same pair, though
// no release up to 5.0 has one.
describe('GraphStage with two relations in one group', () => {
  const twice = buildGraph({
    meta: data.meta,
    nodes: { '787': node('787', 'Out-of-bounds Write'), '788': node('788', 'Access of Memory Location After End of Buffer') },
    edges: [
      { from: '788', to: '787', type: 'PeerOf' },
      { from: '788', to: '787', type: 'Overlaps' },
    ],
  });

  it('draws one edge, labelled and titled with both', async () => {
    const { container } = render(
      <GraphStage graph={twice} selectedId="788" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    );
    expect(container.querySelectorAll('.graph-edge')).toHaveLength(1);
    expect(container.querySelector('.graph-edge title')).toHaveTextContent('Overlaps, PeerOf');
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-787/ }));
    expect(container.querySelector('.graph-edge__label')).toHaveTextContent('Overlaps, PeerOf');
  });
});

describe('GraphStage arrows', () => {
  // CWE 5.0: 113 CanPrecede 79.
  const sequence = buildGraph({
    meta: data.meta,
    nodes: { '79': node('79', 'Cross-site Scripting'), '113': node('113', 'CRLF Injection') },
    edges: [{ from: '113', to: '79', type: 'CanPrecede' }],
  });
  const stage = (selectedId: string) =>
    render(
      <GraphStage graph={sequence} selectedId={selectedId} onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    ).container;

  /** How far short of the end of its edge the arrow's tip stops. */
  function tipInset(container: HTMLElement) {
    const id = container.querySelector('.graph-edge')?.getAttribute('marker-end')?.match(/#([^)]+)/)?.[1];
    const marker = container.querySelector(`marker[id="${id}"]`);
    const [, , width] = marker!.getAttribute('viewBox')!.split(' ').map(Number);
    return Number(marker!.getAttribute('refX')) - width;
  }

  it('stops an arrow into the selected node outside its halo', () => {
    // The selected glyph's radius is 13, and its halo 7 beyond that.
    expect(tipInset(stage('79'))).toBeGreaterThan(20);
  });

  it('stops an arrow into a neighbour outside its glyph', () => {
    // A neighbour's radius is 9, and a ringed glyph's stroke adds 1.4.
    const inset = tipInset(stage('113'));
    expect(inset).toBeGreaterThan(10.4);
    expect(inset).toBeLessThan(20);
  });
});

describe('GraphStage relation labels', () => {
  // CWE 5.0: 79 ChildOf 74, 113 CanPrecede 79 and 79 CanPrecede 494.
  const related = buildGraph({
    meta: data.meta,
    nodes: {
      '74': node('74', 'Injection'),
      '79': node('79', 'Cross-site Scripting'),
      '113': node('113', 'CRLF Injection'),
      '494': node('494', 'Download of Code Without Integrity Check'),
    },
    edges: [
      { from: '79', to: '74', type: 'ChildOf' },
      { from: '113', to: '79', type: 'CanPrecede' },
      { from: '79', to: '494', type: 'CanPrecede' },
    ],
  });
  const stage = () =>
    render(
      <GraphStage graph={related} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />,
    ).container;
  const labels = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('.graph-edge__label'), (l) => l.textContent).sort();

  it('names every relation at rest, and no parent or child edge', () => {
    expect(labels(stage())).toEqual(['CanFollow', 'CanPrecede']);
  });

  it('keeps them, without labelling the hierarchy, when the centre is hovered', async () => {
    // A phone rests here: the node just tapped keeps focus as it re-centres.
    const container = stage();
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-79/ }));
    expect(labels(container)).toEqual(['CanFollow', 'CanPrecede']);
  });

  it('draws every label over every edge, so no line cuts through one', () => {
    const container = stage();
    const lastEdge = Array.from(container.querySelectorAll('.graph-edge')).at(-1)!;
    const firstLabel = container.querySelector('.graph-edge__label')!;
    expect(lastEdge.compareDocumentPosition(firstLabel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('dims a label with its edge', async () => {
    const container = stage();
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    const dimmed = Array.from(container.querySelectorAll('.graph-edge-group--dimmed .graph-edge__label'));
    expect(dimmed.map((l) => l.textContent).sort()).toEqual(['CanFollow', 'CanPrecede']);
  });

  it('adds the hierarchy edge when its other end is hovered', async () => {
    const container = stage();
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(labels(container)).toEqual(['CanFollow', 'CanPrecede', 'ChildOf']);
  });
});
