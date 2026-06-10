/**
 * S2 — blank-line spacing model (audit gap G2).
 *
 * SECNAV M-5216.5 7-2.13: each paragraph "begins on the second line
 * below" the previous one — exactly one full blank line at body type
 * size. The blank line is an explicit empty paragraph whose paragraph
 * mark carries the body font size (w:sz 24 half-points = 12pt), so its
 * height equals one body line in Word.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateDocxBlob } from '@/lib/docx-generator';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

async function fixtureXml(): Promise<string> {
  const blob = await generateDocxBlob(
    FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, FIXTURE_PARAGRAPHS, [],
  );
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

describe('DOCX blank-line spacing model (M-5216.5 7-2.13)', () => {
  it('emits no 6pt after-spacing in the basic letter', async () => {
    const xml = await fixtureXml();
    expect(xml.includes('w:after="120"')).toBe(false);
  });

  it('every empty paragraph carries the 12pt body size (full-height blank line)', async () => {
    const xml = await fixtureXml();
    // Empty paragraphs: <w:p> ... no <w:t> with content ... </w:p>
    const paragraphs = xml.match(/<w:p\b[^>]*>.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
    const empties = paragraphs.filter((p) => !/<w:t[ >]/.test(p) || /<w:t[^>]*><\/w:t>/.test(p));
    expect(empties.length).toBeGreaterThan(0);
    for (const p of empties) {
      // Self-closing <w:p/> has no height control at all — forbidden.
      expect(p.endsWith('/>'), `bare empty paragraph: ${p.slice(0, 80)}`).toBe(false);
      expect(/<w:sz w:val="24"\/>/.test(p), `empty paragraph without 12pt run: ${p.slice(0, 120)}`).toBe(true);
    }
  });
});
