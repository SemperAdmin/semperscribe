/**
 * P4.3 — SECNAV instruction/notice types + validators
 * (SECNAV M-5215.1, Sep 2020; POLICY_COMPLIANCE_AUDIT.md lines 78-106,
 * matrix rows C5/C6/C7; CORE_CONCEPTS_UPDATE_PLAN.md Phase 4 item 3).
 *
 * Source note: the manual PDF (secnav.navy.mil/doni) is WAF-blocked
 * from this environment; the notice self-cancel wording was verbatim-
 * verified 2026-06-10 via search excerpt of the manual. Remaining
 * rules are pinned to the audit summary.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import {
  getDirectiveDesignation,
  buildDirectiveTitle,
  getSignatureBlankLines,
  getSecnavInstructionParagraphs,
  getSecnavNoticeParagraphs,
} from '@/lib/naval-format-utils';
import {
  getFontArchetype,
  getAllowedBodyFonts,
  getAllowedFontSizesPt,
  resolveBodyFont,
  resolveHeaderType,
  isSecnavDirective,
} from '@/lib/font-policy';
import { isDirectiveType, isCorrespondenceType } from '@/lib/indent-engine';
import {
  validateSecnavSchema,
  validateSecnavNoticeCancellation,
  validateSecnavReferencesOverflow,
  validateRevisionSuffix,
  secnavPageCapIssue,
  SECNAV_PAGE_CAP,
} from '@/lib/letter-validators';
import { FIXTURE_FORM_DATA } from './golden/fixture';
import type { ParagraphData } from '@/types';

function instForm(extra: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'secnav-instruction',
    ssic: '5215.1F',
    originatorCode: 'DON/AA',
    from: 'Secretary of the Navy',
    to: '',
    date: '10 Feb 26',
    sig: 'I. M. SECRETARY',
  ...extra,
  } as never;
}

function noticeForm(extra: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'secnav-notice',
    ssic: '5215',
    originatorCode: 'DON/AA',
    from: 'Secretary of the Navy',
    to: '',
    date: '10 Feb 26',
    cancellationDate: '2027-01-31',
    sig: 'I. M. SECRETARY',
    ...extra,
  } as never;
}

const titled = (titles: string[]): ParagraphData[] =>
  titles.map((t, i) => ({ id: i + 1, level: 1, content: 'x', title: t }));

describe('P4.3 designation and title lines (audit lines 82, 90)', () => {
  it('SECNAVINST + full SSIC; SECNAVNOTE + bare SSIC', () => {
    expect(getDirectiveDesignation(instForm() as never)).toBe('SECNAVINST 5215.1F');
    expect(getDirectiveDesignation(noticeForm() as never)).toBe('SECNAVNOTE 5215');
  });
  it('designation line spells the type out', () => {
    expect(buildDirectiveTitle(instForm() as never)).toBe('SECNAV INSTRUCTION 5215.1F');
    expect(buildDirectiveTitle(noticeForm() as never)).toBe('SECNAV NOTICE 5215');
  });
  it('never leaks MCO/MCBul prefixes', () => {
    expect(getDirectiveDesignation(instForm({ orderPrefix: 'MCO' }) as never)).toBe('SECNAVINST 5215.1F');
    expect(buildDirectiveTitle(noticeForm({ orderPrefix: 'MCO' }) as never)).toBe('SECNAV NOTICE 5215');
  });
});

describe('P4.3 archetype policy (G7, audit row C1)', () => {
  it('secnav-directive archetype: Courier New 12 only, DON letterhead only', () => {
    for (const t of ['secnav-instruction', 'secnav-notice']) {
      expect(isSecnavDirective(t)).toBe(true);
      expect(getFontArchetype(t)).toBe('secnav-directive');
      expect(getAllowedBodyFonts(t)).toEqual(['courier']);
      expect(getAllowedFontSizesPt(t)).toEqual([12]);
      expect(resolveBodyFont(t, 'times')).toBe('courier');
      expect(resolveHeaderType(t, 'USMC')).toBe('DON');
      expect(resolveHeaderType(t, 'DLA')).toBe('DON');
      expect(resolveHeaderType(t, undefined)).toBe('DON');
    }
  });
  it('joins the fixed-ladder directive set (audit row C8)', () => {
    for (const t of ['secnav-instruction', 'secnav-notice']) {
      expect(isDirectiveType(t)).toBe(true);
      expect(isCorrespondenceType(t)).toBe(false);
    }
  });
  it('keeps the naval 4th-line signature rule (G5: 3 blanks, not the MCO 4)', () => {
    expect(getSignatureBlankLines('secnav-instruction')).toBe(3);
    expect(getSignatureBlankLines('secnav-notice')).toBe(3);
  });
});

describe('P4.3 paragraph-order validators (audit line 83)', () => {
  it('scaffolds validate clean', () => {
    const inst = validateSecnavSchema(instForm() as never, getSecnavInstructionParagraphs());
    const note = validateSecnavSchema(noticeForm() as never, getSecnavNoticeParagraphs());
    expect(inst.filter((i) => i.severity === 'fail')).toEqual([]);
    expect(note.filter((i) => i.severity === 'fail')).toEqual([]);
  });
  it('Purpose must be first', () => {
    const issues = validateSecnavSchema(instForm() as never, titled(['Background', 'Purpose']));
    expect(issues.some((i) => i.id === 'secnav-purpose-first' && i.severity === 'fail')).toBe(true);
  });
  it('instruction: Cancellation second, Forms last', () => {
    const bad = validateSecnavSchema(
      instForm() as never,
      titled(['Purpose', 'Policy', 'Cancellation', 'Forms and Information Collections', 'Responsibilities']),
    );
    expect(bad.some((i) => i.id === 'secnav-cancellation-position')).toBe(true);
    expect(bad.some((i) => i.id === 'secnav-forms-last')).toBe(true);
    const good = validateSecnavSchema(
      instForm() as never,
      titled(['Purpose', 'Cancellation', 'Policy', 'Forms and Information Collections']),
    );
    expect(good.filter((i) => i.severity === 'fail')).toEqual([]);
  });
  it('notice with cancellation paragraph: Cancellation last, Forms next-to-last', () => {
    const good = validateSecnavSchema(
      noticeForm() as never,
      titled(['Purpose', 'Action', 'Forms and Information Collections', 'Cancellation']),
    );
    expect(good.filter((i) => i.severity === 'fail')).toEqual([]);
    const cancMisplaced = validateSecnavSchema(
      noticeForm() as never,
      titled(['Purpose', 'Cancellation', 'Forms and Information Collections', 'Action']),
    );
    expect(cancMisplaced.some((i) => i.id === 'secnav-notice-cancellation-last')).toBe(true);
    const formsMisplaced = validateSecnavSchema(
      noticeForm() as never,
      titled(['Purpose', 'Forms and Information Collections', 'Action', 'Cancellation']),
    );
    expect(formsMisplaced.some((i) => i.id === 'secnav-notice-forms-next-to-last')).toBe(true);
  });
  it('notice SSIC must not carry a point number (audit line 90)', () => {
    const issues = validateSecnavSchema(noticeForm({ ssic: '5215.1' }) as never, titled(['Purpose']));
    expect(issues.some((i) => i.id === 'secnav-notice-no-point-number' && i.severity === 'fail')).toBe(true);
    const clean = validateSecnavSchema(noticeForm() as never, titled(['Purpose']));
    expect(clean.some((i) => i.id === 'secnav-notice-no-point-number')).toBe(false);
  });
});

describe('P4.3 notice Canc date (audit line 86, verbatim-verified excerpt)', () => {
  it('requires the date and pins month-end', () => {
    expect(validateSecnavNoticeCancellation(noticeForm({ cancellationDate: '' }) as never)
      .some((i) => i.id === 'secnav-notice-canc-missing')).toBe(true);
    expect(validateSecnavNoticeCancellation(noticeForm({ cancellationDate: '2027-01-15' }) as never)
      .some((i) => i.id === 'secnav-notice-canc-month-end')).toBe(true);
    expect(validateSecnavNoticeCancellation(noticeForm() as never)).toEqual([]);
  });
  it('permits a Canc date past one year (no MCBul-style ceiling)', () => {
    // "self-canceling on the 1 year anniversary date unless the Canc
    // date is for a longer period" — 18 months out must validate.
    expect(validateSecnavNoticeCancellation(noticeForm({ date: '10 Feb 26', cancellationDate: '2027-08-31' }) as never)).toEqual([]);
  });
});

describe('P4.3 references overflow (audit line 85; heuristic threshold)', () => {
  it('warns past the threshold, silent at it', () => {
    const eight = Array.from({ length: 8 }, (_, i) => `Ref ${i}`);
    expect(validateSecnavReferencesOverflow(instForm() as never, eight)).toEqual([]);
    const nine = [...eight, 'Ref 8'];
    const issues = validateSecnavReferencesOverflow(instForm() as never, nine);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
  });
});

describe('P4.4 suffix set goes live for SECNAV (audit line 151)', () => {
  it('rejects I and O, permits Q (Q is USMC-only)', () => {
    expect(validateRevisionSuffix(instForm({ ssic: '5215.1I' }) as never)
      .some((i) => i.id === 'revision-suffix-i')).toBe(true);
    expect(validateRevisionSuffix(instForm({ ssic: '5215.1O' }) as never)
      .some((i) => i.id === 'revision-suffix-o')).toBe(true);
    expect(validateRevisionSuffix(instForm({ ssic: '5215.1Q' }) as never)).toEqual([]);
    expect(validateRevisionSuffix(instForm({ ssic: '5215.1AA' }) as never)
      .some((i) => i.id === 'revision-suffix-past-z')).toBe(true);
  });
});

describe('P4.3 five-page cap verdict (audit lines 85, 115; row C7)', () => {
  it('blocks past the cap, silent at it, inert for other types', () => {
    expect(secnavPageCapIssue('secnav-instruction', SECNAV_PAGE_CAP)).toBeNull();
    const blocked = secnavPageCapIssue('secnav-notice', SECNAV_PAGE_CAP + 1);
    expect(blocked).not.toBeNull();
    expect(blocked!.severity).toBe('block');
    expect(secnavPageCapIssue('mco', 50)).toBeNull();
  });
});

describe('P4.3 DOCX emit', () => {
  async function docXml(form: never): Promise<string> {
    const blob = await generateDocxBlob(form, [], [], [], [], titled(['Purpose', 'Forms and Information Collections']), []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return zip.file('word/document.xml')!.async('string');
  }
  it('instruction: SECNAVINST stack, DON letterhead, no To line, Courier coerced', async () => {
    const xml = await docXml(instForm({ headerType: 'USMC', bodyFont: 'times' }) as never);
    expect(xml).toContain('SECNAVINST 5215.1F');
    expect(xml).toContain('DEPARTMENT OF THE NAVY');
    expect(xml).not.toContain('UNITED STATES MARINE CORPS');
    expect(xml).toContain('SECNAV INSTRUCTION 5215.1F');
    expect(xml).toContain('From:');
    expect(xml).not.toContain('To:</w:t>');
    expect(xml).not.toMatch(/To:\s{4}/);
    expect(xml).toContain('Courier New');
  });
  it('notice: Canc line above the ID stack, SECNAVNOTE designation', async () => {
    const xml = await docXml(noticeForm() as never);
    expect(xml).toContain('SECNAVNOTE 5215');
    expect(xml).toContain('Canc: ');
    expect(xml).not.toContain('Canc frp:');
  });
});
