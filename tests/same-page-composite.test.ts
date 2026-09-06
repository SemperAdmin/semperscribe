// @vitest-environment node
/**
 * E.5 - the same-page endorsement written from scratch: one document,
 * two halves, two signers (SECNAV M-5216.5 9-1, 9-2, Figure 9-1).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import {
  deriveEndorsementAddressing, derivedBasicLetterReference, nextReferenceLetter, nextEnclosureNumber,
  letterContext, endorsementContext, migrateLegacySamePage, validateSamePageComposite, hasSamePageComposite,
  emptySamePagePart, type RenderContext,
} from '@/lib/same-page-composite';
import { asSamePageBlock } from '@/lib/same-page-endorsement';
import type { FormData, ParagraphData } from '@/types';

beforeAll(() => {
  registerNodeAssets();
});

const TEMPLATE = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'templates', 'global', 'same-page-endorsement.nldp'), 'utf-8'));

/** Figure 9-1 as the template ships it, with a letterhead for the render. */
function figure(): RenderContext {
  const d = TEMPLATE.data;
  return {
    formData: { ...d.formData, line1: 'NAVAL AIR STATION', line2: 'MERIDIAN MS 39305-1000' } as FormData,
    vias: d.vias, references: d.references, enclosures: d.enclosures, copyTos: d.copyTos,
    paragraphs: d.paragraphs, distList: [],
  };
}

const text = (items: { page: number; text: string }[], page: number) =>
  items.filter((i) => i.page === page).map((i) => i.text).join(' ');

describe('addressing (9-2.2, Figure 9-1)', () => {
  it('lets the first Via endorse to the addressee with the remaining Vias carried forward', () => {
    expect(deriveEndorsementAddressing({ from: 'CO, NAS Meridian', to: 'Commander, Fleet Forces Command', vias: ['Wing', 'AIRLANT'] }))
      .toEqual({ from: 'Wing', to: 'Commander, Fleet Forces Command', vias: ['AIRLANT'], replies: false });
  });

  it('reverses From and To when the letter has no Via, and says so', () => {
    expect(deriveEndorsementAddressing({ from: 'Sergeant Sample', to: 'Commanding Officer', vias: [''] }))
      .toEqual({ from: 'Commanding Officer', to: 'Sergeant Sample', vias: [], replies: true });
  });

  it('writes the letter in reference style for the endorsement line', () => {
    expect(derivedBasicLetterReference({ documentType: 'endorsement', from: 'CO, NAS Meridian', ssic: '5216', originatorCode: 'Ser 11/273', date: '22 Apr 15' } as FormData))
      .toBe('CO, NAS Meridian ltr 5216 Ser 11/273 of 22 Apr 15');
  });

  it('continues the reference letters and enclosure numbers after the letter\'s (9-2.3, 9-2.4)', () => {
    expect(nextReferenceLetter(['(a)', '(b)'])).toBe('c');
    expect(nextReferenceLetter([], 'c')).toBe('c');
    expect(nextReferenceLetter(['x'], 'c')).toBe('d');
    expect(nextEnclosureNumber(['one'])).toBe('2');
    expect(nextEnclosureNumber(['one', 'two'], '3')).toBe('5');
  });
});

describe('the two halves as render contexts', () => {
  it('renders the main sections as a basic letter signed by signer 1', () => {
    const letter = letterContext(figure());
    expect(letter.formData.documentType).toBe('basic');
    expect(letter.formData.sig).toBe('G. L. SLAUGHTER, JR');
    expect(letter.formData.samePageEndorsement).toBeUndefined();
    expect(letter.vias).toHaveLength(2);
  });

  it('renders the part as the same-page endorsement signed by signer 2, numbered after the letter', () => {
    const block = endorsementContext(figure());
    expect(block.formData.documentType).toBe('endorsement');
    expect(block.formData.endorsementPlacement).toBe('same-page');
    expect(block.formData.from).toBe('Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic');
    expect(block.formData.sig).toBe('R. L. GABEL');
    expect(block.formData.originatorCode).toBe('Ser 019/870');
    expect(block.vias).toEqual(['Commander, Naval Air Force, U.S. Atlantic Fleet']);
    expect(block.copyTos).toEqual(['NAS Meridian (Code 11)']);
    expect(block.formData.startingEnclosureNumber).toBe('2');
    expect(block.formData.startingReferenceLevel).toBe('a');
    expect(block.formData.basicLetterReference).toBe('NAS Meridian ltr 5216 Ser 11/273 of 22 Apr 15');
  });
});

describe('migration of a same-page endorsement saved before E.5', () => {
  const legacy = {
    documentType: 'endorsement', endorsementPlacement: 'same-page', endorsementLevel: 'FIRST',
    from: 'Wing', to: 'Fleet', sig: 'R. L. GABEL', originatorCode: 'Ser 1', date: '1 Jan 26',
  } as FormData;
  const slices = { vias: ['AIRLANT', ''], references: [''], enclosures: [''], copyTos: ['NAS Meridian'], paragraphs: [{ id: 1, level: 1, content: 'Forwarded.' }] as ParagraphData[] };

  it('moves the main fields into the endorsement part and empties the letter', () => {
    const out = migrateLegacySamePage(legacy, slices)!;
    expect(out).not.toBeNull();
    expect(out.formData.samePageEndorsement?.from).toBe('Wing');
    expect(out.formData.samePageEndorsement?.sig).toBe('R. L. GABEL');
    expect(out.formData.samePageEndorsement?.vias).toEqual(['AIRLANT']);
    expect(out.formData.samePageEndorsement?.copyTos).toEqual(['NAS Meridian']);
    expect(out.formData.samePageEndorsement?.paragraphs[0].content).toBe('Forwarded.');
    expect(out.formData.samePageEndorsement?.addressingEdited).toBe(true);
    expect(out.formData.from).toBe('');
    expect(out.formData.sig).toBe('');
    expect(out.paragraphs[0].content).toBe('');
    expect(out.vias).toEqual(['']);
  });

  it('leaves a two-half document and every other type alone', () => {
    expect(migrateLegacySamePage({ ...legacy, samePageEndorsement: emptySamePagePart() }, slices)).toBeNull();
    expect(migrateLegacySamePage({ documentType: 'basic' } as FormData, slices)).toBeNull();
    expect(migrateLegacySamePage({ documentType: 'endorsement', endorsementPlacement: 'new-page' } as FormData, slices)).toBeNull();
  });
});

describe('rules for the two-half document', () => {
  const base = (): FormData => ({ ...figure().formData });
  const ids = (fd: FormData) => validateSamePageComposite(fd).map((i) => i.id);

  it('accepts Figure 9-1', () => {
    expect(hasSamePageComposite(base())).toBe(true);
    expect(ids(base())).toEqual([]);
  });

  it('blocks a missing From, To, signer or body, each cited', () => {
    const fd = base();
    fd.samePageEndorsement = { ...fd.samePageEndorsement!, from: '', to: '', sig: '', paragraphs: [{ id: 1, level: 1, content: '' }] };
    const issues = validateSamePageComposite(fd);
    expect(issues.map((i) => i.id)).toEqual(['same-page-endorsement-from', 'same-page-endorsement-to', 'same-page-endorsement-sig', 'same-page-endorsement-body']);
    for (const issue of issues) {
      expect(issue.severity).toBe('block');
      expect(issue.citation).toContain('M-5216.5');
    }
  });

  it('warns, not blocks, when the endorsement goes back to the letter\'s writer (9-1)', () => {
    const fd = base();
    fd.samePageEndorsement = { ...fd.samePageEndorsement!, to: fd.from as string };
    const [issue] = validateSamePageComposite(fd);
    expect(issue.id).toBe('same-page-endorsement-reply');
    expect(issue.severity).toBe('warn');
    expect(issue.citation).toBe('M-5216.5 9-1');
  });

  it('says nothing when a received PDF is the letter, or for a legacy document', () => {
    expect(ids({ ...base(), samePageHost: { kind: 'file', fileId: 'f', fileName: 'x.pdf' } })).toEqual([]);
    expect(ids({ ...base(), samePageEndorsement: undefined })).toEqual([]);
  });
});

describe('the render through the pipeline', () => {
  it('composes Figure 9-1 onto one page with both signers and the rule between them', async () => {
    const blob = await generatePdfForDocType(figure());
    const items = await extractPdfTextLayout(blob);
    expect(Math.max(...items.map((i) => i.page))).toBe(1);
    const page = text(items, 1);
    expect(page).toContain('HOW TO PREPARE AN ENDORSEMENT');
    expect(page).toContain('G. L. SLAUGHTER, JR');
    expect(page).toContain('FIRST ENDORSEMENT');
    expect(page).not.toContain('FIRST ENDORSEMENT on');
    expect(page).toContain('Ser 019/870');
    expect(page).toContain('R. L. GABEL');
    expect(page).toContain('NAS Meridian (Code 11)');
    // Signer 1 above signer 2.
    const slaughter = items.find((i) => i.text.includes('SLAUGHTER'))!;
    const gabel = items.find((i) => i.text.includes('GABEL'))!;
    expect(slaughter.y).toBeGreaterThan(gabel.y);
  }, 90_000);

  it('renders the endorsement alone when asked for the block', async () => {
    const ctx = figure();
    const blob = await generatePdfForDocType({ ...ctx, formData: asSamePageBlock(ctx.formData) });
    const page = text(await extractPdfTextLayout(blob), 1);
    expect(page).toContain('FIRST ENDORSEMENT');
    expect(page).toContain('R. L. GABEL');
    expect(page).not.toContain('SLAUGHTER');
    expect(page).not.toContain('NAVAL AIR STATION');
  }, 90_000);

  it('falls back to a new page with the identification restored when the endorsement does not fit', async () => {
    const ctx = figure();
    const long = Array.from({ length: 14 }, (_, i) => ({
      id: i + 1, level: 1,
      content: `Paragraph ${i + 1} of a long endorsement with enough comment that the whole endorsement cannot be added to the signature page of the basic letter, which is the condition paragraph 9-1 tests.`,
    }));
    ctx.formData = { ...ctx.formData, samePageEndorsement: { ...ctx.formData.samePageEndorsement!, paragraphs: long } };
    const items = await extractPdfTextLayout(await generatePdfForDocType(ctx));
    expect(Math.max(...items.map((i) => i.page))).toBeGreaterThanOrEqual(2);
    const page2 = text(items, 2);
    expect(page2).toContain('FIRST ENDORSEMENT on NAS Meridian ltr 5216 Ser 11/273 of 22 Apr 15');
    expect(page2).toContain('Subj:');
    expect(page2).toContain('5216');
  }, 90_000);
});
