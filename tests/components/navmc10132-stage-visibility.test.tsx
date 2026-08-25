import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Navmc10132FormSections } from '@/components/letter/Navmc10132Sections';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { AccusedElectionSection } from '@/components/letter/navmc10132/AccusedElectionSection';
import {
  createEmptyNavmc10132Data,
  navmc10132Stage,
  NAVMC_10132_EMPTY_OFFENSE,
  type Navmc10132Stage,
} from '@/types/navmc';
import { FormData } from '@/types';

/**
 * Stage-based section visibility, docs/NAVMC_10132_SPEC.md section 13 and
 * decision rows D-37 through D-39, D-43, D-46, D-47.
 *
 * The pass-1 section list comes straight from spec section 13.2, "as ruled
 * by Stephen 2026-08-25," and is the test oracle these assertions check
 * against, matching decision row D-46: the table is an oracle, not the
 * runtime source of truth.
 */

/** Trivial stand-in for SectionCard, matching the house pattern in
 *  tests/components/navmc10132-derived-strings.test.tsx. */
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

function baseFormData(overrides: Partial<FormData> = {}): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    accusedName: 'Doe, John A',
    ...overrides,
  };
}

// Section titles as rendered, either by DynamicForm off the schema's
// `section.title` or by the custom sections' own SectionCard `title` prop.
// See src/lib/schemas.ts (Navmc10132Definition.sections) and each custom
// component under src/components/letter/navmc10132/.
const TITLES = {
  accused: 'Unit and Accused (Items 17-20)',
  rank: 'Rank and Pay Grade (Item 19)',
  offenses: 'Offenses and findings (items 1 and 5)',
  election: 'Item 2, Accused Election',
  absence: 'Unauthorized Absence (Item 4)',
  punishment: 'Punishment (Items 6 and 10)',
  suspension: 'Suspension of Punishment (Item 7)',
  authority: 'NJP Authority (Items 8, 8A, 8B)',
  appeal: 'Appeal (Items 11-15)',
  victims: 'Item 22, Victims',
  remarks: 'Items 21 and 16, Remarks',
  unitDiary: 'Unit Diary Handoff',
};

function renderSections(formData: FormData) {
  return render(
    <Navmc10132FormSections
      formData={formData}
      setFormData={vi.fn()}
      onDynamicSync={vi.fn()}
      formKey="test"
    />,
  );
}

describe('createEmptyNavmc10132Data defaults to pass 1', () => {
  it('sets stage to 1 on a fresh document', () => {
    expect(createEmptyNavmc10132Data().stage).toBe(1);
  });

  it('navmc10132Stage reads that default back off a loose FormData bag', () => {
    const formData = baseFormData();
    expect(navmc10132Stage(formData)).toBe(1);
  });

  it('navmc10132Stage falls back to pass 1 for a document with no stage recorded', () => {
    const formData = baseFormData();
    delete (formData as Record<string, unknown>).stage;
    expect(navmc10132Stage(formData)).toBe(1);
  });
});

describe('Pass 1 (notification) shows exactly the section 13.2 list', () => {
  it('shows every pass-1 section', () => {
    renderSections(baseFormData({ stage: 1 }));

    expect(screen.getByText(TITLES.accused)).toBeInTheDocument();
    expect(screen.getByText(TITLES.rank)).toBeInTheDocument();
    expect(screen.getByText(TITLES.offenses)).toBeInTheDocument();
    expect(screen.getByText(TITLES.election)).toBeInTheDocument();
    expect(screen.getByText(TITLES.authority)).toBeInTheDocument();
    expect(screen.getByText(TITLES.victims)).toBeInTheDocument();
    // Item 21 stays open throughout every pass, including pass 1.
    expect(screen.getByText(TITLES.remarks)).toBeInTheDocument();
  });

  it('victims render at pass 1, not later: all twenty fields close at the accused signature', () => {
    renderSections(baseFormData({ stage: 1 }));
    expect(screen.getByText(TITLES.victims)).toBeInTheDocument();
  });

  it('hides every section belonging to a later pass', () => {
    // Absence has its own separate gate (whether an Art. 85/86 offense is
    // on record) on top of the stage gate, so give it an offense that
    // would otherwise satisfy that gate and confirm the stage gate alone
    // still hides it at pass 1.
    const formData = baseFormData({
      stage: 1,
      offenses: [{ ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 86  Absence, failure to go' }],
    });
    renderSections(formData);

    expect(screen.queryByText(TITLES.absence)).not.toBeInTheDocument();
    expect(screen.queryByText(TITLES.punishment)).not.toBeInTheDocument();
    expect(screen.queryByText(TITLES.suspension)).not.toBeInTheDocument();
    expect(screen.queryByText(TITLES.appeal)).not.toBeInTheDocument();
    expect(screen.queryByText(TITLES.unitDiary)).not.toBeInTheDocument();
  });
});

describe('Later stages are additive', () => {
  it('pass 3 (punishment imposed) keeps every pass-1 section and adds its own', () => {
    const formData = baseFormData({
      stage: 3,
      offenses: [{ ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 86  Absence, failure to go' }],
    });
    renderSections(formData);

    // Still present.
    expect(screen.getByText(TITLES.accused)).toBeInTheDocument();
    expect(screen.getByText(TITLES.rank)).toBeInTheDocument();
    expect(screen.getByText(TITLES.offenses)).toBeInTheDocument();
    expect(screen.getByText(TITLES.election)).toBeInTheDocument();
    expect(screen.getByText(TITLES.authority)).toBeInTheDocument();
    expect(screen.getByText(TITLES.victims)).toBeInTheDocument();
    expect(screen.getByText(TITLES.remarks)).toBeInTheDocument();

    // Newly open at pass 3.
    expect(screen.getByText(TITLES.absence)).toBeInTheDocument();
    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.getByText(TITLES.suspension)).toBeInTheDocument();

    // Still closed.
    expect(screen.queryByText(TITLES.appeal)).not.toBeInTheDocument();
    expect(screen.queryByText(TITLES.unitDiary)).not.toBeInTheDocument();
  });

  it('pass 4 (appeal advisement given) adds the appeal block on top of pass 3', () => {
    renderSections(baseFormData({ stage: 4 }));

    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.getByText(TITLES.appeal)).toBeInTheDocument();
    expect(screen.queryByText(TITLES.unitDiary)).not.toBeInTheDocument();
  });

  it('complete (closed out) shows every section, including the unit diary aid', () => {
    renderSections(baseFormData({ stage: 'complete' as Navmc10132Stage }));

    expect(screen.getByText(TITLES.accused)).toBeInTheDocument();
    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.getByText(TITLES.appeal)).toBeInTheDocument();
    expect(screen.getByText(TITLES.unitDiary)).toBeInTheDocument();
  });
});

describe('OffensesSection: the finding control is gated to pass 3', () => {
  const formData: Partial<FormData> = {
    offenses: [
      { ...NAVMC_10132_EMPTY_OFFENSE, articleLabel: 'Art. 92  Failure to obey order', summary: 'x' },
    ],
  };

  it('hides the finding select at pass 1', () => {
    render(
      <OffensesSection
        formData={formData as FormData}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={1}
      />,
    );

    expect(screen.getByText(/finding is the commander's determination/)).toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('shows the finding select at pass 3', () => {
    render(
      <OffensesSection
        formData={formData as FormData}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={3}
      />,
    );

    expect(screen.queryByText(/finding is the commander's determination/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
  });
});

describe('AccusedElectionSection: item 2 is reduced at pass 1', () => {
  it('shows only the vessel exception and the rights advisement at pass 1', () => {
    render(
      <AccusedElectionSection
        formData={baseFormData({ stage: 1 })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={1}
      />,
    );

    // Kept: the vessel exception fact and the advisement generator.
    expect(
      screen.getByText('The accused is attached to or embarked in a vessel'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Rights advisement, JAGMAN Appendix/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate/ })).toBeInTheDocument();

    // Removed: everything D-41 assigns to the member in Acrobat.
    expect(screen.queryByText('Item 2, election')).not.toBeInTheDocument();
    expect(screen.queryByText('Accused refused to sign')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 2, Booker statement (derived)')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Item 3, CO certification of rights, date'),
    ).not.toBeInTheDocument();
  });

  it('shows the full item 2 election once past pass 1', () => {
    render(
      <AccusedElectionSection
        formData={baseFormData({ stage: 2 })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={2}
      />,
    );

    expect(screen.getByText('Item 2, election')).toBeInTheDocument();
    expect(screen.getByText('Accused refused to sign')).toBeInTheDocument();
    expect(screen.getByText('Item 2, Booker statement (derived)')).toBeInTheDocument();
    expect(screen.getByText('Item 3, CO certification of rights, date')).toBeInTheDocument();
    // The vessel exception and advisement stay available at every stage.
    expect(
      screen.getByText('The accused is attached to or embarked in a vessel'),
    ).toBeInTheDocument();
  });
});
