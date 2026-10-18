import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Legend } from '../../src/components/Legend';
import { GraphEdge } from '../../src/components/GraphEdge';
import { EDGE_GROUPS, type EdgeGroup } from '../../src/lib/relations';

/** The attributes that make a line look the way it does. */
function lineLook(line: Element) {
  return {
    stroke: line.getAttribute('stroke'),
    width: line.getAttribute('stroke-width'),
    dash: line.getAttribute('stroke-dasharray'),
    arrow: line.hasAttribute('marker-end'),
  };
}

describe('Legend', () => {
  it('is exposed as a labelled landmark', () => {
    render(<Legend />);
    expect(screen.getByRole('complementary', { name: 'Legend' })).toBeInTheDocument();
  });

  it('explains what each kind of line means', () => {
    render(<Legend />);
    for (const label of ['Parent / child', 'Sequence', 'Peers', 'Requires']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('draws each kind of line the way the graph does', () => {
    const { container } = render(<Legend />);
    const swatches = container.querySelectorAll('.legend__swatch line');
    const groups = Object.keys(EDGE_GROUPS) as EdgeGroup[];
    expect(swatches).toHaveLength(groups.length);

    groups.forEach((group, i) => {
      const edge = { from: '1', to: '2', type: 'X', group, path: 'M 0 0 L 10 10' };
      const { container: graph } = render(
        <svg><GraphEdge edge={edge} dimmed={false} label={null} /></svg>,
      );
      expect(lineLook(swatches[i]), group).toEqual(lineLook(graph.querySelector('path.graph-edge')!));
    });
  });

  it('explains every abstraction shape', () => {
    render(<Legend />);
    for (const label of ['Pillar', 'Class', 'Base', 'Variant', 'Compound']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
