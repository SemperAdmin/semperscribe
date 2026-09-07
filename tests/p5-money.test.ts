// P5 remediation (2026-09): dollar figures, service years, suspension
// periods and MCTFS dollar fields are parsed against the governing rule
// rather than through Number().
//
// Expected values come from the rule, not from the code:
//   - MCO 5800.16 Vol 14 para 010901: forfeiture in whole dollars only.
//   - JAGMAN 0111.i: pay subject to forfeiture is basic pay plus sea or
//     hardship duty pay; DoD FMR Vol 7A Ch 1: daily rate is 1/30 of monthly.
//     E-3 at 0 years on the held table is 2836.80, so seven days' pay is
//     floor(2836.80 / 30 * 7) = 661.
//   - MCM Part V para 6.a(2): a suspension may not exceed six months.
//   - MCTFSPRIUM 70502.1: dollar amounts are five whole-dollar digits with
//     leading zeros, followed by ".00".

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data } from '@/types/navmc';

import { parseDollars, formatDollars } from '@/lib/navmc10132-money';
import {
  forfeitureCeilingIssues,
  forfeitureWholeDollarIssues,
  punishmentParameterCeilingIssues,
} from '@/lib/navmc10132-validators-punishment';
import {
  renderPunishment,
  Navmc10132PunishmentRenderError,
} from '@/lib/navmc10132-punishment-render';
import { mctfsDollars, mctfsNjpStatements } from '@/lib/navmc10132-mctfs';
import { suspensionPeriods, suspensionPeriodFindings } from '@/lib/njp-suspension-period';
import { monthlyBasicPay, forfeitureCeiling, payTableStatus } from '@/lib/navmc10132-basic-pay';
import { parseItem6 } from '@/lib/navmc10132-item6-parse';
import { getExportBlockers } from '@/lib/letter-validators';

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

/** An E-3 with no completed years, dated inside the held table's window. */
function e3(overrides: Record<string, unknown> = {}): FormData {
  return baseForm({
    punishmentDate: '2026-08-25',
    accusedPayGrade: 'E3',
    accusedYearsOfService: '0',
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// parseDollars
// ---------------------------------------------------------------------------

describe('parseDollars', () => {
  it('reads a bare figure, a leading $, thousands commas and surrounding whitespace', () => {
    expect(parseDollars('700')).toEqual({ cents: 70000, dollars: 700 });
    expect(parseDollars('$700')).toEqual({ cents: 70000, dollars: 700 });
    expect(parseDollars('1,200')).toEqual({ cents: 120000, dollars: 1200 });
    expect(parseDollars('$1,200')).toEqual({ cents: 120000, dollars: 1200 });
    expect(parseDollars(' 700 ')).toEqual({ cents: 70000, dollars: 700 });
    expect(parseDollars('$ 1,234,567.89')).toEqual({ cents: 123456789, dollars: 1234567.89 });
  });

  it('reads at most two decimal places', () => {
    expect(parseDollars('50.5')).toEqual({ cents: 5050, dollars: 50.5 });
    expect(parseDollars('50.50')).toEqual({ cents: 5050, dollars: 50.5 });
    expect(parseDollars('50.')).toBeNull();
    expect(parseDollars('50.505')).toBeNull();
    expect(parseDollars('.50')).toBeNull();
  });

  it('is null for anything that is not a dollar figure', () => {
    expect(parseDollars('')).toBeNull();
    expect(parseDollars('   ')).toBeNull();
    expect(parseDollars('seven hundred')).toBeNull();
    expect(parseDollars('7e2')).toBeNull();
    expect(parseDollars('0x10')).toBeNull();
    expect(parseDollars('-700')).toBeNull();
    expect(parseDollars('+700')).toBeNull();
    expect(parseDollars('Infinity')).toBeNull();
    expect(parseDollars('NaN')).toBeNull();
    expect(parseDollars('1,,200')).toBeNull();
    expect(parseDollars('$$700')).toBeNull();
    expect(parseDollars(undefined)).toBeNull();
    expect(parseDollars(700 as unknown as string)).toBeNull();
  });

  it('formatDollars prints one $ with thousands separators and cents only where present', () => {
    expect(formatDollars(120000)).toBe('$1,200');
    expect(formatDollars(70000)).toBe('$700');
    expect(formatDollars(5050)).toBe('$50.50');
    expect(formatDollars(0)).toBe('$0');
  });
});

// ---------------------------------------------------------------------------
// P5-1: V-20 against an E-3 at 0 years, ceiling $661
// ---------------------------------------------------------------------------

describe('P5-1: V-20 blocks every spelling of an over-ceiling forfeiture', () => {
  it('the fixture ceiling is $661', () => {
    const result = forfeitureCeiling({
      status: payTableStatus('2026-08-25'),
      payGrade: 'E3',
      yearsOfService: '0',
    });
    expect(result.kind).toBe('ceiling');
    if (result.kind === 'ceiling') expect(result.ceiling.sevenDaysPay).toBe(661);
  });

  it.each(['700', '$700', '1,200', '$1,200', ' 700 '])(
    'N07 dollars %j blocks export as over the $661 ceiling',
    (dollars) => {
      const issues = forfeitureCeilingIssues(e3({ punishments: [{ code: 'N07', dollars }] }));
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('navmc10132-v20-forfeiture-over-ceiling-0');
      expect(issues[0].severity).toBe('block');
      expect(issues[0].rule).toContain('ceiling at E3 is $661');
      expect(issues[0].rule).not.toContain('$$');
    },
  );

  it('"seven hundred" blocks, naming the text, rather than skipping the check', () => {
    const issues = forfeitureCeilingIssues(
      e3({ punishments: [{ code: 'N07', dollars: 'seven hundred' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toContain('navmc10132-v20-forfeiture-unreadable');
    expect(issues[0].detail).toContain('"seven hundred"');
  });

  it('"7e2" is not a dollar figure and blocks the same way', () => {
    const issues = forfeitureCeilingIssues(e3({ punishments: [{ code: 'N07', dollars: '7e2' }] }));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].detail).toContain('"7e2"');
  });

  it('an unreadable amount blocks even where no ceiling can be computed', () => {
    const issues = forfeitureCeilingIssues(
      baseForm({ punishments: [{ code: 'N07', dollars: 'seven hundred' }] }),
    );
    expect(issues.some((i) => i.id.includes('forfeiture-unreadable') && i.severity === 'block')).toBe(
      true,
    );
  });

  it('a per-month figure with a $ and a comma is compared, not skipped', () => {
    const issues = forfeitureCeilingIssues(
      e3({ punishments: [{ code: 'N04', dollarsPerMonth: '$1,419', months: '2' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].rule).toContain('$1,419 per month');
  });

  it('a lawful figure spelt with a $ and a comma passes', () => {
    expect(
      forfeitureCeilingIssues(e3({ punishments: [{ code: 'N07', dollars: '$661' }] })),
    ).toEqual([]);
  });
});

describe('P5-1: W-07 whole-dollar rule reads the same figures', () => {
  it('"$50.50" draws the whole-dollar issue and it blocks', () => {
    const issues = forfeitureWholeDollarIssues(
      baseForm({ punishments: [{ code: 'N07', dollars: '$50.50' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w07-dollars-N07');
    expect(issues[0].severity).toBe('block');
  });

  it('"$1,200" is whole dollars', () => {
    expect(
      forfeitureWholeDollarIssues(baseForm({ punishments: [{ code: 'N07', dollars: '$1,200' }] })),
    ).toEqual([]);
  });
});

describe('P5-1: the render prints one $ and the normalised figure', () => {
  it('renders "$1,200" as "Forf of $1,200 pay."', () => {
    expect(renderPunishment([{ code: 'N07', dollars: '$1,200' }]).text).toBe('Forf of $1,200 pay.');
  });

  it('renders "1200" as "Forf of $1,200 pay."', () => {
    expect(renderPunishment([{ code: 'N07', dollars: '1200' }]).text).toBe('Forf of $1,200 pay.');
  });

  it('N04 with "$600" a month for 2 months totals $1,200', () => {
    expect(renderPunishment([{ code: 'N04', dollarsPerMonth: '$600', months: '2' }]).text).toBe(
      'Forf of $600 pay per month for 2 months. Total forf $1,200.',
    );
  });

  it('refuses an amount that is not a dollar figure', () => {
    expect(() => renderPunishment([{ code: 'N07', dollars: 'seven hundred' }])).toThrow(
      Navmc10132PunishmentRenderError,
    );
    expect(() => renderPunishment([{ code: 'N07', dollars: '7e2' }])).toThrow(
      Navmc10132PunishmentRenderError,
    );
  });

  it('the rendered figure reads back through the item 6 parser as the normalised entry', () => {
    const text = renderPunishment([{ code: 'N07', dollars: '$1,200' }]).text;
    const parse = parseItem6(text);
    expect(parse.complete).toBe(true);
    expect(parse.entries[0]).toEqual({ code: 'N07', dollars: '1200' });
  });

  it('the parser does not admit a malformed comma group', () => {
    expect(parseItem6('Forf of $1,,200 pay.').complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P5-7: MCTFS whole-dollar field
// ---------------------------------------------------------------------------

describe('P5-7: mctfsDollars and the N04 month count', () => {
  it('mctfsDollars(1001) is "01001"', () => {
    expect(mctfsDollars(1001)).toBe('01001');
  });

  it('mctfsDollars throws on cents rather than truncating them', () => {
    expect(() => mctfsDollars(500.75)).toThrow();
  });

  it('mctfsDollars throws on a figure wider than the five-byte field', () => {
    expect(() => mctfsDollars(123456)).toThrow();
  });

  it('mctfsDollars throws on a negative figure', () => {
    expect(() => mctfsDollars(-5)).toThrow();
  });

  it('N04 with blank months throws from the render as a missing parameter', () => {
    expect(() => renderPunishment([{ code: 'N04', dollarsPerMonth: '250', months: '' }])).toThrow(
      Navmc10132PunishmentRenderError,
    );
    expect(() => renderPunishment([{ code: 'N04', dollarsPerMonth: '250', months: '2.5' }])).toThrow(
      Navmc10132PunishmentRenderError,
    );
  });

  it('the worksheet reports a cents figure as missing rather than truncating it into TTC 283', () => {
    const sheet = mctfsNjpStatements(
      baseForm({
        punishmentDate: '2026-08-25',
        punishments: [{ code: 'N07', dollars: '500.75' }],
      }),
    );
    const forf = sheet.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forf).toBeDefined();
    expect(forf!.text).toContain('[AMT]');
    expect(forf!.text).not.toContain('00500.00');
    expect(sheet.missing.some((m) => /whole dollar/i.test(m))).toBe(true);
  });

  it('the worksheet reads "$1,001" as 01001', () => {
    const sheet = mctfsNjpStatements(
      baseForm({
        punishmentDate: '2026-08-25',
        punishments: [{ code: 'N07', dollars: '$1,001' }],
      }),
    );
    const forf = sheet.statements.find((s) => s.ttc === 'TTC 283 003');
    expect(forf!.text).toContain('FORF $01001.00 FOR 01 MO NJP TOTAL $01001.00');
  });
});

// ---------------------------------------------------------------------------
// P5-6: suspension periods are whole months or whole days
// ---------------------------------------------------------------------------

describe('P5-6: a fractional suspension period is unreadable, never rounded under the cap', () => {
  it('months "6.5" yields no end date or exceeds six months', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6.5' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted === null || period.exceedsSixMonths).toBe(true);
    expect(period.endsOnIfUninterrupted).not.toBe('2026-07-15');
  });

  it('days "180.5" is unreadable', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, days: '180.5' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted).toBeNull();
    expect(period.periodUnreadable).toBe(true);
  });

  it('an unreadable period is reported as a finding naming it unreadable', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6.5' }],
    });
    const findings = suspensionPeriodFindings(form);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule.toLowerCase()).toContain('unreadable period');
    expect(findings[0].detail).toContain('6.5');
  });

  it('a whole-month period still computes and "6" is still lawful', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    const [period] = suspensionPeriods(form);
    expect(period.endsOnIfUninterrupted).toBe('2026-07-15');
    expect(period.exceedsSixMonths).toBe(false);
    expect(period.periodUnreadable).toBe(false);
    expect(suspensionPeriodFindings(form)).toEqual([]);
  });

  it('an empty period is not "unreadable", it is simply not entered', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0 }],
    });
    expect(suspensionPeriods(form)[0].periodUnreadable).toBe(false);
    expect(suspensionPeriodFindings(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P5-12: numeric field gates
// ---------------------------------------------------------------------------

describe('P5-12: years of service and W-06 days are whole non-negative integers', () => {
  it.each(['1e1', '0x10', '2.5', '-1', ' 3 3'])('monthlyBasicPay("E5", %j) is unavailable', (years) => {
    const result = monthlyBasicPay('E5', years);
    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') expect(result.reason).toBe('unreadable-years');
  });

  it('monthlyBasicPay("E5", "10") still reads the Over-10 cell', () => {
    const result = monthlyBasicPay('E5', '10');
    expect(result).toEqual({ kind: 'rate', monthly: 4395.3 });
  });

  it('W-06 flags days "-3"', () => {
    const issues = punishmentParameterCeilingIssues(
      baseForm({ punishments: [{ code: 'N09', days: '-3' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toContain('navmc10132-w06-days');
    expect(issues[0].detail).toContain('"-3"');
  });

  it('W-06 flags fractional days "3.5"', () => {
    const issues = punishmentParameterCeilingIssues(
      baseForm({ punishments: [{ code: 'N09', days: '3.5' }] }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w06-days');
  });

  it('W-06 flags negative and fractional months on N04', () => {
    const negative = punishmentParameterCeilingIssues(
      baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '-1' }] }),
    );
    expect(negative.some((i) => i.id.includes('navmc10132-w06-months'))).toBe(true);
    const fractional = punishmentParameterCeilingIssues(
      baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '1.5' }] }),
    );
    expect(fractional.some((i) => i.id.includes('navmc10132-w06-months'))).toBe(true);
  });

  it('W-06 still passes a lawful whole day count', () => {
    expect(
      punishmentParameterCeilingIssues(baseForm({ punishments: [{ code: 'N09', days: '14' }] })),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P5-3: the pay facts card stores what was typed
// ---------------------------------------------------------------------------

describe('P5-3: sea pay "150.00" prices as 150', () => {
  it('forfeitureCeiling reads "150.00" as $150 of extra pay', () => {
    const result = forfeitureCeiling({
      status: payTableStatus('2026-08-25'),
      payGrade: 'E1',
      yearsOfService: '0',
      seaHardshipDutyPay: '150.00',
    });
    expect(result.kind).toBe('ceiling');
    if (result.kind === 'ceiling') {
      expect(result.ceiling.monthlySubjectToForfeiture).toBeCloseTo(2557.2, 2);
      expect(result.ceiling.sevenDaysPay).toBe(596);
    }
  });

  it('forfeitureCeiling refuses extra pay that is not a dollar figure', () => {
    const result = forfeitureCeiling({
      status: payTableStatus('2026-08-25'),
      payGrade: 'E1',
      yearsOfService: '0',
      seaHardshipDutyPay: '1e2',
    });
    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') expect(result.reason).toBe('unreadable-extra-pay');
  });
});

// ---------------------------------------------------------------------------
// Export-gate proofs, in the house pattern tests/navmc10132-export-gate.test.ts
// scans for: getExportBlockers plus `.id.startsWith(prefix)`.
// ---------------------------------------------------------------------------

describe('P5 blockers reach getExportBlockers', () => {
  it('W-07 dollars with cents blocks export, whole dollars do not', () => {
    const blocking = baseForm({ punishments: [{ code: 'N07', dollars: '$50.50' }] });
    const compliant = baseForm({ punishments: [{ code: 'N07', dollars: '$50' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-w07-dollars-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-w07-dollars-'))).toBe(false);
  });

  it('W-07 dollarsPerMonth with cents blocks export, whole dollars do not', () => {
    const blocking = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100.25', months: '2' }] });
    const compliant = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-w07-dollarsPerMonth-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-w07-dollarsPerMonth-'))).toBe(false);
  });

  it('V-20 unreadable forfeiture blocks export, a readable one under the ceiling does not', () => {
    const blocking = e3({ punishments: [{ code: 'N07', dollars: 'seven hundred' }] });
    const compliant = e3({ punishments: [{ code: 'N07', dollars: '$600' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v20-forfeiture-unreadable-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v20-forfeiture-unreadable-'))).toBe(false);
  });

  it('V-22 unreadable suspension period blocks export, a whole-month one does not', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6.5' }],
    });
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v22-suspension-period-unreadable-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v22-'))).toBe(false);
  });

  it('W-06 negative days blocks export', () => {
    const blocking = baseForm({ punishments: [{ code: 'N09', days: '-3' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-w06-days-'))).toBe(true);
  });
});
