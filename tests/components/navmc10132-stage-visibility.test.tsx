import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  page11: 'Page 11 entries (NAVMC 118(11))',
  script: 'NJP proceeding script (JAGMAN Appendix A-1-f)',
  payFacts: 'Pay and Service Data (does not print)',
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

/**
 * Screen order, as Stephen set it on 2026-08-27: "Swap the locations of the
 * Offenses and findings (items 1 and 5) section and the NJP proceeding script
 * (JAGMAN Appendix A-1-f) section."
 *
 * ORDER IS NOT COVERED BY ANY VISIBILITY TEST. Every case in this file asks
 * whether a card is on the screen, and all of them pass on any arrangement of
 * the same cards. A layout ruling with no assertion behind it is one careless
 * refactor from silently reverting, so this reads the rendered headings in
 * document order and compares the sequence.
 *
 * THE GATES ARE ASSERTED SEPARATELY AND DELIBERATELY. The swap moved cards,
 * not gates: a literal exchange of the two JSX blocks would have carried
 * OffensesSection into the pass-3 fragment and hidden item 1 at passes 1 and
 * 2, the only passes at which the charge sheet is filled in. The pass-1 case
 * below already asserts the offenses card is present at pass 1, which is what
 * would red on that mistake.
 */
describe('screen order follows the 2026-08-27 ruling', () => {
  /** Headings of interest, in the order the DOM carries them. */
  function orderOf(formData: FormData, titles: string[]): string[] {
    renderSections(formData);
    return titles
      .map((title) => ({ title, node: screen.queryByText(title) }))
      .filter((entry): entry is { title: string; node: HTMLElement } => entry.node !== null)
      .sort((a, b) =>
        // eslint-disable-next-line no-bitwise
        a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      )
      .map((entry) => entry.title);
  }

  it('puts the script above the offenses at pass 3, and both above the punishment', () => {
    expect(
      orderOf(baseFormData({ stage: 3 }), [
        TITLES.rank,
        TITLES.payFacts,
        TITLES.script,
        TITLES.offenses,
        TITLES.punishment,
      ]),
    ).toEqual([TITLES.rank, TITLES.payFacts, TITLES.script, TITLES.offenses, TITLES.punishment]);
  });

  it('keeps the offenses card reachable at pass 1, where the script has not appeared', () => {
    expect(
      orderOf(baseFormData({ stage: 1 }), [TITLES.payFacts, TITLES.script, TITLES.offenses]),
    ).toEqual([TITLES.payFacts, TITLES.offenses]);
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

  // STEPHEN, 2026-08-26: "Once item 12 is signed we need to have the ability
  // to see the Unit Diary action section". The item 12 signature CLOSES pass
  // 5, so the pass to gate on is 6, not 5. Passes 5 and 6 are asserted as a
  // pair below for exactly that reason: an off-by-one here shows the panel a
  // signature too early, on a form where nobody has yet said whether they
  // are appealing.
  it('pass 5 (appeal election being recorded) still hides the unit diary aid', () => {
    renderSections(baseFormData({ stage: 5 }));

    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.queryByText(TITLES.unitDiary)).not.toBeInTheDocument();
  });

  it('pass 6 (item 12 signed) opens the unit diary aid before the form closes out', () => {
    renderSections(baseFormData({ stage: 6 }));

    expect(screen.getByText(TITLES.unitDiary)).toBeInTheDocument();
  });

  // THE OTHER DEMO REGRESSION, 2026-08-25. The page 11 card was gated at
  // pass 3, and pass 3 opens the instant the item 3 election signature
  // closes pass 2, which is before the hearing. SSgt Jara saw an empty 6105
  // on the recording and Stephen ruled it: "that first page 11 we saw should
  // not have been seen at all at that time." The item 9 NJP authority
  // signature closes pass 3 (NAVMC_10132_PASS_SIGNATURES), so pass 4 is the
  // first stage at which a punishment exists for an entry to state. The pair
  // is asserted together because a one-sided test passes on a card that
  // never renders at all.
  it('pass 3 (hearing not yet signed off) hides the page 11 card', () => {
    renderSections(baseFormData({ stage: 3 }));

    // The punishment builder IS open at pass 3, so this is the gate under
    // test and not a section that failed to render.
    expect(screen.getByText(TITLES.punishment)).toBeInTheDocument();
    expect(screen.queryByText(TITLES.page11)).not.toBeInTheDocument();
  });

  it('pass 4 (item 9 signed) opens the page 11 card', () => {
    renderSections(baseFormData({ stage: 4 }));

    expect(screen.getByText(TITLES.page11)).toBeInTheDocument();
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

describe('section order, and the one section this form does not get', () => {
  /** True when `first` appears before `second` in the rendered document. */
  const precedes = (first: HTMLElement, second: HTMLElement): boolean =>
    (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

  /**
   * ITEM 2 SITS AFTER ITEM 22, which is not form order. Stephen's placement,
   * 2026-08-26. On paper item 2 is near the top of page 1 and item 22 is on
   * page 2, so this is deliberate, and it is asserted here so a future
   * reader finds the intent rather than assuming a mistake.
   *
   * THE REASON IS WORK ORDER, NOT PRINT ORDER. The election is what the
   * accused signs, and the A-1-c/A-1-d advisement generated from that card
   * needs the offenses, the rank and the unit already entered. Reaching it
   * last puts every input it depends on behind the clerk.
   *
   * NOTHING ABOUT THE EXPORT DEPENDS ON THIS. navmc10132-acroform.ts writes
   * by field name, never by section order.
   */
  it('renders the accused election after the victim block', () => {
    renderSections(baseFormData({ stage: 'complete' } as Partial<FormData>));
    expect(precedes(screen.getByText(TITLES.victims), screen.getByText(TITLES.election))).toBe(true);
  });

  it('still renders the offenses before both of them', () => {
    renderSections(baseFormData({ stage: 'complete' } as Partial<FormData>));
    expect(precedes(screen.getByText(TITLES.offenses), screen.getByText(TITLES.victims))).toBe(true);
    expect(precedes(screen.getByText(TITLES.offenses), screen.getByText(TITLES.election))).toBe(true);
  });

  /**
   * The section places NEW CAC signature fields on a generated PDF, which is
   * right for a letter the app authors from nothing. The NAVMC 10132 already
   * CARRIES seven signature fields in its official AcroForm, and those are
   * the ones a signer signs and navmc10132-pdf-read.ts reads back to decide
   * the pass and the locks. A further field placed on top would be a
   * signature no part of this app looks at, over a form whose own fields
   * were left empty.
   */
  it('turns off signature-field placement for this document type', () => {
    expect(DOCUMENT_TYPES['navmc10132'].features.showSignature).toBe(false);
  });

  // Scoped to this type, not removed from the app.
  it('leaves every other document type able to place them', () => {
    expect(DOCUMENT_TYPES['basic'].features.showSignature).toBe(true);
  });
});

describe('Start a new case, at the top of the form', () => {
  /**
   * STEPHEN, 2026-08-26: "Clear Form deletes it add a button for this at the
   * top". On every other document type Clear Form discards typing. On this
   * one it also discards the SIGNED PDF the app is writing into, and the
   * only ways to reach it were a header dropdown and the command palette.
   * A data-integrity action was harder to find than a formatting one.
   */
  const withButton = (formData: FormData, onClearForm = vi.fn()) => {
    const view = render(
      <Navmc10132FormSections
        formData={formData}
        setFormData={vi.fn()}
        onDynamicSync={vi.fn()}
        formKey="test"
        onClearForm={onClearForm}
      />,
    );
    return { view, onClearForm };
  };

  it('renders above the load panel and every section', () => {
    withButton(baseFormData({ stage: 'complete' } as Partial<FormData>));
    const button = screen.getByRole('button', { name: /Start a new case/ });
    const first = screen.getByText(TITLES.offenses);
    expect(
      (button.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
  });

  // ONE reset path, not a second implementation. resetDocumentState already
  // drops the working copy's stored files, the base among them.
  it('calls the app own Clear Form action rather than resetting anything itself', () => {
    const { onClearForm } = withButton(baseFormData());
    fireEvent.click(screen.getByRole('button', { name: /Start a new case/ }));
    expect(onClearForm).toHaveBeenCalledTimes(1);
  });

  // The consequence changes with the state, so the copy does.
  it('names the uploaded file and warns what the next export would go into', () => {
    withButton(
      baseFormData({
        navmc10132LoadReport: { fileName: 'THOMPSON.pdf', lockedFields: [] },
      } as unknown as Partial<FormData>),
    );
    expect(screen.getByText(/discards THOMPSON\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/before beginning a different Marine/)).toBeInTheDocument();
  });

  it('says only that it clears the fields when no file is loaded', () => {
    withButton(baseFormData());
    expect(screen.getByText(/starts a blank one/)).toBeInTheDocument();
    expect(screen.queryByText(/discards/)).not.toBeInTheDocument();
  });

  // Optional prop: every existing harness renders without one.
  it('renders nothing when no action is supplied', () => {
    renderSections(baseFormData());
    expect(screen.queryByRole('button', { name: /Start a new case/ })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SECTIONS A SIGNATURE HAS CLOSED OUTRIGHT.
//
// STEPHEN, 2026-08-26: "We can also hide sections that are locked on the form
// from the UI. Example when item 2 is signed we do not need the Unit and
// Accused (Items 17-20) or Item 22, Victims sections".
//
// The lock set below is the REAL one his pass-2 file produces, measured the
// same day and already used as the fixture in navmc10132-signed-locks. Using
// the measured set rather than a plausible one is what makes these assertions
// about his document rather than about an invented shape.
//
// WHAT IS BEING ASSERTED IS A SWAP, NOT A DELETION. The editing surface goes;
// the record stays, in a collapsed summary under the same heading. A test
// that only checked the inputs were gone would pass on a version that dropped
// the accused's name off the screen entirely, so every case below asserts the
// value is still readable.
// ---------------------------------------------------------------------------
describe('a fully signed section collapses to its record', () => {
  /** Verbatim from Stephen's signed file: what item 2 closes at end of pass 2. */
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
    '22A VICTIM STATUS',
    '22A VICTIM SEX',
    '22A VICTIM RACE',
    '22A VICTIM ETHNICITY',
  ];

  function signed(overrides: Partial<FormData> = {}): FormData {
    return baseFormData({
      stage: 3,
      unit: 'HQSVCCo, 1st Bn, 3d Mar',
      accusedName: 'Doe, John A',
      accusedRankGrade: 'Cpl/E-4',
      accusedEdipi: '1234567890',
      navmc10132LoadReport: { fileName: 'signed.pdf', lockedFields: PASS_2_LOCKS },
      ...overrides,
    } as Partial<FormData>);
  }

  it('drops the accused editors once items 17-20 are closed', () => {
    renderSections(signed());

    // The heading stays, so the card is still findable where it always was.
    expect(screen.getByText(TITLES.accused)).toBeInTheDocument();
    // And no editor is offered for a field the export would refuse to write.
    expect(screen.queryByRole('textbox', { name: /accused/i })).not.toBeInTheDocument();
  });

  // THE DEMO REGRESSION, 2026-08-25. An earlier revision hid the whole rank
  // card with the accused block, on the reasoning that its only job is
  // choosing a value the signature closed. It is not: the card also carries
  // years of service and sea and hardship duty pay, which are NOT on the
  // NAVMC 10132, so no signature closes them, and both feed the item 6
  // forfeiture ceiling. On the recording Stephen hit exactly that wall on a
  // signed upload, "max forfeiture, not computed because I did not add the
  // ability to put the years". These two cases pin the split: item 19 shut,
  // the two off-form numbers open, on the same signed document.
  it('keeps the rank card on a signed upload for the two fields no signature closes', () => {
    renderSections(signed());

    expect(screen.getByText(TITLES.rank)).toBeInTheDocument();
    expect(
      screen.getByLabelText('Completed years of service, round down'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Sea or hardship duty pay, per month')).toBeInTheDocument();
  });

  it('still closes the item 19 picker itself on that same document', () => {
    renderSections(signed());

    // Item 19 collapses inside the card that stayed. The picker's own
    // controls are gone: 'Service' and 'Rank' are NOT usable as the probe
    // here, because NjpAuthoritySection renders labels by those same names
    // for item 8A and would satisfy the assertion from a different card.
    // 'Item 19, as it will print' belongs to this card alone.
    expect(screen.getByText('Item 19, as it prints on the signed form')).toBeInTheDocument();
    expect(screen.queryByText('Item 19, as it will print')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /rank/i })).not.toBeInTheDocument();
  });

  // Item 19 is stated ONCE on this screen. The collapsed summary above owns
  // it, so the card that stayed for years of service must not echo it.
  it('does not print item 19 twice when the summary above already states it', () => {
    renderSections(signed());

    expect(screen.getAllByText('Cpl/E-4')).toHaveLength(1);
  });

  it('still shows what those four items carry', () => {
    renderSections(signed());

    expect(screen.getByText('HQSVCCo, 1st Bn, 3d Mar')).toBeInTheDocument();
    expect(screen.getByText('Doe, John A')).toBeInTheDocument();
    expect(screen.getByText('Cpl/E-4')).toBeInTheDocument();
    expect(screen.getByText('1234567890')).toBeInTheDocument();
  });

  it('collapses item 22 and keeps row A readable', () => {
    renderSections(
      signed({
        victims: [
          { status: 'Military', sex: 'Male', race: 'White', ethnicity: 'Not Hispanic or Latino' },
          { status: 'Civilian', sex: 'Female', race: '', ethnicity: '' },
        ],
      } as Partial<FormData>),
    );

    expect(screen.getByText(TITLES.victims)).toBeInTheDocument();
    expect(screen.getByText('Military')).toBeInTheDocument();
    // Rows B through E are carried in item 21, not the item 22 grid, so the
    // summary reports their COUNT rather than pretending the grid holds them.
    expect(screen.getByText('Additional victims, carried in item 21')).toBeInTheDocument();
  });

  it('leaves both sections as editors on a document with no file behind it', () => {
    renderSections(baseFormData({ stage: 3 }));

    expect(screen.getByText(TITLES.rank)).toBeInTheDocument();
    expect(screen.getByText(TITLES.victims)).toBeInTheDocument();
  });

  // THE LOAD-BEARING CASE. The app-lock rule closes only a field the file
  // carries a VALUE for, so a signed file with item 20 left blank leaves the
  // EDIPI open. Collapsing the block then would hide the one box a clerk
  // still has to fill, and the export would carry a UPB with no EDIPI.
  it('keeps the accused block editable when one of the four is still open', () => {
    renderSections(
      signed({
        navmc10132LoadReport: {
          fileName: 'signed.pdf',
          lockedFields: PASS_2_LOCKS.filter((name) => name !== '20 ACCUSED EDIPI'),
        },
      } as Partial<FormData>),
    );

    expect(screen.getByText(TITLES.rank)).toBeInTheDocument();
  });
});
