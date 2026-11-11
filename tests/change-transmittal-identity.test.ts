/**
 * Change Transmittal identity (host report 2026-11-10).
 *
 * 1. The Change Number input is <input type="number">, which hands the
 *    form a string. The schema demanded a number, so every value failed
 *    with "expected number, received string". MCO Chapter Number had the
 *    same defect.
 * 2. Both emitters built the ID-block designation and the underlined
 *    designation line from the SSIC alone. The Parent Directive and the
 *    Change Number never reached the page, so an SSIC of "1500" printed
 *    "MCO 1500" twice and named no change. The transmittal now designates
 *    itself as the parent directive plus "W/CH-n" (owner ruling
 *    2026-11-11, for example "MCO 1500.61 W/CH-2").
 */
import { describe, it, expect } from 'vitest';
import { ChangeTransmittalSchema, MCODefinition } from '@/lib/schemas';
import { getDirectiveDesignation, buildDirectiveTitle } from '@/lib/naval-format-utils';
import type { FormData } from '@/types';

const base = {
  documentType: 'change-transmittal',
  ssic: '1500',
  originatorCode: 'C 461',
  date: '10 Nov 26',
  from: 'Commandant of the Marine Corps',
  to: 'Distribution List',
  subj: 'MARINE CORPS TRAINING',
  parentDirectiveTitle: 'MCO 1500.61',
};

function issuesFor(path: string, data: Record<string, unknown>) {
  const result = ChangeTransmittalSchema.safeParse(data);
  if (result.success) return [];
  return result.error.issues.filter((i) => i.path.join('.') === path).map((i) => i.message);
}

describe('change number input', () => {
  it('accepts the string an <input type="number"> produces', () => {
    expect(issuesFor('changeNumber', { ...base, changeNumber: '2' })).toEqual([]);
  });

  it('still accepts a stored number', () => {
    expect(issuesFor('changeNumber', { ...base, changeNumber: 2 })).toEqual([]);
  });

  it('asks for the number when the box is empty', () => {
    expect(issuesFor('changeNumber', { ...base, changeNumber: '' })).toEqual(['Change number is required']);
  });

  it('refuses zero and fractions', () => {
    expect(issuesFor('changeNumber', { ...base, changeNumber: '0' })).not.toEqual([]);
    expect(issuesFor('changeNumber', { ...base, changeNumber: '1.5' })).not.toEqual([]);
  });
});

describe('MCO chapter number input', () => {
  it('accepts the string an <input type="number"> produces', () => {
    const result = MCODefinition.schema.safeParse({ documentType: 'mco', chapterNumber: '3' });
    const chapterIssues = result.success
      ? []
      : result.error.issues.filter((i) => i.path[0] === 'chapterNumber');
    expect(chapterIssues).toEqual([]);
  });
});

describe('change transmittal designation', () => {
  const ct = (over: Partial<Record<string, unknown>> = {}) =>
    ({ ...base, changeNumber: '2', ...over }) as unknown as FormData;

  it('designates the parent directive and the change number in the ID block', () => {
    expect(getDirectiveDesignation(ct())).toBe('MCO 1500.61 W/CH-2');
  });

  it('prints the same identity on the designation line', () => {
    expect(buildDirectiveTitle(ct())).toBe('MCO 1500.61 W/CH-2');
  });

  it('accepts a numeric change number from a saved package', () => {
    expect(getDirectiveDesignation(ct({ changeNumber: 1 }))).toBe('MCO 1500.61 W/CH-1');
  });

  it('falls back to the SSIC designation until a parent directive is entered', () => {
    expect(getDirectiveDesignation(ct({ parentDirectiveTitle: '' }))).toBe('MCO 1500');
  });

  it('leaves orders untouched', () => {
    const mco = { documentType: 'mco', ssic: '1500.61', parentDirectiveTitle: 'MCO 9.9', changeNumber: 3 } as unknown as FormData;
    expect(getDirectiveDesignation(mco)).toBe('MCO 1500.61');
    expect(buildDirectiveTitle(mco)).toBe('MCO 1500.61');
  });
});

describe('designation line with a stored directive title', () => {
  it('ignores a template directiveTitle the transmittal form cannot edit', async () => {
    const { getDirectiveTitleLine } = await import('@/lib/naval-format-utils');
    const fd = { ...base, changeNumber: 2, directiveTitle: 'MCO 1000.1 W/CH-1' } as unknown as FormData;
    expect(getDirectiveTitleLine(fd)).toBe('MCO 1500.61 W/CH-2');
  });

  it('keeps an order\'s own directive title', async () => {
    const { getDirectiveTitleLine } = await import('@/lib/naval-format-utils');
    const fd = { documentType: 'mco', ssic: '1500.61', directiveTitle: 'MCO 1500.61 W/ CH 1' } as unknown as FormData;
    expect(getDirectiveTitleLine(fd)).toBe('MCO 1500.61 W/ CH 1');
  });
});

describe('change transmittal export filename', () => {
  it('keeps the point and writes the change without a slash', async () => {
    const { getExportFilename } = await import('@/lib/naval-format-utils');
    const fd = { ...base, changeNumber: '2' } as unknown as FormData;
    expect(getExportFilename(fd, 'pdf')).toBe('MCO 1500.61 W-CH-2 - MARINE CORPS TRAINING.pdf');
  });
});
