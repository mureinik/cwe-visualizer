import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Picker } from '../../src/components/Picker';

const options = [
  { id: '1000', label: 'Complete Weakness Hierarchy (1000)' },
  { id: '699', label: 'Software Development (699)' },
  { id: '1435', label: 'Weaknesses in the 2025 CWE Top 25 Most Dangerous Software Weaknesses (1435)' },
  { id: '320', label: 'Key Management Errors', deprecated: true },
];

function renderPicker(onChange = vi.fn(), value: string | null = '1000') {
  render(<Picker label="View" options={options} value={value} onChange={onChange} />);
  return { onChange, input: screen.getByRole('combobox', { name: 'View' }) };
}

describe('Picker', () => {
  it('shows the current option when closed', () => {
    const { input } = renderPicker();
    expect(input).toHaveValue('Complete Weakness Hierarchy (1000)');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows nothing, and the placeholder, when no option is chosen', () => {
    render(<Picker label="Group" options={options} value={null} placeholder="Any group" onChange={() => {}} />);
    const input = screen.getByRole('combobox', { name: 'Group' });
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', 'Any group');
  });

  it('narrows the options to those matching what is typed', async () => {
    const { input } = renderPicker();
    await userEvent.clear(input);
    await userEvent.type(input, 'top');
    const listed = screen.getAllByRole('option');
    expect(listed).toHaveLength(1);
    expect(listed[0]).toHaveTextContent('Top 25');
  });

  it('matches the id as well as the label', async () => {
    const { input } = renderPicker();
    await userEvent.clear(input);
    await userEvent.type(input, '320');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Key Management Errors']);
  });

  it('says so when nothing matches', async () => {
    const { input } = renderPicker();
    await userEvent.clear(input);
    await userEvent.type(input, 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matches')).toBeInTheDocument();
  });

  it('picks the active option with ArrowDown then Enter', async () => {
    const { input, onChange } = renderPicker();
    await userEvent.clear(input);
    await userEvent.type(input, 'top{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1435');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Complete Weakness Hierarchy (1000)');
  });

  it('wraps the active option with the arrow keys', async () => {
    const { input, onChange } = renderPicker();
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[3].id);
    await userEvent.keyboard('{ArrowUp}');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[2].id);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('1000');
  });

  it('opens on ArrowDown from closed, listing every option in the order given', async () => {
    const { input } = renderPicker();
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('option').map((option) => option.dataset.id)).toEqual(['1000', '699', '1435', '320']);
  });

  it('picks an option by clicking it', async () => {
    const { input, onChange } = renderPicker();
    await userEvent.click(input);
    await userEvent.click(screen.getByRole('option', { name: 'Software Development (699)' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('699');
  });

  it('closes on Escape without picking, and restores the current option', async () => {
    const { input, onChange } = renderPicker();
    await userEvent.clear(input);
    await userEvent.type(input, 'top');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('Complete Weakness Hierarchy (1000)');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores Enter with no active option', async () => {
    const { input, onChange } = renderPicker();
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when focus leaves it', async () => {
    const { input } = renderPicker();
    await userEvent.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.tab();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks deprecated options, in the order given', async () => {
    const { input } = renderPicker();
    await userEvent.click(input);
    const listed = screen.getAllByRole('option');
    expect(listed[3]).toHaveAccessibleName('Key Management Errors, deprecated');
    expect(listed[3]).toHaveClass('picker__option--deprecated');
    expect(listed[3].querySelector('.glyph--deprecated')).not.toBeNull();
    expect(listed[0]).not.toHaveClass('picker__option--deprecated');
  });

  it('disables the input when disabled', () => {
    render(<Picker label="Group" options={[]} value={null} onChange={() => {}} disabled />);
    expect(screen.getByRole('combobox', { name: 'Group' })).toBeDisabled();
  });

  describe('former labels', () => {
    const withFormer = [
      { id: '1000', label: 'Complete Weakness Hierarchy (1000)', formerLabels: ['Natural Hierarchy', 'Research Concepts'] },
      { id: '699', label: 'Software Development (699)' },
    ];

    async function typeInto(text: string) {
      render(<Picker label="View" options={withFormer} value={null} onChange={() => {}} />);
      await userEvent.type(screen.getByRole('combobox', { name: 'View' }), text);
    }

    it('lists an option found by a former label, with the newest matching one', async () => {
      await typeInto('research');
      const listed = screen.getAllByRole('option');
      expect(listed).toHaveLength(1);
      expect(listed[0]).toHaveTextContent('formerly: Research Concepts');
      expect(listed[0]).toHaveAccessibleName('Complete Weakness Hierarchy (1000), formerly Research Concepts');
    });

    it('shows the last former label when several match', async () => {
      render(
        <Picker label="View" options={[{ id: '1000', label: 'Hierarchy', formerLabels: ['Research Basics', 'Research Concepts'] }]} value={null} onChange={() => {}} />,
      );
      await userEvent.type(screen.getByRole('combobox', { name: 'View' }), 'research');
      expect(screen.getByRole('option')).toHaveTextContent('formerly: Research Concepts');
    });

    it('shows no former label when the option matched by its own label', async () => {
      await typeInto('hierarchy');
      const listed = screen.getAllByRole('option');
      expect(listed).toHaveLength(1);
      expect(listed[0]).toHaveTextContent(/^Complete Weakness Hierarchy \(1000\)$/);
      expect(listed[0]).toHaveAccessibleName('Complete Weakness Hierarchy (1000)');
    });

    it('says deprecated after the former label', async () => {
      render(
        <Picker label="Group" options={[{ id: '320', label: 'Key Management Errors', deprecated: true, formerLabels: ['Old Keys'] }]} value={null} onChange={() => {}} />,
      );
      await userEvent.type(screen.getByRole('combobox', { name: 'Group' }), 'old');
      expect(screen.getByRole('option')).toHaveAccessibleName('Key Management Errors, formerly Old Keys, deprecated');
    });

    it('says no matches when nothing matches', async () => {
      await typeInto('nothing');
      expect(screen.queryByRole('option')).not.toBeInTheDocument();
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });
  });
});
