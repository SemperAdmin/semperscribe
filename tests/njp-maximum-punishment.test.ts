// Vitest suite for src/lib/njp-maximum-punishment.ts, the A-1-d
// paragraph-3 maximum-punishment ceiling.
//
// The anti-drift tests matter more than the literal-number tests: they
// recompute each ceiling directly off NAVMC_10132_PUNISHMENTS (the same
// table the item 6 picker reads) rather than hardcoding an expectation, so
// a future edit to a code's maxDays/maxMonths/maxDaysPay breaks the test
// that actually protects against the advisement and the picker
// disagreeing, not just a copy of today's numbers.

import { describe, it, expect } from 'vitest';
import {
  resolveAuthorityLevel,
  maximumPunishment,
  renderMaximumPunishment,
} from '@/lib/njp-maximum-punishment';
import {
  NAVMC_10132_PUNISHMENTS,
  authoritySatisfies,
  releaseOnePunishmentsFor,
  type Navmc10132Punishment,
} from '@/lib/navmc10132-punishments';

describe('resolveAuthorityLevel', () => {
  it('O1 through O3 resolve to company-grade', () => {
    expect(resolveAuthorityLevel('O1')).toBe('company-grade');
    expect(resolveAuthorityLevel('O2')).toBe('company-grade');
    expect(resolveAuthorityLevel('O3')).toBe('company-grade');
  });

  it('O4 and above resolve to field-grade', () => {
    expect(resolveAuthorityLevel('O4')).toBe('field-grade');
    expect(resolveAuthorityLevel('O5')).toBe('field-grade');
    expect(resolveAuthorityLevel('O6')).toBe('field-grade');
    expect(resolveAuthorityLevel('O10')).toBe('field-grade');
  });

  it('a dash in the grade is stripped before parsing', () => {
    expect(resolveAuthorityLevel('O-5')).toBe('field-grade');
    expect(resolveAuthorityLevel('O-3')).toBe('company-grade');
  });

  it('returns null for anything that is not a readable officer pay grade', () => {
    expect(resolveAuthorityLevel('')).toBeNull();
    expect(resolveAuthorityLevel('E5')).toBeNull();
    expect(resolveAuthorityLevel('W3')).toBeNull();
    expect(resolveAuthorityLevel('LtCol')).toBeNull();
    expect(resolveAuthorityLevel('garbage')).toBeNull();
  });

  it('returns null for a grade number out of the O1-O10 range', () => {
    expect(resolveAuthorityLevel('O0')).toBeNull();
    expect(resolveAuthorityLevel('O11')).toBeNull();
  });
});

/**
 * Recomputes a family's ceiling directly from the code table, the same
 * table authorizedCodes() in the source reads through authoritySatisfies.
 * This does NOT reproduce the source's internal FAMILY_OF map (that map
 * isn't exported); it derives the family instead from the code's own
 * public description text, appliesTo, and releaseOneAvailable fields, so
 * it stays an independent check rather than a restatement of the
 * implementation.
 */
function tableCap(
  descriptionMatches: RegExp,
  authorityGrade: string,
  key: 'maxDays' | 'maxDaysPay' | 'maxMonths',
): number | null {
  const codes = NAVMC_10132_PUNISHMENTS.filter(
    (p: Navmc10132Punishment) =>
      p.appliesTo !== 'officer' &&
      p.releaseOneAvailable &&
      descriptionMatches.test(p.description) &&
      authoritySatisfies(p.requiredAuthority, authorityGrade) === true,
  );
  const values = codes.map((c) => c[key]).filter((v): v is number => typeof v === 'number');
  return values.length === 0 ? null : Math.max(...values);
}

describe('company-grade ceiling', () => {
  const company = maximumPunishment({ authorityPayGrade: 'O3', accusedPayGrade: 'E3' });

  it('resolves to company-grade', () => {
    expect(company).not.toBeNull();
    expect(company!.level).toBe('company-grade');
  });

  it('states the literal ceiling numbers from MCM Part V para 5.b(2)(A)', () => {
    const text = company!.blocks.map((b) => b.text).join(' ');
    expect(text).toContain('Correctional custody for not more than 7 consecutive days.');
    expect(text).toContain('Forfeiture of not more than 7 days\u2019 pay.');
    expect(text).toContain('for not more than 14 consecutive days.'); // extra duties
    expect(text).toContain(
      'Restriction to specified limits, with or without suspension from duty, for not more than 14 consecutive days.',
    );
  });

  it('anti-drift: every number traces back to NAVMC_10132_PUNISHMENTS at O3', () => {
    const text = company!.blocks.map((b) => b.text).join(' ');

    const custodyCap = tableCap(/CORRECTIONAL CUSTODY/, 'O3', 'maxDays');
    const forfDaysCap = tableCap(/FORFEITURE OF NOT MORE THAN \d+ DAYS/, 'O3', 'maxDaysPay');
    const extraDutyCap = tableCap(/EXTRA DUTIES/, 'O3', 'maxDays');
    const restrictionCap = tableCap(/RESTRICTION TO SPECIFIED LIMITS/, 'O3', 'maxDays');

    expect(custodyCap).toBe(7);
    expect(forfDaysCap).toBe(7);
    expect(extraDutyCap).toBe(14);
    expect(restrictionCap).toBe(14);

    expect(text).toContain(`Correctional custody for not more than ${custodyCap} consecutive days.`);
    expect(text).toContain(`Forfeiture of not more than ${forfDaysCap} days\u2019 pay.`);
    expect(text).toContain(`for not more than ${extraDutyCap} consecutive days.`); // extra duties item
    expect(text).toContain(`for not more than ${restrictionCap} consecutive days.`); // restriction item
  });
});

describe('field-grade ceiling', () => {
  const field = maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E5' });

  it('resolves to field-grade', () => {
    expect(field).not.toBeNull();
    expect(field!.level).toBe('field-grade');
  });

  it('states the literal ceiling numbers from MCM Part V para 5.b(2)(B)', () => {
    const text = field!.blocks.map((b) => b.text).join(' ');
    expect(text).toContain('Correctional custody for not more than 30 consecutive days.');
    expect(text).toContain(
      'Forfeiture of not more than one-half of one month’s pay per month for 2 months.',
    );
    expect(text).toContain('for not more than 45 consecutive days.'); // extra duties
    expect(text).toContain(
      'Restriction to specified limits, with or without suspension from duty, for not more than 60 consecutive days.',
    );
  });

  it('anti-drift: every number traces back to NAVMC_10132_PUNISHMENTS at O5', () => {
    const text = field!.blocks.map((b) => b.text).join(' ');

    const custodyCap = tableCap(/CORRECTIONAL CUSTODY/, 'O5', 'maxDays');
    const monthlyCap = tableCap(/ONE-HALF OF ONE MONTH/, 'O5', 'maxMonths');
    const extraDutyCap = tableCap(/EXTRA DUTIES/, 'O5', 'maxDays');
    const restrictionCap = tableCap(/RESTRICTION TO SPECIFIED LIMITS/, 'O5', 'maxDays');

    expect(custodyCap).toBe(30);
    expect(monthlyCap).toBe(2);
    expect(extraDutyCap).toBe(45);
    expect(restrictionCap).toBe(60);

    expect(text).toContain(`Correctional custody for not more than ${custodyCap} consecutive days.`);
    expect(text).toContain(
      `Forfeiture of not more than one-half of one month’s pay per month for ${monthlyCap} months.`,
    );
    expect(text).toContain(`for not more than ${extraDutyCap} consecutive days.`); // extra duties item
    expect(text).toContain(`for not more than ${restrictionCap} consecutive days.`); // restriction item
  });

  it('does NOT also list the 7-days-pay company forfeiture: the monthly forfeiture subsumes it', () => {
    const text = field!.blocks.map((b) => b.text).join(' ');
    expect(text).not.toMatch(/not more than 7 days' pay/);
  });
});

describe('reduction and the USMC E-6 bar', () => {
  it('a Marine (accusedService USMC) at E-6 loses the reduction item, with a citing note', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E6',
      accusedService: 'USMC',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).not.toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes.some((n) => n.includes('MCO 5800.16 Vol 14 para 010302.C'))).toBe(true);
  });

  it('an unset service defaults to USMC (this is a NAVMC form), so E-6 still loses reduction', () => {
    const result = maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E6' });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).not.toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes.some((n) => n.includes('MCO 5800.16 Vol 14 para 010302.C'))).toBe(true);
  });

  it('E-5 keeps the reduction item, bar or no bar', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E5',
      accusedService: 'USMC',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes).toEqual([]);
  });

  it('E-6 in the USN keeps the reduction item: the bar is a Marine Corps policy, not a Navy one', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E6',
      accusedService: 'USN',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes).toEqual([]);
  });

  // MCO 5800.16 Vol 14 para 010302.C sets TWO floors: E-6 for Marines,
  // E-7 for Sailors. The bug fixed 2026-08-24 tested a single hardcoded E-6
  // floor for both services, which wrongly OMITTED the reduction item for a
  // lawfully-reducible Navy E-6. This is the regression test for that fix.
  it('a Sailor (USN) E-6 KEEPS the reduction item: he is below the Navy own E-7 floor', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E6',
      accusedService: 'USN',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes).toEqual([]);
  });

  it('a Sailor (USN) E-7 OMITS the reduction item, with a note naming "Sailor" and "E-7"', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E7',
      accusedService: 'USN',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).not.toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes.some((n) => n.includes('Sailor') && n.includes('E-7'))).toBe(true);
    expect(result!.notes.some((n) => n.includes('MCO 5800.16 Vol 14 para 010302.C'))).toBe(true);
  });

  it('a Marine (USMC) E-6 OMITS the reduction item, with a note naming "Marine" and "E-6"', () => {
    const result = maximumPunishment({
      authorityPayGrade: 'O5',
      accusedPayGrade: 'E6',
      accusedService: 'USMC',
    });
    const text = result!.blocks.map((b) => b.text).join(' ');
    expect(text).not.toMatch(/Reduction to the next inferior pay grade/);
    expect(result!.notes.some((n) => n.includes('Marine') && n.includes('E-6'))).toBe(true);
  });
});

describe('combination limits', () => {
  it('company grade: the concurrency cap equals the company extra-duty ceiling', () => {
    const company = maximumPunishment({ authorityPayGrade: 'O3', accusedPayGrade: 'E3' });
    const tail = company!.blocks.find((b) => b.kind === 'tail')!.text;
    expect(tail).toContain('Correctional custody may not be combined with restriction or extra duties.');
    const extraDutyCap = tableCap(/EXTRA DUTIES/, 'O3', 'maxDays');
    expect(tail).toContain(`the combination may not exceed ${extraDutyCap} days`);
  });

  it('field grade: the concurrency cap equals the field extra-duty ceiling', () => {
    const field = maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E5' });
    const tail = field!.blocks.find((b) => b.kind === 'tail')!.text;
    const extraDutyCap = tableCap(/EXTRA DUTIES/, 'O5', 'maxDays');
    expect(tail).toContain(`the combination may not exceed ${extraDutyCap} days`);
  });

  it('states that, subject to those limits, all of the above may be imposed in the maximum amounts', () => {
    const field = maximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E5' });
    const tail = field!.blocks.find((b) => b.kind === 'tail')!.text;
    expect(tail).toContain('Subject to those limits, all of the above may be imposed in a single case in the maximum amounts.');
  });
});

describe('renderMaximumPunishment', () => {
  it('returns null for an unreadable authority grade', () => {
    expect(renderMaximumPunishment({ authorityPayGrade: '', accusedPayGrade: 'E5' }, 63)).toBeNull();
    expect(renderMaximumPunishment({ authorityPayGrade: 'LtCol', accusedPayGrade: 'E5' }, 63)).toBeNull();
  });

  it('every returned line fits inside a 63-column width, company grade', () => {
    const lines = renderMaximumPunishment({ authorityPayGrade: 'O3', accusedPayGrade: 'E3' }, 63);
    expect(lines).not.toBeNull();
    expect(lines!.length).toBeGreaterThan(0);
    expect(lines!.filter((l) => l.length > 63)).toEqual([]);
  });

  it('every returned line fits inside a 63-column width, field grade', () => {
    const lines = renderMaximumPunishment({ authorityPayGrade: 'O5', accusedPayGrade: 'E5' }, 63);
    expect(lines).not.toBeNull();
    expect(lines!.filter((l) => l.length > 63)).toEqual([]);
  });
});

/**
 * The item 6 picker's own gate. Separate from the A-1-d ceiling, but driven by
 * the same fact: MCM Part V para 5.b(2) splits the enlisted maxima on the GRADE
 * of the imposing officer, so the picker offers a company-grade authority a
 * strictly smaller list than a field-grade one.
 */
describe('releaseOnePunishmentsFor, the item 6 picker gate', () => {
  const codesOf = (list: ReturnType<typeof releaseOnePunishmentsFor>, available: boolean) =>
    list.filter((o) => o.available === available).map((o) => o.punishment.code).sort();

  it('a company-grade authority (O3) is denied every field-grade code', () => {
    const list = releaseOnePunishmentsFor('O3');
    expect(codesOf(list, false)).toEqual(['N04', 'N12', 'N13', 'N14', 'N15']);
    expect(codesOf(list, true)).toEqual(['N06', 'N07', 'N08', 'N09', 'N10', 'N11', 'N16', 'N17']);
  });

  it('a field-grade authority (O4 and O5) is denied nothing in release one', () => {
    for (const grade of ['O4', 'O5', 'O6']) {
      const list = releaseOnePunishmentsFor(grade);
      expect(codesOf(list, false)).toEqual([]);
      expect(list.every((o) => !o.unverified)).toBe(true);
    }
  });

  it('the denial reason names the required grade AND what item 8A actually holds', () => {
    const denied = releaseOnePunishmentsFor('O3').find((o) => o.punishment.code === 'N13');
    expect(denied?.available).toBe(false);
    expect(denied?.reason).toContain('O-4 or above');
    expect(denied?.reason).toContain('815(b)(2)(H)');
    expect(denied?.reason).toContain('Item 8A is O3');
  });

  // Item 8A sits in a LATER section than item 6. Gating on a grade nobody has
  // entered yet would invert the form's own preparation order, so an unreadable
  // 8A offers everything and flags the check as not run.
  it('an unreadable item 8A offers every code but marks the field-grade ones unverified', () => {
    for (const grade of ['', '   ', 'LtCol', 'E5', 'W3']) {
      const list = releaseOnePunishmentsFor(grade);
      expect(codesOf(list, false)).toEqual([]);
      const fieldGrade = list.filter((o) => o.punishment.requiredAuthority === 'field-grade');
      expect(fieldGrade.length).toBeGreaterThan(0);
      expect(fieldGrade.every((o) => o.unverified)).toBe(true);
      // "any"-authority codes are genuinely verified even with 8A unset:
      // nothing about them turns on the grade.
      const anyAuthority = list.filter((o) => o.punishment.requiredAuthority === 'any');
      expect(anyAuthority.every((o) => !o.unverified)).toBe(true);
    }
  });

  it('never offers a code release one withholds, whatever the authority grade', () => {
    for (const grade of ['', 'O3', 'O6']) {
      const codes = releaseOnePunishmentsFor(grade).map((o) => o.punishment.code);
      expect(codes).not.toContain('N01');
      expect(codes).not.toContain('N02');
      expect(codes).not.toContain('N03');
      expect(codes).not.toContain('N05');
    }
  });

  // Anti-drift: the split must come off requiredAuthority in the code table,
  // not off a list of code strings written here or in the component.
  it('the available set is exactly what authoritySatisfies allows at that grade', () => {
    for (const grade of ['O3', 'O5']) {
      const expected = NAVMC_10132_PUNISHMENTS
        .filter((p) => p.releaseOneAvailable)
        .filter((p) => authoritySatisfies(p.requiredAuthority, grade) === true)
        .map((p) => p.code)
        .sort();
      expect(codesOf(releaseOnePunishmentsFor(grade), true)).toEqual(expected);
    }
  });
});
