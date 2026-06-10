/**
 * S6 — keepNext / widow-orphan enforcement (correspondence).
 *
 * M-5216.5 7-2.16 two-line rule: when the signature block moves to a
 * new page it carries at least two lines of text. Mechanism in Word:
 * the last body paragraph is keepNext (binds its final line to the
 * first signature blank) and widow/orphan control guarantees a
 * minimum two-line fragment; the three signature blanks are keepNext
 * so the block itself never splits.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import {
  FIXTURE_FORM_DATA, FIXTURE_PARAGRAPHS, FIXTURE_VIAS,
  FIXTURE_REFERENCES, FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS,
} from './golden/fixture';

async function fixtureParas(): Promise<string[]> {
  const blob = await generateDocxBlob(
    FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, FIXTURE_PARAGRAPHS, [],
  );
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.match(/<w:p\b.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
}

describe('DOCX keep rules (S6)', () => {
  it('last body paragraph is keepNext + widowControl; earlier ones are not keepNext', async () => {
    const paras = await fixtureParas();
    const bodyIdx = paras
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.includes('level') || p.includes('paragraph'));
    const last = bodyIdx[bodyIdx.length - 1];
    expect(last.p.includes('<w:keepNext/>'), 'last body paragraph keepNext').toBe(true);
    expect(last.p.includes('<w:widowControl/>') || /<w:widowControl w:val="(1|true|on)"\/>/.test(last.p),
      'last body paragraph widowControl').toBe(true);
    for (const { p } of bodyIdx.slice(0, -1)) {
      expect(p.includes('<w:keepNext/>'), 'non-last body paragraph must not be keepNext').toBe(false);
    }
  });

  it('the three signature blanks are keepNext; the signature line itself is not', async () => {
    const paras = await fixtureParas();
    const sigIdx = paras.findIndex((p) => p.includes('I. M. MARINE'));
    expect(sigIdx).toBeGreaterThan(2);
    for (let k = 1; k <= 3; k++) {
      expect(paras[sigIdx - k].includes('<w:keepNext/>'), `blank ${k} above sig keepNext`).toBe(true);
    }
    expect(paras[sigIdx].includes('<w:keepNext/>'), 'signature line not keepNext').toBe(false);
  });
});
