import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../../src/components/DetailPanel';
import { buildGraph, type CweData, type CweEdge } from '../../src/lib/graph';

const data: CweData = {
  meta: { cweVersion: '4.20', catalogDate: '2025-12-01', lastModified: '"v1"', generatedAt: '2026-01-01T00:00:00.000Z' },
  nodes: {
    '74': { id: '74', name: 'Injection', abstraction: 'Class', status: 'Incomplete', description: 'Base description', url: 'https://cwe.mitre.org/data/definitions/74.html' },
    '79': { id: '79', name: 'Cross-site Scripting', abstraction: 'Base', status: 'Stable', description: 'XSS description', url: 'https://cwe.mitre.org/data/definitions/79.html', technicalNuance: [{ kind: 'paragraph', lines: [[{ text: 'Nuance for 79' }]] }] },
    '80': { id: '80', name: 'HTML Tag Neutralization', abstraction: 'Base', status: 'Stable', description: '', url: '' },
    '20': { id: '20', name: 'Improper Input Validation', abstraction: 'Class', status: 'Stable', description: '', url: '', technicalNuance: [{ kind: 'paragraph', lines: [[{ text: 'Nuance for 20' }]] }] },
    '71': { id: '71', name: 'DEPRECATED: DS_Store', abstraction: 'Variant', status: 'Deprecated', description: '', url: '' },
    // No entry in today's data is Obsolete or Usable, but the schema allows both.
    '72': { id: '72', name: 'Superseded entry', abstraction: 'Variant', status: 'Obsolete', description: '', url: '' },
    '73': { id: '73', name: 'Usable entry', abstraction: 'Base', status: 'Usable', description: '', url: '' },
  },
  edges: [
    { from: '79', to: '74', type: 'ChildOf' },
    { from: '80', to: '79', type: 'ChildOf' },
    { from: '79', to: '20', type: 'CanFollow' },
    { from: '79', to: '80', type: 'PeerOf' },
  ],
};

const graph = buildGraph(data);

describe('DetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<DetailPanel graph={graph} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText('Select a CWE to see its details.')).toBeInTheDocument();
  });

  it('shows a not-found message for an unknown id', () => {
    render(<DetailPanel graph={graph} selectedId="99999" onSelect={() => {}} />);
    expect(screen.getByText('CWE-99999 was not found.')).toBeInTheDocument();
  });

  it("renders the selected node's identity, badges and description", () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    expect(screen.getByText('XSS description')).toBeInTheDocument();
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Stable')).toBeInTheDocument();
  });

  it('links out to the authoritative MITRE page', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('link', { name: 'View on cwe.mitre.org' })).toHaveAttribute(
      'href',
      'https://cwe.mitre.org/data/definitions/79.html',
    );
  });

  it('shows Technical nuance between the description and the MITRE link', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    const nuance = screen.getByText('Technical nuance').closest('details') as HTMLElement;
    const description = screen.getByText('XSS description');
    const link = screen.getByRole('link', { name: 'View on cwe.mitre.org' });
    expect(description.compareDocumentPosition(nuance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nuance.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no Technical nuance for a CWE without one', () => {
    render(<DetailPanel graph={graph} selectedId="74" onSelect={() => {}} />);
    expect(screen.queryByText('Technical nuance')).toBeNull();
  });

  it("starts the next CWE's nuance closed", async () => {
    const { rerender } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('Technical nuance'));
    expect(screen.getByText('Technical nuance').closest('details')).toHaveAttribute('open');
    rerender(<DetailPanel graph={graph} selectedId="20" onSelect={() => {}} />);
    expect(screen.getByText('Technical nuance').closest('details')).not.toHaveAttribute('open');
  });

  it('groups relations into labelled sections with counts', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.getByText('Children (1)')).toBeInTheDocument();
    expect(screen.getByText('Peers (1)')).toBeInTheDocument();
    expect(screen.getByText('Sequence (1)')).toBeInTheDocument();
  });

  it('omits a section a node has no relations for', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.queryByText(/^Requires/)).not.toBeInTheDocument();
  });

  it('jumps the selection when a relation chip is clicked', async () => {
    const onSelect = vi.fn();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: 'CWE-74: Injection' }));
    expect(onSelect).toHaveBeenCalledWith('74');
  });

  it('warns when the selected entry is deprecated', () => {
    render(<DetailPanel graph={graph} selectedId="71" onSelect={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('MITRE has deprecated this entry.');
  });

  it('warns when the selected entry is obsolete', () => {
    render(<DetailPanel graph={graph} selectedId="72" onSelect={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('MITRE has marked this entry obsolete.');
  });

  it('shows a usable entry like a stable one, with its status and no warning', () => {
    render(<DetailPanel graph={graph} selectedId="73" onSelect={() => {}} />);
    expect(screen.getByText('Usable')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

// CWE-119 on CWE 4.21, where the data lists its parents 118, 20 and its
// sequence relations 1257, 1260, 128, ... 20, 839, 843 (issue #273).
describe('DetailPanel relation order', () => {
  const n = (id: string) => ({ id, name: `Entry ${id}`, abstraction: 'Base', status: 'Draft', description: '', url: '' });
  const ordered: CweData = {
    meta: data.meta,
    nodes: Object.fromEntries(['119', '118', '20', '1257', '128', '839', '1260'].map((id) => [id, n(id)])),
    edges: [
      { from: '119', to: '118', type: 'ChildOf' },
      { from: '119', to: '20', type: 'ChildOf' },
      ...['1257', '1260', '128', '20', '839'].map((from) => ({ from, to: '119', type: 'CanPrecede' })),
      // Related twice in one section, under two types.
      { from: '119', to: '128', type: 'CanPrecede' },
    ],
  };

  const idsIn = (heading: RegExp) => {
    const section = screen.getByRole('heading', { name: heading }).closest('section')!;
    return Array.from(section.querySelectorAll('.relation-chip'), (chip) => chip.getAttribute('aria-label'));
  };

  it('lists each section by CWE number, not as text', () => {
    render(<DetailPanel graph={buildGraph(ordered)} selectedId="119" onSelect={() => {}} />);
    expect(idsIn(/^Parents/)).toEqual(['CWE-20: Entry 20', 'CWE-118: Entry 118']);
    expect(idsIn(/^Sequence/)).toEqual([
      'CanFollow CWE-20: Entry 20',
      'CanFollow, CanPrecede CWE-128: Entry 128',
      'CanFollow CWE-839: Entry 839',
      'CanFollow CWE-1257: Entry 1257',
      'CanFollow CWE-1260: Entry 1260',
    ]);
  });
});

describe('DetailPanel as a bottom sheet', () => {
  it('starts collapsed, with a control that says it will expand', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    const grabber = screen.getByRole('button', { name: 'Expand details' });
    expect(grabber).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands and collapses again when the grabber is used', async () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Expand details' }));
    const expanded = screen.getByRole('button', { name: 'Collapse details' });
    expect(expanded).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(expanded);
    expect(screen.getByRole('button', { name: 'Expand details' })).toBeInTheDocument();
  });
});

// The graph's lateral "+N more" chip on CWE-123 hides two relations whose
// chips are already on screen, so scrolling alone shows nothing (issue #260).
describe('DetailPanel flashing relations', () => {
  const flashOf = (token: number) => ({ relations: [{ id: '20', type: 'CanFollow' }], token });
  const chip = (name: string) => screen.getByRole('button', { name });
  const canFollow20 = 'CanFollow CWE-20: Improper Input Validation';

  it('flashes only the relations it is given', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(chip(canFollow20)).toHaveClass('relation-chip--flash');
    expect(chip('PeerOf CWE-80: HTML Tag Neutralization')).not.toHaveClass('relation-chip--flash');
    expect(chip('CWE-74: Injection')).not.toHaveClass('relation-chip--flash');
  });

  it('flashes nothing without a flash', () => {
    const { container } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(container.querySelector('.relation-chip--flash')).toBeNull();
  });

  it('moves focus to the first flashed relation', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(chip(canFollow20)).toHaveFocus();
  });

  it('opens the bottom sheet, whose peek shows no relations', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    expect(screen.getByRole('button', { name: 'Collapse details' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets the sheet be collapsed after a flash', async () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Collapse details' }));
    expect(screen.getByRole('button', { name: 'Expand details' })).toBeInTheDocument();
  });

  it('flashes again when asked again, with a fresh chip whose animation restarts', () => {
    const { rerender } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(1)} />);
    const first = chip(canFollow20);
    rerender(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} flash={flashOf(2)} />);
    const second = chip(canFollow20);
    expect(second).not.toBe(first);
    expect(second).toHaveClass('relation-chip--flash');
    expect(second).toHaveFocus();
  });
});

describe('DetailPanel relation direction', () => {
  it('names the relation on each lateral chip, since the heading cannot', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    // "Sequence" covers both CanPrecede and CanFollow, so the chip must say which.
    expect(screen.getByRole('button', { name: 'CanFollow CWE-20: Improper Input Validation' })).toBeInTheDocument();
  });

  it('leaves hierarchy chips unadorned, because the heading already says it', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: 'CWE-74: Injection' })).toBeInTheDocument();
  });
});

// No pair of CWEs in any release up to 5.0 has two peer relations, but the
// schema allows it: Related_Weakness repeats freely, and nothing keeps two
// of them from naming the same CWE under different natures.
describe('DetailPanel with two relations to one CWE in a section', () => {
  const n = (id: string) => ({ id, name: `Entry ${id}`, abstraction: 'Base', status: 'Draft', description: '', url: '' });
  const twice = buildGraph({
    meta: data.meta,
    nodes: { '787': n('787'), '788': n('788') },
    edges: [
      { from: '788', to: '787', type: 'PeerOf' },
      { from: '788', to: '787', type: 'Overlaps' },
    ],
  });
  const both = 'Overlaps, PeerOf CWE-787: Entry 787';

  it('lists the CWE once, with both relations', () => {
    render(<DetailPanel graph={twice} selectedId="788" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Peers (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: both })).toHaveTextContent('Overlaps, PeerOf');
  });

  it('flashes the chip for either relation', () => {
    for (const [token, type] of [[1, 'Overlaps'], [2, 'PeerOf']] as const) {
      const { unmount } = render(
        <DetailPanel graph={twice} selectedId="788" onSelect={() => {}} flash={{ relations: [{ id: '787', type }], token }} />,
      );
      expect(screen.getByRole('button', { name: both })).toHaveClass('relation-chip--flash');
      unmount();
    }
  });
});

describe('DetailPanel with a filter', () => {
  // 79 has parent 74, child 80 (also a peer), and follows 20.
  const chips = () => screen.getAllByRole('button').filter((b) => b.classList.contains('relation-chip'));

  it('subdues relations outside the filter and leaves matching ones alone', () => {
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} matches={new Set(['74', '80'])} />);
    const outside = screen.getByRole('button', { name: /CWE-20: Improper Input Validation, outside the filter$/ });
    expect(outside).toHaveClass('relation-chip--outside');
    const inside = screen.getByRole('button', { name: 'CWE-74: Injection' });
    expect(inside).not.toHaveClass('relation-chip--outside');
    expect(inside.getAttribute('aria-label')).not.toContain('outside the filter');
  });

  it('subdues nothing without a filter', () => {
    const { unmount } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} matches={null} />);
    expect(chips().some((b) => b.classList.contains('relation-chip--outside'))).toBe(false);
    unmount();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    expect(chips().some((b) => b.classList.contains('relation-chip--outside'))).toBe(false);
  });

  it('still lists every relation', () => {
    const { unmount } = render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} />);
    const all = chips().length;
    unmount();
    render(<DetailPanel graph={graph} selectedId="79" onSelect={() => {}} matches={new Set()} />);
    expect(chips()).toHaveLength(all);
    expect(chips().every((b) => b.classList.contains('relation-chip--outside'))).toBe(true);
  });
});

describe('DetailPanel dimensions', () => {
  const dims = [
    { type: 'Behavior-Type', value: 'Optimization' },
    { type: 'Behavior-Type', value: 'Removal or Modification' },
    { type: 'Code-Type', value: 'Code' },
    { type: 'Code-Property', value: 'Security-critical' },
    { type: 'Technology', value: 'Processor' },
  ];
  const withDims = buildGraph({
    ...data,
    nodes: {
      ...data.nodes,
      '74': {
        ...data.nodes['74'],
        dimensions: dims,
        technicalNuance: [{ kind: 'paragraph', lines: [[{ text: 'Nuance for 74' }]] }],
      },
      '79': { ...data.nodes['79'], dimensions: [{ type: 'Code-Type', value: 'Code' }] },
    },
  });

  it('shows dimensions after the description and before technical nuance', () => {
    render(<DetailPanel graph={withDims} selectedId="74" onSelect={() => {}} />);
    const description = screen.getByText('Base description');
    const dimensions = screen.getByText('Dimensions');
    const nuance = screen.getByText('Technical nuance');
    expect(description.compareDocumentPosition(dimensions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dimensions.compareDocumentPosition(nuance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows no dimensions for a CWE without them', () => {
    render(<DetailPanel graph={withDims} selectedId="20" onSelect={() => {}} />);
    expect(screen.queryByText('Dimensions')).toBeNull();
  });

  it('closes the dimensions again when another CWE is selected', async () => {
    const { rerender } = render(<DetailPanel graph={withDims} selectedId="74" onSelect={() => {}} />);
    await userEvent.click(screen.getByText('Dimensions'));
    expect(screen.getByText('Dimensions').closest('details')).toHaveAttribute('open');
    rerender(<DetailPanel graph={withDims} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByText('Dimensions').closest('details')).not.toHaveAttribute('open');
  });
});

describe('DetailPanel relation chips with dimensions', () => {
  const stated = 'Differs by: Behavior type Generation; Common name Cross-site Scripting';
  const dimsData: CweData = {
    ...data,
    edges: [
      {
        from: '79',
        to: '74',
        type: 'ChildOf',
        dimensions: [
          { type: 'Behavior-Type', value: 'Generation' },
          { type: 'Common-Name', value: 'Cross-site Scripting' },
        ],
      },
      { from: '80', to: '79', type: 'ChildOf' },
      { from: '79', to: '20', type: 'CanFollow' },
      { from: '79', to: '80', type: 'PeerOf', dimensions: [{ type: 'Other', value: 'Output' }] },
    ],
  };
  const dimsGraph = buildGraph(dimsData);
  const chipLine = (button: HTMLElement) => button.querySelector('.relation-chip__dimensions');

  it('shows the dimensions on the parent chip, in its name and as its title', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="79" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: `CWE-74: Injection. ${stated}` });
    expect(chipLine(chip)).toHaveTextContent('Generation · Cross-site Scripting');
    expect(chip).toHaveAttribute('title', stated);
  });

  it('shows the same line on the child chip of the same relation', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="74" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: `CWE-79: Cross-site Scripting. ${stated}` });
    expect(chipLine(chip)).toHaveTextContent('Generation · Cross-site Scripting');
  });

  it('shows a stated PeerOf from its target', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="80" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: /^PeerOf CWE-79: / });
    expect(chipLine(chip)).toHaveTextContent('Output');
  });

  it('keeps the outside-the-filter suffix before the dimensions', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="79" onSelect={() => {}} matches={new Set(['80'])} />);
    expect(
      screen.getByRole('button', { name: `CWE-74: Injection, outside the filter. ${stated}` }),
    ).toBeInTheDocument();
  });

  it('still focuses a flashed chip that has dimensions', () => {
    render(
      <DetailPanel
        graph={dimsGraph}
        selectedId="79"
        onSelect={() => {}}
        flash={{ relations: [{ id: '80', type: 'PeerOf' }], token: 1 }}
      />,
    );
    const chip = screen.getByRole('button', { name: /^PeerOf CWE-80: .*Differs by: Other Output$/ });
    expect(chip).toHaveClass('relation-chip--flash');
    expect(chip).toHaveFocus();
  });

  it('leaves a chip without dimensions as it was', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="79" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: 'CanFollow CWE-20: Improper Input Validation' });
    expect(chip).not.toHaveAttribute('title');
    expect(chipLine(chip)).toBeNull();
    expect(chip).not.toHaveClass('relation-chip--dimensions');
  });

  it('marks a chip that has dimensions', () => {
    render(<DetailPanel graph={dimsGraph} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: `CWE-74: Injection. ${stated}` })).toHaveClass('relation-chip--dimensions');
  });
});

describe('DetailPanel CanAlsoBe dimensions', () => {
  it('shows the stated dimensions on the inverse chip of the target', () => {
    const alsoData: CweData = {
      ...data,
      nodes: { ...data.nodes, '201': { ...data.nodes['79'], id: '201', name: 'Stater' }, '209': { ...data.nodes['79'], id: '209', name: 'Target' } },
      edges: [{ from: '201', to: '209', type: 'CanAlsoBe', dimensions: [{ type: 'Other', value: 'Output' }] }],
    };
    const alsoGraph = buildGraph(alsoData);
    render(<DetailPanel graph={alsoGraph} selectedId="209" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: /^CanAlsoBe \(inverse\) CWE-201: /i });
    expect(chip.querySelector('.relation-chip__dimensions')).toHaveTextContent('Output');
  });
});

describe('DetailPanel with a graph that has no relation lists', { tags: ['theoretical'] }, () => {
  // buildGraph gives every node all three lists, but DetailPanel accepts any Graph.
  it('shows no relations for a node with no list entries', () => {
    const bare = {
      ...graph,
      childrenOf: new Map<string, string[]>(),
      parentsOf: new Map<string, string[]>(),
      relatedTo: new Map<string, CweEdge[]>(),
    };
    render(<DetailPanel graph={bare} selectedId="79" onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'CWE-79: Cross-site Scripting' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Parents/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Peers/ })).not.toBeInTheDocument();
  });
});

describe('DetailPanel with a relation to a CWE outside the corpus', { tags: ['theoretical'] }, () => {
  // A relation to an entry that doesn't exist would be a mistake in MITRE's data.
  it('lists it by number alone', () => {
    const dangling = buildGraph({ ...data, edges: [{ from: '79', to: '99999', type: 'ChildOf' }] });
    render(<DetailPanel graph={dangling} selectedId="79" onSelect={() => {}} />);
    const chip = screen.getByRole('button', { name: 'CWE-99999' });
    expect(chip).toHaveTextContent('CWE-99999');
    expect(chip.querySelector('.relation-chip__name')).toBeNull();
  });
});

describe('DetailPanel alternate terms and former names', () => {
  const para = (text: string) => ({ kind: 'paragraph' as const, lines: [[{ text }]] });
  const withNames = buildGraph({
    ...data,
    nodes: {
      ...data.nodes,
      '79': {
        ...data.nodes['79'],
        alternateTerms: [{ term: 'XSS', description: [para('An abbreviation.')] }],
        previousNames: [{ name: 'XSS (old)', date: '2008-04-11' }],
        dimensions: [{ type: 'Code-Type', value: 'Code' }],
      },
      '20': {
        ...data.nodes['20'],
        alternateTerms: [{ term: 'Input checking' }],
        previousNames: [{ name: 'Input Validation', date: '2010-06-21' }],
      },
    },
  });

  it('orders description, alternate terms, dimensions, nuance, former names, link', () => {
    render(<DetailPanel graph={withNames} selectedId="79" onSelect={() => {}} />);
    const parts = [
      screen.getByText('XSS description'),
      screen.getByText('Alternate terms (1)'),
      screen.getByText('Dimensions'),
      screen.getByText('Technical nuance'),
      screen.getByText('Former names (1)'),
      screen.getByRole('link', { name: 'View on cwe.mitre.org' }),
    ];
    for (let i = 0; i < parts.length - 1; i++) {
      expect(parts[i].compareDocumentPosition(parts[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('shows neither disclosure for a CWE without the fields', () => {
    render(<DetailPanel graph={withNames} selectedId="74" onSelect={() => {}} />);
    expect(screen.queryByText(/^Alternate terms/)).toBeNull();
    expect(screen.queryByText(/^Former names/)).toBeNull();
  });

  it('closes both again when another CWE is selected', async () => {
    const { rerender } = render(<DetailPanel graph={withNames} selectedId="79" onSelect={() => {}} />);
    await userEvent.click(screen.getByText(/^Alternate terms/));
    await userEvent.click(screen.getByText(/^Former names/));
    expect(screen.getByText(/^Alternate terms/).closest('details')).toHaveAttribute('open');
    expect(screen.getByText(/^Former names/).closest('details')).toHaveAttribute('open');
    rerender(<DetailPanel graph={withNames} selectedId="20" onSelect={() => {}} />);
    expect(screen.getByText(/^Alternate terms/).closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/^Former names/).closest('details')).not.toHaveAttribute('open');
  });
});
