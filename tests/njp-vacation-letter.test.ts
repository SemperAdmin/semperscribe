// @vitest-environment node
/**
 * The Figure 14-1 hand-off as the page consumes it (owner, 2026-09-26:
 * "Let's wire the vacation letter"). The library name that keeps the UPB
 * findable, the letter fields, and the import package the correspondence
 * editor opens: three numbered paragraphs in print order, reference (a)
 * as the figure cites it, the figure's Copy to, nothing carried over from
 * the UPB that the figure does not print.
 */
import { describe, it, expect } from 'vitest';
import {
  vacationHandoff,
  vacationLetterPackage,
  VACATION_COPY_TO,
  VACATION_REFERENCE,
  VACATION_SSIC,
  VACATION_SUBJ,
} from '@/lib/njp-vacation-handoff';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import type { FormData } from '@/types';

function upb(): FormData {
  return {
    ...(createEmptyNavmc10132Data() as unknown as FormData),
    documentType: 'navmc10132',
    unit: '1st Marine Division',
    accusedName: 'RIVERA, DIEGO M',
    accusedRankGrade: 'LCpl, E3',
    accusedEdipi: '1234567890',
    punishmentDate: '2026-01-15',
    punishments: [{ code: 'N09', days: '14' }],
    suspensions: [{ punishmentIndex: 0, months: '3' }],
  } as unknown as FormData;
}

describe('vacationHandoff', () => {
  it('names the saved UPB by rank and name, and seeds the letter as Figure 14-1 prints it', () => {
    const handoff = vacationHandoff(upb(), 0);
    expect(handoff.name).toBe('NAVMC 10132 - LCpl RIVERA, DIEGO M');
    expect(handoff.seed.documentType).toBe('basic');
    expect(handoff.seed.ssic).toBe(VACATION_SSIC);
    expect(handoff.seed.subj).toBe(VACATION_SUBJ);
    expect(handoff.seed.from).toBe('Commanding Officer, 1st Marine Division');
    expect(String(handoff.seed.to)).toContain('DIEGO M RIVERA');
    expect(handoff.paragraphs.basis).toContain('15 Jan 26');
    expect(handoff.paragraphs.election).toBe('It is my intent to vacate your previously suspended punishment in: FULL/PART');
    expect(handoff.period.suspensionIndex).toBe(0);
  });

  it('refuses a suspension item 7 does not carry', () => {
    expect(() => vacationHandoff(upb(), 3)).toThrow(/No suspension at index 3/);
  });
});

describe('vacationLetterPackage', () => {
  it('is an import payload: three level-1 paragraphs in print order, reference (a), Copy to, nothing else', () => {
    const handoff = vacationHandoff(upb(), 0);
    const pkg = vacationLetterPackage(handoff);
    expect(pkg.formData).toBe(handoff.seed);
    expect(pkg.paragraphs.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(pkg.paragraphs.every((p) => p.level === 1)).toBe(true);
    expect(pkg.paragraphs.map((p) => p.content)).toEqual([
      handoff.paragraphs.basis,
      handoff.paragraphs.election,
      handoff.paragraphs.pointOfContact,
    ]);
    expect(pkg.references).toEqual([VACATION_REFERENCE]);
    expect(pkg.copyTos).toEqual([...VACATION_COPY_TO]);
    expect(pkg.vias).toEqual([]);
    expect(pkg.enclosures).toEqual([]);
    // The UPB's own fields do not ride along: the letter is the figure, not a copy of the form.
    expect('accusedName' in pkg.formData).toBe(false);
    expect('punishments' in pkg.formData).toBe(false);
  });
});
