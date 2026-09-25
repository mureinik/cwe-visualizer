import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Glyph } from '../../src/components/Glyph';

describe('Glyph', () => {
  it('renders a polygon for a Pillar diamond', () => {
    const { container } = render(<Glyph abstraction="Pillar" size={16} />);
    expect(container.querySelector('polygon')).toBeInTheDocument();
  });

  it('renders two circles for the Class ring', () => {
    const { container } = render(<Glyph abstraction="Class" size={16} />);
    expect(container.querySelectorAll('circle')).toHaveLength(2);
  });

  it('is hidden from assistive technology, since its meaning is in the text label', () => {
    const { container } = render(<Glyph abstraction="Base" size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('marks deprecated glyphs with a modifier class', () => {
    const { container } = render(<Glyph abstraction="Base" size={16} deprecated />);
    expect(container.querySelector('svg')).toHaveClass('glyph--deprecated');
  });
});
