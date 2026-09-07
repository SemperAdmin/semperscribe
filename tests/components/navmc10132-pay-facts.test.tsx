import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccusedPayFactsSection } from '@/components/letter/navmc10132/AccusedPayFactsSection';
import { Navmc10132FormSections } from '@/components/letter/Navmc10132Sections';
import { formForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';
import { scriptForfeitureLadder } from '@/lib/njp-package';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { FormData } from '@/types';

/**
 * Pay and Service Data, split out of the item 19 card on Stephen's ruling of
 * 2026-08-27: "when we upload for proceedings we have the YOS and extra pay.
 * Lets make these their own section vice part of Rank and Pay Grade (Item
 * 19). We should then show the max forf based on the YOS and rank along with
 * if reduced."
 *
 * The cases below pin the three things that ruling asks for and one it does
 * not: that the same figures reach the A-1-f hearing script, which was
 * already true and which a shared builder must not silently break.
 */

function StubSectionCard({
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** A Cpl at 4 years, which the held table prices without a floored cell. */
function cpl(overrides: Partial<FormData> = {}): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    accusedName: 'Doe, John A',
    accusedService: 'USMC',
    accusedRankGrade: 'Cpl/E-4',
    accusedPayGrade: 'E4',
    accusedYearsOfService: '4',
    punishmentDate: '2026-08-25',
    ...overrides,
  } as FormData;
}

function renderSection(formData: FormData) {
  return render(
    <AccusedPayFactsSection
      formData={formData}
      setFormData={vi.fn()}
      SectionCard={StubSectionCard}
    />,
  );
}

describe('the card carries both off-form inputs', () => {
  it('offers years of service and sea or hardship duty pay', () => {
    renderSection(cpl());

    expect(screen.getByLabelText('Completed years of service, round down')).toHaveValue('4');
    expect(screen.getByLabelText('Sea or hardship duty pay, per month')).toBeInTheDocument();
  });

  // The whole reason for the split. Neither field is on the NAVMC 10132, so
  // the card must say so where a clerk reads it, not only in a code comment.
  it('says on its face that nothing in it prints', () => {
    renderSection(cpl());

    expect(screen.getByText('Pay and Service Data (does not print)')).toBeInTheDocument();
  });
});

describe('the card prices the forfeiture from the grade and the years', () => {
  it('shows the ceiling at the current grade and at the reduction grade', () => {
    renderSection(cpl());

    const ladder = formForfeitureLadder(cpl() as unknown as { [key: string]: unknown });
    expect(ladder.rungs).toHaveLength(2);

    // Both rows, by the figures themselves rather than by a row count, so a
    // panel that rendered two identical rows would fail.
    const current = ladder.rungs[0].ceiling;
    const reduced = ladder.rungs[1].ceiling;
    expect(reduced.sevenDaysPay).toBeLessThan(current.sevenDaysPay);

    expect(screen.getByText(`$${current.sevenDaysPay.toLocaleString('en-US')}`)).toBeInTheDocument();
    expect(screen.getByText(`$${reduced.sevenDaysPay.toLocaleString('en-US')}`)).toBeInTheDocument();
    expect(screen.getByText(`if reduced to ${reduced.payGrade}`)).toBeInTheDocument();
  });

  // A missing length of service is the exact hole the 2026-08-25 demo hit.
  // The card must print the reason, never a blank where a limit belongs.
  it('explains itself rather than showing nothing when years of service is unset', () => {
    renderSection(cpl({ accusedYearsOfService: '' } as Partial<FormData>));

    expect(screen.getByText('Maximum forfeiture: not computed.')).toBeInTheDocument();
    expect(
      screen.getByText('A limit still applies. It has to be read from the pay table by hand.'),
    ).toBeInTheDocument();
  });

  // Sea pay is not decoration: JAGMAN 0111.i puts it inside the base, so
  // entering it must move the ceiling. Asserted as a delta, because a panel
  // that ignored the field would still render two plausible rows.
  it('raises the ceiling when sea or hardship duty pay is entered', () => {
    const without = formForfeitureLadder(cpl() as unknown as { [key: string]: unknown });
    const with_ = formForfeitureLadder(
      cpl({ accusedSeaHardshipDutyPay: '300' } as Partial<FormData>) as unknown as {
        [key: string]: unknown;
      },
    );

    expect(with_.rungs[0].ceiling.sevenDaysPay).toBeGreaterThan(
      without.rungs[0].ceiling.sevenDaysPay,
    );
  });
});

describe('the card is reachable whatever the document has been through', () => {
  function renderAll(formData: FormData) {
    return render(
      <Navmc10132FormSections
        formData={formData}
        setFormData={vi.fn()}
        onDynamicSync={vi.fn()}
        formKey="test"
      />,
    );
  }

  /** Verbatim from Stephen's signed file: what item 2 closes at pass 2. */
  const PASS_2_LOCKS = [
    '17 UNIT',
    '18 ACCUSED FULL NAME',
    '19 ACCUSED RANK/GRADE',
    '20 ACCUSED EDIPI',
    '1A ARTICLE',
    '1A SUMMARY',
    '2 DEMAND',
    '2 COUNSELOPP',
    '2 ACC REFUSE TO SIGN',
    '2 ACC ELECTION AND RIGHTS DATE_af_date',
  ];

  it('appears on a fresh document at pass 1', () => {
    renderAll(
      cpl({ stage: 1, accusedPayGrade: '', accusedYearsOfService: '' } as Partial<FormData>),
    );

    expect(screen.getByText('Pay and Service Data (does not print)')).toBeInTheDocument();
  });

  // THE DEMO REGRESSION, in its structural form. A signature on items 17-20
  // collapses the accused block and closes item 19. It must not touch this
  // card, because nothing in this card is on the form.
  it('survives a signed upload that closes items 17-20', () => {
    renderAll(
      cpl({
        stage: 3,
        unit: 'HQSVCCo, 1st Bn, 3d Mar',
        accusedEdipi: '1234567890',
        navmc10132LoadReport: { fileName: 'signed.pdf', lockedFields: PASS_2_LOCKS },
      } as Partial<FormData>),
    );

    // Queried against the WHOLE screen, not a scoped card: the point is that
    // these two inputs are reachable somewhere on a signed document. getBy*
    // throws on more than one match, so this also proves the fields did not
    // get left behind in the item 19 card as well.
    expect(screen.getByText('Pay and Service Data (does not print)')).toBeInTheDocument();
    expect(screen.getByLabelText('Completed years of service, round down')).toBeEnabled();
    expect(screen.getByLabelText('Sea or hardship duty pay, per month')).toBeEnabled();
  });
});

describe('one builder feeds the card, the punishment builder and the A-1-f script', () => {
  // THE POINT OF formForfeitureLadder. Before it, three callers assembled the
  // same five keys by hand. Two ceilings for one Marine on one screen, with
  // nothing to say which governs, is the failure this rules out.
  it('the script ladder and the card ladder are the same ladder', () => {
    const formData = cpl({
      punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }],
    } as unknown as Partial<FormData>);

    const fromCard = formForfeitureLadder(formData as unknown as { [key: string]: unknown });
    const fromScript = scriptForfeitureLadder(formData);

    expect(fromScript).toEqual(fromCard);
    // And the recorded reduction actually moved the operative row, so this
    // is not two matching ladders that both ignored the reduction.
    expect(fromCard.rungs.find((rung) => rung.operative)?.reduced).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P5-3 (2026-09): the inputs keep what the clerk typed, or refuse the
// keystroke. They never delete characters out of the middle of an entry, which
// is how "150.00" became "15000" and "2.5" became "25".
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { fireEvent } from '@testing-library/react';
import { SuspensionSection } from '@/components/letter/navmc10132/SuspensionSection';

/** A controlled harness, so a rejected keystroke is observable as the old value surviving. */
function Harness({ initial }: { initial: FormData }) {
  const [formData, setFormData] = useState<FormData>(initial);
  return (
    <AccusedPayFactsSection
      formData={formData}
      setFormData={setFormData}
      SectionCard={StubSectionCard}
    />
  );
}

describe('P5-3: the card stores what was typed, never a mangled version of it', () => {
  it('typing "150.00" into sea pay stores "150.00" and the E-1 ladder shows $596', () => {
    // JAGMAN 0111.i: base = basic pay + sea pay. E-1 over 4 months on the
    // held table is 2407.20; 2407.20 + 150 = 2557.20; floor(2557.20 / 30 * 7)
    // = 596.
    render(
      <Harness
        initial={cpl({ accusedPayGrade: 'E1', accusedRankGrade: 'Pvt/E-1', accusedYearsOfService: '0' })}
      />,
    );
    const input = screen.getByLabelText('Sea or hardship duty pay, per month');
    fireEvent.change(input, { target: { value: '150.00' } });
    expect(input).toHaveValue('150.00');
    expect(screen.getByText('$596')).toBeInTheDocument();
  });

  it('typing "2.5" into years keeps "2" and prices the E-7 seven-day figure at $1,001', () => {
    // E-7 Over-2 rate on the held table is 4291.50; floor(4291.50 / 30 * 7) = 1001.
    render(
      <Harness
        initial={cpl({ accusedPayGrade: 'E7', accusedRankGrade: 'GySgt/E-7', accusedYearsOfService: '2' })}
      />,
    );
    const input = screen.getByLabelText('Completed years of service, round down');
    fireEvent.change(input, { target: { value: '2.5' } });
    expect(input).toHaveValue('2');
    expect(screen.getByText('$1,001')).toBeInTheDocument();
    expect(screen.getByText(/whole years/i)).toBeInTheDocument();
  });

  it('rejects a third decimal place and a letter in sea pay, keeping the previous value', () => {
    render(<Harness initial={cpl({ accusedSeaHardshipDutyPay: '150.0' } as Partial<FormData>)} />);
    const input = screen.getByLabelText('Sea or hardship duty pay, per month');
    fireEvent.change(input, { target: { value: '150.005' } });
    expect(input).toHaveValue('150.0');
    fireEvent.change(input, { target: { value: '150.0a' } });
    expect(input).toHaveValue('150.0');
    expect(screen.getByText(/dollars and cents/i)).toBeInTheDocument();
  });

  it('accepts a partial entry ending in a decimal point, since the clerk is mid-keystroke', () => {
    render(<Harness initial={cpl()} />);
    const input = screen.getByLabelText('Sea or hardship duty pay, per month');
    fireEvent.change(input, { target: { value: '150.' } });
    expect(input).toHaveValue('150.');
    fireEvent.change(input, { target: { value: '' } });
    expect(input).toHaveValue('');
  });

  it('rejects a third digit of years', () => {
    render(<Harness initial={cpl({ accusedYearsOfService: '12' } as Partial<FormData>)} />);
    const input = screen.getByLabelText('Completed years of service, round down');
    fireEvent.change(input, { target: { value: '123' } });
    expect(input).toHaveValue('12');
  });
});

describe('P5-6: the item 7 period inputs are whole-number fields', () => {
  it('months and days carry step="1" and min="0"', () => {
    render(
      <SuspensionSection
        formData={
          {
            punishments: [{ code: 'N09', days: '10' }],
            suspensions: [{ punishmentIndex: 0, months: '6' }],
            punishmentDate: '2026-01-15',
          } as unknown as FormData
        }
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );
    const months = screen.getByLabelText('Suspended for (months)');
    const days = screen.getByLabelText('or days');
    expect(months).toHaveAttribute('step', '1');
    expect(months).toHaveAttribute('min', '0');
    expect(days).toHaveAttribute('step', '1');
    expect(days).toHaveAttribute('min', '0');
  });
});
