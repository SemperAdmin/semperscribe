/**
 * I-Type cover ruling (2026-06-10, hard stance from the template
 * owner): the first SIX NSN/TAMCN/ID/MODEL rows sit ON PAGE 1 of the
 * Technical Publication — six rows always drawn, data or not — and
 * only rows 7+ overflow to page 2. Seal renders 2in x 2in (template
 * Layout dialog: absolute 2" x 2").
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateITypeDocx } from '@/services/docx/i-type-docx';

const item = (n: number) => ({ nsn: `NSN-${n}`, tamcn: `T-${n}`, id: `ID-${n}`, model: `M-${n}` });

const baseForm = (count: number) => ({
  documentType: 'i-type',
  date: '2026-06-10',
  shortTitle: 'TM 12345-OR',
  publicationType: 'TECHNICAL MANUAL',
  longTitle: 'OPERATOR MANUAL',
  nomenclature: 'WIDGET, FIELD, M1',
  componentsAffected: Array.from({ length: count }, (_, i) => item(i + 1)),
}) as never;

async function docXml(count: number): Promise<string> {
  const buf = await generateITypeDocx(baseForm(count));
  const zip = await JSZip.loadAsync(buf);
  return zip.file('word/document.xml')!.async('string');
}

const tableCellCount = (xml: string) => (xml.match(/<w:tc[ >]/g) || []).length;
const pageBreakCount = (xml: string) => (xml.match(/<w:br w:type="page"\/?>/g) || []).length;

describe('I-Type DOCX cover table', () => {
  it('column split gives MODEL half the width (no-wrap ruling)', async () => {
    const xml = await docXml(1);
    for (const w of [2376, 1620, 1404, 5400]) {
      expect(xml).toContain(`w:w="${w}"`);
    }
  });


  it('pads to six rows on page 1 with two items, no overflow page', async () => {
    const xml = await docXml(2);
    // header row (4 cells) + 6 body rows (24 cells) = 28 component cells
    // minimum; assert the padded empties exist and items render.
    expect(xml).toContain('NSN-1');
    expect(xml).toContain('NSN-2');
    expect(xml).not.toContain('NSN-7');
    expect(tableCellCount(xml)).toBeGreaterThanOrEqual(28);
    // No explicit page break: the cover flows straight to the page-3
    // section when nothing overflows.
    expect(pageBreakCount(xml)).toBe(0);
  });

  it('puts rows 7+ on an overflow page behind a page break', async () => {
    const xml = await docXml(8);
    expect(xml).toContain('NSN-6');
    expect(xml).toContain('NSN-7');
    expect(xml).toContain('NSN-8');
    expect(pageBreakCount(xml)).toBe(1);
    // Overflow rows sit AFTER the page break; row 6 sits before it.
    const brIdx = xml.indexOf('<w:br w:type="page"');
    expect(xml.indexOf('NSN-6')).toBeLessThan(brIdx);
    expect(xml.indexOf('NSN-7')).toBeGreaterThan(brIdx);
  });

  it('exactly six rows on page 1 with eight items (six before the break)', async () => {
    const xml = await docXml(8);
    const brIdx = xml.indexOf('<w:br w:type="page"');
    const page1 = xml.slice(0, brIdx);
    for (let n = 1; n <= 6; n++) expect(page1).toContain(`NSN-${n}`);
    expect(page1).not.toContain('NSN-7');
  });
});
