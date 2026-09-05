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
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { EndorsementSchema } from '@/lib/schemas';
import {
  composeSamePage,
  measureBlockExtent,
  endorsementLineText,
  omitsIdentification,
  isSamePageEndorsement,
  asSamePageBlock,
} from '@/lib/same-page-endorsement';
import { SAME_PAGE_ENDORSEMENT_OPTION, resolvePickerType } from '@/lib/document-type-options';
import type { FormData, ParagraphData } from '@/types';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

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

/**
 * Figure 9-1's first endorsement carries a Via line, a Copy to and a
 * three-line paragraph, 276 pt in all, so the letter under it needs
 * a short body: the fixture with one paragraph leaves 295 pt.
 */
const SHORT_HOST_BODY: ParagraphData[] = [
  { id: 1, level: 1, content: 'Request approval of the action described below.', isMandatory: true },
];

async function hostBytes(): Promise<Uint8Array> {
  const blob = await generateBasePDFBlob(
    FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, SHORT_HOST_BODY, [],
  );
  return new Uint8Array(await blob.arrayBuffer());
}

async function blockBytes(): Promise<Uint8Array> {
  const blob = await generateBasePDFBlob(
    asSamePageBlock(merged), nldp.data.vias, nldp.data.references, nldp.data.enclosures,
    nldp.data.copyTos, templateParagraphs, [],
  );
  return new Uint8Array(await blob.arrayBuffer());
}

beforeAll(() => {
  registerNodeAssets();
});

describe('Same-Page Endorsement template (library entry)', () => {
  it('is listed next to the new-page endorsement under the same-page option', () => {
    expect(entry).toBeDefined();
    // E.4: the index names the picker option, so the template shows under
    // Same-Page Endorsement and not under Endorsement.
    expect(entry.documentType).toBe(SAME_PAGE_ENDORSEMENT_OPTION);
    expect(resolvePickerType(entry.documentType!).documentType).toBe('endorsement');
    expect(index.find((e) => e.id === 'endorsement')?.documentType).toBe('endorsement');
    expect(entry.title).toBe('Same-Page Endorsement');
    const ids = index.map((e) => e.id);
    expect(ids.indexOf(TEMPLATE_ID)).toBe(ids.indexOf('endorsement') + 1);
  });

  it('ships the same-page placement and the 9-2.1.a omission pre-filled', () => {
    expect(templateFormData.documentType).toBe('endorsement');
    expect(templateFormData.endorsementPlacement).toBe('same-page');
    expect(templateFormData.samePageOmitsIdentification).toBe(true);
    expect(templateFormData.endorsementLevel).toBe('FIRST');
    // The subject stays in the form. The block does not print it
    // (Figure 9-1), but the fallback to a new page restores it, and
    // the required-field gate asks for it on every letter type.
    expect(templateFormData.subj).toBeTruthy();
    expect(templateFormData.basicLetterReference).toBeTruthy();
  });

  it('survives the import merge and reads as a same-page endorsement', () => {
    expect(isSamePageEndorsement(merged)).toBe(true);
    expect(omitsIdentification(merged)).toBe(true);
    expect(endorsementLineText(merged)).toBe('FIRST ENDORSEMENT');
    const parsed = EndorsementSchema.safeParse(merged);
    expect(parsed.success, JSON.stringify(parsed.success ? null : parsed.error.issues)).toBe(true);
  });

  it('is Figure 9-1\'s first endorsement', () => {
    expect(templateFormData.from).toBe('Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic');
    expect(templateFormData.to).toBe('Commander, Fleet Forces Command');
    expect(templateFormData.originatorCode).toBe('Ser 019/870');
    expect(templateFormData.date).toBe('23 Apr 15');
    expect(templateFormData.sig).toBe('R. L. GABEL');
    expect(nldp.data.vias).toEqual(['Commander, Naval Air Force, U.S. Atlantic Fleet']);
    expect(nldp.data.copyTos).toEqual(['NAS Meridian (Code 11)']);
    expect(templateParagraphs).toHaveLength(1);
    expect(templateParagraphs[0].content).toMatch(/^A same-page endorsement may omit the SSIC/);
    expect(templateParagraphs[0].isMandatory).toBe(true);
    expect(nldp.data.references).toEqual([]);
    expect(nldp.data.enclosures).toEqual([]);
  });

  it('renders as a one-page block that fits on a short letter\'s signature page (9-1)', async () => {
    const block = await blockBytes();
    const extent = await measureBlockExtent(block);
    expect(extent.pages).toBe(1);

    const host = await hostBytes();
    const result = await composeSamePage(host, block);
    expect(result.fits, result.fits ? '' : result.reason).toBe(true);
    if (result.fits) {
      expect(result.pages).toBe(1);
      expect(result.blockFirstBaseline).toBeLessThan(result.hostLastBaseline);
    }
  }, 60_000);
});
