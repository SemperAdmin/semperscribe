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

  // Finding 1: mirrors layout.test.ts - a section with both a body block
  // and a numbered paragraph must render both, not just whichever the old
  // if/else picked.
  it('renders both a section body block and its numbered paragraph (finding 1)', async () => {
    const d = blankVolume();
    d.chapters[0].sections[0] = {
      seq: 1,
      title: 'PURPOSE',
      body: [{ runs: [{ text: 'Body block text.' }] }],
      paragraphs: [{ seq: 1, title: '', body: [{ runs: [{ text: 'Paragraph text.' }] }], children: [] }],
    };
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Body block text.');
    expect(xml).toContain('010101.');
    expect(xml).toContain('Paragraph text.');
  });

  // Finding 15 (T10): format spec §4.6 verbatim header, "PAGE / PARAGRAPH".
  it('prints the chapter change-table header as "PAGE / PARAGRAPH" (finding 15)', async () => {
    const d = blankVolume();
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('PAGE / PARAGRAPH');
    expect(xml).not.toContain('PAGE/PARAGRAPH');
  });

  // Finding 3: DOCX's front matter (title/verso/references/TOC) had NO
  // headers/footers at all. Every Word section now carries one, and the
  // running-head/footer text is composed from the same shared
  // runningHeadParts/footerScheme (lib/volume/layout.ts) as the PDF path.
  it('gives every front-matter section a header/footer, with a REF- footer prefix on the references band (finding 3)', async () => {
    const d = blankVolume();
    d.references = [{ text: 'MCO 5215.1K' }];
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    const xml = await zip.file('word/document.xml')!.async('string');
    const headerRefs = xml.match(/w:headerReference/g) ?? [];
    const footerRefs = xml.match(/w:footerReference/g) ?? [];
    // 3 front-matter sections + 1 chapter section = 4 of each.
    expect(headerRefs.length).toBe(4);
    expect(footerRefs.length).toBe(4);

    const footerFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/footer'));
    let sawRefPrefix = false;
    for (const name of footerFiles) {
      const content = await zip.file(name)!.async('string');
      if (content.includes('REF-')) sawRefPrefix = true;
    }
    expect(sawRefPrefix).toBe(true);
  });

  // Finding 3: DOCX's running head never suppressed the ", Chapter N"
  // suffix for a single-chapter volume, and never formatted the
  // last-updated date - both now come from the shared runningHeadParts.
  it("suppresses the chapter suffix for a single-chapter volume's header and formats the date (finding 3)", async () => {
    const d = blankVolume();
    d.volume.lastUpdatedDate = '2018-02-20';
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const headerFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/header'));
    let sawBareVolume = false;
    let sawFormattedDate = false;
    for (const name of headerFiles) {
      const content = await zip.file(name)!.async('string');
      if (content.includes('>Volume 1<')) sawBareVolume = true;
      if (content.includes('20 Feb 2018')) sawFormattedDate = true;
      expect(content).not.toContain('Chapter');
      expect(content).not.toContain('2018-02-20');
    }
    expect(sawBareVolume).toBe(true);
    expect(sawFormattedDate).toBe(true);
  });

  // Finding 3: the title-page bug-for-bug copy of the PDF's fix -
  // "Report Required:" prints bare, with no invented trailing sentence.
  it('prints the bare "Report Required:" label with no invented text (finding 3)', async () => {
    const d = blankVolume();
    d.volume.reportRequired = true;
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('Report Required:');
    expect(xml).not.toContain('See Volume text for details');
  });

  // Finding 4: TableOfContents (headingStyleRange '1-2') needs paragraphs
  // actually styled Heading1/Heading2 to find - previously none existed.
  it('styles the chapter title Heading1 and section headings Heading2 so the TOC field populates (finding 4)', async () => {
    const d = blankVolume();
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('w:pStyle w:val="Heading1"');
    expect(xml).toContain('w:pStyle w:val="Heading2"');
  });

  // Finding 8: mirrors layout.test.ts - a correspondence block sequence
  // must render its own a./b. designators in the DOCX output too.
  it('renders a correspondence block sequence with a./b. designators (finding 8)', async () => {
    const d = blankVolume();
    d.chapters[0].sections[0].paragraphs.push({
      seq: 1,
      title: '',
      body: [
        { runs: [{ text: 'Intro line before the embedded sample.' }] },
        { ladder: 'correspondence', runs: [{ text: 'First embedded item.' }] },
        { ladder: 'correspondence', runs: [{ text: 'Second embedded item.' }] },
      ],
      children: [],
    });
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('First embedded item.');
    expect(xml).toContain('Second embedded item.');
    expect(xml).toMatch(/>a\.\s*</);
    expect(xml).toMatch(/>b\.\s*</);
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
