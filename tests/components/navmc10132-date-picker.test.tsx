/**
 * The date picker, and why its calendar was misaligned.
 *
 * STEPHEN, 2026-08-26: "Date picker need to be fixed and add a today option
 * to make it easier for the user." His screenshot showed the weekday header
 * printing "Su" alone at the left with "Mo Tu We Th Fr Sa" bunched to the
 * right of it, out of line with the day columns beneath.
 *
 * THE CAUSE WAS A HALF-FINISHED DEPENDENCY MIGRATION. calendar.tsx carried
 * react-day-picker v8 class keys while v9 was installed (9.14.0 against a
 * "^9.8.0" pin). v9 renamed nearly all of them: head_row to weekdays,
 * head_cell to weekday, row to week, cell to day, day to day_button,
 * caption to month_caption, and the modifier keys day_selected, day_today,
 * day_outside, day_disabled to selected, today, outside, disabled.
 *
 * v9 IGNORES AN UNKNOWN CLASS KEY SILENTLY. No error, no warning, no
 * failing test: the layout classes simply never reached the DOM and the
 * grid fell back to browser defaults. The Chevron override in the same file
 * was already v9-only, so the file was half migrated and the half that
 * degraded quietly is the half nobody had looked at.
 *
 * These tests assert against the RENDERED DOM rather than the config
 * object, because a config key that goes nowhere is exactly what passed
 * unnoticed before.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from '@/components/ui/date-picker';
import { IsoDatePicker } from '@/components/letter/navmc10132/IsoDatePicker';

function open(): HTMLElement {
  fireEvent.click(screen.getByRole('button'));
  return screen.getByRole('dialog');
}

describe('the calendar reaches the DOM with its layout classes', () => {
  /**
   * THE REPORTED SYMPTOM, asserted directly. The seven weekday headers sit
   * in one row, and that row carries the flex class the v8 key never
   * applied. Reverting `weekdays` to the v8 name `head_row` reds this.
   */
  it('lays the seven weekday headings out in one styled row', () => {
    render(<DatePicker date={new Date(2026, 7, 25)} setDate={vi.fn()} />);
    const dialog = open();

    // Selected as elements rather than by the columnheader role: jsdom does
    // not expose the implicit role on a <th> inside this grid, and the point
    // here is the CLASSES on the real nodes anyway.
    const headings = Array.from(dialog.querySelectorAll('th'));
    expect(headings).toHaveLength(7);
    expect(headings.map((h) => h.textContent)).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);

    // Every heading carries the fixed width, so the columns line up with the
    // days below them. This is the class the v8 `head_cell` key never set.
    for (const heading of headings) {
      expect(heading.className).toContain('w-9');
    }
    expect(headings[0].parentElement?.className).toContain('flex');
  });

  it('gives every week row the same flex layout as the header', () => {
    render(<DatePicker date={new Date(2026, 7, 25)} setDate={vi.fn()} />);
    const dialog = open();
    const rows = Array.from(dialog.querySelectorAll('tr'));
    // One header row plus the weeks of the month.
    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) expect(row.className).toContain('flex');
  });
});

describe('Today and Clear', () => {
  /**
   * "add a today option to make it easier for the user". Most dates on this
   * form are today's: the election is signed today, the punishment is
   * imposed today, the notice is given today.
   */
  it('sets today, in LOCAL time', () => {
    const setDate = vi.fn();
    render(<DatePicker setDate={setDate} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(setDate).toHaveBeenCalledTimes(1);
    const picked = setDate.mock.calls[0][0] as Date;
    const now = new Date();
    expect(picked.getFullYear()).toBe(now.getFullYear());
    expect(picked.getMonth()).toBe(now.getMonth());
    expect(picked.getDate()).toBe(now.getDate());
    // Midnight local, never UTC: a UTC-midnight Date prints as the previous
    // day anywhere west of Greenwich, which is most of the Marine Corps.
    expect(picked.getHours()).toBe(0);
    expect(picked.getMinutes()).toBe(0);
  });

  // A date entered by mistake had no way back out except reopening the
  // calendar and hunting for the selected day.
  it('clears back to no date', () => {
    const setDate = vi.fn();
    render(<DatePicker date={new Date(2026, 7, 25)} setDate={setDate} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(setDate).toHaveBeenCalledWith(undefined);
  });

  // A single-date picker is finished the moment a day is chosen. Leaving the
  // popover open hides the field the value just landed in.
  it('closes the popover after Today', () => {
    render(<DatePicker setDate={vi.fn()} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('the ISO adapter still speaks yyyy-mm-dd', () => {
  it('hands Today back as an ISO string, not a Date', () => {
    const onChange = vi.fn();
    render(<IsoDatePicker value="" onChange={onChange} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('clears to the empty string', () => {
    const onChange = vi.fn();
    render(<IsoDatePicker value="2026-08-25" onChange={onChange} />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  // The whole reason the adapter exists: new Date('yyyy-mm-dd') parses as
  // UTC and loses a day west of Greenwich.
  it('round-trips a stored date without shifting it', () => {
    render(<IsoDatePicker value="2026-08-25" onChange={vi.fn()} />);
    expect(screen.getByRole('button').textContent).toContain('25 Aug 26');
  });
});
