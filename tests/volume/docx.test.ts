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

  // Task 26: mirrors layout.test.ts's referencesSummaryPage coverage for the
  // DOCX path - the second "REFERENCES" summary page (quoted heading +
  // boilerplate) is opt-in, default on.
  it('Task 26: omits the "REFERENCES" summary page boilerplate when referencesSummaryPage is false', async () => {
    const d = blankVolume();
    d.references = [{ text: 'MCO 1650.62' }];

    const withSummary = await generateVolumeDocx(d);
    const zipWith = await JSZip.loadAsync(await withSummary.arrayBuffer());
    const xmlWith = await zipWith.file('word/document.xml')!.async('string');
    expect(xmlWith).toContain('As changes are made within this MCO Volume');

    d.volume = { ...d.volume, referencesSummaryPage: false };
    const withoutSummary = await generateVolumeDocx(d);
    const zipWithout = await JSZip.loadAsync(await withoutSummary.arrayBuffer());
    const xmlWithout = await zipWithout.file('word/document.xml')!.async('string');
    expect(xmlWithout).not.toContain('As changes are made within this MCO Volume');
    expect(xmlWithout).toContain('MCO 1650.62');
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

  // Task 21 finding 5 (regression hunt, DOCX side): mirrors
  // tests/volume/layout.test.ts's identical PDF-path test - a changeLog
  // with real entries must still get the 3 blank/gray-shaded template rows
  // appended (previously `titlePageChangeRows` dropped them once the log
  // had any real data, which is exactly what the vol17.json fixture's
  // one-row changeLog triggers).
  it('shades the 3 trailing blank template rows even when the changeLog already has real entries (finding 5 regression)', async () => {
    const d = blankVolume();
    d.changeLog = [{ version: 'ORIGINAL VOLUME', summary: 'N/A', originationDate: '10 Feb 2021', dateOfChanges: 'N/A' }];
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    // One shaded cell per blank row (their ORIGINATION DATE column).
    expect((xml.match(/D9D9D9/g) ?? []).length).toBe(3);
  });

  // Task 21 finding 2: the running-head designator/volume separator is an
  // en dash (U+2013), not a middot - the shared `runningHeadParts`
  // (lib/volume/layout.ts) composes it once for both generators.
  it('uses an en dash (not a middot) between the designator and the volume tag', async () => {
    const d = blankVolume();
    const blob = await generateVolumeDocx(d);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const headerFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/header'));
    let sawDash = false;
    for (const name of headerFiles) {
      const content = await zip.file(name)!.async('string');
      expect(content).not.toContain('·'); // middot
      if (content.includes('– V')) sawDash = true;
    }
    expect(sawDash).toBe(true);
  });

  // Task 22: appendix support - its own Word section (extra w:sectPr), a
  // divider (reusing the same box+table shape as a chapter's), the
  // "APPENDIX {L}" + title content, a borderless two-column glossary table,
  // and an "{L}-" footer prefix.
  describe('appendices', () => {
    function withAppendix() {
      const d = blankVolume();
      d.appendices = [
        {
          letter: 'A',
          title: 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS',
          changeLog: [],
          blocks: [],
          glossary: [
            { term: 'ABA', definition: 'American Bar Association' },
            { term: 'TSO', definition: 'Trial Services Organization' },
          ],
        },
      ];
      return d;
    }

    it('adds an extra Word section for the appendix', async () => {
      const withoutAppendix = blankVolume();
      const withoutBlob = await generateVolumeDocx(withoutAppendix);
      const withoutZip = await JSZip.loadAsync(await withoutBlob.arrayBuffer());
      const withoutXml = await withoutZip.file('word/document.xml')!.async('string');
      const withoutSections = (withoutXml.match(/w:sectPr/g) ?? []).length;

      const blob = await generateVolumeDocx(withAppendix());
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      const withSections = (xml.match(/w:sectPr/g) ?? []).length;

      expect(withSections).toBeGreaterThan(withoutSections);
      expect(xml).toContain('APPENDIX A');
      expect(xml).toContain('GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
      expect(xml).toContain('SUMMARY OF SUBSTANTIVE CHANGES');
    });

    it('renders the glossary as a table with term/definition cells', async () => {
      const blob = await generateVolumeDocx(withAppendix());
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('<w:tbl>');
      expect(xml).toContain('ABA');
      expect(xml).toContain('American Bar Association');
      expect(xml).toContain('TSO');
      expect(xml).toContain('Trial Services Organization');
    });

    it('styles the appendix title Heading1 so the TOC field picks it up', async () => {
      const blob = await generateVolumeDocx(withAppendix());
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const xml = await zip.file('word/document.xml')!.async('string');
      // At least 2 Heading1 paragraphs: the chapter title AND the appendix title.
      expect((xml.match(/w:pStyle w:val="Heading1"/g) ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it('uses an "A-" footer prefix on the appendix band', async () => {
      const blob = await generateVolumeDocx(withAppendix());
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const footerFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/footer'));
      let sawAppendixPrefix = false;
      for (const name of footerFiles) {
        const content = await zip.file(name)!.async('string');
        if (content.includes('>A-<')) sawAppendixPrefix = true;
      }
      expect(sawAppendixPrefix).toBe(true);
    });

    it('uses the "Volume {n}, Appendix {L}" running-head left label', async () => {
      const blob = await generateVolumeDocx(withAppendix());
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const headerFiles = Object.keys(zip.files).filter((n) => n.startsWith('word/header'));
      let sawAppendixLabel = false;
      for (const name of headerFiles) {
        const content = await zip.file(name)!.async('string');
        if (content.includes('Volume 1, Appendix A')) sawAppendixLabel = true;
      }
      expect(sawAppendixLabel).toBe(true);
    });
  });
});
