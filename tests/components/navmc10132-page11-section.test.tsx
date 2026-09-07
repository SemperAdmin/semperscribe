import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Page11Section } from '@/components/letter/navmc10132/Page11Section';
import { createEmptyNavmc10132Data, NAVMC_10132_EMPTY_OFFENSE } from '@/types/navmc';
import { APP_PAGE11_SIGNATURE_BLOCK, SIGNATURE_BLOCK } from '@/lib/navmc10132-page11';
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

/**
 * His document. Cpl/E-4, Art. 123 Guilty, N07 imposed, and NO date on either
 * item 6 or item 10.
 *
 * BOTH DATES ARE BLANK on purpose. He reported this against item 6, and on
 * 2026-08-27 ruled that the Page 11 opens with item 10 instead. Leaving both
 * unset keeps this file asserting what he saw, a form generating only half
 * its columns, without pinning which field the entry happens to read.
 */
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
    dispositionNoticeDate: '',
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

describe('the right column on an entry with no date yet', () => {
  it('shows the promotion restriction entry rather than an explanation of its absence', () => {
    renderCard(hisDocument());

    expect(screen.getByText(/not recommended for promotion to sergeant/)).toBeInTheDocument();
    // The sentence he actually saw in that box.
    expect(
      screen.queryByText(/The item 6 punishment date is not set, and the entry opens with it/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/is not set, and the entry opens with it/)).not.toBeInTheDocument();
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
      screen.getAllByText('the item 10 disposition notice date, which both entries open with'),
    ).toHaveLength(1);
  });
});

describe('the right column stays absent where the paragraph does not reach', () => {
  // 4006.3e is written for privates through corporals. A sergeant's form
  // carries the counseling entry alone, and that is correct rather than a
  // failure, so the card must still say why.
  it('explains itself for a sergeant instead of printing an entry', () => {
    renderCard(hisDocument({ accusedPayGrade: 'E5', accusedRankGrade: 'Sgt, E5' } as Partial<FormData>));

    expect(screen.queryByText(/not recommended for promotion/)).not.toBeInTheDocument();
    expect(screen.getByText(/4006.3e is written for privates through corporals/)).toBeInTheDocument();
    expect(
      screen.getByText(/This will produce a form carrying the 6105 counseling entry only/),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// "OPEN THESE ENTRIES TO SIGN".
//
// Stephen, 2026-08-27: "look at how we do pg. 11 in the app already. It might
// be better to use that interface for the pg. 11 entries as that allows you
// to sign already." That replaced a plan to build a second facsimile
// generator. Page11RemarksSection already reads `remarksLeft` and
// `remarksRight`, which are the exact keys njpPage11 returns, and the
// navmc11811 pipeline already draws and signs them.
//
// WHAT THESE CASES DEFEND. The switch has to carry the entries across AND
// leave the UPB intact, and those are two separate failures. A handoff that
// dropped the columns produces an empty Page 11; one that reset document
// state destroys the Unit Punishment Book. Both are asserted on one act.
// ---------------------------------------------------------------------------
describe('handing the entries to the app Page 11', () => {
  /** Captures the functional setFormData update and applies it. */
  function switchAndCapture(formData: FormData): FormData {
    let next: FormData = formData;
    const setFormData = vi.fn((updater: unknown) => {
      next = typeof updater === 'function'
        ? (updater as (p: FormData) => FormData)(formData)
        : (updater as FormData);
    });
    render(
      <Page11Section formData={formData} setFormData={setFormData} SectionCard={StubSectionCard} />,
    );
    screen.getByRole('button', { name: /open these entries to sign/i }).click();
    expect(setFormData).toHaveBeenCalledTimes(1);
    return next;
  }

  it('switches the document to the app Page 11', () => {
    const next = switchAndCapture(hisDocument({ dispositionNoticeDate: '2026-08-27' }));
    expect(next.documentType).toBe('page11');
  });

  it('carries both columns and the Marine across', () => {
    const next = switchAndCapture(hisDocument({ dispositionNoticeDate: '2026-08-27' }));

    expect(next.name).toBe('Dog, Devil D.');
    expect(next.edipi).toBe('1234567890');
    expect(next.remarksLeft).toContain('Counseled this date concerning the following');
    expect(next.remarksRight).toContain('not recommended for promotion');
  });

  /**
   * THE LINES STAY, LAID OUT FOR THIS RENDERER.
   *
   * Stephen caught half of this on the rendered page ("the problem with the
   * digital signed option") and corrected the other half himself on
   * 2026-08-28: "we still need teh line and the signature of member and
   * signature of CO." The defect was never the block. It was the block built
   * for the official form arriving at a renderer that cannot draw it.
   *
   * navmc11811Generator wraps at an 11pt 261pt column and its wrapText splits
   * on ' ', which destroys the run of padding the side-by-side block is built
   * from, so the rule line wrapped and the labels stacked. The app target
   * stacks the two pairs instead, and every line of it survives a split and
   * rejoin on spaces.
   *
   * ASSERTED AGAINST THE OFFICIAL BLOCK, not merely for the words, because a
   * handoff that carried the official block across would still contain
   * "Signature of Marine" and still be the bug he reported.
   */
  it('carries the lines across in the app renderer layout, not the form one', () => {
    const next = switchAndCapture(hisDocument({ dispositionNoticeDate: '2026-08-27' }));

    for (const column of [String(next.remarksLeft), String(next.remarksRight)]) {
      expect(column).toContain(APP_PAGE11_SIGNATURE_BLOCK);
      expect(column.endsWith(APP_PAGE11_SIGNATURE_BLOCK)).toBe(true);
      expect(column).not.toContain(SIGNATURE_BLOCK);
      // The failure that shipped: two labels sharing one line, which this
      // renderer's wrap turns into a stacked mess.
      expect(column).not.toMatch(/Signature of Marine +Signature of CO/);
      // Every line of the block that arrived clears the generator's
      // 48-character wrap. Scoped to the block: the body is wrapped by the
      // same rule but is prose, and reflowing prose is not a defect.
      const block = column.slice(-APP_PAGE11_SIGNATURE_BLOCK.length);
      for (const line of block.split('\n')) expect(line.length).toBeLessThanOrEqual(48);
      // The gaps Stephen asked for on 2026-08-28, two blank lines each.
      expect(column.endsWith(`\n\n\n${APP_PAGE11_SIGNATURE_BLOCK}`)).toBe(true);
    }
  });

  // THE HALF THAT LOSES A FEDERAL RECORD IF IT BREAKS. The type switch is a
  // merge, so every NAVMC 10132 field has to still be there afterwards and
  // the clerk gets the UPB back by reselecting it.
  it('leaves the Unit Punishment Book intact in document state', () => {
    const before = hisDocument({ dispositionNoticeDate: '2026-08-27' });
    const next = switchAndCapture(before);

    expect(next.accusedName).toBe(before.accusedName);
    expect(next.accusedEdipi).toBe(before.accusedEdipi);
    expect(next.accusedPayGrade).toBe(before.accusedPayGrade);
    expect(next.offenses).toEqual(before.offenses);
    expect(next.punishments).toEqual(before.punishments);
    expect(next.page11CorrectiveAction).toBe(before.page11CorrectiveAction);
  });

  // The official-form button has to survive alongside it. They produce
  // different documents and a clerk picks by what happens next.
  it('keeps the official-form export offered beside it', () => {
    render(
      <Page11Section
        formData={hisDocument()}
        setFormData={vi.fn()}
        SectionCard={StubSectionCard}
      />,
    );
    expect(screen.getByRole('button', { name: /generate page 11/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /open these entries to sign/i }),
    ).toBeInTheDocument();
  });
});
