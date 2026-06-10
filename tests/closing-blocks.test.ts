/**
 * S4 — business/exec/DLA closing blocks (audit gap G4).
 *
 * M-5216.5 11-2.8/11-2.9; MCO 5216.20B Sec 12 2.f: the complimentary
 * close and signature block BEGIN at the page center (4680 twips) and
 * are left-aligned — "Begin at the center of the page, but do not
 * center." Signature on the 4th line below the close (3 blank lines).
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateDocxBlob } from '@/lib/docx-generator';
import { FIXTURE_FORM_DATA, FIXTURE_PARAGRAPHS } from './golden/fixture';

async function xmlFor(extra: Record<string, unknown>): Promise<string> {
  const blob = await generateDocxBlob(
    { ...FIXTURE_FORM_DATA, ...extra }, [], [], [], [], FIXTURE_PARAGRAPHS, [],
  );
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

function paragraphsOf(xml: string): string[] {
  return xml.match(/<w:p\b.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
}

describe('business letter closing block (G4)', () => {
  it('close and signature start at page center, left-aligned, not centered', async () => {
    const xml = await xmlFor({
      documentType: 'business-letter',
      complimentaryClose: 'Sincerely',
      sig: 'I. M. MARINE',
      signerTitle: 'Director',
    });
    const paras = paragraphsOf(xml);
    const close = paras.find((p) => p.includes('Sincerely'));
    const sig = paras.find((p) => p.includes('I. M. MARINE'));
    for (const [name, p] of [['close', close], ['sig', sig]] as const) {
      expect(p, name).toBeDefined();
      expect(p!.includes('<w:jc w:val="center"/>'), `${name} must not be centered`).toBe(false);
      expect(p!.includes('<w:ind w:left="4680"/>'), `${name} must start at page center`).toBe(true);
    }
  });

  it('signature sits on the 4th line below the close (3 blank paragraphs)', async () => {
    const xml = await xmlFor({
      documentType: 'business-letter',
      complimentaryClose: 'Sincerely',
      sig: 'I. M. MARINE',
    });
    const paras = paragraphsOf(xml);
    const closeIdx = paras.findIndex((p) => p.includes('Sincerely'));
    const sigIdx = paras.findIndex((p) => p.includes('I. M. MARINE'));
    expect(sigIdx - closeIdx, 'three blanks between close and signature').toBe(4);
    for (let k = closeIdx + 1; k < sigIdx; k++) {
      expect(/<w:t[ >]/.test(paras[k]), `paragraph ${k} must be blank`).toBe(false);
    }
  });
});

describe('DLA closing blocks (G4)', () => {
  it('DLA memorandum signature block starts at page center', async () => {
    const xml = await xmlFor({
      documentType: 'dla-memorandum',
      headerType: 'DLA',
      signerFullName: 'JANE Q. CIVILIAN',
      signerTitle: 'Deputy Director',
    });
    const sig = paragraphsOf(xml).find((p) => p.includes('JANE Q. CIVILIAN'));
    expect(sig).toBeDefined();
    expect(sig!.includes('<w:jc w:val="center"/>')).toBe(false);
    expect(sig!.includes('<w:ind w:left="4680"/>')).toBe(true);
  });

  it('DLA business letter close starts at page center with 3 blanks to signature', async () => {
    const xml = await xmlFor({
      documentType: 'dla-business-letter',
      headerType: 'DLA',
      complimentaryClose: 'Sincerely',
      signerFullName: 'JANE Q. CIVILIAN',
    });
    const paras = paragraphsOf(xml);
    const closeIdx = paras.findIndex((p) => p.includes('Sincerely'));
    const sigIdx = paras.findIndex((p) => p.includes('JANE Q. CIVILIAN'));
    expect(paras[closeIdx].includes('<w:ind w:left="4680"/>')).toBe(true);
    expect(sigIdx - closeIdx).toBe(4);
  });
});
