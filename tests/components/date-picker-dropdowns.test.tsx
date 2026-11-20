/**
 * The shared DatePicker lets the user jump by year and month (react-day-picker
 * captionLayout="dropdown") instead of paging back month by month, and keeps
 * building dates at LOCAL midnight.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DatePicker } from '@/components/ui/date-picker';

afterEach(cleanup);

function open(): HTMLElement {
  fireEvent.click(screen.getByRole('button'));
  return screen.getByRole('dialog');
}

describe('DatePicker year and month dropdowns', () => {
  it('renders labelled year and month selects', () => {
    render(<DatePicker setDate={vi.fn()} />);
    open();
    expect(screen.getByRole('combobox', { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /year/i })).toBeInTheDocument();
  });

  it('offers 1950 through ten years past today', () => {
    render(<DatePicker setDate={vi.fn()} />);
    open();
    const years = Array.from(
      (screen.getByRole('combobox', { name: /year/i }) as HTMLSelectElement).options
    ).map((o) => Number(o.value));
    expect(years[0]).toBe(1950);
    expect(years[years.length - 1]).toBe(new Date().getFullYear() + 10);
  });

  it('opens on the selected date month, not today', () => {
    render(<DatePicker date={new Date(2009, 2, 15)} setDate={vi.fn()} />);
    open();
    expect((screen.getByRole('combobox', { name: /year/i }) as HTMLSelectElement).value).toBe('2009');
    expect((screen.getByRole('combobox', { name: /month/i }) as HTMLSelectElement).value).toBe('2');
  });

  it('year, then month, then day yields the right LOCAL date', () => {
    const setDate = vi.fn();
    render(<DatePicker setDate={setDate} />);
    open();
    fireEvent.change(screen.getByRole('combobox', { name: /year/i }), { target: { value: '2012' } });
    fireEvent.change(screen.getByRole('combobox', { name: /month/i }), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /June 9(th)?,? 2012/ }));

    expect(setDate).toHaveBeenCalledTimes(1);
    const d = setDate.mock.calls[0][0] as Date;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2012, 5, 9]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});
