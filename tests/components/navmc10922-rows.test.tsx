/**
 * Phase 0.4 (HARDENING_PLAN_2026-09): behaviour pins for the NAVMC 10922
 * dependent and prior-marriage row sections. They collapse the fixed row
 * arrays to populated rows plus any the user added and follow template
 * loads through an effect Phase A.1 replaces.
 *
 * The sections are module-private, so they are exercised through the
 * exported Navmc10922FormSections.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Navmc10922FormSections } from '@/components/letter/Navmc10922Sections';
import { NAVMC_10922_EMPTY_DEPENDENT, NAVMC_10922_EMPTY_DISSOLUTION } from '@/types/navmc';
import type { FormData } from '@/types';

afterEach(cleanup);

function form(extra: Record<string, unknown> = {}): FormData {
  return { documentType: 'navmc10922', ...extra } as unknown as FormData;
}

function renderForm(formData: FormData) {
  return render(
    <Navmc10922FormSections formData={formData} setFormData={vi.fn()} onDynamicSync={vi.fn()} formKey={1} />,
  );
}

const dependentRows = () => screen.getAllByText('Name (full given name)');
const dissolutionRows = () => screen.getAllByText('Spouse in the Dissolved Marriage');

describe('NAVMC 10922 dependents', () => {
  it('shows one blank dependent row on an empty form', () => {
    renderForm(form());
    expect(dependentRows()).toHaveLength(1);
  });

  it('shows every populated dependent row', () => {
    const dependents = [
      { ...NAVMC_10922_EMPTY_DEPENDENT, name: 'JANE Q DOE' },
      { ...NAVMC_10922_EMPTY_DEPENDENT, name: 'JOHN Q DOE JR' },
      { ...NAVMC_10922_EMPTY_DEPENDENT, name: 'JILL Q DOE' },
    ];
    renderForm(form({ dependents }));
    expect(dependentRows()).toHaveLength(3);
  });

  it('adds a blank row on request and grows on a template load', () => {
    const { rerender } = renderForm(form());
    fireEvent.click(screen.getByRole('button', { name: /Add dependent/ }));
    expect(dependentRows()).toHaveLength(2);
    const dependents = [1, 2, 3, 4].map(n => ({ ...NAVMC_10922_EMPTY_DEPENDENT, name: `DEP ${n}` }));
    rerender(
      <Navmc10922FormSections formData={form({ dependents })} setFormData={vi.fn()} onDynamicSync={vi.fn()} formKey={1} />,
    );
    expect(dependentRows()).toHaveLength(4);
  });
});

describe('NAVMC 10922 prior marriages', () => {
  // Section 4 renders rows only when a prior-marriage answer is YES.
  const prior = { memberPrevMarried: 'yes' };

  it('shows one blank dissolution row once a prior marriage is declared', () => {
    renderForm(form(prior));
    expect(dissolutionRows()).toHaveLength(1);
  });

  it('shows every populated dissolution row and adds on request', () => {
    const dissolutions = [
      { ...NAVMC_10922_EMPTY_DISSOLUTION, spouseName: 'FIRST SPOUSE' },
      { ...NAVMC_10922_EMPTY_DISSOLUTION, spouseName: 'SECOND SPOUSE' },
    ];
    renderForm(form({ ...prior, dissolutions }));
    expect(dissolutionRows()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /Add former marriage/ }));
    expect(dissolutionRows()).toHaveLength(3);
  });
});
