import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EdgeLabelsToggle } from '../../src/components/EdgeLabelsToggle';
import { EDGE_LABELS_STORAGE_KEY } from '../../src/lib/edge-labels';

describe('EdgeLabelsToggle', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('offers to hide labels that are showing', () => {
    render(<EdgeLabelsToggle edgeLabels="shown" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Hide edge labels' })).toHaveAttribute('title', 'Hide edge labels');
  });

  it('offers to show labels that are hidden', () => {
    render(<EdgeLabelsToggle edgeLabels="hidden" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Show edge labels' })).toHaveAttribute('title', 'Show edge labels');
  });

  it('strikes out its glyph only while the labels are hidden', () => {
    const { container, rerender } = render(<EdgeLabelsToggle edgeLabels="shown" onChange={() => {}} />);
    expect(container.querySelector('.edge-labels-toggle__strike')).toBeNull();
    rerender(<EdgeLabelsToggle edgeLabels="hidden" onChange={() => {}} />);
    expect(container.querySelector('.edge-labels-toggle__strike')).not.toBeNull();
  });

  it('reports and remembers the new choice when clicked', async () => {
    const onChange = vi.fn();
    render(<EdgeLabelsToggle edgeLabels="shown" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Hide edge labels' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('hidden');
    expect(localStorage.getItem(EDGE_LABELS_STORAGE_KEY)).toBe('hidden');
  });
});
