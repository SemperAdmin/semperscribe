// Vitest suite for the NAVMC 10132 derivation engine.
//
// Everything below imports from the barrel, @/lib/navmc10132-utils, rather
// than from the individual modules. The barrel exists so a call site needs
// one import for the whole engine, and the Barrel exports block at the
// bottom of this file proves the barrel actually re-exports what its own
// doc comment promises.
//
// Converted from four standalone node harnesses that ran the same modules
// through esbuild directly: check-booker.mjs, check-punishment.mjs,
// check-remarks.mjs and check-capacity.mjs. Every assertion those four
// harnesses ran is preserved here. Assertions that were bundled together
// under one label in the original harnesses are split into separate it()
// cases, so a failure names the exact rule that broke instead of a group
// of unrelated rules.

import { describe, it, expect } from 'vitest';
import {
  bookerStatement,
  coerceDemand,
  renderPunishment,
  Navmc10132PunishmentRenderError,
  composeRemarks,
  isPrescribedFormat,
  measureText,
  usableWidthOf,
  linesOf,
  fitsInField,
  overflowBy,
  resolveArticle,
  NAVMC_10132_ARTICLES,
  NAVMC_10132_ARTICLE_GROUPS,
  resolvePunishment,
  authoritySatisfies,
  NAVMC_10132_PUNISHMENTS,
  NAVMC_10132_RELEASE_ONE_PUNISHMENTS,
  NAVMC_10132_FIELD_METRICS,
} from '@/lib/navmc10132-utils';

describe('Booker statement engine', () => {
  // The item 2 BOOKER field looks like static artwork on the printed blank,
  // but it is actually rewritten by three identical on-blur handlers in the
  // form's own PDF JavaScript, and the blank ships with the acceptance
  // sentence already stored. A fill of a refusal case would state that the
  // accused accepted NJP if this engine picked the wrong branch, or picked
  // branches in the wrong order.

  // These three strings mirror NAVMC_10132_DEMAND from @/types/navmc. They
  // are copied here as literals, the same way the original harness copied
  // them, because the demand strings are not part of the engine barrel's
  // own promise.
  const DEMAND = {
    ACCEPT:
      'I do not demand trial and will accept non-judicial punishment, subject to my right of appeal.',
    REFUSE: 'I demand trial and refuse non-judicial punishment.',
    VESSEL: 'I cannot demand trial because I am attached to or embarked upon a vessel.',
  };

  const EXPECT = {
    VESSEL:
      '(No Booker statement due to the vessel exception, United States v. Mack, 9 M.J. 300, 320 (C.M.A. 1980).)',
    REFUSED_TO_SIGN: '(No Booker statement due to refusal to sign.)',
    REFUSED_NJP: '(No Booker statement due to refusal of NJP.)',
    NO_COUNSEL: '(No Booker statement; no opportunity to consult with counsel.)',
    ACCEPTANCE:
      'BOOKER STATEMENT: Having been advised of the above and fully understanding my rights, I choose to accept NJP.',
  };

  it('vessel exception produces the vessel statement', () => {
    expect(bookerStatement(DEMAND.VESSEL, 'have', false)).toBe(EXPECT.VESSEL);
  });

  it('refusal to sign produces the refused-to-sign statement', () => {
    expect(bookerStatement(DEMAND.ACCEPT, 'have', true)).toBe(EXPECT.REFUSED_TO_SIGN);
  });

  it('a standing demand to refuse NJP produces the refused-NJP statement', () => {
    expect(bookerStatement(DEMAND.REFUSE, 'have', false)).toBe(EXPECT.REFUSED_NJP);
  });

  it('no counsel opportunity produces the no-counsel statement', () => {
    expect(bookerStatement(DEMAND.ACCEPT, 'have not', false)).toBe(EXPECT.NO_COUNSEL);
  });

  it('acceptance produces the acceptance statement', () => {
    expect(bookerStatement(DEMAND.ACCEPT, 'have', false)).toBe(EXPECT.ACCEPTANCE);
  });

  it('no branch matches on an empty demand', () => {
    expect(bookerStatement('', 'have', false)).toBe('');
  });

  it('no branch matches when every input is empty', () => {
    expect(bookerStatement('', '', false)).toBe('');
  });

  it('vessel exception beats refusal to sign', () => {
    expect(bookerStatement(DEMAND.VESSEL, 'have', true)).toBe(EXPECT.VESSEL);
  });

  it('refusal to sign beats a standing demand to refuse NJP', () => {
    expect(bookerStatement(DEMAND.REFUSE, 'have', true)).toBe(EXPECT.REFUSED_TO_SIGN);
  });

  it('refusal to sign beats no counsel opportunity', () => {
    expect(bookerStatement(DEMAND.ACCEPT, 'have not', true)).toBe(EXPECT.REFUSED_TO_SIGN);
  });

  it('a standing demand to refuse NJP beats no counsel opportunity', () => {
    expect(bookerStatement(DEMAND.REFUSE, 'have not', false)).toBe(EXPECT.REFUSED_NJP);
  });

  it('no counsel opportunity beats acceptance', () => {
    expect(bookerStatement(DEMAND.ACCEPT, 'have not', false)).toBe(EXPECT.NO_COUNSEL);
  });

  it('coerceDemand flips ACCEPT to REFUSE when the accused refused to sign', () => {
    expect(coerceDemand(DEMAND.ACCEPT, true)).toBe(DEMAND.REFUSE);
  });

  it('coerceDemand leaves ACCEPT alone when the accused did not refuse to sign', () => {
    expect(coerceDemand(DEMAND.ACCEPT, false)).toBe(DEMAND.ACCEPT);
  });

  it('coerceDemand leaves VESSEL alone when the accused refused to sign', () => {
    expect(coerceDemand(DEMAND.VESSEL, true)).toBe(DEMAND.VESSEL);
  });

  it('coerceDemand leaves VESSEL alone when the accused did not refuse to sign', () => {
    expect(coerceDemand(DEMAND.VESSEL, false)).toBe(DEMAND.VESSEL);
  });

  it('coerceDemand leaves REFUSE alone when the accused refused to sign', () => {
    expect(coerceDemand(DEMAND.REFUSE, true)).toBe(DEMAND.REFUSE);
  });

  it('coerceDemand leaves REFUSE alone when the accused did not refuse to sign', () => {
    expect(coerceDemand(DEMAND.REFUSE, false)).toBe(DEMAND.REFUSE);
  });

  it('coerceDemand leaves an empty demand alone', () => {
    expect(coerceDemand('', true)).toBe('');
  });
});

describe('Punishment renderer', () => {
  // Item 6 is free text on the printed form. This module composes it from
  // structured codes instead, so the export gate can check ceilings and
  // authority grade without parsing prose, and so the app can measure the
  // rendered result against a field that clips silently at 123 characters
  // with no visual warning. A renderer that fills the wrong template, or
  // that gets the join or suspension clause wrong, produces exactly that
  // kind of silently wrong punishment record.

  it('restriction without suspension renders MCO example (1)', () => {
    const { text } = renderPunishment([
      {
        code: 'N11',
        limits: 'HQSVCCo, 1st Bn, 3d Mar',
        days: '14',
        suspendedFromDuty: false,
      },
    ]);
    expect(text).toBe(
      'Restr to the limits of HQSVCCo, 1st Bn, 3d Mar for 14 days, w/o susp fr du.'
    );
  });

  it('restriction without suspension renders example (1) to 75 characters', () => {
    const { length } = renderPunishment([
      {
        code: 'N11',
        limits: 'HQSVCCo, 1st Bn, 3d Mar',
        days: '14',
        suspendedFromDuty: false,
      },
    ]);
    expect(length).toBe(75);
  });

  it('forfeiture total is computed from dollars per month times months, not passed in', () => {
    const { text } = renderPunishment([
      { code: 'N04', dollarsPerMonth: '250', months: '2' },
    ]);
    expect(text).toBe('Forf of $250 pay per month for 2 months. Total forf $500.');
  });

  it('correctional custody with suspension renders MCO example (3)', () => {
    const { text } = renderPunishment([{ code: 'N06', days: '7', suspendedFromDuty: true }]);
    expect(text).toBe('Corr cust for 7 days w/susp fr du.');
  });

  it('correctional custody without suspension renders MCO example (4)', () => {
    const { text } = renderPunishment([{ code: 'N06', days: '6', suspendedFromDuty: false }]);
    expect(text).toBe('Corr cust for 6 days w/o susp fr du.');
  });

  // MCO 5800.16 Vol 14 para 011105.F's own worked example (5) orders its
  // restriction clause as "w/susp fr du for 14 days", the reverse of the
  // same MCO's worked example (1), "for 14 days, w/susp fr du". No single
  // template can match both orderings, because the two published examples
  // contradict each other, not because of a gap in this module. This
  // module standardizes on example (1)'s order, the order six of the
  // seventeen code templates already encode, and adds concurrency as a
  // set-level option. The test below is example (5) re-expressed in that
  // canonical order, which is exactly reproducible, in place of the
  // verbatim MCO string, which this module cannot and should not produce.
  it('MCO example (5) is only reachable in canonical clause order', () => {
    const concurrentEntries = [
      {
        code: 'N11',
        limits: 'place of mess, bil, du and worship and most dir route to and fr',
        days: '14',
        suspendedFromDuty: false,
      },
      { code: 'N09', days: '14' },
    ];
    const { text } = renderPunishment(concurrentEntries, { concurrent: true });
    expect(text).toBe(
      'Restr to the limits of place of mess, bil, du and worship and most dir route to and fr for 14 days, w/o susp fr du, and extra du for 14 days, to run concurrently.'
    );
  });

  it('canonical-order example (5) renders to 162 characters', () => {
    const concurrentEntries = [
      {
        code: 'N11',
        limits: 'place of mess, bil, du and worship and most dir route to and fr',
        days: '14',
        suspendedFromDuty: false,
      },
      { code: 'N09', days: '14' },
    ];
    const { length } = renderPunishment(concurrentEntries, { concurrent: true });
    expect(length).toBe(162);
  });

  it('omitting the concurrent option leaves out the concurrently phrase', () => {
    const concurrentEntries = [
      {
        code: 'N11',
        limits: 'place of mess, bil, du and worship and most dir route to and fr',
        days: '14',
        suspendedFromDuty: false,
      },
      { code: 'N09', days: '14' },
    ];
    const { text } = renderPunishment(concurrentEntries);
    expect(text).not.toContain('concurrently');
  });

  it('an explicit concurrent false leaves out the concurrently phrase', () => {
    const concurrentEntries = [
      {
        code: 'N11',
        limits: 'place of mess, bil, du and worship and most dir route to and fr',
        days: '14',
        suspendedFromDuty: false,
      },
      { code: 'N09', days: '14' },
    ];
    const { text } = renderPunishment(concurrentEntries, { concurrent: false });
    expect(text).not.toContain('concurrently');
  });

  it('concurrent true with a single entry appends nothing, since concurrency needs two', () => {
    const { text } = renderPunishment([{ code: 'N09', days: '14' }], { concurrent: true });
    expect(text).toBe('Extra du for 14 days.');
  });

  it('reduction and reprimand join with ", and " per MCO example (6)', () => {
    const { text } = renderPunishment([
      { code: 'N08', gradeReducedTo: 'LCpl, E-3' },
      { code: 'N17', oralOrWritten: 'orally' },
    ]);
    expect(text).toBe('To be red to LCpl, E-3, and to be orally reprimanded.');
  });

  it('an unknown punishment code throws rather than rendering silently', () => {
    expect(() => renderPunishment([{ code: 'N99' }])).toThrow(Navmc10132PunishmentRenderError);
  });
});

describe('Remark composer', () => {
  // Item 21 has ten prescribed formats required in chronological order.
  // Free text alone guarantees format drift, and format drift is what a
  // legal review finds. Every kind below is checked both for its exact
  // rendered wording and, since composeRemarks and isPrescribedFormat are
  // meant to agree with each other, for round-tripping back through the
  // validator that flags a hand-edited line as non-conforming.

  const offenses = {
    date: '2026-01-05',
    kind: 'additional-offenses' as const,
    detail:
      'F. Art 92  Failure to obey order. UA 2026-01-01, Camp Pendleton. G.\n' +
      'G. Art 128  Assault. Struck LCpl Doe 2026-01-02, barracks. NG.',
  };
  const offensesExpected =
    '2026-01-05 ITEM 1: Additional Offenses:\n' +
    '            F. Art 92  Failure to obey order. UA 2026-01-01, Camp Pendleton. G.\n' +
    '            G. Art 128  Assault. Struck LCpl Doe 2026-01-02, barracks. NG.';

  it('additional-offenses renders as an ITEM 1 header with lettered continuation lines', () => {
    expect(composeRemarks([offenses])).toBe(offensesExpected);
  });

  const offensesLines = offensesExpected.split('\n');
  it('additional-offenses header line reads as prescribed format', () => {
    expect(isPrescribedFormat(offensesLines[0])).toBe(true);
  });
  it('additional-offenses first continuation line reads as prescribed format', () => {
    expect(isPrescribedFormat(offensesLines[1])).toBe(true);
  });
  it('additional-offenses second continuation line reads as prescribed format', () => {
    expect(isPrescribedFormat(offensesLines[2])).toBe(true);
  });

  const forwarded = { date: '2026-01-06', kind: 'forwarded' as const, detail: 'trial by special court-martial' };
  const forwardedExpected = '2026-01-06 ITEM 2: Fwd to Bn/Sqn CO recom trial by special court-martial.';
  it('forwarded renders as an ITEM 2 recommendation sentence', () => {
    expect(composeRemarks([forwarded])).toBe(forwardedExpected);
  });
  it('a rendered forwarded line reads as prescribed format', () => {
    expect(isPrescribedFormat(forwardedExpected)).toBe(true);
  });

  const susVacNjp = {
    date: '2026-01-07',
    kind: 'suspension-vacated-njp' as const,
    detail: 'Extra duties for 14 days susp on 2026-01-01',
  };
  const susVacNjpExpected = '2026-01-07 ITEM 7: Extra duties for 14 days susp on 2026-01-01 vacated.';
  it('suspension-vacated-njp renders as an ITEM 7 vacation sentence', () => {
    expect(composeRemarks([susVacNjp])).toBe(susVacNjpExpected);
  });
  it('a rendered suspension-vacated-njp line reads as prescribed format', () => {
    expect(isPrescribedFormat(susVacNjpExpected)).toBe(true);
  });

  const stayRestriction = { date: '2026-01-08', kind: 'appeal-stayed-restriction' as const, detail: '3 Jan 26' };
  const stayRestrictionExpected =
    '2026-01-08 ITEM 13: Appeal submitted 3 Jan 26, five days elapsed with no action. Punishment of restriction stayed.';
  it('appeal-stayed-restriction renders as the fixed ITEM 13 restriction sentence', () => {
    expect(composeRemarks([stayRestriction])).toBe(stayRestrictionExpected);
  });
  it('a rendered appeal-stayed-restriction line reads as prescribed format', () => {
    expect(isPrescribedFormat(stayRestrictionExpected)).toBe(true);
  });

  const stayExtraDuties = { date: '2026-01-09', kind: 'appeal-stayed-extra-duties' as const, detail: '4 Jan 26' };
  const stayExtraDutiesExpected =
    '2026-01-09 ITEM 13: Appeal submitted 4 Jan 26, five days elapsed with no action. Punishment of extra duties stayed.';
  it('appeal-stayed-extra-duties renders as the fixed ITEM 13 extra-duties sentence', () => {
    expect(composeRemarks([stayExtraDuties])).toBe(stayExtraDutiesExpected);
  });
  it('a rendered appeal-stayed-extra-duties line reads as prescribed format', () => {
    expect(isPrescribedFormat(stayExtraDutiesExpected)).toBe(true);
  });

  const denied = { date: '2026-01-10', kind: 'appeal-denied' as const, detail: 'untimely submission' };
  const deniedExpected = '2026-01-10 ITEM 14: Appeal denied, untimely submission.';
  it('appeal-denied renders as an ITEM 14 denial sentence', () => {
    expect(composeRemarks([denied])).toBe(deniedExpected);
  });
  it('a rendered appeal-denied line reads as prescribed format', () => {
    expect(isPrescribedFormat(deniedExpected)).toBe(true);
  });

  const granted = {
    date: '2026-01-11',
    kind: 'appeal-granted' as const,
    detail: 'reduction in punishment to 7 days restriction',
  };
  const grantedExpected = '2026-01-11 ITEM 14: Appeal granted, reduction in punishment to 7 days restriction.';
  it('appeal-granted renders as an ITEM 14 grant sentence', () => {
    expect(composeRemarks([granted])).toBe(grantedExpected);
  });
  it('a rendered appeal-granted line reads as prescribed format', () => {
    expect(isPrescribedFormat(grantedExpected)).toBe(true);
  });

  const susVacAppeal = {
    date: '2026-01-12',
    kind: 'suspension-vacated-appeal' as const,
    detail: 'Reduction to E-3 susp on 2026-01-11',
  };
  const susVacAppealExpected = '2026-01-12 ITEM 14: Reduction to E-3 susp on 2026-01-11 vacated.';
  it('suspension-vacated-appeal renders as an ITEM 14 vacation sentence', () => {
    expect(composeRemarks([susVacAppeal])).toBe(susVacAppealExpected);
  });
  it('a rendered suspension-vacated-appeal line reads as prescribed format', () => {
    expect(isPrescribedFormat(susVacAppealExpected)).toBe(true);
  });

  const setAside = { date: '2026-01-13', kind: 'set-aside' as const, detail: 'Forfeiture of $500 pay' };
  const setAsideExpected =
    '2026-01-13 ITEM 14: Forfeiture of $500 pay, is set aside. All rights, privileges and property affected will be restored.';
  it('set-aside renders as an ITEM 14 restoration sentence', () => {
    expect(composeRemarks([setAside])).toBe(setAsideExpected);
  });
  it('a rendered set-aside line reads as prescribed format', () => {
    expect(isPrescribedFormat(setAsideExpected)).toBe(true);
  });

  const victims = {
    date: '2026-01-14',
    kind: 'additional-victims' as const,
    detail: 'F. Civilian (spouse) Female White Not Hispanic or Latino\nG. Military Male Black Unknown',
  };
  const victimsExpected =
    '2026-01-14 ITEM 22: Additional Victims:\n' +
    '            F. Civilian (spouse) Female White Not Hispanic or Latino\n' +
    '            G. Military Male Black Unknown';
  it('additional-victims renders as an ITEM 22 header with lettered continuation lines', () => {
    expect(composeRemarks([victims])).toBe(victimsExpected);
  });

  const victimsLines = victimsExpected.split('\n');
  it('additional-victims header line reads as prescribed format', () => {
    expect(isPrescribedFormat(victimsLines[0])).toBe(true);
  });
  it('additional-victims first continuation line reads as prescribed format', () => {
    expect(isPrescribedFormat(victimsLines[1])).toBe(true);
  });
  it('additional-victims second continuation line reads as prescribed format', () => {
    expect(isPrescribedFormat(victimsLines[2])).toBe(true);
  });

  it('remarks sort chronologically with equal dates keeping input order', () => {
    const unordered = [
      { date: '2026-03-01', kind: 'forwarded' as const, detail: 'later same-day, first in input' },
      { date: '2026-02-01', kind: 'appeal-denied' as const, detail: 'middle date' },
      { date: '2026-01-01', kind: 'appeal-granted' as const, detail: 'earliest date' },
      { date: '2026-03-01', kind: 'appeal-denied' as const, detail: 'later same-day, second in input' },
    ];
    const expectedOrder = [
      '2026-01-01 ITEM 14: Appeal granted, earliest date.',
      '2026-02-01 ITEM 14: Appeal denied, middle date.',
      '2026-03-01 ITEM 2: Fwd to Bn/Sqn CO recom later same-day, first in input.',
      '2026-03-01 ITEM 14: Appeal denied, later same-day, second in input.',
    ].join('\n');
    expect(composeRemarks(unordered)).toBe(expectedOrder);
  });

  it('freeText alone, with no structured block, needs no separator', () => {
    expect(composeRemarks([], 'Only free text, no structured block')).toBe(
      'Only free text, no structured block'
    );
  });

  it('no remarks and no freeText yields an empty string', () => {
    expect(composeRemarks([], '')).toBe('');
  });

  it('a structured block alone, with no freeText, carries no trailing separator', () => {
    expect(composeRemarks([denied])).toBe(deniedExpected);
  });

  it('freeText is appended after the structured block with a blank-line separator', () => {
    expect(composeRemarks([denied], 'A trailing note added by the recorder.')).toBe(
      `${deniedExpected}\n\nA trailing note added by the recorder.`
    );
  });

  it('a near-miss with an inserted word is rejected as prescribed format', () => {
    expect(isPrescribedFormat('2026-08-14 ITEM 14: Appeal was denied, untimely.')).toBe(false);
  });

  it('a fixed ITEM 13 sentence under the wrong item number is rejected', () => {
    expect(isPrescribedFormat('2026-08-14 ITEM 14: Punishment of restriction stayed.')).toBe(false);
  });

  it('unstructured free text is rejected as prescribed format', () => {
    expect(isPrescribedFormat('just some free text with no structure')).toBe(false);
  });
});

describe('Field capacity', () => {
  // Every widget on this form is Arial 8pt and none of them auto-shrink.
  // A validator that only counts characters passes strings that a
  // proportional font overflows, because Arial is not monospaced, and a
  // string built from wide letters takes real, measurable room that a
  // same-length string of narrow letters does not.

  it("measureText('G', 8) is about 6.2pt", () => {
    expect(measureText('G', 8)).toBeCloseTo(6.2, 1);
  });

  it("measureText('Guilty', 8) is about 20.45pt", () => {
    expect(measureText('Guilty', 8)).toBeCloseTo(20.45, 1);
  });

  it("'6 PUNISHMENT IMPOSED' usable width is about 433pt", () => {
    expect(usableWidthOf('6 PUNISHMENT IMPOSED')).toBeCloseTo(433, 0);
  });

  it('the long MCO worked example does not fit in 6 PUNISHMENT IMPOSED', () => {
    const longPunishment =
      'Restr to the limits of place of mess, bil, du and worship and most ' +
      'dir route to and fr w/o susp fr du for 14 days and extra du for 14 ' +
      'days, to run concurrently.';
    expect(fitsInField('6 PUNISHMENT IMPOSED', longPunishment)).toBe(false);
  });

  it('the long MCO worked example overflows 6 PUNISHMENT IMPOSED by a positive amount', () => {
    const longPunishment =
      'Restr to the limits of place of mess, bil, du and worship and most ' +
      'dir route to and fr w/o susp fr du for 14 days and extra du for 14 ' +
      'days, to run concurrently.';
    expect(overflowBy('6 PUNISHMENT IMPOSED', longPunishment) > 0).toBe(true);
  });

  it('the short MCO worked example fits in 6 PUNISHMENT IMPOSED', () => {
    const shortPunishment = 'Restr to limits of H&S Co, 1st Bn, 6th Mar for 14 days w/o susp fr du.';
    expect(fitsInField('6 PUNISHMENT IMPOSED', shortPunishment)).toBe(true);
  });

  it('the short MCO worked example has zero overflow', () => {
    const shortPunishment = 'Restr to limits of H&S Co, 1st Bn, 6th Mar for 14 days w/o susp fr du.';
    expect(overflowBy('6 PUNISHMENT IMPOSED', shortPunishment)).toBe(0);
  });

  it("a same-length 'W' string overflows 1A SUMMARY, where a proportional font is wide", () => {
    const wString = 'W'.repeat(60);
    expect(fitsInField('1A SUMMARY', wString)).toBe(false);
  });

  it("a same-length 'i' string fits 1A SUMMARY, where a proportional font is narrow", () => {
    const iString = 'i'.repeat(60);
    expect(fitsInField('1A SUMMARY', iString)).toBe(true);
  });

  it('a single very long line fails 21 REMARKS', () => {
    const oneLongLine = 'word '.repeat(200).trim();
    expect(fitsInField('21 REMARKS', oneLongLine)).toBe(false);
  });

  it('the same content, wrapped by the caller to fit each line, passes 21 REMARKS', () => {
    // fitsInField checks each newline-separated line independently against
    // usable width and does not itself wrap text, so a value the caller
    // has already wrapped to fit should pass.
    function wrapToWidth(text: string, fontSize: number, maxWidth: number): string {
      const words = text.split(' ');
      const lines: string[] = [];
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (measureText(candidate, fontSize) <= maxWidth) {
          current = candidate;
        } else {
          if (current) lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
      return lines.join('\n');
    }

    const oneLongLine = 'word '.repeat(200).trim();
    const remarksUsableWidth = usableWidthOf('21 REMARKS');
    const wrappedContent = wrapToWidth(oneLongLine, 8, remarksUsableWidth);
    expect(fitsInField('21 REMARKS', wrappedContent)).toBe(true);
  });

  it('an unknown field name throws out of fitsInField, rather than returning a silent true', () => {
    expect(() => fitsInField('99 DOES NOT EXIST', 'anything')).toThrow(
      /is not a NAVMC 10132 text field/
    );
  });

  it('an unknown field name throws out of usableWidthOf', () => {
    expect(() => usableWidthOf('99 DOES NOT EXIST')).toThrow(/is not a NAVMC 10132 text field/);
  });

  it('an unknown field name throws out of overflowBy', () => {
    expect(() => overflowBy('99 DOES NOT EXIST', 'anything')).toThrow(
      /is not a NAVMC 10132 text field/
    );
  });

  it("usableWidthOf('6 PUNISHMENT IMPOSED') is still about 432.52pt after the rewrite", () => {
    expect(usableWidthOf('6 PUNISHMENT IMPOSED')).toBeCloseTo(432.52, 2);
  });

  it('every name in NAVMC_10132_FIELD_METRICS resolves without throwing', () => {
    for (const name of Object.keys(NAVMC_10132_FIELD_METRICS)) {
      usableWidthOf(name);
    }
  });

  it("a choice field name ('1A FINDING') throws, since only text fields are in the table", () => {
    expect(() => usableWidthOf('1A FINDING')).toThrow(/is not a NAVMC 10132 text field/);
  });

  it("a signature field name ('9 NJP AUTHORITY SIGNATURE') throws, for the same reason", () => {
    expect(() => usableWidthOf('9 NJP AUTHORITY SIGNATURE')).toThrow(
      /is not a NAVMC 10132 text field/
    );
  });
});

describe('Barrel exports', () => {
  // The barrel exists so a call site needs one import for the whole
  // engine. This block proves that promise holds, that every runtime name
  // the barrel's own doc comment claims to re-export is actually defined,
  // grouped by the module each re-export statement pulls from.

  it('re-exports the booker statement engine', () => {
    expect(bookerStatement).toBeDefined();
    expect(coerceDemand).toBeDefined();
  });

  it('re-exports the punishment renderer', () => {
    expect(renderPunishment).toBeDefined();
    expect(Navmc10132PunishmentRenderError).toBeDefined();
  });

  it('re-exports the remark composer', () => {
    expect(composeRemarks).toBeDefined();
    expect(isPrescribedFormat).toBeDefined();
  });

  it('re-exports the field capacity checker', () => {
    expect(measureText).toBeDefined();
    expect(usableWidthOf).toBeDefined();
    expect(linesOf).toBeDefined();
    expect(fitsInField).toBeDefined();
    expect(overflowBy).toBeDefined();
  });

  it('re-exports the article table', () => {
    expect(resolveArticle).toBeDefined();
    expect(NAVMC_10132_ARTICLES).toBeDefined();
    expect(NAVMC_10132_ARTICLE_GROUPS).toBeDefined();
  });

  it('re-exports the punishment code table', () => {
    expect(resolvePunishment).toBeDefined();
    expect(authoritySatisfies).toBeDefined();
    expect(NAVMC_10132_PUNISHMENTS).toBeDefined();
    expect(NAVMC_10132_RELEASE_ONE_PUNISHMENTS).toBeDefined();
  });

  it('re-exports the field metrics table', () => {
    expect(NAVMC_10132_FIELD_METRICS).toBeDefined();
  });
});
