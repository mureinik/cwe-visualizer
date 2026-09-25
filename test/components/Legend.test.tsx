import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Legend } from '../../src/components/Legend';

describe('Legend', () => {
  it('is exposed as a labelled landmark', () => {
    render(<Legend />);
    expect(screen.getByRole('complementary', { name: 'Legend' })).toBeInTheDocument();
  });

  it('explains what each kind of line means', () => {
    render(<Legend />);
    for (const label of ['Parent / child', 'Can precede', 'Peer, can also be', 'Requires']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('explains every abstraction shape', () => {
    render(<Legend />);
    for (const label of ['Pillar', 'Class', 'Base', 'Variant', 'Compound']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
