import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateVolumeDocx } from '@/services/docx/volumeDocx';
import { blankVolume } from '@/store/volumeStore';

describe('generateVolumeDocx', () => {
  it('produces a docx with a section per chapter and a TOC field', async () => {
    const d = blankVolume();
    d.chapters.push({ number: 2, title: 'SECOND', changeLog: [], sections: [{ seq: 1, title: 'X', paragraphs: [] }], figures: [] });
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('TOC');            // TOC field
    expect((xml.match(/w:sectPr/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('renders a changed run in blue (0000FF)', async () => {
    const d = blankVolume();
    d.chapters[0].sections[0].paragraphs.push({
      seq: 1,
      title: '',
      body: [{ runs: [{ text: 'This text changed.', changed: true }] }],
      children: [],
    });
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('<w:color w:val="0000FF"');
  });
});
