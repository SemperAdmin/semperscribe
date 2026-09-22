// tests/golden/volume/frontmatter.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

function doc() {
  const d = blankVolume();
  d.volume = { ...d.volume, number: 1, title: 'LEGAL SUPPORT', titleQuoted: true, originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20' };
  d.references = [{ text: 'SECNAVINST 5430.7R' }, { text: 'MCO 5430.2' }];
  d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'x' }] }], paragraphs: [] };
  return d;
}

describe('front matter', () => {
  it('has a title page with SUMMARY OF VOLUME 1 CHANGES', () => {
    const out = layoutVolume(doc());
    const text = out.pages.flatMap(p => p.items).map(i => (i as any).segments?.map((s:any)=>s.text).join('') ?? (i as any).text ?? '').join(' ');
    expect(text).toContain('SUMMARY OF VOLUME 1 CHANGES');
  });
  it('renders references with (a) (b) designators', () => {
    const out = layoutVolume(doc());
    const refPage = out.pages.find(p => p.band === 'ref');
    const t = refPage!.items.map(i => JSON.stringify(i)).join(' ');
    expect(t).toContain('(a)');
    expect(t).toContain('SECNAVINST 5430.7R');
  });
  it('fills the TOC with resolved page numbers', () => {
    const out = layoutVolume(doc());
    const tocEntry = out.toc.find(e => e.label.includes('PURPOSE'));
    expect(tocEntry?.page).toBeTruthy();
  });

  // Task 24: the real Vol 17 PDF's own front-matter placement order is
  // title (i) -> blank verso (ii) -> TABLE OF CONTENTS (iii...) ->
  // REFERENCES (REF band) -> chapter divider/body - TOC immediately after
  // the verso, BEFORE References. Cheap regression guard: whichever page
  // paints the "TABLE OF CONTENTS" heading must come before the first
  // `band: 'ref'` page in the final page sequence.
  it('places the TOC before the References band (Task 24 order)', () => {
    const out = layoutVolume(doc());
    const tocPageIdx = out.pages.findIndex(p =>
      p.items.some(i => JSON.stringify(i).includes('TABLE OF CONTENTS')),
    );
    const refPageIdx = out.pages.findIndex(p => p.band === 'ref');
    expect(tocPageIdx).toBeGreaterThanOrEqual(0);
    expect(refPageIdx).toBeGreaterThanOrEqual(0);
    expect(tocPageIdx).toBeLessThan(refPageIdx);
  });

  // Task 24: the "REFERENCES" TOC entry renders bold (label+leader+page) -
  // measured directly against the real Vol 17 TOC page (fontmap.py, page
  // index 1, y=656.4: a `/TimesNewRomanPS-BoldMT` BaseFont, unlike every
  // other entry on the same page) - see TocEntry.bold's doc comment in
  // lib/volume/layout.ts.
  it('renders the REFERENCES TOC entry bold (Task 24)', () => {
    const out = layoutVolume(doc());
    const refEntry = out.toc.find(e => e.label === 'REFERENCES');
    expect(refEntry?.bold).toBe(true);
  });
});
