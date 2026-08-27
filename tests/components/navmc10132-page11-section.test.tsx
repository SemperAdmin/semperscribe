import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Page11Section } from '@/components/letter/navmc10132/Page11Section';
import { createEmptyNavmc10132Data, NAVMC_10132_EMPTY_OFFENSE } from '@/types/navmc';
import { FormData } from '@/types';

/**
 * The card, on the document Stephen was looking at when he reported the
 * defect on 2026-08-27: "pg. 11 right side is not generating as the app does
 * not recognize the item 6 completion."
 *
 * A LIBRARY TEST WAS NOT ENOUGH HERE. njpPage11 returning both columns is
 * necessary but not sufficient: the card branches on `restrictionOmitted`,
 * and it is the card that decides whether a clerk sees an entry or an
 * explanation of why there is none. He reported what he saw on the screen,
 * so the screen is what these assert.
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

/** His document. Cpl/E-4, Art. 123 Guilty, N07 imposed, item 6 undated. */
function hisDocument(overrides: Partial<FormData> = {}): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    accusedName: 'Dog, Devil D.',
    accusedEdipi: '1234567890',
    accusedService: 'USMC',
    accusedRankGrade: 'Cpl, E4',
    accusedPayGrade: 'E4',
    offenses: [
      {
        ...NAVMC_10132_EMPTY_OFFENSE,
        articleLabel: 'Art. 123  Offenses concerning government computers',
        summary: 'What you did',
        finding: 'Guilty',
      },
    ],
    punishments: [{ code: 'N07', dollars: '853' }],
    suspensions: [],
    punishmentDate: '',
    page11CorrectiveAction: 'What are you to do',
    page11AssistanceAvailable: 'This is who can help you with it',
    page11SeparationIntent: 'not-processing',
    ...overrides,
  } as unknown as FormData;
}

function renderCard(formData: FormData) {
  return render(
    <Page11Section
      formData={formData}
      setFormData={vi.fn()}
      SectionCard={StubSectionCard}
    />,
  );
}

describe('the right column on an undated item 6', () => {
  it('shows the promotion restriction entry rather than an explanation of its absence', () => {
    renderCard(hisDocument());

    expect(screen.getByText(/NOT RECOMMENDED FOR PROMOTION TO SERGEANT/)).toBeInTheDocument();
    // The sentence he actually saw in that box.
    expect(
      screen.queryByText(/The item 6 punishment date is not set, and the entry opens with it/),
    ).not.toBeInTheDocument();
  });

  it('promises a form carrying both entries', () => {
    renderCard(hisDocument());

    expect(
      screen.getByText(/This will produce a form carrying both entries/),
    ).toBeInTheDocument();
  });

  // The gap is still reported. Filling the column must not have cost the
  // clerk the warning that a blank is going onto a service record entry.
  it('still warns that the entries carry a named blank, once', () => {
    renderCard(hisDocument());

    expect(screen.getByText('The entry below carries a named blank for each of these.'))
      .toBeInTheDocument();
    expect(
      screen.getAllByText('the item 6 punishment date, which opens the entry'),
    ).toHaveLength(1);
  });
});

describe('the right column stays absent where the paragraph does not reach', () => {
  // 4006.3e is written for privates through corporals. A sergeant's form
  // carries the counseling entry alone, and that is correct rather than a
  // failure, so the card must still say why.
  it('explains itself for a sergeant instead of printing an entry', () => {
    renderCard(hisDocument({ accusedPayGrade: 'E5', accusedRankGrade: 'Sgt, E5' } as Partial<FormData>));

    expect(screen.queryByText(/NOT RECOMMENDED FOR PROMOTION/)).not.toBeInTheDocument();
    expect(screen.getByText(/4006.3e is written for privates through corporals/)).toBeInTheDocument();
    expect(
      screen.getByText(/This will produce a form carrying the 6105 counseling entry only/),
    ).toBeInTheDocument();
  });
});
