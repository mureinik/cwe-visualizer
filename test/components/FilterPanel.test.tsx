import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from '../../src/components/FilterPanel';
import { DEFAULT_FILTER, type Filter } from '../../src/lib/filter';
import { buildGraph } from '../../src/lib/graph';
import { viewsData } from '../fixtures/views-data';

const graph = buildGraph(viewsData);

function renderPanel(filter: Filter = DEFAULT_FILTER, narrow = false) {
  const onChange = vi.fn();
  const onClose = vi.fn();
  render(<FilterPanel graph={graph} filter={filter} onChange={onChange} narrow={narrow} onClose={onClose} />);
  return { onChange, onClose };
}

/** Holds the filter, so a clear button disables itself as it does in the app. */
function StatefulPanel({ initial }: { initial: Filter }) {
  const [filter, setFilter] = useState(initial);
  return <FilterPanel graph={graph} filter={filter} onChange={setFilter} narrow={false} onClose={() => {}} />;
}

describe('FilterPanel', () => {
  it('lists every view by name and ID, view 1000 first, and shows the chosen one', async () => {
    renderPanel();
    const view = screen.getByRole('combobox', { name: 'View' });
    expect(view).toHaveValue('Complete Weakness Hierarchy (1000)');
    await userEvent.click(view);
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Complete Weakness Hierarchy (1000)',
      'Software Development (699)',
      'Weaknesses in the 2025 CWE Top 25 Most Dangerous Software Weaknesses (1435)',
    ]);
  });

  it('sets the view and clears the group when a view is chosen', async () => {
    const { onChange } = renderPanel({ viewId: '699', groupId: '1228', phase: 'Implementation', language: null, anyLanguage: false });
    await userEvent.click(screen.getByRole('combobox', { name: 'View' }));
    await userEvent.click(screen.getByRole('option', { name: /Top 25/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '1435', groupId: null, phase: 'Implementation', language: null, anyLanguage: false });
  });

  it('disables the group for view 1000', () => {
    renderPanel();
    expect(screen.getByRole('combobox', { name: 'Group' })).toBeDisabled();
  });

  it("lists view 699's groupings, the deprecated one last and marked", async () => {
    renderPanel({ viewId: '699', groupId: null, phase: null, language: null, anyLanguage: false });
    const group = screen.getByRole('combobox', { name: 'Group' });
    expect(group).toBeEnabled();
    await userEvent.click(group);
    const listed = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(listed.map((option) => option.textContent)).toEqual(['API / Function Errors', 'Key Management Errors']);
    expect(listed[1]).toHaveAccessibleName('Key Management Errors, deprecated');
  });

  it('sets the group when one is chosen', async () => {
    const { onChange } = renderPanel({ viewId: '699', groupId: null, phase: null, language: null, anyLanguage: false });
    await userEvent.click(screen.getByRole('combobox', { name: 'Group' }));
    await userEvent.click(screen.getByRole('option', { name: 'API / Function Errors' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '699', groupId: '1228', phase: null, language: null, anyLanguage: false });
  });

  it('offers any phase, then each phase by label', () => {
    renderPanel();
    const phase = screen.getByRole('combobox', { name: 'Phase' });
    expect(phase).toHaveValue('');
    expect([...(phase as HTMLSelectElement).options].map((option) => option.textContent)).toEqual([
      'Any phase',
      'Architecture and Design',
      'Implementation',
      'Testing',
      'Testing (AI)',
    ]);
  });

  it('sets a custom phase by its key', async () => {
    const { onChange } = renderPanel();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phase' }), 'Testing (AI)');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '1000', groupId: null, phase: 'AI:Testing', language: null, anyLanguage: false });
  });

  it('clears the phase when Any phase is chosen', async () => {
    const { onChange } = renderPanel({ viewId: '1000', groupId: null, phase: 'Implementation', language: null, anyLanguage: false });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phase' }), 'Any phase');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_FILTER);
  });

  it('offers Any language, then each language by name, between Group and Phase', () => {
    renderPanel();
    const language = screen.getByRole('combobox', { name: 'Language' });
    expect(language).toHaveValue('');
    expect([...(language as HTMLSelectElement).options].map((option) => option.textContent)).toEqual([
      'Any language',
      'C',
      'SQL',
    ]);
    expect(screen.getAllByRole('combobox').map((box) => (box as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      'View',
      'Group',
      'Language',
      'Phase',
    ]);
  });

  it('sets the language and keeps the view and group', async () => {
    const { onChange } = renderPanel({ viewId: '699', groupId: '1228', phase: null, language: null, anyLanguage: false });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'C');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ viewId: '699', groupId: '1228', phase: null, language: 'C', anyLanguage: false });
  });

  it('clears the language and anyLanguage when Any language is chosen', async () => {
    const { onChange } = renderPanel({ ...DEFAULT_FILTER, language: 'C', anyLanguage: true });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'Any language');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_FILTER);
  });

  it('shows the checkbox and the note only once a language is chosen', () => {
    renderPanel();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).not.toHaveAccessibleDescription();
  });

  it('describes the chosen language and offers the checkbox with its extra count', () => {
    renderPanel({ ...DEFAULT_FILTER, language: 'C' });
    expect(screen.getByRole('checkbox', { name: 'Also show weaknesses that apply to any language (+1)' })).not.toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveAccessibleDescription(
      "Weaknesses MITRE ties to C, or to memory-unsafe or compiled languages. Which languages count as which is our call, not MITRE's.",
    );
  });

  it('ticks anyLanguage', async () => {
    const { onChange } = renderPanel({ ...DEFAULT_FILTER, language: 'C' });
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_FILTER, language: 'C', anyLanguage: true });
  });

  it('keeps anyLanguage when the language changes', async () => {
    const { onChange } = renderPanel({ ...DEFAULT_FILTER, language: 'C', anyLanguage: true });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'SQL');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...DEFAULT_FILTER, language: 'SQL', anyLanguage: true });
  });

  it('shows (+0) when every agnostic weakness is already a member', () => {
    const allMembers = buildGraph({ ...viewsData, languageAgnosticIds: ['79'] });
    render(<FilterPanel graph={allMembers} filter={{ ...DEFAULT_FILTER, language: 'C' }} onChange={() => {}} narrow={false} onClose={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Also show weaknesses that apply to any language (+0)' })).toBeInTheDocument();
  });

  it('Clear language clears both and focuses the language list', async () => {
    render(<StatefulPanel initial={{ ...DEFAULT_FILTER, language: 'C', anyLanguage: true }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear language' }));
    expect(screen.getByRole('button', { name: 'Clear language' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveFocus();
  });

  it('clears the group, the phase and the view on their own', async () => {
    const filter = { viewId: '699', groupId: '1228', phase: 'Implementation', language: null, anyLanguage: false };
    const { onChange } = renderPanel(filter);
    await userEvent.click(screen.getByRole('button', { name: 'Clear group' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...filter, groupId: null });
    await userEvent.click(screen.getByRole('button', { name: 'Clear phase' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...filter, phase: null });
    await userEvent.click(screen.getByRole('button', { name: 'Show all CWEs' }));
    expect(onChange).toHaveBeenLastCalledWith({ viewId: '1000', groupId: null, phase: 'Implementation', language: null, anyLanguage: false });
  });

  it('clears everything with Clear all', async () => {
    const { onChange } = renderPanel({ viewId: '699', groupId: '1228', phase: 'Implementation', language: 'C', anyLanguage: true });
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(DEFAULT_FILTER);
  });

  // A clear button disables itself once used, which would drop focus to the page.
  it.each([
    ['Clear group', 'Group'],
    ['Show all CWEs', 'View'],
    ['Clear all', 'View'],
  ])('moves focus from %s to the %s picker', async (button, picker) => {
    render(<StatefulPanel initial={{ viewId: '699', groupId: '1228', phase: 'Implementation', language: null, anyLanguage: false }} />);
    await userEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByRole('button', { name: button })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: picker })).toHaveFocus();
  });

  it('moves focus from Clear phase to the phase list', async () => {
    render(<StatefulPanel initial={{ viewId: '699', groupId: '1228', phase: 'Implementation', language: null, anyLanguage: false }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear phase' }));
    expect(screen.getByRole('button', { name: 'Clear phase' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Phase' })).toHaveFocus();
  });

  it('disables the clear buttons with nothing to clear', () => {
    renderPanel();
    for (const name of ['Clear group', 'Clear language', 'Clear phase', 'Show all CWEs', 'Clear all']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });

  it('has a close button only as a sheet', () => {
    renderPanel();
    expect(screen.queryByRole('button', { name: 'Close filters' })).not.toBeInTheDocument();
  });

  it('closes from its close button as a sheet', async () => {
    const { onClose } = renderPanel(DEFAULT_FILTER, true);
    expect(screen.getByRole('dialog', { name: 'Filter' })).toHaveClass('filter-panel--sheet');
    await userEvent.click(screen.getByRole('button', { name: 'Close filters' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('FilterPanel with a graph that has no views', { tags: ['theoretical'] }, () => {
  // prepare-data always writes views; only hand-built data lacks them.
  it('disables the group', () => {
    const bare = buildGraph({ ...viewsData, views: undefined, groups: undefined });
    render(<FilterPanel graph={bare} filter={DEFAULT_FILTER} onChange={() => {}} narrow={false} onClose={() => {}} />);
    expect(screen.getByRole('combobox', { name: 'Group' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'View' })).toHaveValue('');
  });
});
