import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverflowChip } from '../../src/components/OverflowChip';

function renderChip() {
  const onActivate = vi.fn();
  render(
    <svg>
      <OverflowChip x={10} y={20} count={7} label="Show 7 more" onActivate={onActivate} />
    </svg>,
  );
  return onActivate;
}

describe('OverflowChip', () => {
  it('shows how many items it stands for', () => {
    renderChip();
    expect(screen.getByRole('button', { name: 'Show 7 more' })).toHaveTextContent('+7 more');
  });

  it('acts on Space as well as Enter, like a native button', async () => {
    const onActivate = renderChip();
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('ignores other keys', async () => {
    const onActivate = renderChip();
    screen.getByRole('button').focus();
    await userEvent.keyboard('a{Tab}');
    expect(onActivate).not.toHaveBeenCalled();
  });
});
