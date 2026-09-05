/**
 * Phase 0.4 (HARDENING_PLAN_2026-09): behaviour pins for the NAVMC 10132
 * offense and victim row sections. Both collapse the form's fixed five
 * rows to the populated ones plus any the user added, and follow a
 * template load which raises the populated count. Phase A.1 replaces the
 * effect which keeps `visible` in step with the data; these tests are
 * the contract it must keep.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { VictimsSection } from '@/components/letter/navmc10132/VictimsSection';
import { SectionCard } from '@/components/letter/Navmc10132Sections';
import { NAVMC_10132_EMPTY_OFFENSE } from '@/types/navmc';
import type { FormData } from '@/types';

afterEach(cleanup);

const OFFENSE_PLACEHOLDER = 'Article, specific offense, date, and place';

function form(extra: Record<string, unknown> = {}): FormData {
  return { documentType: 'navmc10132', ...extra } as unknown as FormData;
}

describe('OffensesSection', () => {
  it('shows one blank row when no offense is recorded', () => {
    render(<OffensesSection formData={form()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Add offense/ })).toBeInTheDocument();
  });

  it('shows every populated row', () => {
    const offenses = [
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'Art 86, UA 0600-0800, 12 Jan 26' },
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'Art 92, disobeyed order, 13 Jan 26' },
    ];
    render(<OffensesSection formData={form({ offenses })} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(2);
  });

  it('adds a blank row without touching form data', () => {
    const setFormData = vi.fn();
    render(<OffensesSection formData={form()} setFormData={setFormData} SectionCard={SectionCard} />);
    fireEvent.click(screen.getByRole('button', { name: /Add offense/ }));
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(2);
    expect(setFormData).not.toHaveBeenCalled();
  });

  it('grows when a template load populates more rows than are visible', () => {
    const { rerender } = render(
      <OffensesSection formData={form()} setFormData={vi.fn()} SectionCard={SectionCard} />,
    );
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(1);
    const offenses = [
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'one' },
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'two' },
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'three' },
    ];
    rerender(<OffensesSection formData={form({ offenses })} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(3);
  });

  it('keeps a user-added blank row when data shrinks', () => {
    const offenses = [
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'one' },
      { ...NAVMC_10132_EMPTY_OFFENSE, summary: 'two' },
    ];
    const { rerender } = render(
      <OffensesSection formData={form({ offenses })} setFormData={vi.fn()} SectionCard={SectionCard} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Add offense/ }));
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(3);
    rerender(<OffensesSection formData={form({ offenses: [offenses[0]] })} setFormData={vi.fn()} SectionCard={SectionCard} />);
    // Collapse never removes rows the user opened in this session.
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(3);
  });

  it('hides the add button once all five rows are open', () => {
    render(<OffensesSection formData={form()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Add offense/ }));
    }
    expect(screen.getAllByPlaceholderText(OFFENSE_PLACEHOLDER)).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add offense/ })).toBeNull();
  });
});

describe('VictimsSection', () => {
  const statusSelects = () => screen.getAllByText('Select status');

  it('shows one blank row when no victim is recorded', () => {
    render(<VictimsSection formData={form()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    expect(statusSelects()).toHaveLength(1);
  });

  it('shows every populated row', () => {
    const victims = [
      { status: 'Civilian', sex: '', race: '', ethnicity: '' },
      { status: 'Military', sex: '', race: '', ethnicity: '' },
    ];
    render(<VictimsSection formData={form({ victims })} setFormData={vi.fn()} SectionCard={SectionCard} />);
    // A populated status renders its value instead of the placeholder,
    // so count the sex placeholders, which stay blank in both rows.
    expect(screen.getAllByText('Select sex')).toHaveLength(2);
  });

  it('adds a blank row and stops at five', () => {
    render(<VictimsSection formData={form()} setFormData={vi.fn()} SectionCard={SectionCard} />);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Add another victim/ }));
    }
    expect(statusSelects()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /Add another victim/ })).toBeNull();
  });
});
