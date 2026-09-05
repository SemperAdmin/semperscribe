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
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout, type PdfTextItem } from './golden/helpers';
import { LINE_HEIGHT_12PT, PDF_MARGINS } from '@/lib/pdf-settings';
import { runLetterValidators } from '@/lib/letter-validators';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { indexToRefLetter } from '@/lib/reference-letters';

/** (a) through the nth letter, using the one shared walk. */
const indexRange = (n: number) => Array.from({ length: n }, (_, i) => indexToRefLetter(i + 1));

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

/** The same two, with a reference and enclosure list the emitters letter and number. */
async function docxListText(formData: any, references: string[], enclosures: string[] = []): Promise<string> {
  const blob = await generateDocxBlob(formData, [], references, enclosures, [], PARAGRAPHS, []);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
}

async function pdfListText(formData: any, references: string[], enclosures: string[] = []): Promise<string> {
  const blob = await generateBasePDFBlob(formData, [], references, enclosures, [], PARAGRAPHS, []);
  const layout = await extractPdfTextLayout(blob);
  // A reference line reaches the layout as separate runs for "(", the
  // letter and ")", so the runs are joined without a separator and the
  // parenthesized letter reads as one token.
  return layout.map((i) => i.text).join('');
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
  //
  // D.4 moved the message on again. The rule now states the
  // REQUIREMENT and cites the paragraph it comes from, so the detail
  // names the field's state and then says what the manual asks for.
  it('an absent required field reads as a plain requirement', () => {
    const ids = runLetterValidators({ documentType: 'business-letter' } as any, [], [], PARAGRAPHS);
    const recipient = ids.find(i => i.id === 'schema-business-letter-recipientName');
    expect(recipient?.detail).toContain('Recipient Name is empty.');
    expect(recipient?.rule).toBe('The inside address names the person or the business written to');
    expect(recipient?.citation).toBe('SECNAV M-5216.5 11-2.2.a');
    expect(ids.map(i => i.detail).join(' ')).not.toContain('expected string');
  });

  // UX audit finding 3: "SSIC fails its document schema", cited to
  // "Basic Letter schema (src/lib/schemas.ts)". A source path in a
  // citation field gives a reviewing officer nothing to check.
  it('no validator message cites a source path', () => {
    const issues = runLetterValidators({ documentType: 'basic' } as any, [], [], PARAGRAPHS);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.citation).not.toContain('src/lib');
      expect(issue.citation).not.toContain('.ts');
      expect(issue.rule).not.toContain('document schema');
    }
  });

  it('the required header fields cite the paragraph which requires them', () => {
    const issues = runLetterValidators({ documentType: 'basic' } as any, [], [], PARAGRAPHS);
    const byId = new Map(issues.map(i => [i.id, i]));
    expect(byId.get('schema-basic-ssic')?.rule).toBe('An SSIC is required on every naval letter');
    expect(byId.get('schema-basic-ssic')?.citation).toBe('SECNAV M-5216.5 7-2.3.a(1)');
    expect(byId.get('schema-basic-from')?.citation).toBe('SECNAV M-5216.5 7-2.6.a');
    expect(byId.get('schema-basic-to')?.citation).toBe('SECNAV M-5216.5 7-2.7.a');
    expect(byId.get('schema-basic-date')?.citation).toBe('SECNAV M-5216.5 7-2.3.a(3) and 2-16.a');
    // The field name travels with the issue, so the compliance dialog
    // jumps to it.
    expect(byId.get('schema-basic-ssic')?.field).toBe('ssic');
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

describe('From, To and Via wrap to the text column on both surfaces', () => {
  // M-5216.5 7-2 para 6 (From), 8 (Via), 9 (Subj): "If the entry is
  // longer than one line, start the second line under the first word
  // after the heading." Measured 2026-08-16: the export sent every
  // wrapped line back to the left margin, under its own label, because
  // the paragraphs carried a tab stop and no hanging indent. The
  // preview aligned correctly but its column DRIFTED, since a
  // fixed-width label inside a flex row shrinks when the row overflows.
  const LONG_FROM = 'Commanding Officer, Naval Recruiting District Minneapolis, 212 3rd Avenue South, Minneapolis, MN 55401-2592';
  const LONG_TO = 'Commander, Navy Personnel Command, Attn Assistant Commander for Career Management, 5720 Integrity Drive, Millington, TN 38055-0000';
  const LONG_VIA = 'Commander, Carrier Strike Group NINE, Naval Station Norfolk, 1530 Gilbert Street, Norfolk, VA 23511-2797';
  /** 720 twips = 0.5 inch = the 36pt column the preview uses. */
  const HANGING = '<w:ind w:left="720" w:hanging="720"/>';
  const LETTER = { ...BASE, documentType: 'basic', date: '14 Aug 26', from: LONG_FROM, to: LONG_TO };

  async function headingParagraphs(formData: any, vias: string[] = []) {
    const blob = await generateDocxBlob(formData, vias, [], [], [], PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    return (xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? []).filter(p =>
      /^(From:|To:|Via:)/.test(p.replace(/<[^>]+>/g, '').trim()),
    );
  }

  it('the export gives every From/To/Via paragraph a hanging indent', async () => {
    const paragraphs = await headingParagraphs(LETTER, [LONG_VIA]);
    expect(paragraphs).toHaveLength(3);
    for (const paragraph of paragraphs) {
      expect(paragraph).toContain(HANGING);
    }
  });

  it('the preview holds one column whatever the entry length', async () => {
    // Absolute points are font-dependent (the suite mocks the embedded
    // fonts), so this asserts the INVARIANT instead: every heading value
    // starts on the same column, and that column does not move with the
    // length of the entry. Both were false before the fix.
    const lengths = [
      { from: 'Commanding Officer', to: 'Commandant' },
      { from: 'Commanding Officer, Headquarters Battalion, Camp Smith', to: 'Commandant of the Marine Corps' },
      { from: LONG_FROM, to: LONG_TO },
    ];
    const columns: number[] = [];
    for (const entry of lengths) {
      const blob = await generateBasePDFBlob({ ...LETTER, ...entry }, [LONG_VIA], [], [], [], PARAGRAPHS, []);
      const layout = await extractPdfTextLayout(blob);
      const margin = Math.min(...layout.map(i => i.x));
      for (const label of ['From:', 'To:', 'Via:']) {
        const line = layout.find(i => i.text.trim().startsWith(label));
        expect(line, `${label} line must render`).toBeDefined();
        const value = layout
          .filter(i => Math.abs(i.y - line!.y) < 1 && i.x > line!.x && i.text.trim() !== '')
          .sort((a, b) => a.x - b.x)[0];
        expect(value, `${label} value must render`).toBeDefined();
        // 0.5 inch from the left margin, the column the DOCX tab and
        // hanging indent both use (720 twips).
        expect(value!.x - margin, `${label} column`).toBeCloseTo(36, 1);
        columns.push(value!.x);
      }
    }
    const first = columns[0];
    for (const column of columns) {
      expect(column, `column drifted: ${columns.join(', ')}`).toBeCloseTo(first, 1);
    }
  });

  it('a wrapped line starts under the first word, not at the margin', async () => {
    const blob = await generateBasePDFBlob(LETTER, [LONG_VIA], [], [], [], PARAGRAPHS, []);
    const layout = await extractPdfTextLayout(blob);
    const margin = Math.min(...layout.map(i => i.x));
    const from = layout.find(i => i.text.trim().startsWith('From:'))!;
    const value = layout
      .filter(i => Math.abs(i.y - from.y) < 1 && i.x > from.x && i.text.trim() !== '')
      .sort((a, b) => a.x - b.x)[0];
    // The next line down belongs to the same entry: it must sit on the
    // value column, never back at the margin under the label.
    const wrapped = layout
      .filter(i => i.y < from.y - 1 && i.y > from.y - 20 && i.text.trim() !== '')
      .sort((a, b) => a.x - b.x)[0];
    expect(wrapped, 'the From entry must wrap for this test to mean anything').toBeDefined();
    expect(wrapped!.x).toBeCloseTo(value.x, 1);
    expect(wrapped!.x).toBeGreaterThan(margin + 20);
  });
});

describe('Courier headings hang to their own 7-character column', () => {
  // Courier is 7.2pt per character and the labels pad to 7 characters
  // ("From:" + 2 spaces, "To:" + 4, "Via:" + 3, "Subj:" + 2), so the
  // text column is 50.4pt, not the 36pt Times reaches through its tab.
  // Measured 2026-08-16: the preview sent courier wraps to the margin,
  // and the first pass at the export hung them to 36pt, 14pt short of
  // their own text.
  const COURIER_COLUMN = 50.4;
  const COURIER = {
    ...BASE,
    documentType: 'basic',
    bodyFont: 'courier',
    date: '10 Feb 26',
    subj: 'STANDARD NAVAL LETTER TEMPLATE STANDARD NAVAL LETTER TEMPLATE STANDARD NAVAL LETTER TEMPLATE',
    from: 'Commanding Officer, Unit Name, City, State Zip Commanding Officer, Unit Name, City, State Zip',
    to: 'Commanding Officer, Destination Unit, City, State Zip Commanding Officer, Destination Unit, City, State Zip',
  };
  const COURIER_VIA = ['Commanding Officer, Destination Unit, City, State Zip Commanding Officer, Destination Unit, City, State Zip'];

  it('the export hangs to 1008 twips, the courier column', async () => {
    const blob = await generateDocxBlob(COURIER, COURIER_VIA, [], [], [], PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const headings = (xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? []).filter(p =>
      /^(From:|To:|Via:)/.test(p.replace(/<[^>]+>/g, '').trim()),
    );
    expect(headings).toHaveLength(3);
    for (const heading of headings) {
      expect(heading).toContain('<w:ind w:left="1008" w:hanging="1008"/>');
    }
  });

  it('Times still hangs to 720 twips', async () => {
    const blob = await generateDocxBlob({ ...COURIER, bodyFont: 'times' }, COURIER_VIA, [], [], [], PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:ind w:left="720" w:hanging="720"/>');
    expect(xml).not.toContain('<w:ind w:left="1008" w:hanging="1008"/>');
  });

  it('the preview wraps every courier heading to the same column', async () => {
    const blob = await generateBasePDFBlob(COURIER, COURIER_VIA, [], [], [], PARAGRAPHS, []);
    const layout = await extractPdfTextLayout(blob);
    const margin = Math.min(...layout.map(i => i.x));
    for (const label of ['From:', 'To:', 'Via:', 'Subj:']) {
      const line = layout.find(i => i.text.trim().startsWith(label));
      expect(line, `${label} must render`).toBeDefined();
      const wrapped = layout
        .filter(i => i.y < line!.y - 1 && i.y > line!.y - 20 && i.text.trim() !== '')
        .sort((a, b) => a.x - b.x)[0];
      expect(wrapped, `${label} must wrap for this test to mean anything`).toBeDefined();
      expect(wrapped!.x - margin, `${label} wrap column`).toBeCloseTo(COURIER_COLUMN, 1);
    }
  });
});

/**
 * Reference lettering and enclosure numbering, M-5216.5 9-2.3 and
 * 9-2.4. Two divergences of the same class, both measured before D.3:
 *
 *   5. The DOCX applied startingReferenceLevel and
 *      startingEnclosureNumber to every document type while the PDF
 *      applied them only to an endorsement, so a stale "c" on a basic
 *      letter (a saved draft, a shared link) lettered Word (c) and (d)
 *      against a preview reading (a) and (b).
 *   6. Both emitters walked character codes from the starting letter,
 *      so the 27th reference printed "{" where the validator and the
 *      package assembler read "aa".
 *
 * Only an endorsement continues another document's sequences, and the
 * walk itself lives in src/lib/reference-letters.ts.
 */
describe('reference letters and enclosure numbers are scoped and shared', () => {
  const REFS = ['MCO 1500.1 of 3 Mar 25', 'MCO 1600.2 of 4 Apr 25'];
  const ENCLS = ['Roster of 4 Apr 25'];
  const CONTINUED = { startingReferenceLevel: 'c', startingEnclosureNumber: '3' };

  const STALE_BASIC = {
    ...BASE,
    documentType: 'basic',
    from: 'Commanding Officer, Unit',
    to: 'Commandant of the Marine Corps',
    ...CONTINUED,
  };

  const ENDORSEMENT = {
    ...STALE_BASIC,
    documentType: 'endorsement',
    endorsementLevel: 'FIRST',
    basicLetterReference: '1500 G-1 of 3 Mar 25',
  };

  it('a basic letter carrying a stale starting letter renders (a) and (b) in the DOCX', async () => {
    const text = await docxListText(STALE_BASIC, REFS, ENCLS);
    expect(text).toContain('(a)');
    expect(text).toContain('(b)');
    expect(text).not.toContain('(c)');
    expect(text).toContain('(1)');
    expect(text).not.toContain('(3)');
  });

  it('and the same (a) and (b) in the PDF', async () => {
    const text = await pdfListText(STALE_BASIC, REFS, ENCLS);
    expect(text).toContain('(a)');
    expect(text).toContain('(b)');
    expect(text).not.toContain('(c)');
    expect(text).toContain('(1)');
    expect(text).not.toContain('(3)');
  });

  it('an endorsement renders (c) and (d) in the DOCX', async () => {
    const text = await docxListText(ENDORSEMENT, REFS, ENCLS);
    expect(text).toContain('(c)');
    expect(text).toContain('(d)');
    expect(text).not.toContain('(a)');
    expect(text).toContain('(3)');
  });

  it('and the same (c) and (d) in the PDF', async () => {
    const text = await pdfListText(ENDORSEMENT, REFS, ENCLS);
    expect(text).toContain('(c)');
    expect(text).toContain('(d)');
    expect(text).not.toContain('(a)');
    expect(text).toContain('(3)');
  });

  const MANY = Array.from({ length: 27 }, (_, i) => `MCO ${1500 + i}.1 of 3 Mar 25`);

  it('the 27th reference letters as (aa) in the DOCX, never as "{"', async () => {
    const text = await docxListText({ ...STALE_BASIC, ...{ startingReferenceLevel: 'a' } }, MANY);
    expect(text).toContain('(z)');
    expect(text).toContain('(aa)');
    expect(text).not.toContain('({)');
  });

  it('the 27th reference letters as (aa) in the PDF, never as "{"', async () => {
    const text = await pdfListText({ ...STALE_BASIC, ...{ startingReferenceLevel: 'a' } }, MANY);
    expect(text).toContain('(z)');
    expect(text).toContain('(aa)');
    expect(text).not.toContain('({)');
  });

  it('and the validator letters the same 27 the same way', () => {
    const cited = indexRange(27).map((l) => `ref (${l})`).join(', ');
    const issues = runLetterValidators(
      { ...STALE_BASIC, startingReferenceLevel: 'a' } as any,
      [],
      MANY,
      [{ id: '1', level: 1, content: cited, title: '' }] as any,
    );
    expect(issues.filter((i) => i.id.startsWith('ref-'))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * D.5, 2026-09-05: the civilian branch follows chapters 11 and 12.    *
 * ------------------------------------------------------------------ */

describe('business and executive letters follow chapters 11 and 12', () => {
  /** Two body paragraphs. The first wraps, so the wrapped line shows
   *  the first-line indent against the left margin; the second is the
   *  last line of text the close is measured from. */
  const CIVIL_PARAGRAPHS = [
    {
      id: '1',
      level: 1,
      title: '',
      content:
        'Alpha paragraph body long enough to wrap onto a second line so the ' +
        'wrapped line sits at the left margin while the first line is indented.',
    },
    { id: '2', level: 1, title: '', content: 'ZLASTBODYZ' },
  ] as any;

  const CIVIL = {
    ...BASE,
    ssic: '5216',
    originatorCode: 'Ser JA/28',
    sig: 'j. q. public',
    signerTitle: 'Executive Officer',
    recipientName: 'Mr. A. B. Seay',
    recipientAddress: '1234 Any Street\nBaltimore, MD 21085-1234',
    salutation: 'Dear Mr. Seay:',
  };

  const BUSINESS = { ...CIVIL, documentType: 'business-letter' };
  const EXECUTIVE = { ...CIVIL, documentType: 'executive-correspondence', execFormat: 'letter' };
  const ENCLOSURES = ['Widget report', 'Cost sheet'];

  async function civilianLayout(formData: any) {
    const blob = await generateBasePDFBlob(formData, [], [], ENCLOSURES, [], CIVIL_PARAGRAPHS, []);
    return extractPdfTextLayout(blob);
  }

  /** The y and x of the first layout item whose text starts with `prefix`. */
  const yOf = (layout: PdfTextItem[], prefix: string) =>
    layout.find((i) => i.text.startsWith(prefix))!.y;
  const xOf = (layout: PdfTextItem[], prefix: string) =>
    layout.find((i) => i.text.startsWith(prefix))!.x;

  /** Paragraphs of word/document.xml as {text, firstLine} in order. */
  async function docxParagraphs(formData: any) {
    const blob = await generateDocxBlob(formData, [], [], ENCLOSURES, [], CIVIL_PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    return [...xml.matchAll(/<w:p(?: [^>]*)?>([\s\S]*?)<\/w:p>/g)].map((m) => ({
      text: [...m[1].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join(''),
      firstLine: /w:firstLine="(\d+)"/.exec(m[1])?.[1] ?? null,
    }));
  }

  /** Alignment of the identification-symbol table in the DOCX. */
  async function docxIdBlockAlignment(formData: any) {
    const blob = await generateDocxBlob(formData, [], [], ENCLOSURES, [], CIVIL_PARAGRAPHS, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const tblPr = /<w:tblPr>([\s\S]*?)<\/w:tblPr>/.exec(xml)![1];
    return /<w:jc w:val="(\w+)"\/>/.exec(tblPr)![1];
  }

  /** Blank paragraphs between the two given texts in the DOCX body. */
  function blanksBetween(paragraphs: { text: string }[], first: string, second: string) {
    const from = paragraphs.findIndex((p) => p.text.includes(first));
    const to = paragraphs.findIndex((p, i) => i > from && p.text.includes(second));
    return paragraphs.slice(from + 1, to).filter((p) => p.text.trim() === '').length;
  }

  // M-5216.5 11-2.1 and Fig 11-2: the three identification symbols sit
  // "in the upper left corner, blocked one below the other". Both
  // emitters anchored them right, measured x=460.3pt in the preview.
  it('the business-letter identification symbols block at the left margin', async () => {
    const layout = await civilianLayout(BUSINESS);
    expect(xOf(layout, '5216')).toBe(PDF_MARGINS.left);
    expect(xOf(layout, 'Ser JA/28')).toBe(PDF_MARGINS.left);
    expect(xOf(layout, 'August 14, 2026')).toBe(PDF_MARGINS.left);
    expect(await docxIdBlockAlignment(BUSINESS)).toBe('left');
  });

  // Fig 11-4 sets the window-envelope symbols right of centre on line
  // 10, clear of the address window, so that variant keeps its anchor.
  it('the window-envelope variant keeps its right-anchored block', async () => {
    const layout = await civilianLayout({ ...BUSINESS, isWindowEnvelope: true });
    expect(xOf(layout, '5216')).toBeGreaterThan(400);
    expect(await docxIdBlockAlignment({ ...BUSINESS, isWindowEnvelope: true })).toBe('right');
  });

  // Chapter 12 states no placement for the executive identification
  // symbols and Fig 12-2 shows the date to the right, so it is left
  // where it is.
  it('the executive letter keeps its right-anchored block', async () => {
    const layout = await civilianLayout(EXECUTIVE);
    expect(xOf(layout, '5216')).toBeGreaterThan(400);
    expect(await docxIdBlockAlignment(EXECUTIVE)).toBe('right');
  });

  // M-5216.5 11-2.9.a(1): "Signer's name in all capital letters."
  // The preview printed it as typed while the export capitalised it.
  it.each([['business', BUSINESS], ['executive', EXECUTIVE]] as const)(
    'the %s signer name renders in capitals on both surfaces',
    async (_label, formData) => {
      const layout = await civilianLayout(formData);
      const text = layout.map((i) => i.text).join('\n');
      expect(text).toContain('J. Q. PUBLIC');
      expect(text).not.toContain('j. q. public');
      const paragraphs = await docxParagraphs(formData);
      expect(paragraphs.some((p) => p.text === 'J. Q. PUBLIC')).toBe(true);
    },
  );

  // M-5216.5 11-2.6 "four spaces, or set margin at half inch" and
  // 12-3.2.c(2) "Each paragraph must be indented 1/2 inch". The
  // preview measured x=72.0pt, no indent at all, because react-pdf
  // reads textIndent on the Text node and not on the View.
  it.each([['business', BUSINESS], ['executive', EXECUTIVE]] as const)(
    'the %s first line indents half an inch and the wrap returns to the margin',
    async (_label, formData) => {
      const layout = await civilianLayout(formData);
      expect(xOf(layout, 'Alpha paragraph body')).toBe(PDF_MARGINS.left + 36);
      expect(xOf(layout, 'ZLASTBODYZ')).toBe(PDF_MARGINS.left + 36);
      // The run after the first line is that paragraph's wrapped line,
      // which returns to the left margin.
      const first = layout.findIndex((i) => i.text.startsWith('Alpha paragraph body'));
      const wrapped = layout[first + 1];
      expect(wrapped.text).not.toContain('ZLASTBODYZ');
      expect(wrapped.x).toBe(PDF_MARGINS.left);
      const paragraphs = await docxParagraphs(formData);
      expect(paragraphs.find((p) => p.text === 'ZLASTBODYZ')?.firstLine).toBe('720');
    },
  );

  // M-5216.5 11-2.8 and 12-3.4: the close on the second line below the
  // text. 11-2.9.a and 12-3.2.e(3)(a): the name on the fourth line
  // below the close. Measured three and six before this change.
  it.each([['business', BUSINESS], ['executive', EXECUTIVE]] as const)(
    'the %s close and name sit on the second and fourth lines',
    async (_label, formData) => {
      const layout = await civilianLayout(formData);
      const lastBody = yOf(layout, 'ZLASTBODYZ');
      const close = yOf(layout, 'Sincerely,');
      const name = yOf(layout, 'J. Q. PUBLIC');
      expect(lastBody - close).toBeCloseTo(2 * LINE_HEIGHT_12PT, 1);
      expect(close - name).toBeCloseTo(4 * LINE_HEIGHT_12PT, 1);
      const paragraphs = await docxParagraphs(formData);
      expect(blanksBetween(paragraphs, 'ZLASTBODYZ', 'Sincerely,')).toBe(1);
      expect(blanksBetween(paragraphs, 'Sincerely,', 'J. Q. PUBLIC')).toBe(3);
    },
  );

  // M-5216.5 11-2.10.a: "Type 'Enclosure' on the second line below the
  // signature line, number and describe them briefly." Chapter 12
  // states no enclosure-line form, so the executive letter keeps its
  // plain list.
  it('the business letter numbers its enclosure entries on both surfaces', async () => {
    const layout = await civilianLayout(BUSINESS);
    const text = layout.map((i) => i.text).join('');
    expect(text).toContain('(1) Widget report');
    expect(text).toContain('(2) Cost sheet');
    const paragraphs = await docxParagraphs(BUSINESS);
    expect(paragraphs.some((p) => p.text === '(1) Widget report')).toBe(true);
    expect(paragraphs.some((p) => p.text === '(2) Cost sheet')).toBe(true);
  });

  it('the executive letter leaves its enclosure entries unnumbered', async () => {
    const paragraphs = await docxParagraphs(EXECUTIVE);
    expect(paragraphs.some((p) => p.text === 'Widget report')).toBe(true);
    expect(paragraphs.some((p) => p.text === '(1) Widget report')).toBe(false);
  });
});

describe('DLA correspondence does not move with the business letter', () => {
  // The DLA plan (docs/DLA_CORRESPONDENCE_PLAN.md) makes the DLA
  // ruleset "a separate, parallel ruleset", additive only, governed by
  // the DLA Correspondence Manual rather than M-5216.5 chapters 11 and
  // 12. Every block D.5 touches already excludes the DLA types, and
  // this pins that: the positions below are the pre-D.5 measurement.
  const DLA = {
    ...BASE,
    documentType: 'dla-business-letter',
    headerType: 'DLA',
    ssic: '5216',
    originatorCode: 'Ser JA/28',
    sig: 'j. q. public',
    signerFullName: 'J. Q. PUBLIC',
    recipientName: 'Mr. A. B. Seay',
    recipientAddress: '1234 Any Street',
    salutation: 'Dear Mr. Seay:',
  } as any;

  const DLA_PARAGRAPHS = [
    { id: '1', level: 1, title: '', content: 'Alpha paragraph body.' },
    { id: '2', level: 2, title: '', content: 'Subdivision body.' },
  ] as any;

  it('the DLA business letter renders the layout it rendered before D.5', async () => {
    const blob = await generateBasePDFBlob(DLA, [], [], ['Widget report'], [], DLA_PARAGRAPHS, []);
    const layout = await extractPdfTextLayout(blob);
    const at = (prefix: string) => {
      const item = layout.find((i) => i.text.startsWith(prefix))!;
      return { x: item.x, y: item.y };
    };
    // Date flush right, no SSIC block: DLA Corr Manual Ch.3.
    expect(at('August 14, 2026')).toEqual({ x: 460.3, y: 675.2 });
    // Level 1 body at the left margin, subdivision one tab in.
    expect(at('Alpha paragraph body.').x).toBe(72);
    expect(at('a.').x).toBe(108);
    // Attachment line above the body, not below the signature.
    expect(at('Attachment:').y).toBeGreaterThan(at('Alpha paragraph body.').y);
    // Close and full name as the DLA branch has always placed them.
    const close = at('Sincerely,');
    const name = at('J. Q. PUBLIC');
    expect(close.x).toBe(306);
    expect(close.y - name.y).toBeCloseTo(6 * LINE_HEIGHT_12PT, 1);
  });
});
