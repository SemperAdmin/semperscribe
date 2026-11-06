import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { FormData } from '@/types';
import { NAVMC_11106_EMPTY_DEPENDENT } from '@/types/navmc';
import { Navmc11106FormSections, basesForRow } from '@/components/letter/Navmc11106Sections';

afterEach(cleanup);

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [formData, setFormData] = React.useState({ documentType: 'navmc11106', ...initial } as unknown as FormData);
  return <Navmc11106FormSections formData={formData} setFormData={setFormData} onDynamicSync={vi.fn()} formKey={1} />;
}

const selectedBox = () => screen.getByRole('list', { name: 'Part A purpose' }).querySelector('[aria-current="true"]')?.textContent;
const child = { ...NAVMC_11106_EMPTY_DEPENDENT, name: 'MARINE, KID', relationship: 'SON', sponsorshipBasis: 'installation-approval' };

describe('NAVMC 11106 Part A', () => {
  it('shows Member Only with no dependents and hides the Dependents only option', () => {
    render(<Harness />);
    expect(selectedBox()).toContain('For Member Only');
    expect(screen.queryByRole('checkbox', { name: /Dependents only/ })).toBeNull();
  });

  it('moves to Member and Dependents as soon as a dependent is typed', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Dependent 1 name"), { target: { value: 'MARINE, KID' } });
    expect(selectedBox()).toContain('For Member and Dependents');
    expect(screen.getByRole('checkbox', { name: /Dependents only/ })).toBeTruthy();
  });

  it('moves to Dependents Only when the option is checked', () => {
    render(<Harness initial={{ navmc11106Dependents: [child] }} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Dependents only/ }));
    expect(selectedBox()).toContain("For Member's Dependents Only");
  });

  it('returns to Member Only and clears the option when the last dependent is removed', () => {
    render(<Harness initial={{ navmc11106Dependents: [child], dependentsOnly: true }} />);
    expect(selectedBox()).toContain("For Member's Dependents Only");
    fireEvent.click(screen.getByRole('button', { name: 'Remove dependent 1' }));
    expect(selectedBox()).toContain('For Member Only');
    fireEvent.change(screen.getByLabelText('Dependent 1 name'), { target: { value: 'MARINE, NEW' } });
    expect(selectedBox()).toContain('For Member and Dependents');
  });

  it('does not count a non-sponsored dependent, and explains why', () => {
    render(<Harness initial={{ navmc11106Dependents: [{ ...child, sponsorshipBasis: 'not-sponsored' }] }} />);
    expect(selectedBox()).toContain('For Member Only');
    expect(screen.getByText(/will not print or count/)).toBeTruthy();
  });
});

describe('NAVMC 11106 Part C and Part D', () => {
  it('explains what command sponsored means', () => {
    render(<Harness />);
    expect(screen.getByText(/authorized by the appropriate authority/)).toBeTruthy();
  });

  it('hides the sponsored-date input for a basis that uses the date of birth', () => {
    render(<Harness initial={{ navmc11106Dependents: [{ ...child, sponsorshipBasis: 'birth' }] }} />);
    expect(screen.queryByLabelText('Dependent 1 date command sponsored')).toBeNull();
  });

  it('starts Part D empty', () => {
    render(<Harness />);
    for (const radio of screen.getAllByRole('radio')) expect(radio.getAttribute('aria-checked')).toBe('false');
  });

  it('offers the suggested effective date but does not apply it on its own', () => {
    render(<Harness initial={{ dateOfArrival: '2026-06-01' }} />);
    const input = screen.getByLabelText('3. This Application Is Approved Effective') as HTMLInputElement;
    expect(input.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: /Use suggested date/ }));
    expect(input.value).toBe('2026-06-01');
  });

  it('shows the Remarks lines the app will add', () => {
    render(<Harness initial={{ navmc11106Spouse: { ...child, name: 'S', sponsorshipBasis: 'not-required' } }} />);
    expect(screen.getByText('S: COMMAND SPONSORSHIP NOT REQUIRED.')).toBeTruthy();
  });
});

describe('sponsorship bases by row type', () => {
  it('does not offer child-only bases on the spouse row', () => {
    expect(basesForRow(true)).not.toContain('birth');
    expect(basesForRow(true)).not.toContain('adoption-placement');
    expect(basesForRow(true)).toContain('active-duty-spouse');
    expect(basesForRow(true)).toContain('dual-mil-separation');
  });

  it('does not offer spouse-only bases on a dependent row', () => {
    expect(basesForRow(false)).toContain('birth');
    expect(basesForRow(false)).not.toContain('active-duty-spouse');
    expect(basesForRow(false)).not.toContain('dual-mil-separation');
  });
});
