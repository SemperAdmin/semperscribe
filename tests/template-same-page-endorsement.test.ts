// @vitest-environment node
/**
 * E.1 follow-up: the Same-Page Endorsement template.
 *
 * The template library's endorsement entry ships the new-page form
 * only, so a drafter who wants the 9-1 same-page form has to change
 * the placement and take the 9-2.1.a omission by hand. This template
 * ships both settings pre-filled. The test reads the shipped file the
 * way the app does (fetch, merge over the current form), checks the
 * two placement fields survive the merge, and renders the block to
 * prove the shipped body fits on a signature page.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { registerNodeAssets } from './node-assets';
import { EndorsementSchema } from '@/lib/schemas';
import { omitsIdentification, isSamePageEndorsement } from '@/lib/same-page-endorsement';
import { hasSamePageComposite, deriveEndorsementAddressing } from '@/lib/same-page-composite';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { extractPdfTextLayout } from './golden/helpers';
import { SAME_PAGE_ENDORSEMENT_OPTION, resolvePickerType } from '@/lib/document-type-options';
import type { FormData, ParagraphData } from '@/types';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
const TEMPLATE_ID = 'same-page-endorsement';

type IndexEntry = { id: string; title: string; description?: string; documentType?: string; url: string };

const index: IndexEntry[] = JSON.parse(readFileSync(join(GLOBAL_DIR, 'index.json'), 'utf-8'));
const entry = index.find((e) => e.id === TEMPLATE_ID)!;
const nldp = JSON.parse(readFileSync(join(GLOBAL_DIR, entry.url.replace('/templates/global/', '')), 'utf-8'));
const templateFormData: Partial<FormData> = nldp.data.formData;
const templateParagraphs: ParagraphData[] = nldp.data.paragraphs;

/** The merge useImportExport.handleImport performs: template over the current form. */
const merged: FormData = { ...FIXTURE_FORM_DATA, ...templateFormData };



beforeAll(() => {
  registerNodeAssets();
});

describe('Same-Page Endorsement template (library entry)', () => {
  it('is listed next to the new-page endorsement under the same-page option', () => {
    expect(entry).toBeDefined();
    expect(entry.documentType).toBe(SAME_PAGE_ENDORSEMENT_OPTION);
    expect(resolvePickerType(entry.documentType!).documentType).toBe('endorsement');
    expect(index.find((e) => e.id === 'endorsement')?.documentType).toBe('endorsement');
    const ids = index.map((e) => e.id);
    expect(ids.indexOf(TEMPLATE_ID)).toBe(ids.indexOf('endorsement') + 1);
  });

  it('ships the same-page placement and the 9-2.1.a omission pre-filled', () => {
    expect(templateFormData.documentType).toBe('endorsement');
    expect(templateFormData.endorsementPlacement).toBe('same-page');
    expect(templateFormData.samePageOmitsIdentification).toBe(true);
    expect(templateFormData.endorsementLevel).toBe('FIRST');
  });

  it('is Figure 9-1 as one document: the letter and its first endorsement', () => {
    // The letter, signer 1.
    expect(templateFormData.from).toBe('Commanding Officer, Naval Air Station, Meridian');
    expect(templateFormData.to).toBe('Commander, Fleet Forces Command');
    expect(templateFormData.ssic).toBe('5216');
    expect(templateFormData.originatorCode).toBe('Ser 11/273');
    expect(templateFormData.date).toBe('22 Apr 15');
    expect(templateFormData.subj).toBe('HOW TO PREPARE AN ENDORSEMENT');
    expect(templateFormData.sig).toBe('G. L. SLAUGHTER, JR');
    expect(nldp.data.vias).toEqual(['Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic', 'Commander, Naval Air Force, U.S. Atlantic Fleet']);
    expect(nldp.data.enclosures).toEqual(['Example of New-Page Endorsement']);
    expect(templateParagraphs[0].content).toMatch(/^An endorsement may be added to the bottom of a basic letter/);
    // The endorsement, signer 2, addressed per 9-2.2.
    const part = templateFormData.samePageEndorsement!;
    expect(part.from).toBe('Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic');
    expect(part.to).toBe('Commander, Fleet Forces Command');
    expect(part.vias).toEqual(['Commander, Naval Air Force, U.S. Atlantic Fleet']);
    expect(part.originatorCode).toBe('Ser 019/870');
    expect(part.date).toBe('23 Apr 15');
    expect(part.sig).toBe('R. L. GABEL');
    expect(part.copyTos).toEqual(['NAS Meridian (Code 11)']);
    expect(part.paragraphs[0].content).toMatch(/^A same-page endorsement may omit the SSIC/);
    expect(deriveEndorsementAddressing({ from: templateFormData.from!, to: templateFormData.to!, vias: nldp.data.vias }))
      .toMatchObject({ from: part.from, to: part.to, vias: part.vias });
  });

  it('survives the import merge and reads as a two-half same-page endorsement', () => {
    expect(isSamePageEndorsement(merged)).toBe(true);
    expect(omitsIdentification(merged)).toBe(true);
    expect(hasSamePageComposite(merged)).toBe(true);
    const parsed = EndorsementSchema.safeParse(merged);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });

  it('renders as one page carrying both signers (9-1)', async () => {
    const blob = await generatePdfForDocType({
      formData: merged, vias: nldp.data.vias, references: nldp.data.references, enclosures: nldp.data.enclosures,
      copyTos: nldp.data.copyTos, paragraphs: templateParagraphs, distList: [],
    });
    const items = await extractPdfTextLayout(blob);
    expect(Math.max(...items.map((i) => i.page))).toBe(1);
    const page = items.map((i) => i.text).join(' ');
    expect(page).toContain('G. L. SLAUGHTER, JR');
    expect(page).toContain('FIRST ENDORSEMENT');
    expect(page).toContain('R. L. GABEL');
  }, 90_000);
});
