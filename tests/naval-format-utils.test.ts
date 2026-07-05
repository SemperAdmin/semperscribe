import { describe, it, expect } from 'vitest';
import {
  getBodyFont,
  getComplimentaryClose,
  getFromToSpacing,
  getViaSpacing,
  getSubjSpacing,
  getRefSpacing,
  getEnclSpacing,
  getCopySpacing,
  splitSubject,
  formatCancellationDate,
  getMCOParagraphs,
  getMCBulParagraphs,
  getMOAParagraphs,
  getExportFilename,
  mergeAdminSubsections,
  getStaffingPaperParagraphs,
  getInformationPaperParagraphs,
} from '@/lib/naval-format-utils';
import { FormData, ParagraphData, AdminSubsections } from '@/types';

describe('getBodyFont', () => {
  it('returns "Times New Roman" for times', () => {
    expect(getBodyFont('times')).toBe('Times New Roman');
  });

  it('returns "Courier New" for courier', () => {
    expect(getBodyFont('courier')).toBe('Courier New');
  });
});

describe('getFromToSpacing', () => {
  it('uses tabs for Times New Roman', () => {
    expect(getFromToSpacing('From', 'times')).toBe('From:\t');
    expect(getFromToSpacing('To', 'times')).toBe('To:\t');
  });

  it('uses fixed spaces for Courier', () => {
    expect(getFromToSpacing('From', 'courier')).toBe('From:  ');
    expect(getFromToSpacing('To', 'courier')).toBe('To:    ');
  });
});

describe('getViaSpacing — single via unnumbered (M-5216.5, Phase 2 item 1)', () => {
  it('omits the "(1)" when there is exactly one via (times)', () => {
    expect(getViaSpacing(0, 'times', 1)).toBe('Via:\t');
  });
  it('omits the "(1)" when there is exactly one via (courier)', () => {
    expect(getViaSpacing(0, 'courier', 1)).toBe('Via:\u00A0\u00A0\u00A0');
  });
  it('numbers vias when two or more (times)', () => {
    expect(getViaSpacing(0, 'times', 2)).toContain('(1)');
    expect(getViaSpacing(1, 'times', 2)).toContain('(2)');
  });
  it('numbers vias when two or more (courier)', () => {
    expect(getViaSpacing(0, 'courier', 3)).toContain('(1)');
    expect(getViaSpacing(2, 'courier', 3)).toContain('(3)');
  });
});

describe('getViaSpacing', () => {
  it('includes "Via:" label for first entry (times)', () => {
    const result = getViaSpacing(0, 'times');
    expect(result).toContain('Via:');
    expect(result).toContain('(1)');
  });

  it('omits "Via:" for subsequent entries (times)', () => {
    const result = getViaSpacing(1, 'times');
    expect(result).not.toContain('Via:');
    expect(result).toContain('(2)');
  });

  it('uses non-breaking spaces for courier', () => {
    const result = getViaSpacing(0, 'courier');
    expect(result).toContain('Via:');
    expect(result).toContain('\u00A0');
  });
});

describe('getSubjSpacing', () => {
  it('uses tab for Times', () => {
    expect(getSubjSpacing('times')).toBe('Subj:\t');
  });

  it('uses spaces for Courier', () => {
    expect(getSubjSpacing('courier')).toBe('Subj:  ');
  });
});

describe('getRefSpacing', () => {
  it('includes "Ref:" for first reference (times)', () => {
    const result = getRefSpacing('a', 0, 'times');
    expect(result).toContain('Ref:');
    expect(result).toContain('(a)');
  });

  it('omits "Ref:" for subsequent references', () => {
    const result = getRefSpacing('b', 1, 'times');
    expect(result).not.toContain('Ref:');
    expect(result).toContain('(b)');
  });

  it('handles courier spacing with non-breaking spaces', () => {
    const result = getRefSpacing('a', 0, 'courier');
    expect(result).toContain('Ref:');
    expect(result).toContain('\u00A0');
  });
});

describe('getEnclSpacing', () => {
  it('includes "Encl:" for first enclosure (times)', () => {
    const result = getEnclSpacing(1, 0, 'times');
    expect(result).toContain('Encl:');
    expect(result).toContain('(1)');
  });

  it('omits "Encl:" for subsequent enclosures', () => {
    const result = getEnclSpacing(2, 1, 'times');
    expect(result).not.toContain('Encl:');
    expect(result).toContain('(2)');
  });
});

describe('getCopySpacing', () => {
  it('returns "Copy to:" for both fonts', () => {
    expect(getCopySpacing('times')).toBe('Copy to:');
    expect(getCopySpacing('courier')).toBe('Copy to:');
  });
});

describe('splitSubject', () => {
  it('returns empty array for empty subject', () => {
    expect(splitSubject('')).toEqual([]);
  });

  it('keeps short subjects on one line', () => {
    expect(splitSubject('SHORT SUBJECT')).toEqual(['SHORT SUBJECT']);
  });

  it('splits long subjects at word boundaries', () => {
    const longSubject = 'THIS IS A VERY LONG SUBJECT LINE THAT SHOULD BE SPLIT INTO MULTIPLE LINES FOR PROPER FORMATTING';
    const result = splitSubject(longSubject, 60);
    result.forEach(line => {
      expect(line.length).toBeLessThanOrEqual(60);
    });
    expect(result.join(' ')).toBe(longSubject);
  });

  it('respects custom max length', () => {
    const subject = 'WORD1 WORD2 WORD3 WORD4 WORD5';
    const result = splitSubject(subject, 15);
    result.forEach(line => {
      expect(line.length).toBeLessThanOrEqual(15);
    });
  });
});

describe('formatCancellationDate', () => {
  it('returns empty string for empty input', () => {
    expect(formatCancellationDate('')).toBe('');
  });

  it('formats ISO dates to "Mon YYYY"', () => {
    expect(formatCancellationDate('2025-06-15')).toBe('Jun 2025');
  });

  it('returns original string for invalid dates', () => {
    expect(formatCancellationDate('not-a-date')).toBe('not-a-date');
  });
});

describe('Standard paragraph templates', () => {
  describe('getMCOParagraphs', () => {
    it('returns SMEAC structure with mandatory level-1 paragraphs', () => {
      const paras = getMCOParagraphs();
      // MCO uses SMEAC with sub-paragraphs under Execution and Command & Signal
      expect(paras.length).toBeGreaterThanOrEqual(5);
      const level1Titles = paras.filter(p => p.level === 1).map(p => p.title);
      expect(level1Titles).toContain('Situation');
      expect(level1Titles).toContain('Mission');
      expect(level1Titles).toContain('Execution');
      expect(level1Titles).toContain('Administration and Logistics');
      expect(level1Titles).toContain('Command and Signal');
    });

    it('has mandatory flags on SMEAC paragraphs', () => {
      const paras = getMCOParagraphs();
      const mandatoryTitles = paras.filter(p => p.isMandatory).map(p => p.title);
      expect(mandatoryTitles).toContain('Situation');
      expect(mandatoryTitles).toContain('Mission');
      expect(mandatoryTitles).toContain('Execution');
      expect(mandatoryTitles).toContain('Administration and Logistics');
      expect(mandatoryTitles).toContain('Command and Signal');
    });
  });

  describe('getMCBulParagraphs', () => {
    it('returns standard bulletin paragraphs', () => {
      const paras = getMCBulParagraphs();
      expect(paras.length).toBeGreaterThanOrEqual(5);
      expect(paras[0].title).toBe('Purpose');
      const titles = paras.map(p => p.title);
      expect(titles).toContain('Purpose');
      expect(titles).toContain('Cancellation');
      expect(titles).toContain('Reserve Applicability');
    });
  });

  describe('getMOAParagraphs', () => {
    it('returns MOA paragraphs with "Agreement" title by default', () => {
      const paras = getMOAParagraphs();
      expect(paras.find(p => p.title === 'Agreement')).toBeDefined();
    });

    it('returns MOU paragraphs with "Understanding" title', () => {
      const paras = getMOAParagraphs('mou');
      expect(paras.find(p => p.title === 'Understanding')).toBeDefined();
    });

    it('includes required sections: Purpose, Problem, Scope, Effective Date', () => {
      const paras = getMOAParagraphs();
      const titles = paras.map(p => p.title).filter(Boolean);
      expect(titles).toContain('Purpose');
      expect(titles).toContain('Problem');
      expect(titles).toContain('Scope');
      expect(titles).toContain('Effective Date');
    });
  });

  describe('Staffing paper templates', () => {
    it('getInformationPaperParagraphs returns Purpose and Key Points', () => {
        const paras = getInformationPaperParagraphs();
        expect(paras).toHaveLength(2);
        expect(paras[0].title).toBe('Purpose');
        expect(paras[1].title).toBe('Key Points');
        paras.forEach(p => expect(p.level).toBe(1));
    });

    it('getStaffingPaperParagraphs includes Purpose, Major Points, Discussion, Recommendation', () => {
      const paras = getStaffingPaperParagraphs();
      expect(paras).toHaveLength(4);
      const titles = paras.map(p => p.title);
      expect(titles).toEqual(['Purpose', 'Main Points', 'Discussion', 'Recommendation']);
    });

    it('all staffing paper paragraphs are mandatory', () => {
      const allPapers = [
        ...getInformationPaperParagraphs(),
        ...getStaffingPaperParagraphs(),
      ];
      allPapers.forEach(p => expect(p.isMandatory).toBe(true));
    });
  });
});

describe('getExportFilename', () => {
  const baseForm: FormData = {
    documentType: 'basic',
    endorsementLevel: '',
    basicLetterReference: '',
    referenceWho: '',
    referenceType: '',
    referenceDate: '',
    startingReferenceLevel: '',
    startingEnclosureNumber: '',
    line1: '',
    line2: '',
    line3: '',
    ssic: '5216',
    originatorCode: '',
    date: '',
    from: '',
    to: '',
    subj: 'TEST SUBJECT',
    sig: '',
    delegationText: '',
    startingPageNumber: 1,
    previousPackagePageCount: 0,
    headerType: 'USMC',
    bodyFont: 'times',
  };

  it('generates basic letter filename', () => {
    expect(getExportFilename(baseForm, 'pdf')).toBe('Letter 5216 - TEST SUBJECT.pdf');
  });

  it('generates MCO filename with prefix', () => {
    const form = { ...baseForm, documentType: 'mco' as const, orderPrefix: 'MCO' };
    expect(getExportFilename(form, 'pdf')).toBe('MCO 5216 - TEST SUBJECT.pdf');
  });

  it('generates MCO filename with custom prefix', () => {
    const form = { ...baseForm, documentType: 'mco' as const, orderPrefix: 'BnO' };
    expect(getExportFilename(form, 'pdf')).toBe('BnO 5216 - TEST SUBJECT.pdf');
  });

  it('generates bulletin filename', () => {
    const form = { ...baseForm, documentType: 'bulletin' as const };
    expect(getExportFilename(form, 'docx')).toBe('MCBul 5216 - TEST SUBJECT.docx');
  });

  it('generates endorsement filename', () => {
    const form = {
      ...baseForm,
      documentType: 'endorsement' as const,
      endorsementLevel: 'FIRST' as const,
      basicLetterReference: 'CO ltr 5216',
    };
    expect(getExportFilename(form, 'pdf')).toBe('FIRST on CO ltr 5216.pdf');
  });

  it('generates MOA/MOU filename', () => {
    const moaForm = { ...baseForm, documentType: 'moa' as const };
    expect(getExportFilename(moaForm, 'pdf')).toBe('MOA - TEST SUBJECT.pdf');

    const mouForm = { ...baseForm, documentType: 'mou' as const };
    expect(getExportFilename(mouForm, 'pdf')).toBe('MOU - TEST SUBJECT.pdf');
  });

  it('generates staffing paper filenames', () => {
    const form = { ...baseForm, documentType: 'information-paper' as const };
    expect(getExportFilename(form, 'pdf')).toBe('Information Paper - TEST SUBJECT.pdf');
  });

  it('falls back to "Draft" when SSIC is empty', () => {
    const form = { ...baseForm, ssic: '' };
    expect(getExportFilename(form, 'pdf')).toBe('Letter Draft - TEST SUBJECT.pdf');
  });
});

describe('mergeAdminSubsections', () => {
  const baseParagraphs: ParagraphData[] = [
    { id: 1, level: 1, content: '', title: 'Situation' },
    { id: 2, level: 1, content: '', title: 'Mission' },
    { id: 3, level: 1, content: '', title: 'Execution' },
    { id: 4, level: 1, content: '', title: 'Administration and Logistics' },
    { id: 5, level: 1, content: '', title: 'Command and Signal' },
  ];

  it('returns original paragraphs when no admin subsections', () => {
    expect(mergeAdminSubsections(baseParagraphs)).toEqual(baseParagraphs);
    expect(mergeAdminSubsections(baseParagraphs, undefined)).toEqual(baseParagraphs);
  });

  it('inserts Records Management subsection after Admin paragraph', () => {
    const admin: AdminSubsections = {
      recordsManagement: { show: true, content: 'RM content', order: 1 },
      privacyAct: { show: false, content: '', order: 2 },
      reportsRequired: { show: false, content: '', order: 3 },
    };
    const result = mergeAdminSubsections(baseParagraphs, admin);
    expect(result).toHaveLength(6);
    expect(result[4].content).toContain('Records Management');
    expect(result[4].level).toBe(2);
  });

  it('inserts multiple subsections in order', () => {
    const admin: AdminSubsections = {
      recordsManagement: { show: true, content: 'RM content', order: 1 },
      privacyAct: { show: true, content: 'PA content', order: 2 },
      reportsRequired: { show: true, content: 'RR content', order: 3 },
    };
    const result = mergeAdminSubsections(baseParagraphs, admin);
    expect(result).toHaveLength(8);
    expect(result[4].content).toContain('Records Management');
    expect(result[5].content).toContain('Privacy Act');
    expect(result[6].content).toContain('Reports Required');
  });

  it('returns original paragraphs if Admin section is not found', () => {
    const noParagraphs: ParagraphData[] = [
      { id: 1, level: 1, content: '', title: 'Purpose' },
    ];
    const admin: AdminSubsections = {
      recordsManagement: { show: true, content: 'RM', order: 1 },
      privacyAct: { show: false, content: '', order: 2 },
      reportsRequired: { show: false, content: '', order: 3 },
    };
    expect(mergeAdminSubsections(noParagraphs, admin)).toEqual(noParagraphs);
  });
});

describe('getComplimentaryClose (MCO 5216.20B Sec 12; Phase 2 item 7)', () => {
  it('defaults to "Sincerely,"', () => {
    expect(getComplimentaryClose({})).toBe('Sincerely,');
  });
  it('VIP mode yields "Very respectfully,"', () => {
    expect(getComplimentaryClose({ isVipMode: true })).toBe('Very respectfully,');
  });
  it('explicit close wins over VIP mode and gains exactly one comma', () => {
    expect(getComplimentaryClose({ complimentaryClose: 'Respectfully', isVipMode: true }))
      .toBe('Respectfully,');
    expect(getComplimentaryClose({ complimentaryClose: 'Sincerely,' })).toBe('Sincerely,');
    expect(getComplimentaryClose({ complimentaryClose: 'Sincerely,,' })).toBe('Sincerely,');
  });
});
