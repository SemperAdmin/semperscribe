// Vitest suite for src/lib/navmc10132-combination-limits.ts (punishmentFamily
// re-export coverage, familyTotals, combinationFindings) and the V-21
// punishment-combination validator in src/lib/navmc10132-validators-punishment.ts
// that wraps it.
//
// Controlling source, MCM Part V para 5.d, quoted verbatim (see the header of
// navmc10132-combination-limits.ts):
//   (1) Arrest in quarters may not be imposed in combination with restriction;
//   (2) Confinement may not be imposed in combination with correctional
//       custody, extra duties, or restriction;
//   (3) Correctional custody may not be imposed in combination with
//       restriction or extra duties;
//   (4) Restriction and extra duties may be combined to run concurrently, but
//       the combination may not exceed the maximum imposable for extra duties;
//   (5) Subject to (1)-(4), all authorized punishments may be imposed in a
//       single case in the maximum amounts.
// And MCM Part V para 5.b, which states each maximum PER CASE, not per award.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import { createEmptyNavmc10132Data, type Navmc10132PunishmentEntry } from '@/types/navmc';

import { NAVMC_10132_PUNISHMENTS, punishmentFamily } from '@/lib/navmc10132-punishments';

import { familyTotals, combinationFindings } from '@/lib/navmc10132-combination-limits';

import { punishmentCombinationIssues, punishmentIssues } from '@/lib/navmc10132-validators-punishment';

import { getExportBlockers } from '@/lib/letter-validators';

// ---------------------------------------------------------------------------
// Fixture helpers, matching the style in tests/navmc10132-basic-pay.test.ts
// ---------------------------------------------------------------------------

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

/** Finds the one issue whose id matches, or fails the test with a clear message. */
function findIssue(issues: ValidationIssue[], idPrefix: string): ValidationIssue {
  const found = issues.find((i) => i.id.startsWith(idPrefix));
  if (!found) {
    throw new Error(
      `Expected an issue with id starting "${idPrefix}", got: ${issues.map((i) => i.id).join(', ') || '(none)'}`
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// punishmentFamily
// ---------------------------------------------------------------------------

describe('punishmentFamily', () => {
  it('maps N10, N11, N14, N15 to restriction', () => {
    expect(punishmentFamily('N10')).toBe('restriction');
    expect(punishmentFamily('N11')).toBe('restriction');
    expect(punishmentFamily('N14')).toBe('restriction');
    expect(punishmentFamily('N15')).toBe('restriction');
  });

  it('maps N06 and N12 to correctional-custody', () => {
    expect(punishmentFamily('N06')).toBe('correctional-custody');
    expect(punishmentFamily('N12')).toBe('correctional-custody');
  });

  it('maps N09 and N13 to extra-duties', () => {
    expect(punishmentFamily('N09')).toBe('extra-duties');
    expect(punishmentFamily('N13')).toBe('extra-duties');
  });

  it('maps N08 to reduction', () => {
    expect(punishmentFamily('N08')).toBe('reduction');
  });

  it('maps N16 and N17 to admonition', () => {
    expect(punishmentFamily('N16')).toBe('admonition');
    expect(punishmentFamily('N17')).toBe('admonition');
  });

  it('maps N03 to arrest-in-quarters', () => {
    expect(punishmentFamily('N03')).toBe('arrest-in-quarters');
  });

  it('returns null for an unknown code and for the empty string', () => {
    expect(punishmentFamily('N99')).toBeNull();
    expect(punishmentFamily('BOGUS')).toBeNull();
    expect(punishmentFamily('')).toBeNull();
  });

  it('is case and whitespace tolerant: " n09 " resolves the same as "N09"', () => {
    expect(punishmentFamily(' n09 ')).toBe('extra-duties');
  });

  it('anti-drift: every code in NAVMC_10132_PUNISHMENTS has a non-null family', () => {
    // Loops the table itself rather than listing codes by hand, so a future
    // code added to the table without being classified here fails loudly
    // instead of silently falling through as unclassified.
    for (const punishment of NAVMC_10132_PUNISHMENTS) {
      expect(
        punishmentFamily(punishment.code),
        `${punishment.code} has no family classification`
      ).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// familyTotals
// ---------------------------------------------------------------------------

describe('familyTotals', () => {
  it('sums two N09 entries (10 + 4 days) under one extra-duties entry carrying both codes', () => {
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N09', days: '10' },
      { code: 'N09', days: '4' },
    ];
    const totals = familyTotals(entries);
    const extraDuties = totals.get('extra-duties');
    expect(extraDuties).toBeDefined();
    expect(extraDuties!.days).toBe(14);
    expect(extraDuties!.codes).toEqual(['N09', 'N09']);
    expect(totals.size).toBe(1);
  });

  it('marks incomplete when a contributing entry has a blank day count, so the total must not be trusted', () => {
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N09', days: '10' },
      { code: 'N09', days: '' },
    ];
    const totals = familyTotals(entries);
    const extraDuties = totals.get('extra-duties');
    expect(extraDuties).toBeDefined();
    expect(extraDuties!.incomplete).toBe(true);
  });

  it('marks incomplete when a contributing entry has an unparseable day count', () => {
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N09', days: '10' },
      { code: 'N09', days: 'abc' },
    ];
    const totals = familyTotals(entries);
    const extraDuties = totals.get('extra-duties');
    expect(extraDuties).toBeDefined();
    expect(extraDuties!.incomplete).toBe(true);
  });

  it('ceiling is the LOWEST maxDays among contributing codes, because the code actually imposed is what the record says was imposed', () => {
    // N09 caps at 14, N13 caps at 45. A set carrying both is only as lawful
    // as the lower-ceilinged code it actually contains, not the higher one
    // a field-grade commander could have used instead.
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N09', days: '10' },
      { code: 'N13', days: '20' },
    ];
    const totals = familyTotals(entries);
    const extraDuties = totals.get('extra-duties');
    expect(extraDuties).toBeDefined();
    expect(extraDuties!.ceiling).toBe(14);
  });

  it('codes with no days parameter (N08, N07, N16) contribute a family entry but 0 days', () => {
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N08', gradeReducedTo: 'E3' },
      { code: 'N07', dollars: '50' },
      { code: 'N16', oralOrWritten: 'orally' },
    ];
    const totals = familyTotals(entries);

    const reduction = totals.get('reduction');
    expect(reduction).toBeDefined();
    expect(reduction!.days).toBe(0);
    expect(reduction!.incomplete).toBe(false);

    const forfeitureDaysPay = totals.get('forfeiture-days-pay');
    expect(forfeitureDaysPay).toBeDefined();
    expect(forfeitureDaysPay!.days).toBe(0);

    const admonition = totals.get('admonition');
    expect(admonition).toBeDefined();
    expect(admonition!.days).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// combinationFindings — flat prohibitions, 5.d(1)-(3)
// ---------------------------------------------------------------------------

describe('combinationFindings — flat prohibitions (5.d(1)-(3))', () => {
  // Every flat prohibition must fire regardless of authorityPayGrade, since
  // no ceiling figure is involved and there is no reason to stay silent.
  const AUTHORITY_GRADES = ['O3', ''];

  it('N06 + N11 (correctional custody + restriction) fires 5.d(3) whatever authorityPayGrade is', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [
          { code: 'N06', days: '7' },
          { code: 'N11', limits: 'the confines of the unit area', days: '14' },
        ],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toHaveLength(1);
      expect(findings[0].citation).toBe('MCM Part V para 5.d(3)');
    }
  });

  it('N06 + N09 (correctional custody + extra duties) fires 5.d(3) whatever authorityPayGrade is', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [
          { code: 'N06', days: '7' },
          { code: 'N09', days: '10' },
        ],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toHaveLength(1);
      expect(findings[0].citation).toBe('MCM Part V para 5.d(3)');
    }
  });

  it('N12 + N14 fires 5.d(3): the field-grade codes belong to the same families as N06/N11', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [
          { code: 'N12', days: '20' },
          { code: 'N14', limits: 'the confines of the barracks', days: '30' },
        ],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toHaveLength(1);
      expect(findings[0].citation).toBe('MCM Part V para 5.d(3)');
    }
  });

  it('N06 alone raises no finding, whatever authorityPayGrade is', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [{ code: 'N06', days: '7' }],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toEqual([]);
    }
  });

  it('N09 alone raises no finding, whatever authorityPayGrade is', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [{ code: 'N09', days: '10' }],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toEqual([]);
    }
  });

  it('N11 alone raises no finding, whatever authorityPayGrade is', () => {
    for (const authorityPayGrade of AUTHORITY_GRADES) {
      const findings = combinationFindings({
        entries: [{ code: 'N11', limits: 'the confines of the unit area', days: '10' }],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toEqual([]);
    }
  });

  it('5.d(5): a lawful mixed set (reduction + forfeiture + extra duties) raises no finding at all', () => {
    // 5.d(5) permits all authorized punishments to be imposed together, in
    // the maximum amounts, so long as (1)-(4) are respected. None of these
    // three families appear anywhere in the FORBIDDEN_PAIRS list or in the
    // 5.d(4) restriction/extra-duties pairing (restriction is absent here),
    // so nothing should fire.
    const findings = combinationFindings({
      entries: [
        { code: 'N08', gradeReducedTo: 'E3' },
        { code: 'N07', dollars: '7' },
        { code: 'N09', days: '14' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// combinationFindings — 5.d(4) numeric cap
// ---------------------------------------------------------------------------

describe('combinationFindings — 5.d(4) numeric cap', () => {
  it('company grade O3: restriction 14 + extra duties 14 run consecutively, 28 over the 14-day cap', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
        { code: 'N09', days: '14' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('combination-restriction-extra-duties');
    expect(findings[0].citation).toBe('MCM Part V para 5.d(4)');
    expect(findings[0].rule).toContain('28 days');
    expect(findings[0].rule).toContain('14-day maximum');
  });

  it('company grade O3: the same 14+14 set run CONCURRENTLY combines to 14, so no finding', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
        { code: 'N09', days: '14' },
      ],
      authorityPayGrade: 'O3',
      concurrent: true,
    });
    expect(findings).toEqual([]);
  });

  it('a field-grade commander may impose 60 days of restriction alone, but not alongside extra duties: N15 60 + N13 45 concurrently fires', () => {
    // The non-obvious case: field grade authorizes 60 days of restriction on
    // its own (N15's own ceiling), and separately authorizes 45 days of
    // extra duty (N13's own ceiling). Running them concurrently combines to
    // 60, which is over the 45-day maximum imposable for extra duties, even
    // though restriction alone at 60 would have been lawful.
    const findings = combinationFindings({
      entries: [
        { code: 'N15', limits: 'the confines of the air station', days: '60' },
        { code: 'N13', days: '45' },
      ],
      authorityPayGrade: 'O5',
      concurrent: true,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('combination-restriction-extra-duties');
    expect(findings[0].citation).toBe('MCM Part V para 5.d(4)');
    expect(findings[0].rule).toContain('60 days');
    expect(findings[0].rule).toContain('45-day maximum');
  });

  it('field grade O5: N15 restriction 45 + N13 extra duties 45, concurrently, raises no finding', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N15', limits: 'the confines of the air station', days: '45' },
        { code: 'N13', days: '45' },
      ],
      authorityPayGrade: 'O5',
      concurrent: true,
    });
    expect(findings).toEqual([]);
  });

  it('will not state a cap it cannot derive: an unreadable authorityPayGrade silences 5.d(4) even when over the numeric cap', () => {
    for (const authorityPayGrade of ['', 'LtCol']) {
      const findings = combinationFindings({
        entries: [
          { code: 'N11', limits: 'the confines of the unit area', days: '20' },
          { code: 'N09', days: '20' },
        ],
        authorityPayGrade,
        concurrent: false,
      });
      expect(findings, `authorityPayGrade=${JSON.stringify(authorityPayGrade)}`).toEqual([]);
    }
  });

  it('an incomplete restriction day count silences 5.d(4)', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N11', limits: 'the confines of the unit area', days: '' },
        { code: 'N09', days: '10' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings.find((f) => f.id === 'combination-restriction-extra-duties')).toBeUndefined();
  });

  it('an incomplete extra-duties day count silences 5.d(4)', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
        { code: 'N09', days: '' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings.find((f) => f.id === 'combination-restriction-extra-duties')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// combinationFindings — per-case aggregates, MCM Part V para 5.b
// ---------------------------------------------------------------------------

describe('combinationFindings — per-case aggregates (5.b)', () => {
  it('two N09 awards of 10 days each fire, 20 over the 14-day case maximum', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N09', days: '10' },
        { code: 'N09', days: '10' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('combination-aggregate-extra-duties');
    expect(findings[0].citation).toBe('MCM Part V para 5.b');
    expect(findings[0].rule).toContain('20 days');
    expect(findings[0].rule).toContain('14-day maximum');
  });

  it('two N09 awards of 7 days each (14 total) raise no aggregate finding', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N09', days: '7' },
        { code: 'N09', days: '7' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toEqual([]);
  });

  it('a single N09 at 14 raises no aggregate finding: one entry is already clamped at input', () => {
    const findings = combinationFindings({
      entries: [{ code: 'N09', days: '14' }],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toEqual([]);
  });

  it('two N10 restrictions of 10 days each fire, 20 over the 14-day case maximum', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N10', limits: 'the confines of the unit area', days: '10' },
        { code: 'N10', limits: 'the confines of the barracks', days: '10' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].id).toBe('combination-aggregate-restriction');
    expect(findings[0].citation).toBe('MCM Part V para 5.b');
    expect(findings[0].rule).toContain('20 days');
    expect(findings[0].rule).toContain('14-day maximum');
  });

  it('the aggregate rule stays silent when a contributing entry is incomplete', () => {
    const findings = combinationFindings({
      entries: [
        { code: 'N09', days: '10' },
        { code: 'N09', days: '' },
      ],
      authorityPayGrade: 'O3',
      concurrent: false,
    });
    expect(findings.find((f) => f.id === 'combination-aggregate-extra-duties')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// punishmentCombinationIssues (V-21)
// ---------------------------------------------------------------------------

describe('punishmentCombinationIssues (V-21)', () => {
  it('every issue has severity "block" and an id starting "navmc10132-v21-"', () => {
    const form = baseForm({
      njpAuthorityPayGrade: 'O3',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
      ],
    });
    const issues = punishmentCombinationIssues(form);
    expect(issues.length).toBeGreaterThan(0);
    for (const found of issues) {
      expect(found.severity).toBe('block');
      expect(found.id.startsWith('navmc10132-v21-')).toBe(true);
    }
  });

  it('is wired into punishmentIssues: a v21 id surfaces from the aggregate function, not just the leaf', () => {
    const form = baseForm({
      njpAuthorityPayGrade: 'O3',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
      ],
    });
    const issues = punishmentIssues(form);
    findIssue(issues, 'navmc10132-v21-');
  });

  it('reads punishmentsConcurrent from formData: the same set flips between firing and not as the flag flips', () => {
    const entries: Navmc10132PunishmentEntry[] = [
      { code: 'N11', limits: 'the confines of the unit area', days: '14' },
      { code: 'N09', days: '14' },
    ];

    const consecutive = punishmentCombinationIssues(
      baseForm({
        njpAuthorityPayGrade: 'O3',
        punishmentsConcurrent: false,
        punishments: entries,
      })
    );
    expect(consecutive.some((i) => i.id === 'navmc10132-v21-combination-restriction-extra-duties')).toBe(
      true
    );

    const concurrent = punishmentCombinationIssues(
      baseForm({
        njpAuthorityPayGrade: 'O3',
        punishmentsConcurrent: true,
        punishments: entries,
      })
    );
    expect(
      concurrent.some((i) => i.id === 'navmc10132-v21-combination-restriction-extra-duties')
    ).toBe(false);
  });

  it("V-21 stops the export, not merely the compliance list: a 'fail' severity renders as Non-compliant and lets the export through", () => {
    // Correctional custody + restriction: forbidden outright by MCM Part V
    // para 5.d(3). getExportBlockers runs the FULL validator suite, so this
    // fixture trips other unrelated blockers too — assert on the presence
    // of the V-21 prefix, never on the array's length or emptiness.
    const blocking = baseForm({
      njpAuthorityPayGrade: 'O3',
      punishments: [
        { code: 'N06', days: '7' },
        { code: 'N11', limits: 'the confines of the unit area', days: '14' },
      ],
    });
    const blockingIssues = getExportBlockers(blocking, [], [], []);
    expect(blockingIssues.some((i) => i.id.startsWith('navmc10132-v21-'))).toBe(true);

    // Same authority and case, but only the correctional custody: no
    // combination to forbid, so no V-21 issue.
    const compliant = baseForm({
      njpAuthorityPayGrade: 'O3',
      punishments: [{ code: 'N06', days: '7' }],
    });
    const compliantIssues = getExportBlockers(compliant, [], [], []);
    expect(compliantIssues.some((i) => i.id.startsWith('navmc10132-v21-'))).toBe(false);
  });
});
