import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GraphStage } from '../../src/components/GraphStage';
import { buildGraph, type CweData } from '../../src/lib/graph';

const node = (id: string, name: string) => ({
  id, name, abstraction: 'Base', status: 'Draft', description: '', url: '',
});

const data: CweData = {
  meta: { cweVersion: '4.20', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
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
    <GraphStage graph={graph} selectedId={selectedId} onSelect={onSelect} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
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
      screen.getByRole('button', { name: 'CWE-79: Cross-site Scripting. Base, Draft. 1 parent, 1 child.' })
    ).toBeInTheDocument();
  });

  it('re-centres when another node is clicked', async () => {
    const onSelect = renderStage('79');
    await userEvent.click(screen.getByRole('button', { name: /^CWE-74: Injection/ }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('draws one path per edge', () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
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
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} onShowRelations={() => {}} hops={2} />
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
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
    );
    expect(container.querySelectorAll('.graph-edge__label')).toHaveLength(0);
  });

  it('labels the incident edges when a node is hovered', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(container.querySelectorAll('.graph-edge__label').length).toBeGreaterThan(0);
  });

  it('dims the nodes that are not incident to the hovered one', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-74/ }));
    expect(container.querySelector('[data-node-id="80"]')).toHaveClass('graph-node--dimmed');
    expect(container.querySelector('[data-node-id="74"]')).not.toHaveClass('graph-node--dimmed');
  });

  it('clears the highlight when the pointer leaves', async () => {
    const { container } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
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
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} onShowRelations={() => {}} hops={2} />
    );
    const chip = screen.getByRole('button', { name: /Show \d+ more children of CWE-79/ });
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(onShowChildren).toHaveBeenCalledWith('79');
  });

  it('does not dim the whole graph when the hovered node leaves the layout', async () => {
    const { container, rerender } = render(
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
    );
    await userEvent.hover(screen.getByRole('button', { name: /^CWE-80/ }));
    expect(container.querySelectorAll('.graph-node--dimmed').length).toBeGreaterThan(0);

    // Re-centre somewhere CWE-80 is absent. React fires no mouseleave for an
    // unmounted node, so a stale hover would dim every node with nothing lit.
    rerender(
      <GraphStage graph={graph} selectedId="71" onSelect={() => {}} onShowChildren={() => {}} onShowRelations={() => {}} hops={2} />
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
      />
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
