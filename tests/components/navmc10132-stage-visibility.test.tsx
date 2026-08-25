import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Navmc10132FormSections, APPEAL_FIELD_PASS } from '@/components/letter/Navmc10132Sections';
import { OffensesSection } from '@/components/letter/navmc10132/OffensesSection';
import { AccusedElectionSection } from '@/components/letter/navmc10132/AccusedElectionSection';
import { RemarksSection } from '@/components/letter/navmc10132/RemarksSection';
import {
  createEmptyNavmc10132Data,
  navmc10132Stage,
  NAVMC_10132_EMPTY_OFFENSE,
  type Navmc10132Stage,
} from '@/types/navmc';
import { FormData } from '@/types';
import { DOCUMENT_TYPES } from '@/lib/schemas';

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
  // The pass-7 name. The card is renamed per stage, see appealTitleForStage.
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

  // THIS ASSERTION CHANGED, and the change is the point rather than a
  // loosening. It used to look for the card titled 'Appeal (Items 11-15)'
  // at pass 4, which passed because all eight appeal fields opened at pass
  // 4 together. The 13.1 lock table puts four of them at passes 5, 6 and 7,
  // so what pass 4 opens is item 11 alone, and the card is named for that.
  // The per-field placement is asserted in its own describe block below.
  it('pass 4 (appeal advisement given) adds the appeal block, holding item 11 only', () => {
    renderSections(baseFormData({ stage: 4 }));

    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.getByText('Appeal (Item 11)')).toBeInTheDocument();
    expect(screen.queryByText(TITLES.appeal)).not.toBeInTheDocument();
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


/**
 * Item 16 is the one part of RemarksSection that does not belong to the pass
 * its section title implies. The section renders items 21 AND 16, so every
 * section-level assertion above passes at pass 1 while the item 16 inputs sit
 * open underneath. Found by driving the real UI in a browser at each stage
 * and diffing the rendered label set, not by any section-level check here,
 * which is why these assertions target the controls rather than the card.
 *
 * Item 16 signs with the form's own FINAL ADMIN INIT lock, which closes every
 * remaining field in Adobe, so a unit diary number typed at notification is a
 * number for an entry that has not been made, on a document with six passes
 * of work left. See spec section 13 and decision row D-43.
 */
describe('RemarksSection: item 16 is gated to pass 7', () => {
  const UD = 'Item 16, unit diary (UD)';
  const DTD = 'Item 16, date (DTD)';
  const PLACEHOLDER = /Item 16 records the unit diary entry made after the case is closed/;

  function renderAt(stage: Navmc10132Stage) {
    return render(
      <RemarksSection
        formData={baseFormData({ stage })}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
        stage={stage}
      />,
    );
  }

  const earlier: Navmc10132Stage[] = [1, 2, 3, 4, 5, 6];

  it.each(earlier)('hides both item 16 inputs at pass %s', (stage) => {
    renderAt(stage);

    expect(screen.queryByText(UD)).not.toBeInTheDocument();
    expect(screen.queryByText(DTD)).not.toBeInTheDocument();
    expect(screen.getByText(PLACEHOLDER)).toBeInTheDocument();
  });

  it('keeps item 21 open at pass 1, since remarks accrue throughout the case', () => {
    renderAt(1);

    expect(screen.getByText('Free text')).toBeInTheDocument();
    expect(screen.getByText('Item 21 preview, as it will print')).toBeInTheDocument();
  });

  it('opens both item 16 inputs at pass 7', () => {
    renderAt(7);

    expect(screen.getByText(UD)).toBeInTheDocument();
    expect(screen.getByText(DTD)).toBeInTheDocument();
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });

  it('keeps item 16 open once the case is closed out', () => {
    renderAt('complete');

    expect(screen.getByText(UD)).toBeInTheDocument();
    expect(screen.getByText(DTD)).toBeInTheDocument();
  });
});


/**
 * The appeal block spans passes 4 through 7 and used to open all eight of
 * its fields at pass 4, offering a clerk a decision on an appeal that had
 * not been taken yet. Same defect class as item 16 above, found by the same
 * eight-stage browser sweep, and fixed differently because this section is
 * a DynamicForm driven by `Navmc10132Definition` rather than hand-written
 * JSX: it filters its DEFINITION per stage instead of its markup.
 *
 * The property that makes that safe, that DynamicForm omits unnamed keys
 * rather than clearing them and page.tsx merges, is measured separately in
 * tests/components/navmc10132-dynamicform-clobber.test.tsx. These tests
 * cover placement; that file covers data survival. Both are required.
 */
describe('the appeal block opens its fields pass by pass, not all at once', () => {
  const LABELS = {
    item11: 'Item 11 - date accused advised of the right to appeal',
    item12intent: 'Item 12 - accused intention',
    item12date: 'Item 12 - date',
    item13not: 'Item 13 - not appealed',
    item13date: 'Item 13 - date of appeal, if any',
    item14decision: 'Item 14 - decision on appeal',
    item14date: 'Item 14 - date',
    item15: 'Item 15 - date accused notified of the decision',
  };

  function labelsAt(stage: Navmc10132Stage): string[] {
    const { unmount } = renderSections(baseFormData({ stage }));
    const found = Object.entries(LABELS)
      .filter(([, label]) => screen.queryByText(label) !== null)
      .map(([key]) => key);
    unmount();
    return found;
  }

  it('shows only item 11 at pass 4, where the advisement is given', () => {
    expect(labelsAt(4)).toEqual(['item11']);
  });

  it('adds item 12 at pass 5, where the accused records an intention', () => {
    expect(labelsAt(5)).toEqual(['item11', 'item12intent', 'item12date']);
  });

  it('adds items 13 and 14 at pass 6, where the appeal is decided', () => {
    expect(labelsAt(6)).toEqual([
      'item11',
      'item12intent',
      'item12date',
      'item13not',
      'item13date',
      'item14decision',
      'item14date',
    ]);
  });

  it('adds item 15 at pass 7, where notice of the decision is recorded', () => {
    expect(labelsAt(7)).toEqual(Object.keys(LABELS));
  });

  it('keeps every field open once the case is closed out', () => {
    expect(labelsAt('complete')).toEqual(Object.keys(LABELS));
  });

  // The card used to say "Items 11-15" while showing one field, which reads
  // as a rendering failure rather than a stage gate.
  it('names the card for the items it is actually showing', () => {
    const titles: Record<string, string> = {};
    for (const stage of [4, 5, 6, 7] as Navmc10132Stage[]) {
      const { unmount } = renderSections(baseFormData({ stage }));
      titles[String(stage)] =
        screen.getByText(/^Appeal \(Item/).textContent?.trim() ?? '';
      unmount();
    }

    expect(titles).toEqual({
      '4': 'Appeal (Item 11)',
      '5': 'Appeal (Items 11-12)',
      '6': 'Appeal (Items 11-14)',
      '7': 'Appeal (Items 11-15)',
    });
  });

  /**
   * META GUARD. `appealDefinitionForStage` shows a field it has no pass for,
   * deliberately: appearing too early is visible and reportable, while
   * disappearing entirely is found by its absence at an audit years later.
   * That fail-open direction is a safety net, not the plan, and this is what
   * makes it a net rather than a hiding place. A field added to the appeal
   * section without a decision in APPEAL_FIELD_PASS fails here.
   */
  it('assigns every field in the appeal section to a pass', () => {
    const appeal = DOCUMENT_TYPES['navmc10132'].sections.find((s) => s.id === 'appeal');
    expect(appeal, 'the navmc10132 definition must still carry an appeal section').toBeTruthy();

    const unassigned = appeal!.fields
      .map((f) => f.name)
      .filter((name) => APPEAL_FIELD_PASS[name] === undefined);

    expect(
      unassigned,
      'Every appeal field needs a pass in APPEAL_FIELD_PASS (Navmc10132Sections.tsx), ' +
        'from the section 13.1 lock table in docs/NAVMC_10132_SPEC.md. Unassigned fields ' +
        'render at pass 4, which is earlier than most of them belong.',
    ).toEqual([]);
  });

  // The reverse direction: a pass entry naming a field that no longer
  // exists is dead weight that makes the map look more complete than it is.
  it('has no pass entry for a field the appeal section does not carry', () => {
    const appeal = DOCUMENT_TYPES['navmc10132'].sections.find((s) => s.id === 'appeal');
    const names = new Set(appeal!.fields.map((f) => f.name));
    const orphans = Object.keys(APPEAL_FIELD_PASS).filter((name) => !names.has(name));

    expect(orphans, 'APPEAL_FIELD_PASS names fields the appeal section no longer has').toEqual([]);
  });
});
