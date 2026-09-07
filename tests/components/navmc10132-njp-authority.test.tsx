/**
 * Items 8, 8A and 8B, the officer imposing the punishment.
 *
 * STEPHEN, 2026-08-26: "We shoudl have the dropdown for Service, Rank, and
 * generate the grade for the NJP Authority (Items 8, 8A, 8B) like we do the
 * Rank and Pay Grade (Item 19)."
 *
 * THE DEFECT THIS CLOSES IS NOT COSMETIC. The old DynamicForm section
 * carried two free-text grade fields with nothing tying them together:
 * `njpAuthorityGrade`, which prints in item 8A, and `njpAuthorityPayGrade`,
 * labelled "Not printed", which drives the item 6 punishment picker, the
 * A-1-d maximum-punishment paragraph and V-20's ceiling arithmetic. A clerk
 * could type "Capt, O3" in one and "O5" in the other and every consequence
 * would split down the middle, with nothing checking. One picker feeds both.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NjpAuthoritySection } from '@/components/letter/navmc10132/NjpAuthoritySection';
import {
  NAVMC_10132_USMC_OFFICER_RANKS,
  NAVMC_10132_OFFICER_PAY_GRADES,
  officerPayGradeOf,
  officerRankGradeDiverges,
  formatRankGrade,
} from '@/lib/navmc10132-ranks';
import { resolveAuthorityLevel } from '@/lib/navmc10132-punishments';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { NAVMC_10132_ITEM_9_LOCK_FIELDS as LOCKS } from '@/lib/navmc10132-locks';
import { FormData } from '@/types';

// ---------------------------------------------------------------------------
// The table, against the form's own note
// ---------------------------------------------------------------------------

describe('the officer rank list is the page 3 note, verbatim', () => {
  /**
   * The note's closed Marine list, quoted in navmc10132-ranks.ts: "WO, CWO2,
   * CWO3, CWO4, CWO5, 2ndLt, 1stLt, Capt, Maj, LtCol, Col, BGen, MajGen,
   * LtGen, Gen". Order included, because the note gives one.
   */
  it('carries exactly the note\'s officer and warrant ranks, in its order', () => {
    expect(NAVMC_10132_USMC_OFFICER_RANKS.map((r) => r.abbreviation)).toEqual([
      'WO', 'CWO2', 'CWO3', 'CWO4', 'CWO5',
      '2ndLt', '1stLt', 'Capt', 'Maj', 'LtCol', 'Col',
      'BGen', 'MajGen', 'LtGen', 'Gen',
    ]);
  });

  it('carries exactly the note\'s officer pay grades, E variants included', () => {
    expect([...NAVMC_10132_OFFICER_PAY_GRADES]).toEqual([
      'W1', 'W2', 'W3', 'W4', 'W5',
      'O1', 'O1E', 'O2', 'O2E', 'O3', 'O3E',
      'O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10',
    ]);
  });

  // The note forbids dashes in pay grades and periods in Marine ranks.
  it('uses no dashes and no periods, as the note requires', () => {
    for (const grade of NAVMC_10132_OFFICER_PAY_GRADES) expect(grade).not.toContain('-');
    for (const rank of NAVMC_10132_USMC_OFFICER_RANKS) expect(rank.abbreviation).not.toContain('.');
  });

  it('maps every rank to a grade the note lists', () => {
    for (const rank of NAVMC_10132_USMC_OFFICER_RANKS) {
      expect(NAVMC_10132_OFFICER_PAY_GRADES).toContain(rank.payGrade);
    }
  });

  it('seeds the usual grade from the rank, and nothing from an unknown one', () => {
    expect(officerPayGradeOf('LtCol')).toBe('O5');
    expect(officerPayGradeOf('CWO3')).toBe('W3');
    expect(officerPayGradeOf('Gen')).toBe('O10');
    expect(officerPayGradeOf('Sergeant Major')).toBeUndefined();
  });

  // Frocking's officer equivalent: prior enlisted service.
  it('reports a Capt paid O3E as diverging, which is correct and not an error', () => {
    expect(officerRankGradeDiverges('Capt', 'O3E')).toBe(true);
    expect(officerRankGradeDiverges('Capt', 'O3')).toBe(false);
    expect(officerRankGradeDiverges('Capt', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The E-variant fix the picker exposed
// ---------------------------------------------------------------------------

describe('resolveAuthorityLevel accepts the prior-enlisted rates', () => {
  /**
   * FOUND BY BUILDING THE PICKER. The page 3 note lists O1E, O2E and O3E as
   * pay grades this form accepts, so the picker offers them. Before this,
   * `^O(\d+)$` rejected them: an item 8A recorded as O3E returned null,
   * which printed a BLANK maximum punishment on A-1-d and reported the grade
   * as unreadable. An O3E is exactly as much a company-grade officer as an
   * O3.
   */
  it('reads O1E, O2E and O3E as company grade', () => {
    for (const grade of ['O1E', 'O2E', 'O3E']) {
      expect(resolveAuthorityLevel(grade)).toBe('company-grade');
    }
  });

  it('still reads the plain grades as before', () => {
    expect(resolveAuthorityLevel('O3')).toBe('company-grade');
    expect(resolveAuthorityLevel('O4')).toBe('field-grade');
    expect(resolveAuthorityLevel('O10')).toBe('field-grade');
  });

  // A warrant grade is a real entry on this form and resolves no NJP level.
  it('resolves nothing from a warrant grade, and nothing from junk', () => {
    for (const grade of ['W1', 'W5', 'E9', 'O', 'Colonel', '']) {
      expect(resolveAuthorityLevel(grade)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// The clobber rule
// ---------------------------------------------------------------------------

describe('the authority fields belong to the component, not to a DynamicForm', () => {
  /**
   * RHF seeds defaults once at mount and stomps external writes on its next
   * debounced sync. A field written by a custom component must therefore
   * appear in NO section of the definition. This is the rule that bit the
   * 10922 build twice, per the note in schemas.ts.
   */
  it('no section of the definition names any item 8 field', () => {
    const named = DOCUMENT_TYPES['navmc10132'].sections.flatMap((section) =>
      section.fields.map((field) => field.name),
    );
    for (const field of [
      'njpAuthorityName', 'njpAuthorityGrade', 'njpAuthorityEdipi',
      'njpAuthorityPayGrade', 'njpAuthorityService',
    ]) {
      expect(named, `${field} must not be in a DynamicForm section`).not.toContain(field);
    }
  });

  it('still declares them on the schema, so they survive a save and a load', () => {
    const parsed = createEmptyNavmc10132Data();
    expect(parsed).toHaveProperty('njpAuthorityGrade');
    expect(parsed).toHaveProperty('njpAuthorityPayGrade');
  });
});

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

function StubSectionCard({ title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function doc(o: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...o,
  } as unknown as FormData;
}

function show(formData: FormData) {
  return render(
    <NjpAuthoritySection formData={formData} setFormData={vi.fn()} SectionCard={StubSectionCard} />,
  );
}

describe('the card', () => {
  it('offers service, rank and pay grade, like item 19 does', () => {
    show(doc());
    expect(screen.getByText('Service')).toBeInTheDocument();
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Pay grade')).toBeInTheDocument();
  });

  // The composed string is what item 8A prints, and it is shown as such.
  it('previews item 8A as the composed rank and grade', () => {
    show(doc({ njpAuthorityGrade: formatRankGrade('LtCol', 'O5'), njpAuthorityPayGrade: 'O5' }));
    expect(screen.getByText('LtCol, O5')).toBeInTheDocument();
  });

  it('names the authority level the pay grade resolves, where it resolves one', () => {
    show(doc({ njpAuthorityGrade: 'LtCol, O5', njpAuthorityPayGrade: 'O5' }));
    expect(screen.getByText(/decides which punishment codes item 6 offers/)).toBeInTheDocument();
  });

  /**
   * A WARRANT GRADE IS A LEGITIMATE ENTRY WITH A CONSEQUENCE. The form's own
   * list carries WO through CWO5, so item 8A must record them, and 10 U.S.C.
   * 815(b)(2) sets the higher ceiling for a commanding officer of the grade
   * of major or above. The card says what follows rather than leaving A-1-d
   * blank and unexplained.
   */
  it('explains what a warrant grade costs instead of failing quietly', () => {
    show(doc({ njpAuthorityGrade: 'CWO3, W3', njpAuthorityPayGrade: 'W3' }));
    expect(screen.getByText(/warrant grade resolves no NJP authority level/)).toBeInTheDocument();
    expect(screen.getByText(/still records W3/)).toBeInTheDocument();
  });

  it('flags a prior-enlisted rate as deliberate rather than a typo', () => {
    show(doc({ njpAuthorityGrade: 'Capt, O3E', njpAuthorityPayGrade: 'O3E' }));
    expect(screen.getByText(/prior enlisted service/)).toBeInTheDocument();
  });

  // The note closes the list for Marines only.
  it('takes a typed abbreviation for any other service, and says why', () => {
    show(doc({ njpAuthorityService: 'OTHER' }));
    expect(screen.getByText(/correct and appropriate rank abbreviation/)).toBeInTheDocument();
  });

  // D-45: item 8 closes at the item 9 signature, not before.
  it('renders item 8A as a signed value once the app has closed it', () => {
    show(
      doc({
        njpAuthorityGrade: 'LtCol, O5',
        njpAuthorityPayGrade: 'O5',
        navmc10132LoadReport: { fileName: 'signed.pdf', lockedFields: [], appLockedFields: [...LOCKS] },
      }),
    );
    expect(screen.getByText('LtCol, O5')).toBeInTheDocument();
    expect(screen.queryByText('Service')).not.toBeInTheDocument();
    expect(screen.queryByText('Rank')).not.toBeInTheDocument();
  });

  it('offers the pickers on a document nothing has closed', () => {
    show(doc({ njpAuthorityGrade: 'LtCol, O5' }));
    expect(screen.getByText('Service')).toBeInTheDocument();
  });
});
