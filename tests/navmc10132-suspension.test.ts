// Vitest suite for the NAVMC 10132 item 7 suspension engine
// (navmc10132-suspension-render.ts), plus the adjacent W-06 severity fix.
//
// Item 7 was free text, which let a clerk suspend a punishment never
// imposed, "cant suspend somthing that is not imposed" in the reporting
// user's own words. A Navmc10132Suspension now names its punishment by
// index into item 6's structured punishments array rather than carrying a
// copy, so the two cannot drift, and a dangling index is refused rather
// than silently rendered. This suite proves the 1:1 guarantee, plus the
// separate fix promoting W-06 (a days or months value over a code's own
// MCM Part V 5.b ceiling) from a warning to a blocker.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { suspensionOverflowIssues } from '@/lib/navmc10132-validators-punishment';
import { createEmptyNavmc10132Data, type Navmc10132PunishmentEntry, type Navmc10132Suspension } from '@/types/navmc';
import {
  renderPunishment,
  renderSuspension,
  Navmc10132SuspensionRenderError,
} from '@/lib/navmc10132-utils';
import { punishmentParameterCeilingIssues } from '@/lib/navmc10132-validators-punishment';

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

describe('renderSuspension, empty suspensions', () => {
  /**
   * REVERSED 2026-08-26. This asserted NONE with nothing imposed. Stephen:
   * "item 7 cannot show NONE until after they conduct the NJP otherwise its
   * predetermined."
   *
   * NONE IS NOT A NEUTRAL PLACEHOLDER. It asserts the commanding officer
   * considered suspension and declined it, and a suspension is a decision
   * ABOUT an imposed punishment: which one, for how long, remitted on what
   * terms. With item 6 empty there is no decision to record, and printing
   * NONE states an outcome nobody has reached. The item 7 instruction
   * prescribing NONE governs a COMPLETED form, the only kind it was written
   * about.
   */
  it('renders EMPTY with no punishment imposed, because NONE would predetermine', () => {
    const result = renderSuspension([], []);
    expect(result.text).toBe('');
    expect(result.length).toBe(0);
  });

  it('renders exactly NONE even when punishments are imposed but none is suspended', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const result = renderSuspension([], punishments);
    expect(result.text).toBe('NONE');
  });
});

describe('renderSuspension, one suspension states all three required elements', () => {
  it('states the punishment, the length of the suspension, and the automatic remission terms', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '6' }];

    const result = renderSuspension(suspensions, punishments);

    // The specific punishment, item 7 element one.
    expect(result.text).toContain('Extra du for 10 days');
    // The length of the suspension, item 7 element two.
    expect(result.text).toContain('susp for 6 mos');
    // The terms for automatic remission, item 7 element three.
    expect(result.text).toContain('at which time, unless sooner vacated,');
    expect(result.text).toContain('will be remitted w/o further action.');
    expect(result.length).toBe(result.text.length);
  });

  it('prefixes the whole entry with the imposition date, "D Mon YY", when supplied', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '6' }];

    const result = renderSuspension(suspensions, punishments, { impositionDate: '2012-06-02' });

    expect(result.text.startsWith('2 Jun 12, ')).toBe(true);
  });
});

describe('renderSuspension, punishmentIndex out of bounds throws', () => {
  const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];

  it('throws when punishmentIndex is above the top of the array', () => {
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 1, months: '6' }];
    expect(() => renderSuspension(suspensions, punishments)).toThrow(Navmc10132SuspensionRenderError);
  });

  it('throws when punishmentIndex is below the start of the array', () => {
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: -1, months: '6' }];
    expect(() => renderSuspension(suspensions, punishments)).toThrow(Navmc10132SuspensionRenderError);
  });
});

describe('renderSuspension, a missing period throws and names the problem', () => {
  it('throws when a suspension carries neither months nor days', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0 }];

    expect(() => renderSuspension(suspensions, punishments)).toThrow(
      /needs "months" or "days"/,
    );
  });
});

describe('renderSuspension, editing item 6 leaves a dangling item 7 index', () => {
  it('throws rather than emitting a suspension for a punishment no longer imposed', () => {
    // The clerk first books a punishment at index 0 and suspends it.
    const originalPunishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '6' }];
    expect(() => renderSuspension(suspensions, originalPunishments)).not.toThrow();

    // The clerk then removes the punishment from item 6, without touching
    // the suspension. This is the whole point of the fix: item 7 must not
    // go on describing a punishment item 6 no longer carries.
    const afterRemoval: Navmc10132PunishmentEntry[] = [];
    expect(() => renderSuspension(suspensions, afterRemoval)).toThrow(Navmc10132SuspensionRenderError);
  });
});

describe('renderSuspension, two suspensions each read as a complete sentence', () => {
  it('joins two suspensions so each carries its own subject and closing period', () => {
    const punishments: Navmc10132PunishmentEntry[] = [
      { code: 'N09', days: '10' },
      { code: 'N08', gradeReducedTo: 'LCpl' },
    ];
    const suspensions: Navmc10132Suspension[] = [
      { punishmentIndex: 0, months: '6' },
      { punishmentIndex: 1, days: '30' },
    ];

    const result = renderSuspension(suspensions, punishments);
    const sentences = result.text.split('. ').map((s, i, arr) => (i < arr.length - 1 ? `${s}.` : s));

    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toContain('Extra du for 10 days');
    expect(sentences[0]).toContain('extra du will be remitted');
    expect(sentences[1]).toContain('To be red to LCpl');
    expect(sentences[1]).toContain('red will be remitted');
  });
});

describe('renderSuspension, singular and plural of the period', () => {
  it('states 1 mo, singular, for a one month suspension', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '1' }];
    expect(renderSuspension(suspensions, punishments).text).toContain('susp for 1 mo,');
  });

  it('states N mos, plural, for a suspension of more than one month', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N09', days: '10' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '3' }];
    expect(renderSuspension(suspensions, punishments).text).toContain('susp for 3 mos,');
  });

  it('states 1 day, singular, for a one day suspension', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N08', gradeReducedTo: 'LCpl' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, days: '1' }];
    expect(renderSuspension(suspensions, punishments).text).toContain('susp for 1 day,');
  });

  it('states N days, plural, for a suspension of more than one day', () => {
    const punishments: Navmc10132PunishmentEntry[] = [{ code: 'N08', gradeReducedTo: 'LCpl' }];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, days: '5' }];
    expect(renderSuspension(suspensions, punishments).text).toContain('susp for 5 days,');
  });
});

describe('renderSuspension, item 6 and item 7 agree on how a punishment reads', () => {
  it('renders the same punishment text in the suspension clause as renderPunishment renders for item 6', () => {
    const entry: Navmc10132PunishmentEntry = { code: 'N09', days: '10' };
    const punishments: Navmc10132PunishmentEntry[] = [entry];
    const suspensions: Navmc10132Suspension[] = [{ punishmentIndex: 0, months: '6' }];

    const item6Text = renderPunishment(punishments).text;
    const item7Text = renderSuspension(suspensions, punishments).text;

    // Item 7's clause is item 6's rendering of the same entry, trailing
    // period stripped, continued by the suspension clause. Both derive from
    // the SAME renderPunishment call, so they cannot say different things
    // about what the punishment is.
    const strippedItem6 = item6Text.replace(/\.\s*$/, '');
    expect(item7Text.startsWith(strippedItem6)).toBe(true);
  });
});

describe('W-06, promoted from warning to blocker', () => {
  it('reports block, not warn, when entered days exceeds the code own ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N06', days: '10', suspendedFromDuty: false }] });
    const issues = punishmentParameterCeilingIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
  });

  it('reports block, not warn, when entered months exceeds the code own ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '3' }] });
    const issues = punishmentParameterCeilingIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
  });
});

describe('W-06, a code with no maxDays and no maxMonths never produces a ceiling issue', () => {
  it('does not trip at any days or months value for N08, which names neither ceiling', () => {
    const form = baseForm({
      punishments: [{ code: 'N08', gradeReducedTo: 'LCpl', days: '99999', months: '99999' }],
    });
    expect(punishmentParameterCeilingIssues(form)).toEqual([]);
  });
});

describe('V-17, item 7 overflow', () => {
  const base = { documentType: 'navmc10132', punishmentDate: '2026-06-02' } as Record<string, unknown>;
  const two = {
    punishments: [{ code: 'N09', days: '10' }, { code: 'N08', gradeReducedTo: 'LCpl' }],
    suspensions: [{ punishmentIndex: 0, months: '6' }, { punishmentIndex: 1, days: '30' }],
  };

  // Item 7 is a SINGLE LINE field. It clips rather than wrapping, so an
  // over-long entry loses its tail with no visible error on the page.
  it('one suspension fits the field', () => {
    expect(
      suspensionOverflowIssues({ ...base, punishments: [{ code: 'N09', days: '10' }], suspensions: [{ punishmentIndex: 0, months: '6' }] } as never),
    ).toEqual([]);
  });

  it('two suspensions overflow and block the export', () => {
    const issues = suspensionOverflowIssues({ ...base, ...two } as never);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toBe('navmc10132-v17-item7-overflow');
  });

  it('the item 21 escape hatch clears it, mirroring item 6', () => {
    expect(
      suspensionOverflowIssues({ ...base, ...two, suspensionOverflowToItem21: true } as never),
    ).toEqual([]);
  });

  // One defect, one report. The bounds rule owns a dangling index.
  it('stays silent on a dangling index so it is not reported twice', () => {
    expect(
      suspensionOverflowIssues({ ...base, punishments: [{ code: 'N09', days: '10' }], suspensions: [{ punishmentIndex: 7, months: '6' }] } as never),
    ).toEqual([]);
  });
});
