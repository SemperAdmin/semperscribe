/**
 * DD 1561 guided editor (Phase 3): every input writes to formData, the
 * eligibility panel and the qualifying-day count read back live, blocks 5
 * and 8a-8g are derived (never asked twice), the EDIPI is checked inline,
 * the certifying official is optional, and nothing on screen is money.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { Dd1561FormSections } from '@/components/letter/Dd1561Sections';
import { runDd1561Validators } from '@/lib/dd1561-validators';
import { createDd1561Defaults } from '@/types/dd1561';
import type { FormData } from '@/types';

afterEach(cleanup);

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [formData, setFormData] = useState<FormData>({ ...createDd1561Defaults(), ...initial } as unknown as FormData);
  return (
    <>
      <Dd1561FormSections formData={formData} setFormData={setFormData} />
      <output data-testid="form">{JSON.stringify(formData)}</output>
    </>
  );
}

const stored = (): Record<string, any> => JSON.parse(screen.getByTestId('form').textContent ?? '{}');

/** Answer a question by its legend and the option's label. */
function answer(legend: RegExp, option: string | RegExp) {
  const group = screen.getByRole('radiogroup', { name: legend });
  fireEvent.click(within(group).getByRole('radio', { name: option }));
}

/** FMR 4.4.1 Ex. 1: detach 25 May, 5 days of leave, return 30 Jun -> 32 days. */
const FSA_T: Record<string, unknown> = {
  dd1561MemberName: 'SAMPLE, MARINE A',
  dd1561Grade: 'SGT',
  dd1561Edipi: '1234567890',
  dd1561BranchOrganization: 'USMC, TRAINING DEMO COMMAND',
  dd1561DependentAddresses: '100 SAMPLE STREET, JACKSONVILLE, NC 28540',
  dd1561FsaType: 'T',
  dd1561MaritalStatus: 'married',
  dd1561SoleDependentInstitutionalized: false,
  dd1561AllDependentsNear: false,
  dd1561PermissiveOrders: false,
  dd1561LastTdyWithin30: 'was-not',
  dd1561FsaTRows: [{ location: 'SITE B', from: '2026-05-25', to: '2026-06-30', interruptedBefore: false }],
  dd1561FsaTLeaveBeforeDays: 5,
  dd1561OrdersAuthority: 'TAD ORDERS 0001-26',
  dd1561OrdersDate: '2026-05-01',
  dd1561BahWithDependentsConfirmed: true,
};

const FSA_S: Record<string, unknown> = {
  ...FSA_T,
  dd1561FsaType: 'S',
  dd1561FsaSShipUnit: 'USS SAMPLE',
  dd1561FsaSHomeport: 'SAN DIEGO, CA',
  dd1561FsaSSegments: [{ status: 'away', from: '2026-06-15', to: '2026-07-15', shipUnit: 'USS SAMPLE' }],
};

const FSA_R: Record<string, unknown> = {
  ...FSA_T,
  dd1561FsaType: 'R',
  dd1561FsaRTransportAuthorized: false,
  dd1561FsaRElectedUnaccompanied: false,
  dd1561FsaRLastPds: 'CAMP SAMPLE, NC',
  dd1561FsaRDetachDate: '2026-06-01',
  dd1561FsaRLeaveFrom: '2026-06-02',
  dd1561FsaRLeaveTo: '2026-06-11',
  dd1561FsaRNewPds: 'CAMP SAMPLE, JAPAN',
  dd1561FsaRReportDate: '2026-06-14',
};

describe('Dd1561FormSections', () => {
  it('renders the five steps and asks for the type before dates', () => {
    render(<Harness />);
    for (const title of ['1. Do you qualify?', '2. What kind of separation?', '3. Dates', '4. Your certification', '5. Orders and certifying official']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Choose the kind of separation in step 2 first.')).toBeInTheDocument();
  });

  it('sets the FSA type from a situation card, by radio semantics', () => {
    render(<Harness />);
    const group = screen.getByRole('radiogroup', { name: /Kind of separation/ });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    fireEvent.click(within(group).getByRole('radio', { name: /Aboard ship away from homeport/ }));
    expect(stored().dd1561FsaType).toBe('S');
    expect(screen.getByText('Selected: FSA-S (Ship)')).toBeInTheDocument();
  });

  it('shows the FSA-T rows, the FSA-S segments and the FSA-R block for each type', () => {
    const { unmount } = render(<Harness initial={FSA_T} />);
    expect(screen.getByLabelText('Row 1 location')).toHaveValue('SITE B');
    unmount();

    const s = render(<Harness initial={FSA_S} />);
    expect(screen.getByLabelText('12a. Name of ship or unit')).toHaveValue('USS SAMPLE');
    expect(screen.getByTestId('dd1561-day-total')).toHaveTextContent('31 qualifying days. More than 30: yes.');
    s.unmount();

    render(<Harness initial={FSA_R} />);
    expect(screen.getByLabelText('Last permanent duty station')).toHaveValue('CAMP SAMPLE, NC');
    expect(screen.getByTestId('dd1561-fsa-r-questions')).toBeInTheDocument();
    // Detach 1 Jun + 10 days of leave = 11 Jun.
    expect(screen.getByTestId('dd1561-fsa-r-start')).toHaveTextContent('11 Jun 2026');
    expect(screen.getByTestId('dd1561-fsa-r-start')).toHaveTextContent('10 days of leave en route');
  });

  it('updates the FSA-T qualifying-day count live (FMR 4.4.1 Ex. 1 gives 32)', () => {
    render(<Harness initial={{ ...FSA_T, dd1561FsaTLeaveBeforeDays: 0 }} />);
    const total = screen.getByTestId('dd1561-day-total');
    expect(total).toHaveTextContent('37 qualifying days. More than 30: yes.');
    fireEvent.change(screen.getByLabelText(/Days of leave or proceed time before traveling/), { target: { value: '5' } });
    expect(stored().dd1561FsaTLeaveBeforeDays).toBe(5);
    expect(screen.getByTestId('dd1561-day-total')).toHaveTextContent('32 qualifying days. More than 30: yes.');
    expect(screen.getByTestId('dd1561-constructive-dates')).toHaveTextContent('30 May 2026 to 30 Jun 2026');
    expect(screen.getByTestId('dd1561-day-counter').querySelector('[role="status"]')).toHaveAttribute('aria-live', 'polite');
  });

  it('adds and removes TDY rows, with a continuation note past three rows', () => {
    render(<Harness initial={FSA_T} />);
    const add = screen.getByRole('button', { name: /Add a TDY location/ });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(screen.queryByTestId('dd1561-continuation-note')).toBeNull();
    fireEvent.click(add);
    expect(stored().dd1561FsaTRows).toHaveLength(4);
    expect(screen.getByTestId('dd1561-continuation-note')).toHaveTextContent('continuation page');
    expect(screen.getByLabelText('The TDY was interrupted before row 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 4' }));
    expect(stored().dd1561FsaTRows).toHaveLength(3);
  });

  it('shows "appears to qualify" for an eligible claim', () => {
    render(<Harness initial={FSA_T} />);
    expect(screen.getByTestId('dd1561-qualifies')).toHaveTextContent('Appears to qualify');
  });

  it('shows the cited regulation when a disqualifier is answered, and never says denied', () => {
    render(<Harness initial={FSA_T} />);
    answer(/permissive orders/, 'Yes');
    expect(stored().dd1561PermissiveOrders).toBe(true);
    const finding = screen.getByTestId('dd1561-finding-permissive-orders');
    expect(finding).toHaveTextContent('FSA is not authorized for duty under permissive orders.');
    expect(finding).toHaveTextContent('DoD FMR Vol 7A Ch 27 par 1.1, 4.1.1.3');
    expect(screen.queryByTestId('dd1561-qualifies')).toBeNull();
    expect(screen.getByTestId('dd1561-eligibility')).toHaveTextContent('The certifying official reviews the facts and decides the entitlement.');
    expect(screen.getByTestId('dd1561-sections').textContent).not.toMatch(/denied/i);
  });

  it('shows the custody blocker with its citation', () => {
    render(<Harness initial={{ ...FSA_T, dd1561MaritalStatus: 'divorced' }} />);
    answer(/claiming one or more children/, 'Yes');
    answer(/legal custody of the child/, 'Someone else has legal custody');
    expect(stored().dd1561ChildCustody).toBe('other-person');
    expect(screen.getByTestId('dd1561-finding-child-custody-other')).toHaveTextContent('DoD FMR Vol 7A Ch 27 par 2.2.1.1, 3.1.2');
  });

  it('derives the block 5 and 8a-8g checklist from the answers', () => {
    render(<Harness initial={{ ...FSA_T, dd1561HasChildren: true, dd1561ChildCustody: 'member', dd1561DependentOnActiveDuty: false }} />);
    const box = (b: string) => screen.getByTestId(`dd1561-box-${b}`);
    expect(box('5')).toHaveAttribute('data-marked', 'true');
    expect(box('5')).toHaveTextContent('FSA-T');
    expect(box('8a')).toHaveAttribute('data-marked', 'true');
    expect(box('8a')).toHaveTextContent('marked X');
    expect(box('8b')).toHaveAttribute('data-marked', 'true');
    expect(box('8c')).toHaveAttribute('data-marked', 'true');
    expect(box('8d')).toHaveAttribute('data-marked', 'true');
    expect(box('8e')).toHaveAttribute('data-marked', 'false');
    expect(box('8e')).toHaveTextContent('left blank');
    expect(box('8f')).toHaveAttribute('data-marked', 'false');
    expect(box('8g')).toHaveAttribute('data-marked', 'true');
    expect(box('8g')).toHaveTextContent('"Was not" is marked');

    answer(/Are you married to another member/, 'Yes');
    answer(/living together right before/, /Yes, we were living together/);
    expect(box('8f')).toHaveAttribute('data-marked', 'true');
    expect(box('8f')).toHaveTextContent('"Was residing with me" is marked');
  });

  it('checks the EDIPI inline and never keeps an SSN shape', () => {
    render(<Harness />);
    const input = screen.getByLabelText('3. DoD ID number (EDIPI)');
    fireEvent.change(input, { target: { value: '123-45-678' } });
    expect(stored().dd1561Edipi).toBe('12345678');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter all 10 digits of the DoD ID (EDIPI).')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '1234567890' } });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Enter all 10 digits of the DoD ID (EDIPI).')).toBeNull();
  });

  it('keeps each stretch\'s "still deployed" choice with its stretch when an earlier one is removed', () => {
    render(<Harness initial={{
      ...FSA_S,
      dd1561FsaSSegments: [
        { status: 'away', from: '2026-06-01', to: '2026-06-10', shipUnit: 'USS ONE' },
        { status: 'away', from: '2026-06-11', to: '', shipUnit: 'USS TWO' },
        { status: 'away', from: '2026-07-01', to: '2026-07-20', shipUnit: 'USS THREE' },
      ],
    }} />);
    // Stretch 2 has no return date, so it reads as still deployed until the user says otherwise.
    const seg2 = screen.getByTestId('dd1561-fsa-s-seg-2');
    expect(within(seg2).getByText(/still deployed\./i)).toBeInTheDocument();
    fireEvent.click(within(seg2).getByRole('checkbox', { name: 'Still deployed' }));
    expect(within(seg2).queryByText(/still deployed\./i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove stretch 1' }));
    // The former stretch 2 is now stretch 1 and keeps the user's "not still deployed" choice.
    const first = screen.getByTestId('dd1561-fsa-s-seg-1');
    expect(within(first).queryByText(/still deployed\./i)).toBeNull();
    expect(within(first).getByRole('checkbox', { name: 'Still deployed' })).not.toBeChecked();
    expect(within(screen.getByTestId('dd1561-fsa-s-seg-2')).getByRole('checkbox', { name: 'Still deployed' })).not.toBeChecked();
  });

  it('opens the certifying-official panel when its details arrive after the screen mounted', () => {
    function LateHarness() {
      const [formData, setFormData] = useState<FormData>({ ...createDd1561Defaults(), ...FSA_T } as unknown as FormData);
      return (
        <>
          <Dd1561FormSections formData={formData} setFormData={setFormData} />
          <button type="button" onClick={() => setFormData((f) => ({ ...f, dd1561CertifierName: 'OFFICIAL, SAMPLE C' } as FormData))}>load</button>
        </>
      );
    }
    render(<LateHarness />);
    expect(screen.queryByDisplayValue('OFFICIAL, SAMPLE C')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'load' }));
    expect(screen.getByDisplayValue('OFFICIAL, SAMPLE C')).toBeInTheDocument();
  });

  it.each([['T'], ['S'], ['R']])('describes every date field for FSA-%s (where the date comes from)', (t) => {
    const base = t === 'T' ? FSA_T : t === 'S' ? FSA_S : { ...FSA_T, dd1561FsaType: 'R' };
    render(<Harness initial={{ ...base, dd1561Mobilized: true, dd1561LastTdyWithin30: 'was', dd1561CertifierName: 'OFFICIAL, SAMPLE C' }} />);
    const dateButtons = document.querySelectorAll('button[aria-labelledby]');
    expect(dateButtons.length).toBeGreaterThan(3);
    for (const b of Array.from(dateButtons)) {
      const ids = (b.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
      const text = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
      expect(text.length, `date field ${b.id} has no description`).toBeGreaterThan(20);
    }
  });

  it('keeps the certifying official optional, collapsed, and out of the export blockers', () => {
    render(<Harness initial={FSA_T} />);
    const toggle = screen.getByRole('button', { name: /Certifying official \(optional, can be left for the certifier\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('15a. Typed name')).toBeNull();
    expect(screen.getByTestId('dd1561-certifier')).toHaveTextContent('Block 15d, the signature, is always left blank');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.change(screen.getByLabelText('15a. Typed name'), { target: { value: 'SAMPLE, OFFICER B' } });
    expect(stored().dd1561CertifierName).toBe('SAMPLE, OFFICER B');

    const issues = runDd1561Validators({ ...createDd1561Defaults(), ...FSA_T } as unknown as FormData);
    expect(issues.filter((i) => i.severity === 'block')).toEqual([]);
    expect(issues.map((i) => `${i.field ?? ''} ${i.detail}`).join(' ')).not.toMatch(/Certifier|15a|15b|15c|block 16/i);
  });

  it.each([['FSA-T', FSA_T], ['FSA-S', FSA_S], ['FSA-R', FSA_R]])('%s shows no dollar figure or amount anywhere', (_name, initial) => {
    render(<Harness initial={{ ...initial, dd1561LastTdyWithin30: 'was', dd1561PriorPeriodType: 'T', dd1561PriorPeriodFrom: '2026-03-01', dd1561PriorPeriodTo: '2026-04-15' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Certifying official/ }));
    const shown = screen.getByTestId('dd1561-sections').textContent ?? '';
    expect(shown).not.toMatch(/\$|\bamount\b|\bdollars?\b|\brate\b/i);
  });
});
