/**
 * AMHSEditor: the DTG is generated once at first load when empty, and
 * never regenerated because the callback prop changed identity or the
 * user cleared the field (Phase A.5, latest-ref pattern).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { AMHSEditor } from '@/components/amhs/AMHSEditor';
import type { FormData } from '@/types';

afterEach(cleanup);

const form = (over: Partial<FormData> = {}) => ({ documentType: 'amhs', ...over }) as unknown as FormData;

describe('AMHSEditor DTG initialisation', () => {
  it('generates a DTG once when the message has none', () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<AMHSEditor formData={form()} onUpdate={onUpdate} />);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0].amhsDtg).toMatch(/^\d{6}Z[A-Z]{3}\d{2}$/);
    rerender(<AMHSEditor formData={form()} onUpdate={vi.fn()} />);
    rerender(<AMHSEditor formData={form({ amhsDtg: '' })} onUpdate={vi.fn()} />);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('leaves an existing DTG alone', () => {
    const onUpdate = vi.fn();
    render(<AMHSEditor formData={form({ amhsDtg: '051200ZSEP26' })} onUpdate={onUpdate} />);
    expect(onUpdate).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/DTG/) as HTMLInputElement).value).toBe('051200ZSEP26');
  });

  it('refreshes through the button with the current callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<AMHSEditor formData={form({ amhsDtg: '051200ZSEP26' })} onUpdate={first} />);
    rerender(<AMHSEditor formData={form({ amhsDtg: '051200ZSEP26' })} onUpdate={second} />);
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
