// Vitest suite for the NAVMC 10132 unit diary handoff, a pure presentation
// formatter with no MCTFS connectivity of its own (navmc10132-unit-diary.ts's
// own header comment). SemperScribe hands a human-readable block back to a
// clerk who transcribes it into MCTFS by hand.
//
// The rule that matters most, per that same header comment: only an offense
// row whose finding is exactly 'Guilty' produces an MCTFS punishment entry.
// A 'Not Guilty' finding, or a blank finding, must never leak its offense
// code into the reportable OFFENSES section, reporting either as a
// conviction is the worst outcome this module can cause. Case 12 below is
// built specifically to prove that, with a Guilty row and a Not Guilty row
// carrying two DIFFERENT MCTFS codes, so the assertion cannot pass by
// accident.
//
// Rebuilt from tools/aa-forms/tmp_check_unit_diary.mjs, a throwaway node
// harness with 35 passing assertions this suite could not read directly, and
// extended per the task's required case list.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, type Navmc10132Offense } from '@/types/navmc';
import { resolveArticle } from '@/lib/navmc10132-utils';
import { unitDiaryBlock } from '@/lib/navmc10132-unit-diary';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

function offenseRow(overrides: Partial<Navmc10132Offense> = {}): Navmc10132Offense {
  return { articleLabel: '', summary: '', finding: '', ...overrides };
}

/** Five offense rows, A through E. Pass rows for the ones you care about, in order. */
function offensesWith(...rows: Partial<Navmc10132Offense>[]): Navmc10132Offense[] {
  const built = Array.from({ length: 5 }, () => offenseRow());
  rows.forEach((r, i) => {
    built[i] = offenseRow(r);
  });
  return built;
}

/** The fields MARINE, GRADE, EDIPI, UNIT, and NJP DATE, all filled in. */
const IDENTITY_FIELDS = {
  accusedName: 'Smith, John A.',
  accusedRankGrade: 'Sgt/E-5',
  accusedEdipi: '1234567890',
  unit: 'HQSVCCo, 1st Bn, 3d Mar',
  punishmentDate: '2026-01-15',
};

/** Extracts the lines of the OFFENSES (guilty findings only) block from the rendered text. */
function offensesSection(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === 'OFFENSES (guilty findings only)');
  if (start === -1) throw new Error('OFFENSES heading not found in unit diary text');
  const end = lines.indexOf('', start + 1);
  return lines.slice(start + 1, end === -1 ? undefined : end).join('\n');
}

// Sanity check against the source: Art. 86 and Art. 89 must resolve to
// different MCTFS codes, or case 12 below would be vacuous.
const ART_86 = 'Art. 86  Absence without leave';
const ART_89 = 'Art. 89  Disrespect of sup. comm. officer';

describe('unitDiaryBlock fixture sanity', () => {
  it('Art. 86 and Art. 89 resolve to different MCTFS codes', () => {
    expect(resolveArticle(ART_86)?.mctfsCode).toBe('86');
    expect(resolveArticle(ART_89)?.mctfsCode).toBe('89');
    expect(resolveArticle(ART_86)?.mctfsCode).not.toBe(resolveArticle(ART_89)?.mctfsCode);
  });
});

// ---------------------------------------------------------------------------
// 1. A fully populated Guilty case
// ---------------------------------------------------------------------------

describe('a fully populated Guilty case', () => {
  it('is reportable, has nothing missing or excluded, and the text carries the resolved code and both punishment codes', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [
        { code: 'N06', days: '7', suspendedFromDuty: false },
        { code: 'N16', oralOrWritten: 'orally' },
      ],
      suspension: 'NONE',
      intendAppeal: 'I do not intend to appeal.',
    });

    const result = unitDiaryBlock(form);

    expect(result.reportable).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.excluded).toEqual([]);
    expect(result.text).toContain(resolveArticle(ART_86)!.mctfsCode);
    expect(result.text).toContain('N06');
    expect(result.text).toContain('N16');
  });
});

// ---------------------------------------------------------------------------
// 2. One Guilty row and one Not Guilty row
// ---------------------------------------------------------------------------

describe('one Guilty row and one Not Guilty row', () => {
  it('is reportable, excludes exactly the Not Guilty row, and names it under NOT REPORTED', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith(
        { articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' },
        { articleLabel: ART_89, summary: 'Alleged disrespect, not sustained.', finding: 'Not Guilty' }
      ),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.reportable).toBe(true);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].row).toBe('B');
    expect(result.excluded[0].reason).toBe('finding is Not Guilty');
    expect(result.text).toContain('NOT REPORTED');
    expect(result.text).toContain('B   ' + ART_89);
  });
});

// ---------------------------------------------------------------------------
// 3. Every row Not Guilty
// ---------------------------------------------------------------------------

describe('every row Not Guilty', () => {
  it('is not reportable, and the text says there is no entry to make', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith(
        { articleLabel: ART_86, summary: 'Alleged UA, not sustained.', finding: 'Not Guilty' },
        { articleLabel: ART_89, summary: 'Alleged disrespect, not sustained.', finding: 'Not Guilty' }
      ),
    });

    const result = unitDiaryBlock(form);

    expect(result.reportable).toBe(false);
    expect(result.text).toContain('No offense on this NAVMC 10132 carries a Guilty finding.');
    expect(result.text).toContain('There is no unit diary entry to make.');
  });
});

// ---------------------------------------------------------------------------
// 4. A row with a blank finding
// ---------------------------------------------------------------------------

describe('a row with a blank finding', () => {
  it('is excluded with a reason distinguishing unadjudicated from acquitted', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Case still pending review.', finding: '' }),
    });

    const result = unitDiaryBlock(form);

    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toBe('finding is blank, case not yet adjudicated');
    expect(result.excluded[0].reason).not.toBe('finding is Not Guilty');
  });
});

// ---------------------------------------------------------------------------
// 5. Empty accusedEdipi
// ---------------------------------------------------------------------------

describe('empty accusedEdipi', () => {
  it('names item 20 in missing, and the EDIPI line carries a bracketed marker', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      accusedEdipi: '',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.missing).toContain('accused EDIPI (item 20)');
    expect(result.text).toMatch(/EDIPI\s+\[MISSING\]/);
  });
});

// ---------------------------------------------------------------------------
// 6. A punishment entry missing a parameter its code needs
// ---------------------------------------------------------------------------

describe('a punishment entry missing a required parameter', () => {
  it('N06 with no days still returns a block, with that line marked incomplete and named in missing', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      // N06's parameters are ['days', 'suspendedFromDuty'] per navmc10132-punishments.ts.
      // suspendedFromDuty is supplied, days is deliberately omitted.
      punishments: [{ code: 'N06', suspendedFromDuty: false }],
    });

    expect(() => unitDiaryBlock(form)).not.toThrow();
    const result = unitDiaryBlock(form);

    expect(result.text).toMatch(/N06\s+\[incomplete:.*"days".*\]/);
    expect(result.missing.some((m) => m.startsWith('punishment N06:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. An articleLabel not in the article table
// ---------------------------------------------------------------------------

describe('an articleLabel not in the article table', () => {
  it('the row lands in both excluded and missing', () => {
    const badLabel = 'Art. 999  Nonexistent offense';
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith({ articleLabel: badLabel, summary: 'Whatever this was.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].row).toBe('A');
    expect(result.excluded[0].reason).toContain('MCTFS code not found');
    expect(result.missing).toContain(`MCTFS code for row A ("${badLabel}")`);
  });
});

// ---------------------------------------------------------------------------
// 8. intendAppeal blank
// ---------------------------------------------------------------------------

describe('intendAppeal blank', () => {
  it('missing does not name appeal, and the text reads not yet elected', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      intendAppeal: '',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.missing.some((m) => m.toLowerCase().includes('appeal'))).toBe(false);
    expect(result.text).toContain('not yet elected');
  });
});

// ---------------------------------------------------------------------------
// 9. finalAdminUd set, with and without finalAdminDtd
// ---------------------------------------------------------------------------

describe('finalAdminUd set', () => {
  it('with a date, alreadyReported is non-null and the text carries the dated clause', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      finalAdminUd: 'UD 26-001',
      finalAdminDtd: '2026-01-10',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.alreadyReported).toEqual({ ud: 'UD 26-001', dtd: '2026-01-10' });
    expect(result.text).toContain('dated 2026-01-10');
  });

  it('without a date, alreadyReported is still non-null and the text has no dangling dated with nothing after it', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      finalAdminUd: 'UD 26-001',
      finalAdminDtd: '',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.alreadyReported).toEqual({ ud: 'UD 26-001', dtd: '' });
    expect(result.text).not.toContain('dated ');
    expect(result.text).not.toMatch(/dated\s*$/m);
  });
});

// ---------------------------------------------------------------------------
// 10. finalAdminUd empty
// ---------------------------------------------------------------------------

describe('finalAdminUd empty', () => {
  it('alreadyReported is null, missing does not name it, and UD ENTRY reads not yet recorded', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      finalAdminUd: '',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);

    expect(result.alreadyReported).toBeNull();
    expect(result.missing.some((m) => m.toLowerCase().includes('ud'))).toBe(false);
    expect(result.text).toMatch(/UD ENTRY\s+\[not yet recorded\]/);
  });
});

// ---------------------------------------------------------------------------
// 11. No Guilty finding AND finalAdminUd set
// ---------------------------------------------------------------------------

describe('no Guilty finding and finalAdminUd set', () => {
  it('reportable is false, alreadyReported is non-null, and the text carries both warnings', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      finalAdminUd: 'UD 26-002',
      offenses: offensesWith({ articleLabel: ART_86, summary: 'Alleged UA, not sustained.', finding: 'Not Guilty' }),
    });

    const result = unitDiaryBlock(form);

    expect(result.reportable).toBe(false);
    expect(result.alreadyReported).not.toBeNull();
    expect(result.text).toContain('ALREADY REPORTED');
    expect(result.text).toContain('There is no unit diary entry to make.');
  });
});

// ---------------------------------------------------------------------------
// 12. The one that matters most: a Not Guilty row's code must never appear
//     in the reportable OFFENSES section
// ---------------------------------------------------------------------------

describe('a Not Guilty row code must never appear in the reportable OFFENSES section', () => {
  it('with a Guilty row and a Not Guilty row carrying different MCTFS codes, only the Guilty code reaches OFFENSES', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith(
        { articleLabel: ART_86, summary: 'Failed to report as ordered.', finding: 'Guilty' },
        { articleLabel: ART_89, summary: 'Alleged disrespect, not sustained.', finding: 'Not Guilty' }
      ),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);
    const guiltyCode = resolveArticle(ART_86)!.mctfsCode;
    const notGuiltyCode = resolveArticle(ART_89)!.mctfsCode;
    expect(guiltyCode).not.toBe(notGuiltyCode);

    const offenses = offensesSection(result.text);
    expect(offenses).toContain(guiltyCode);
    expect(offenses).not.toMatch(new RegExp(`\\b${notGuiltyCode}\\b`));
  });
});

// ---------------------------------------------------------------------------
// 13. unitDiaryBlock resolves the article code fresh, not from a stored
//     mctfsCode
// ---------------------------------------------------------------------------

describe('unitDiaryBlock resolves the code fresh through resolveArticle', () => {
  it('ignores a wrong stored mctfsCode and emits the code resolved from articleLabel', () => {
    const form = baseForm({
      ...IDENTITY_FIELDS,
      offenses: offensesWith({
        articleLabel: ART_86,
        summary: 'Failed to report as ordered.',
        finding: 'Guilty',
        mctfsCode: 'WRONG-STALE-CODE',
      }),
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });

    const result = unitDiaryBlock(form);
    const correctCode = resolveArticle(ART_86)!.mctfsCode;

    const offenses = offensesSection(result.text);
    expect(offenses).toContain(correctCode);
    expect(offenses).not.toContain('WRONG-STALE-CODE');
  });
});

// ---------------------------------------------------------------------------
// A PENDING APPEAL, which only became reachable when the panel moved earlier.
//
// The panel used to open at item 16, after which nothing could change. It now
// opens at the item 12 signature (Stephen, 2026-08-26), which is before the
// reviewing authority has ruled. Article 15(e), UCMJ and MCM Part V para 7.f
// let that authority set aside, mitigate, remit or suspend the punishment, so
// a block copied while an appeal is out can describe a punishment that will
// not survive item 14.
//
// The flag reports the risk. It does not gate the block, because MCM Part V
// para 7.d(2) makes punishment effective when imposed and an appeal does not
// stay it by itself, so entering it while the appeal is out is a real and
// lawful case.
// ---------------------------------------------------------------------------
describe('appealPending', () => {
  const guilty = {
    ...IDENTITY_FIELDS,
    offenses: offensesWith({
      articleLabel: resolveArticle('Art. 86  Absence without leave')?.formLabel ?? 'Art. 86  Absence without leave',
      summary: 'UA 3 days',
      finding: 'Guilty',
    }),
  };

  it('is TRUE once item 12 states an intent to appeal and item 14 has not ruled', () => {
    const block = unitDiaryBlock(baseForm({ ...guilty, intendAppeal: 'I do intend to appeal.' }));
    expect(block.appealPending).toBe(true);
  });

  it('is FALSE once item 14 carries a decision', () => {
    const block = unitDiaryBlock(
      baseForm({
        ...guilty,
        intendAppeal: 'I do intend to appeal.',
        appealDecision: 'Appeal denied.',
      }),
    );
    expect(block.appealPending).toBe(false);
  });

  it('is FALSE when the accused declined to appeal', () => {
    const block = unitDiaryBlock(
      baseForm({ ...guilty, intendAppeal: 'I do not intend to appeal.' }),
    );
    expect(block.appealPending).toBe(false);
  });

  // A refusal to SIGN the item 12 election is not a statement of intent. The
  // form offers it as a third option on the same control, so a naive
  // "anything but 'do not'" test would caveat every refusal case.
  it('is FALSE when the accused refused to sign the election', () => {
    const block = unitDiaryBlock(
      baseForm({ ...guilty, intendAppeal: 'the accused refuses to sign.' }),
    );
    expect(block.appealPending).toBe(false);
  });

  it('is FALSE on a form where item 12 has not been reached', () => {
    expect(unitDiaryBlock(baseForm(guilty)).appealPending).toBe(false);
  });

  // The caveat is a UI banner, never a line in the copyable block. A clerk
  // pastes that block into MCTFS, and a warning sentence pasted with it would
  // be typed into the record.
  //
  // The block DOES carry an APPEAL line, and must: item 12's answer is part
  // of what the entry reports. What it must not gain is the caution about
  // that answer. The two are told apart by the caution's own words, since
  // asserting on the word "appeal" alone would fail on the data line and
  // tempt someone to delete it.
  it('keeps the caveat out of the copyable text', () => {
    const block = unitDiaryBlock(baseForm({ ...guilty, intendAppeal: 'I do intend to appeal.' }));
    expect(block.appealPending).toBe(true);
    // The data line stays.
    expect(block.text).toContain('I do intend to appeal.');
    // The caution does not.
    for (const word of ['set aside', 'mitigate', 'remit', 'may have to be corrected']) {
      expect(block.text.toLowerCase()).not.toContain(word);
    }
  });
});

// ---------------------------------------------------------------------------
// THE RUC LINE, REMOVED 2026-08-26 ON STEPHEN'S RULING.
//
// It printed `RUC  [not captured in SemperScribe]` on every block, and so on
// every printed worksheet. True and useless: the NAVMC 10132 has no RUC
// field, so no amount of filling the form produces one, and the clerk
// entering this block is working in their own unit's diary and knows their
// own RUC. A permanent placeholder for something that was never going to
// arrive reads as a gap in the handoff rather than a fact about the form.
//
// GUARDED RATHER THAN JUST DELETED. Nothing asserted the line existed, so
// nothing failed when it went, which means nothing would fail if it came
// back either. This is that assertion, inverted.
// ---------------------------------------------------------------------------
describe('the block carries no RUC placeholder', () => {
  const guilty = {
    ...IDENTITY_FIELDS,
    offenses: offensesWith({
      articleLabel: resolveArticle('Art. 86  Absence without leave')?.formLabel ?? '',
      summary: 'UA 3 days',
      finding: 'Guilty',
    }),
  };

  it('prints no RUC label and no "not captured" placeholder', () => {
    const text = unitDiaryBlock(baseForm(guilty)).text;
    expect(text).not.toContain('not captured in SemperScribe');
    expect(text.split('\n').some((line) => /^RUC\b/.test(line))).toBe(false);
  });

  it('still prints the four identity lines around where it used to sit', () => {
    // Guards the guard: a block that lost MARINE, GRADE, EDIPI and UNIT too
    // would pass the assertion above for the wrong reason.
    const text = unitDiaryBlock(baseForm(guilty)).text;
    for (const label of ['MARINE', 'GRADE', 'EDIPI', 'UNIT']) {
      expect(text.split('\n').some((line) => line.startsWith(label))).toBe(true);
    }
  });

  it('keeps UD ENTRY, which is filled by the clerk rather than never arriving', () => {
    const text = unitDiaryBlock(baseForm(guilty)).text;
    expect(text).toContain('UD ENTRY');
    expect(text).toContain('[not yet recorded]');
  });
});
