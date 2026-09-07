import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { AccusedElectionSection } from '@/components/letter/navmc10132/AccusedElectionSection';
import { AccusedRankSection } from '@/components/letter/navmc10132/AccusedRankSection';
import { AccusedPayFactsSection } from '@/components/letter/navmc10132/AccusedPayFactsSection';
import { VictimsSection } from '@/components/letter/navmc10132/VictimsSection';
import { createEmptyNavmc10132Data, NAVMC_10132_EMPTY_OFFENSE } from '@/types/navmc';
import { FormData } from '@/types';

/**
 * What a loaded file's signatures close in the UI.
 *
 * REPORTED BY STEPHEN 2026-08-26 after loading his own signed UPB: item 19
 * and item 2 were still editable over signed values, and an offense row
 * could be added but never removed. The lock set below is the REAL one his
 * pass-2 file produces, measured the same day, so these are the exact
 * conditions he hit rather than a plausible imitation.
 *
 * ONE OF HIS FOUR REPORTS WAS NOT A DEFECT and is asserted as correct
 * behaviour below: item 5 findings are NOT closed at pass 2. They close at
 * the item 9 signature, and making them is the pass-3 work.
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
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** Verbatim from the real signed file: 45 closed fields at end of pass 2. */
const PASS_2_LOCKS = [
  '17 UNIT',
  '18 ACCUSED FULL NAME',
  '19 ACCUSED RANK/GRADE',
  '20 ACCUSED EDIPI',
  '1A ARTICLE',
  '1A SUMMARY',
  '1B ARTICLE',
  '1B SUMMARY',
  '2 DEMAND',
  '2 COUNSELOPP',
  '2 ACC REFUSE TO SIGN',
  '2 ACC ELECTION AND RIGHTS DATE_af_date',
  '2 BOOKER',
  '22A VICTIM STATUS',
  '22A VICTIM SEX',
  '22A VICTIM RACE',
  '22A VICTIM ETHNICITY',
];

function loaded(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    stage: 3,
    navmc10132LoadReport: { fileName: 'signed.pdf', lockedFields: PASS_2_LOCKS },
    ...overrides,
  } as unknown as FormData;
}

function unloaded(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    stage: 3,
    ...overrides,
  } as unknown as FormData;
}

describe('item 19 closes; the two fields beside it do not', () => {
  // Stephen: item 19's data "should have been blocked as it is on the form",
  // but years of service and sea pay should not, because they are not on it.
  it('shows item 19 as a signed value instead of three pickers', () => {
    render(
      <AccusedRankSection
        formData={loaded({ accusedRankGrade: 'Cpl, E4' })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );

    // ONCE. The locked block states it; the "as it will print" preview is
    // suppressed on a closed field, because there is nothing pending about a
    // value the signed file already carries.
    expect(screen.getAllByText('Cpl, E4')).toHaveLength(1);
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Pay grade')).not.toBeInTheDocument();
  });

  // THE RULE HELD, THE CARD MOVED. Stephen split years of service and sea
  // pay into AccusedPayFactsSection on 2026-08-27. The rule this case exists
  // for is unchanged and is now structural rather than conditional: neither
  // field has an AcroForm field anywhere on the NAVMC 10132, so neither can
  // be closed by a signature, and they no longer share a card with anything
  // that can be. Both feed the forfeiture ceiling, which is app-side
  // arithmetic a clerk may still need to correct on a signed document.
  it('does not leave years of service or sea pay in the item 19 card', () => {
    render(
      <AccusedRankSection
        formData={unloaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );

    expect(screen.queryByText('Completed years of service, round down')).not.toBeInTheDocument();
    expect(screen.queryByText('Sea or hardship duty pay, per month')).not.toBeInTheDocument();
  });

  it('leaves years of service and sea pay editable on a fully signed document', () => {
    render(
      <AccusedPayFactsSection
        formData={loaded({ accusedRankGrade: 'Cpl, E4' })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );

    expect(screen.getByLabelText('Completed years of service, round down')).toBeEnabled();
    expect(screen.getByLabelText('Sea or hardship duty pay, per month')).toBeEnabled();
  });

  it('shows the pickers on a document with no signed file behind it', () => {
    render(
      <AccusedRankSection
        formData={unloaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );

    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Pay grade')).toBeInTheDocument();
  });
});

describe('item 2 closes at the accused own signature', () => {
  it('renders the election as signed values, not as controls', () => {
    render(
      <AccusedElectionSection
        formData={loaded({
          demand: 'I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.',
          electionDate: '2026-08-05',
          counselOpportunity: 'have',
        })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(screen.getByText('2026-08-05')).toBeInTheDocument();
    expect(screen.getByText(/that signature closed this block/)).toBeInTheDocument();
    // The controls a clerk could have typed into over a signed election.
    expect(screen.queryByText('Item 2, date of election')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Select the accused's election")).not.toBeInTheDocument();
  });

  it('leaves the election editable when no signature has closed it', () => {
    render(
      <AccusedElectionSection
        formData={unloaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(screen.getByText("Select the accused's election")).toBeInTheDocument();
  });

  // vesselException is APP STATE, not a form field, and it selects which
  // rights advisement is served. It has nothing on the form to be closed by.
  it('keeps the vessel exception editable even on a fully signed document', () => {
    render(
      <AccusedElectionSection
        formData={loaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(
      screen.getByText('The accused is attached to or embarked in a vessel'),
    ).toBeInTheDocument();
  });

  // Stephen: the advisement "should be available on the first round before
  // anything is signed to be given at the time of signing". It always was,
  // and this pins it: the button sits outside every stage and lock gate,
  // because the advisement is what the accused READS in order to elect.
  it('offers the rights advisement at pass 1, before anything is signed', () => {
    render(
      <AccusedElectionSection
        formData={unloaded({ stage: 1 })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={1}
      />,
    );

    expect(screen.getByText(/Rights advisement, JAGMAN Appendix/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate/ })).toBeInTheDocument();
  });
});

describe('the victim block closes at the same signature', () => {
  // All twenty fields sit in the item 2 lock list, which is why spec 13.2
  // puts victims in the pass 1 UI.
  it('disables every victim control on a signed file', () => {
    const { container } = render(
      <VictimsSection
        formData={loaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );

    const fieldset = container.querySelector('fieldset');
    expect(fieldset).toBeTruthy();
    expect(fieldset).toBeDisabled();
    expect(screen.getByText(/closed all twenty victim fields/)).toBeInTheDocument();
  });

  it('leaves them editable with no signed file behind the document', () => {
    const { container } = render(
      <VictimsSection formData={unloaded()} setFormData={vi.fn()} SectionCard={StubSectionCard} />,
    );

    expect(container.querySelector('fieldset')).not.toBeDisabled();
  });
});

/**
 * THE ONE OF STEPHEN'S FOUR REPORTS THAT WAS NOT A DEFECT. He asked for
 * "Offenses and findings (items 1 and 5)" to be blocked "as they have been
 * already signed". Item 1 is signed. Item 5 is not, and blocking it would
 * stop the pass-3 work he was there to do.
 */
describe('the offense is closed and the finding is not', () => {
  const withOffense = (extra: Record<string, unknown> = {}) =>
    loaded({
      offenses: [
        {
          ...NAVMC_10132_EMPTY_OFFENSE,
          articleLabel: 'Art. 91  Disrespect toward WO/NCO',
          summary: 'Disrespectful language toward platoon sergeant, 1 Aug 26.',
        },
      ],
      ...extra,
    });

  it('closes item 1 and says the finding is still the clerk to make', () => {
    render(
      <OffensesSection
        formData={withOffense()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    // Regex, because the form label carries a double space that the DOM
    // normalizes to one.
    expect(screen.getByText(/Art\. 91\s+Disrespect toward WO\/NCO/)).toBeInTheDocument();
    expect(screen.getByText(/item 5 closes at the item 9 signature, so it is yours to make/)).toBeInTheDocument();
  });
});

describe('removing an offense', () => {
  // Never existed until 2026-08-26. A mis-picked article had to be blanked
  // field by field and still left an empty row behind.
  it('shuffles the rows up rather than leaving a hole', () => {
    const setFormData = vi.fn();
    const formData = unloaded({
      offenses: [
        { ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 86  AWOL', summary: 'first' },
        { ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 91  Disrespect', summary: 'second' },
      ],
    });

    render(
      <OffensesSection
        formData={formData}
        setFormData={setFormData}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    fireEvent.click(screen.getByLabelText('Remove offense A'));

    const updater = setFormData.mock.calls[0][0] as (p: FormData) => FormData;
    const rows = updater(formData).offenses as { summary: string }[];

    // The item 1 instruction letters offenses A, B, C in order and item 5's
    // findings key to the same letters, so a hole at A would print a finding
    // for an offense that is not there.
    expect(rows[0].summary).toBe('second');
    expect(rows[1].summary).toBe('');
    expect(rows).toHaveLength(5);
  });

  // A UPB with no offense is a charge sheet with no charge, and the export
  // gate blocks on it anyway. Clearing the row is what the clerk means.
  it('offers no remove on the last remaining row', () => {
    render(
      <OffensesSection
        formData={unloaded({ offenses: [{ ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 86  AWOL' }] })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(screen.queryByLabelText('Remove offense A')).not.toBeInTheDocument();
  });

  // Deleting a signed row would shuffle a closed article into another
  // letter's position, and the export would then refuse to write the change,
  // leaving the app and the file disagreeing about which offense is which.
  it('offers no remove on a row a signature has closed', () => {
    render(
      <OffensesSection
        formData={loaded({
          offenses: [
            { ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 91  Disrespect', summary: 'signed' },
            { ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 86  AWOL', summary: 'also signed' },
          ],
        })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(screen.queryByLabelText('Remove offense A')).not.toBeInTheDocument();
  });
});

describe('the charge sheet closes at the item 3 signature', () => {
  /**
   * STEPHEN, 2026-08-26: "once a signed item 3 is done we should not eb able
   * to add more offenses."
   *
   * Item 3 certifies the accused "has been afforded these rights under
   * Article 31, UCMJ, and advised of the right to demand trial by
   * court-martial". THESE rights concern the offenses as they stood when it
   * was signed. A sixth offense added afterwards is one the accused was
   * never advised of, under a certificate saying otherwise.
   *
   * THE FIELD LOCKS COULD NOT REACH THIS. The item 2 signature closes each
   * FILLED row's article and summary, and an empty row F carried no lock at
   * all, because the form has none to place on a field with no value. So the
   * charge sheet stayed open over a certified advisement.
   */
  const signedItem3 = (overrides: Record<string, unknown> = {}): FormData =>
    ({
      documentType: 'navmc10132',
      ...createEmptyNavmc10132Data(),
      stage: 3,
      navmc10132LoadReport: {
        fileName: 'signed.pdf',
        lockedFields: PASS_2_LOCKS,
        signedSignatures: ['2 ACC ELECTION AND RIGHTS SIGNATURE', '3 RIGHTS ATTEST SIGNATURE'],
      },
      ...overrides,
    }) as unknown as FormData;

  it('offers no Add offense once item 3 is signed', () => {
    render(
      <OffensesSection
        formData={signedItem3()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );
    expect(screen.queryByRole('button', { name: /Add offense/ })).not.toBeInTheDocument();
  });

  // Silently removing the control reads as a bug. The card says why.
  it('says why, rather than removing the control without explanation', () => {
    render(
      <OffensesSection
        formData={signedItem3()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );
    expect(screen.getByText(/charge sheet is closed/)).toBeInTheDocument();
    expect(screen.getByText(/needs a new proceeding/)).toBeInTheDocument();
  });

  /**
   * ITEM 2 ALONE IS NOT ENOUGH. The accused's own election closes the rows
   * already charged; the COMMANDER'S certificate at item 3 is what states
   * the accused was advised of them. Until that exists a further offense
   * can still be charged and advised on in the same proceeding.
   */
  it('still offers it when only item 2 is signed', () => {
    render(
      <OffensesSection
        formData={
          {
            documentType: 'navmc10132',
            ...createEmptyNavmc10132Data(),
            stage: 3,
            navmc10132LoadReport: {
              fileName: 'signed.pdf',
              lockedFields: PASS_2_LOCKS,
              signedSignatures: ['2 ACC ELECTION AND RIGHTS SIGNATURE'],
            },
          } as unknown as FormData
        }
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );
    expect(screen.getByRole('button', { name: /Add offense/ })).toBeInTheDocument();
  });

  it('offers it freely on a document with no file behind it', () => {
    render(
      <OffensesSection
        formData={unloaded()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );
    expect(screen.getByRole('button', { name: /Add offense/ })).toBeInTheDocument();
  });
});
