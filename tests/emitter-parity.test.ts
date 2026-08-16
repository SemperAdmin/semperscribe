/**
 * Emitter parity: the preview and the export must carry the same
 * content (audit 2026-08-16).
 *
 * Four divergences of one class, all measured before the fix:
 *   1. DOCX fabricated "Date Placeholder", "Commanding Officer" and
 *      "Addressee" for an empty date/From/To while the preview printed
 *      nothing, so the export invented a signing authority.
 *   2. DOCX dropped the directive FOUO marking the preview stamped
 *      (MCO 5215.1K para 10) - a control marking lost on export.
 *   3. DOCX dropped delegationText on business and executive letters,
 *      understating the authority the letter was signed under.
 *   4. The preview printed the literal "Rank Name, Code, Phone" on a
 *      staffing paper whose approver fields were empty.
 *
 * Companion to tests/salutation-parity.test.ts. The governing rule:
 * neither emitter invents text the drafter never typed, and an empty
 * required field is reported by the validators instead.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { runLetterValidators } from '@/lib/letter-validators';
import { DOCUMENT_TYPES } from '@/lib/schemas';

const PARAGRAPHS = [{ id: '1', level: 1, content: 'Body text alpha.', title: '' }] as any;

/** Long enough to paginate past two pages, so "every page" is testable. */
const LONG_PARAGRAPHS = Array.from({ length: 14 }, (_, i) => ({
  id: String(i + 1),
  level: 1,
  title: '',
  content: `Body paragraph ${i + 1}. ` + 'Filler sentence to force pagination. '.repeat(8),
})) as any;

const BASE = {
  ssic: '5216',
  originatorCode: 'G-1',
  date: 'August 14, 2026',
  subj: 'TEST SUBJECT',
  sig: 'S. A. SHORTER',
  complimentaryClose: 'Sincerely,',
  line1: 'UNITED STATES MARINE CORPS',
  line2: 'HEADQUARTERS BATTALION',
  line3: 'CAMP SMITH, HI 96861',
  bodyFont: 'times',
} as any;

/** Body, headers and footers together - markings live outside document.xml. */
async function docxText(formData: any, paragraphs: any = PARAGRAPHS): Promise<string> {
  const blob = await generateDocxBlob(formData, [], [], [], [], paragraphs, []);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  let xml = '';
  for (const name of Object.keys(zip.files)) {
    if (/word\/(document|header\d*|footer\d*)\.xml$/.test(name)) {
      xml += await zip.file(name)!.async('string');
    }
  }
  return xml.replace(/<[^>]+>/g, '');
}

async function pdfText(formData: any, paragraphs: any = PARAGRAPHS): Promise<string> {
  const blob = await generateBasePDFBlob(formData, [], [], [], [], paragraphs, []);
  const layout = await extractPdfTextLayout(blob);
  return layout.map((i) => i.text).join('\n');
}

describe('empty date, From and To are never fabricated', () => {
  const EMPTY = { ...BASE, documentType: 'basic', date: '', from: '', to: '' };

  it.each(['Date Placeholder', 'Commanding Officer', 'Addressee'])(
    'DOCX writes no "%s"',
    async (literal) => {
      expect(await docxText(EMPTY)).not.toContain(literal);
    },
  );

  it('the validators report the three empty fields instead', () => {
    const ids = runLetterValidators(EMPTY, [], [], PARAGRAPHS).map((i) => i.id);
    expect(ids).toContain('schema-basic-date');
    expect(ids).toContain('schema-basic-from');
    expect(ids).toContain('schema-basic-to');
  });

  it('real values still render, and the date still formats naval-style', async () => {
    const xml = await docxText({ ...BASE, documentType: 'basic', from: 'Commanding Officer, Unit', to: 'Commandant' });
    expect(xml).toContain('Commanding Officer, Unit');
    expect(xml).toContain('Commandant');
    expect(xml).toMatch(/14 Aug 26/);
  });

  it('the multiple-address branch keeps its symmetric default', async () => {
    // Both emitters default this one to "Addressee", so it is parity,
    // not fabrication. Locked so a future sweep does not break it.
    const xml = await docxText({ ...BASE, documentType: 'multiple-address', from: 'CO', to: '' });
    expect(xml).toContain('Addressee');
  });
});

describe('directive FOUO marking reaches the DOCX', () => {
  const MCO = { ...BASE, documentType: 'mco', from: 'CO', to: 'ALL', directiveTitle: 'MCO 5216' };

  it.each(['full', 'partial'])('fouoDesignation "%s" marks the export', async (mode) => {
    const xml = await docxText({ ...MCO, fouoDesignation: mode });
    expect(xml).toContain('FOR OFFICIAL USE ONLY');
  });

  it('marks both the first-page footer and the continuation footer', async () => {
    const xml = await docxText({ ...MCO, fouoDesignation: 'full' });
    expect((xml.match(/FOR OFFICIAL USE ONLY/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('stays off when no designation is set', async () => {
    expect(await docxText({ ...MCO, fouoDesignation: '' })).not.toContain('FOR OFFICIAL USE ONLY');
  });

  // SECNAV M-5216.5 Figure 7-7 (page 7-22): internal pages carrying FOUO
  // information are marked at the bottom. Para 7-3 states no page
  // pattern and delegates to DoDM 5200.01 Vol 4. The preview previously
  // marked page 1 and the last page, which is the bound-document
  // cover rule from the same figure, misapplied to a letter.
  it.each(['full', 'partial'])('the preview marks EVERY page for "%s"', async (mode) => {
    const blob = await generateBasePDFBlob(
      { ...MCO, fouoDesignation: mode }, [], [], [], [], LONG_PARAGRAPHS, [],
    );
    const layout = await extractPdfTextLayout(blob);
    const pages = [...new Set(layout.map((i) => i.page))];
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const page of pages) {
      // The layout extractor emits per-glyph-run spacing, so collapse
      // whitespace before matching the marking.
      const text = layout.filter((i) => i.page === page).map((i) => i.text).join(' ').replace(/\s+/g, ' ');
      expect(text, `page ${page} must carry the FOUO marking`).toContain('FOR OFFICIAL USE ONLY');
    }
  });
});

describe('delegation text reaches the DOCX closing block', () => {
  const CIVILIAN = {
    ...BASE,
    originatorCode: 'JA',
    recipientName: 'Mr. Doe',
    recipientAddress: '123 Main St',
    salutation: 'Dear Mr. Doe:',
    delegationText: 'By direction',
  };

  it('business letter carries it', async () => {
    expect(await docxText({ ...CIVILIAN, documentType: 'business-letter' })).toContain('By direction');
  });

  it('executive letter carries it', async () => {
    expect(await docxText({ ...CIVILIAN, documentType: 'executive-correspondence', execFormat: 'letter' })).toContain('By direction');
  });

  it('omitSignatureBlock suppresses it, matching the preview', async () => {
    const xml = await docxText({ ...CIVILIAN, documentType: 'business-letter', omitSignatureBlock: true });
    expect(xml).not.toContain('By direction');
  });
});

describe('staffing paper approver line', () => {
  const PAPER = {
    ...BASE,
    documentType: 'position-paper',
    drafterName: 'A. DRAFTER',
    drafterRank: 'Maj',
    approverRank: '',
    approverName: '',
    approverOfficeCode: '',
    approverPhone: '',
  };

  it('the preview prints no Rank/Name/Code/Phone placeholders', async () => {
    const text = await pdfText(PAPER);
    expect(text).toContain('Approved by:');
    for (const literal of ['Rank Name', 'Rank ', ', Code,', ', Phone']) {
      expect(text).not.toContain(literal);
    }
  });

  it('real approver values still render', async () => {
    const text = await pdfText({ ...PAPER, approverRank: 'Col', approverName: 'B. APPROVER', approverOfficeCode: 'G-3', approverPhone: '555-0100' });
    expect(text).toContain('Col');
    expect(text).toContain('B. APPROVER');
  });
});

/* ------------------------------------------------------------------ *
 * Second set, 2026-08-16: the remaining audit divergences.            *
 * ------------------------------------------------------------------ */

describe('civilian letters carry no reference list', () => {
  // M-5216.5 11-2.9: a business letter refers to previous
  // communications "in the body of the letter only, without calling
  // them references or enclosures". The preview obeyed this; the export
  // printed a Ref: block the drafter never saw.
  const CIVILIAN = {
    ...BASE,
    recipientName: 'Mr. Doe',
    recipientAddress: '1 Main St',
    salutation: 'Dear Mr. Doe:',
  };

  async function withRefs(formData: any) {
    const blob = await generateDocxBlob(formData, [], ['ZREFONEZ'], ['ZENCLONEZ'], [], PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '\n');
  }

  it.each(['business-letter', 'executive-correspondence'])('%s drops the Ref list', async (documentType) => {
    const xml = await withRefs({ ...CIVILIAN, documentType, execFormat: 'letter' });
    expect(xml).not.toContain('ZREFONEZ');
  });

  it('DLA correspondence keeps its references', async () => {
    expect(await withRefs({ ...CIVILIAN, documentType: 'dla-business-letter' })).toContain('ZREFONEZ');
  });

  it('the naval standard letter keeps its references', async () => {
    expect(await withRefs({ ...BASE, documentType: 'basic', from: 'CO', to: 'CMC' })).toContain('ZREFONEZ');
  });

  // M-5216.5 11-2 Enclosure Line: typed on the second line BELOW the
  // signature. The preview placed it there; the export put it above the
  // body with the Ref block.
  it('the enclosure line sits below the signature on a business letter', async () => {
    const xml = await withRefs({ ...CIVILIAN, documentType: 'business-letter' });
    expect(xml.indexOf('ZENCLONEZ')).toBeGreaterThan(xml.indexOf('S. A. SHORTER'));
  });

  it('the naval letter keeps its enclosures above the body', async () => {
    const xml = await withRefs({ ...BASE, documentType: 'basic', from: 'CO', to: 'CMC' });
    expect(xml.indexOf('ZENCLONEZ')).toBeLessThan(xml.indexOf('S. A. SHORTER'));
  });
});

describe('omitDate is honored by both emitters', () => {
  const CIVILIAN = {
    ...BASE,
    recipientName: 'Mr. Doe',
    recipientAddress: '1 Main St',
    salutation: 'Dear Mr. Doe:',
  };

  async function dateCounts(formData: any) {
    const docx = await docxText(formData, LONG_PARAGRAPHS);
    const pdf = await pdfText(formData, LONG_PARAGRAPHS);
    return {
      docx: (docx.match(/August 14, 2026/g) ?? []).length,
      pdf: (pdf.match(/August 14, 2026/g) ?? []).length,
    };
  }

  it('an executive letter with omitDate carries no date on either surface', async () => {
    const c = await dateCounts({ ...CIVILIAN, documentType: 'executive-correspondence', execFormat: 'letter', omitDate: true });
    expect(c).toEqual({ docx: 0, pdf: 0 });
  });

  it('without omitDate both surfaces print it', async () => {
    // Counts are not compared directly: the DOCX stores ONE continuation
    // header definition that Word applies to every later page, while the
    // PDF materializes one per page.
    const c = await dateCounts({ ...CIVILIAN, documentType: 'executive-correspondence', execFormat: 'letter' });
    expect(c.docx).toBeGreaterThan(0);
    expect(c.pdf).toBeGreaterThan(0);
  });

  it('the executive letter prints its date once per page, not twice', async () => {
    // The preview rendered the date in the ID block AND the executive
    // address block. Ch 12-3 para 3 gives it one home.
    const text = await pdfText({ ...CIVILIAN, documentType: 'executive-correspondence', execFormat: 'letter' }, PARAGRAPHS);
    expect((text.match(/August 14, 2026/g) ?? []).length).toBe(1);
  });
});

describe('DLA letterhead follows headerType', () => {
  it.each([
    ['USMC', 'UNITED STATES MARINE CORPS'],
    ['DON', 'DEPARTMENT OF THE NAVY'],
    ['DLA', 'DEFENSE LOGISTICS AGENCY'],
  ])('headerType %s prints %s in the preview', async (headerType, expected) => {
    const text = await pdfText({
      ...BASE,
      documentType: 'dla-memorandum',
      headerType,
      memorandumFor: 'ALL HANDS',
      line1: 'HEADQUARTERS BATTALION',
    });
    expect(text).toContain(expected);
  });
});

describe('change transmittal is a directive on both surfaces', () => {
  const CT = {
    ...BASE,
    documentType: 'change-transmittal',
    from: 'CMC',
    to: 'Distribution',
    directiveTitle: 'ZDIRECTIVETITLEZ',
  };

  it('the export carries the directive title', async () => {
    expect(await docxText(CT)).toContain('ZDIRECTIVETITLEZ');
  });

  it('the export suppresses Copy to, as the preview does', async () => {
    const blob = await generateDocxBlob(CT, [], [], [], ['ZCOPYTOONEZ'], PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).not.toContain('ZCOPYTOONEZ');
  });
});

describe('staffing papers', () => {
  const GRID = {
    recommendationItems: [{ id: 'r1', text: 'Approve the plan.' }],
    recommenders: [{ id: 'c1', role: 'G-3', options: ['Concur', 'Nonconcur'] }],
    finalDecision: { role: 'CG', options: ['Approved', 'Disapproved'] },
  };
  const PAPER = {
    ...BASE,
    documentType: 'position-paper',
    drafterName: 'A. DRAFTER',
    drafterRank: 'Maj',
    decisionMode: 'MULTIPLE_RECS',
    decisionGrid: GRID,
  };
  const four = (fourthTitle: string) =>
    [1, 2, 3, 4].map(i => ({ id: String(i), level: 1, title: i === 4 ? fourthTitle : '', content: `Para ${i} content.` })) as any;

  it('a 4th paragraph keeps its own title and body', async () => {
    // The export hijacked ANY 4th paragraph: it replaced the title with
    // the literal "Recommendation" and dropped the body text.
    const xml = await docxText(PAPER, four('Way Ahead'));
    expect(xml).toContain('Way Ahead');
    expect(xml).toContain('Para 4 content.');
    expect(xml).not.toContain('Recommendation');
  });

  it('a real Recommendation paragraph still renders the grid', async () => {
    const xml = await docxText(PAPER, four('Recommendation'));
    expect(xml).toContain('Approve the plan.');
  });

  it('the export carries the top classification banner', async () => {
    const xml = await docxText({ ...PAPER, classification: 'SECRET' }, four('Way Ahead'));
    // Top banner plus the footer marking.
    expect((xml.match(/SECRET/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('an empty classification still marks the page UNCLASSIFIED', async () => {
    const xml = await docxText(PAPER, four('Way Ahead'));
    expect((xml.match(/UNCLASSIFIED/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('a decisionGrid with no recommenders does not crash the export', async () => {
    const xml = await docxText(
      { ...PAPER, decisionGrid: { recommendationItems: [{ id: 'r1', text: 'Approve.' }] } },
      four('Recommendation'),
    );
    expect(xml).toContain('Approve.');
  });
});

describe('validator messages a drafter can act on', () => {
  // Found in the browser pass 2026-08-16: an ABSENT field made Zod
  // report a type error, so the panel read "Recipient Name: Invalid
  // input: expected string, received undefined".
  it('an absent required field reads as a plain requirement', () => {
    const ids = runLetterValidators({ documentType: 'business-letter' } as any, [], [], PARAGRAPHS);
    const recipient = ids.find(i => i.id === 'schema-business-letter-recipientName');
    expect(recipient?.detail).toBe('Recipient Name: Recipient Name is required');
    expect(ids.map(i => i.detail).join(' ')).not.toContain('expected string');
  });

  // M-5216.5 11-2.9 keeps references out of BOTH emitters, so the
  // References section on a business letter now collects text that
  // reaches no output. The rule reports it rather than losing it.
  it('references typed on a business letter are reported, not silently dropped', () => {
    const issues = runLetterValidators(
      { ...BASE, documentType: 'business-letter', salutation: 'Dear Mr. Doe:' } as any,
      [], ['MCO 5216.20B'], PARAGRAPHS,
    );
    const ref = issues.find(i => i.id === 'civilian-reference-list');
    expect(ref?.severity).toBe('warn');
    expect(ref?.citation).toContain('11-2.9');
  });

  it('the executive memo format keeps its reference list without a warning', () => {
    const issues = runLetterValidators(
      { ...BASE, documentType: 'executive-correspondence', execFormat: 'memo', salutation: 'Dear Mr. Doe:' } as any,
      [], ['MCO 5216.20B'], PARAGRAPHS,
    );
    expect(issues.find(i => i.id === 'civilian-reference-list')).toBeUndefined();
  });
});

describe('FOUO is retired from the form, kept for legacy documents', () => {
  // DoDI 5200.48 (6 Mar 2020) cancelled DoDM 5200.01 Vol 4 and ended
  // FOUO on new documents; MARADMIN 664/20 implemented it for the
  // Marine Corps. CUI replaces it. Confirmed with Stephen 2026-08-16.
  const LEGACY = {
    ...BASE,
    documentType: 'mco',
    from: 'CO',
    to: 'ALL',
    directiveTitle: 'MCO 5216',
    fouoDesignation: 'full',
  };

  it.each(['mco', 'bulletin', 'change-transmittal', 'dla-memorandum', 'dla-business-letter'])(
    'no FOUO control remains on the %s form',
    (documentType) => {
      const definition = DOCUMENT_TYPES[documentType];
      const hasField = definition.sections.some(section =>
        section.fields.some(field => field.name === 'fouoDesignation'),
      );
      expect(hasField).toBe(false);
    },
  );

  it.each(['mco', 'bulletin', 'change-transmittal', 'dla-memorandum', 'dla-business-letter'])(
    'the %s keeps the CUI marking engine, so removing FOUO costs no capability',
    (documentType) => {
      expect(DOCUMENT_TYPES[documentType].features.showClassification).toBe(true);
    },
  );

  it('a saved document still renders the marking it was created with', async () => {
    expect(await docxText(LEGACY)).toContain('FOR OFFICIAL USE ONLY');
  });

  it('and the validators say why that marking is obsolete', () => {
    const issue = runLetterValidators(LEGACY, [], [], PARAGRAPHS).find(i => i.id === 'fouo-retired');
    expect(issue?.severity).toBe('fail');
    expect(issue?.citation).toContain('5200.48');
    expect(issue?.detail).toContain('CUI');
  });

  it('stays silent on a document with no designation', () => {
    const issues = runLetterValidators({ ...LEGACY, fouoDesignation: '' }, [], [], PARAGRAPHS);
    expect(issues.find(i => i.id === 'fouo-retired')).toBeUndefined();
  });
});
