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
    <GraphStage graph={graph} selectedId={selectedId} onSelect={onSelect} onShowChildren={() => {}} hops={2} />
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
      <GraphStage graph={graph} selectedId="79" onSelect={() => {}} onShowChildren={() => {}} hops={2} />
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
      <GraphStage graph={buildGraph(wide)} selectedId="79" onSelect={() => {}} onShowChildren={onShowChildren} hops={2} />
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
