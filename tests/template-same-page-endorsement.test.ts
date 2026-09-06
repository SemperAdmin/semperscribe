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

  it('is an appointment letter from the commander to a Marine, acknowledged on the same page', () => {
    // The letter, signer 1, no Via.
    expect(templateFormData.from).toBe('Commanding Officer, (Unit)');
    expect(templateFormData.to).toBe('Staff Sergeant John T. Smith 1234567890/0111 USMC');
    expect(templateFormData.subj).toBe('APPOINTMENT AS COMMAND DESIGNATED DIRECTIVES MANAGER (CDDM)');
    expect(templateFormData.sig).toBe('I. M. COMMANDER');
    expect(nldp.data.vias).toEqual([]);
    expect(nldp.data.references).toEqual(['MCO 5215.1K w/Admin CH-3', 'The Directives Review Process (DRP) Guide']);
    expect(templateParagraphs[0].content).toMatch(/^Per references \(a\) and \(b\), you are appointed/);
    // The endorsement, signer 2: the Marine back to the commander, the
    // reversal the no-Via case derives (9-2.2 has no Via to hand it to).
    const part = templateFormData.samePageEndorsement!;
    expect(part.from).toBe(templateFormData.to);
    expect(part.to).toBe(templateFormData.from);
    expect(part.vias).toEqual([]);
    expect(part.sig).toBe('J. T. SMITH');
    expect(part.paragraphs[0].content).toMatch(/^I acknowledge this appointment/);
    expect(deriveEndorsementAddressing({ from: templateFormData.from!, to: templateFormData.to!, vias: nldp.data.vias }))
      .toMatchObject({ from: part.from, to: part.to, vias: [], replies: true });
  });

  it('keeps the manual\'s own example as a second entry under the same option', () => {
    const figure = index.find((e) => e.id === 'same-page-figure-9-1')!;
    expect(figure).toBeDefined();
    expect(figure.documentType).toBe(SAME_PAGE_ENDORSEMENT_OPTION);
    const fd = JSON.parse(readFileSync(join(GLOBAL_DIR, 'same-page-figure-9-1.nldp'), 'utf-8')).data.formData;
    expect(fd.sig).toBe('G. L. SLAUGHTER, JR');
    expect(fd.samePageEndorsement.sig).toBe('R. L. GABEL');
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
    expect(page).toContain('I. M. COMMANDER');
    expect(page).toContain('FIRST ENDORSEMENT');
    expect(page).toContain('J. T. SMITH');
    expect(page).toContain('I acknowledge this appointment');
  }, 90_000);
});
