/**
 * D.8 (UX audit finding 10) - the two custom pickers are real ARIA
 * comboboxes.
 *
 * The audit found "Custom comboboxes with no ARIA: 2 patterns": the
 * SSIC picker in the dynamic form and the dictionary auto-suggest.
 * Neither exposed role="combobox", aria-expanded, role="listbox" or
 * role="option", and both selected on onPointerDown alone, so no
 * keyboard path to an option existed. SSIC is required on every naval
 * letter and the picker is the only lookup, which made this the
 * required field a keyboard-only drafter could not fill.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { AutoSuggestInput } from '@/components/ui/AutoSuggestInput';
import { DynamicForm } from '@/components/ui/DynamicForm';
import { DOCUMENT_TYPES } from '@/lib/schemas';

const SSICS = [
  { code: '1500', nomenclature: 'Training and Education' },
  { code: '1520', nomenclature: 'Formal Schools' },
  { code: '1540', nomenclature: 'Training Records' },
];

vi.mock('@/hooks/useReferenceData', () => ({
  useSsics: () => ({ ssics: SSICS, loading: false }),
  useMilitaryDictionary: () => ({ dictionary: [], loading: false }),
}));

vi.mock('@/lib/dictionary-display', () => ({
  findSuggestions: (_dictionary: unknown, query: string) =>
    query.length >= 2
      ? ['Commanding Officer', 'Commanding General', 'Command Element'].filter(s =>
          s.toLowerCase().startsWith(query.toLowerCase()),
        )
      : [],
}));

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
afterEach(() => { vi.useRealTimers(); cleanup(); });

/** The debounce inside AutoSuggestInput is 300 ms. */
function flushDebounce() {
  act(() => { vi.advanceTimersByTime(400); });
}

describe('SSIC combobox', () => {
  function renderSsic() {
    render(
      <DynamicForm
        documentType={DOCUMENT_TYPES['basic']}
        onSubmit={vi.fn()}
        defaultValues={{ documentType: 'basic' }}
      />,
    );
    return screen.getByRole('combobox', { name: /SSIC/ });
  }

  it('exposes the combobox contract and opens a listbox of options', async () => {
    const input = renderSsic();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    fireEvent.change(input, { target: { value: '15' } });

    const listbox = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('moves through the options with the arrow keys and selects with Enter', async () => {
    const input = renderSsic();
    fireEvent.change(input, { target: { value: '15' } });
    await screen.findByRole('listbox');

    // Nothing is active until an arrow key moves onto the list.
    expect(input).not.toHaveAttribute('aria-activedescendant');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const first = screen.getAllByRole('option')[0];
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', first.id);

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input).toHaveValue('1500'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('wraps from the last option to the first', async () => {
    const input = renderSsic();
    fireEvent.change(input, { target: { value: '15' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', options[options.length - 1].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
  });

  it('closes on Escape without changing the value', async () => {
    const input = renderSsic();
    fireEvent.change(input, { target: { value: '15' } });
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(input).toHaveValue('15');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects on a plain click as well as on a pointer down', async () => {
    const input = renderSsic();
    fireEvent.change(input, { target: { value: '15' } });
    await screen.findByRole('listbox');

    fireEvent.click(screen.getAllByRole('option')[2]);
    await waitFor(() => expect(input).toHaveValue('1540'));
  });
});

describe('AutoSuggestInput combobox', () => {
  function renderSuggest(onChange = vi.fn()) {
    render(<AutoSuggestInput aria-label="From" value="" onChange={onChange} />);
    return { input: screen.getByRole('combobox', { name: 'From' }), onChange };
  }

  it('exposes the combobox contract and opens a listbox of options', async () => {
    const { input } = renderSuggest();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.change(input, { target: { value: 'Comman' } });
    flushDebounce();

    const listbox = await screen.findByRole('listbox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('moves with the arrow keys and selects with Enter', async () => {
    const { input, onChange } = renderSuggest();
    fireEvent.change(input, { target: { value: 'Comman' } });
    flushDebounce();
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('Commanding General');
  });

  it('closes on Escape and selects on a plain click', async () => {
    const { input, onChange } = renderSuggest();
    fireEvent.change(input, { target: { value: 'Comman' } });
    flushDebounce();
    await screen.findByRole('listbox');

    fireEvent.keyDown(input, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());

    fireEvent.change(input, { target: { value: 'Comman' } });
    flushDebounce();
    await screen.findByRole('listbox');
    fireEvent.click(screen.getAllByRole('option')[0]);
    expect(onChange).toHaveBeenLastCalledWith('Commanding Officer');
  });
});
