// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';
import { blankVolume } from '@/store/volumeStore';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function docWithAdjacentLinks(): VolumeDoc {
  const d = blankVolume();
  d.chapters[0].sections[0] = {
    seq: 1, title: 'PURPOSE', paragraphs: [],
    body: [{ runs: [
      { text: 'this link', link: true, href: 'https://example.com/a' },
      { text: 'that link', link: true, href: 'https://example.com/b' },
    ] }],
  };
  return d;
}

async function linkUrlsOnPage(buf: Buffer, pageIndex: number): Promise<{ urls: string[]; rects: number[][] }> {
  const loaded = await PDFDocument.load(buf);
  const page = loaded.getPage(pageIndex);
  const annotsRef = page.node.get(PDFName.of('Annots'));
  const annots = loaded.context.lookup(annotsRef, PDFArray);
  const urls: string[] = [];
  const rects: number[][] = [];
  for (let i = 0; i < (annots?.size() ?? 0); i++) {
    const annot = loaded.context.lookup(annots!.get(i), PDFDict);
    const action = loaded.context.lookup(annot.get(PDFName.of('A')), PDFDict);
    const uri = action?.get(PDFName.of('URI'));
    if (uri instanceof PDFString) urls.push(uri.decodeText());
    const rect = annot.get(PDFName.of('Rect'));
    if (rect instanceof PDFArray) {
      rects.push(rect.asArray().map((n: any) => n.asNumber()));
    }
  }
  return { urls, rects };
}

describe('volume PDF: hyperlink annotations', () => {
  it('gives two adjacent link runs with different hrefs separate rectangles (Task 9 controller ruling)', async () => {
    const blob = await generateVolumePdf(docWithAdjacentLinks());
    const buf = Buffer.from(await blob.arrayBuffer());
    const loaded = await PDFDocument.load(buf);
    const { urls, rects } = await linkUrlsOnPage(buf, loaded.getPageCount() - 1);

    expect(urls).toContain('https://example.com/a');
    expect(urls).toContain('https://example.com/b');
    expect(urls.length).toBe(2); // one rect per href, not one merged rect covering both

    // Rects must not be identical (i.e. not derived from one merged drawText
    // buffer spanning both segments) — each segment gets its own box.
    expect(rects.length).toBe(2);
    const [r1, r2] = rects;
    expect(r1).not.toEqual(r2);
    // The two boxes should be adjacent (second starts where the first ends),
    // not overlapping and not identical.
    expect(r2[0]).toBeCloseTo(r1[2], 1);
  });
});

describe('volume PDF: figure embed resilience', () => {
  it('does not reject the whole export when a figure has a malformed image data URL', async () => {
    const d = blankVolume();
    d.chapters[0].figures = [
      { number: 1, caption: 'Broken Figure', image: 'not-a-data-url', legend: [] },
    ];
    // Must resolve, not throw/reject.
    const blob = await generateVolumePdf(d);
    const buf = Buffer.from(await blob.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);

    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
  });

  it('does not reject the export when a figure image has an unsupported/corrupt encoding', async () => {
    const d = blankVolume();
    d.chapters[0].figures = [
      { number: 1, caption: 'Corrupt Figure', image: 'data:image/gif;base64,not-real-bytes', legend: [] },
    ];
    const blob = await generateVolumePdf(d);
    const buf = Buffer.from(await blob.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it('still embeds a well-formed figure image', async () => {
    const d = blankVolume();
    d.chapters[0].figures = [
      { number: 1, caption: 'Org Chart', image: PNG_1x1, legend: ['TC — Trial Counsel'] },
    ];
    const blob = await generateVolumePdf(d);
    const buf = Buffer.from(await blob.arrayBuffer());
    const loaded = await PDFDocument.load(buf);
    expect(loaded.getPageCount()).toBeGreaterThan(0);
  });
});
