/**
 * TLA Packet editor: every input writes to formData, the computation
 * reads back as the user types, and the rule checks sit on screen.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TlaSections } from '@/components/tla/TlaSections';
import type { FormData } from '@/types';

afterEach(cleanup);

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [formData, setFormData] = useState<FormData>({ documentType: 'tla-packet', ...initial } as unknown as FormData);
  return (
    <>
      <TlaSections formData={formData} setFormData={setFormData} />
      <output data-testid="form">{JSON.stringify(formData)}</output>
    </>
  );
}

function stored(): Record<string, any> {
  return JSON.parse(screen.getByTestId('form').textContent ?? '{}');
}

function type(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function addFiveDayPeriod() {
  fireEvent.click(screen.getByRole('button', { name: /Add lodging period/ }));
  type('Period 1, first day', '2026-11-01');
  type('Period 1, last day', '2026-11-05');
  type('Period 1, locality lodging rate', '200');
  type('Period 1, locality M&IE rate', '100');
  type('Period 1, daily lodging cost', '150');
}

describe('TlaSections', () => {
  it('writes the Marine to formData', () => {
    render(<Harness />);
    type('Last name', 'Rivera');
    expect(stored().tlaMarineLastName).toBe('Rivera');
  });

  it('adds a period with the Marine in the lodging and computes it as the user types', () => {
    render(<Harness />);
    addFiveDayPeriod();
    expect(stored().tlaPeriods[0].memberOccupying).toBe(true);
    expect(screen.getByTestId('tla-total')).toHaveTextContent('$1,075.00');
    expect(screen.getByTestId('tla-total')).toHaveTextContent('5 days');
  });

  it('starts a further period from the one before it, so rates need not be retyped', () => {
    render(<Harness />);
    addFiveDayPeriod();
    fireEvent.click(screen.getByRole('button', { name: /Add lodging period/ }));
    const [first, second] = stored().tlaPeriods;
    expect(second.perDiemLodging).toBe(first.perDiemLodging);
    expect(second.dailyLodgingCost).toBe(first.dailyLodgingCost);
    expect(second.startDate).toBe('');
    expect(second.endDate).toBe('');
  });

  it('removes a period', () => {
    render(<Harness />);
    addFiveDayPeriod();
    fireEvent.click(screen.getByRole('button', { name: 'Remove period 1' }));
    expect(stored().tlaPeriods).toEqual([]);
  });

  it('counts dependents into the percentages', () => {
    render(<Harness />);
    addFiveDayPeriod();
    type('Period 1, dependents 12 or older', '1');
    // 100 percent M&IE for two persons: 150 lodging + 100 M&IE, five days.
    expect(screen.getByTestId('tla-total')).toHaveTextContent('$1,250.00');
  });

  it('shows a rule check with its authority when the facts call for it', () => {
    render(<Harness initial={{ tlaSituation: 'arrival', tlaPriorDays: '70' }} />);
    addFiveDayPeriod();
    const check = screen.getByTestId('tla-advisory-arrival-over-60');
    expect(check).toHaveTextContent(/60 days/);
    expect(check).toHaveTextContent(/FMR/);
  });

  it('asks for the additional-period reason only on an additional request', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Why more TLA is needed')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Additional period/ }));
    expect(stored().tlaRequestKind).toBe('additional');
    expect(screen.getByLabelText('Why more TLA is needed')).toBeInTheDocument();
  });

  it('opens a certificate only when it is switched on', () => {
    render(<Harness />);
    expect(screen.queryByLabelText('Why the lodging was kept')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Military necessity/ }));
    expect(stored().tlaCertMilitaryNecessity).toBe(true);
    type('Why the lodging was kept', 'Ordered TAD for 12 days.');
    expect(stored().tlaMilitaryNecessityNote).toBe('Ordered TAD for 12 days.');
  });

  it('adds and fills a housing search entry', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Add housing entry/ }));
    type('Housing entry 1, date', '2026-11-02');
    type('Housing entry 1, action', 'Registered with the housing office.');
    expect(stored().tlaHousingLog).toEqual([{ date: '2026-11-02', action: 'Registered with the housing office.' }]);
  });

  it('never blocks: a blank packet shows no rule checks', () => {
    render(<Harness />);
    expect(screen.queryByTestId(/^tla-advisory-/)).toBeNull();
  });
});
