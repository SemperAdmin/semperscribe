// tests/volume/layout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

function sampleDoc() {
  const d = blankVolume();
  d.order = { designator: 'MCO 5800.16', policyTitle: 'LEGAL SUPPORT AND ADMINISTRATION MANUAL', sponsorCode: 'JA' };
  d.volume = { ...d.volume, number: 6, title: 'INTERNATIONAL AND OPERATIONAL LAW', originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20' };
  d.chapters = [{
    number: 1, title: 'INTERNATIONAL AND OPERATIONAL LAW', changeLog: [], figures: [],
    sections: [
      { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'This Volume promulgates policy.' }] }], paragraphs: [] },
    ],
  }];
  return d;
}

describe('layoutVolume', () => {
  it('produces front matter, then body pages', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.pages.some(p => p.band === 'front')).toBe(true);
    expect(out.pages.some(p => p.band === 'body')).toBe(true);
  });
  it('emits a TOC entry for the section', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.toc.find(e => e.label.includes('PURPOSE'))).toBeTruthy();
  });
  it('numbers a single-chapter body page sequentially', () => {
    const out = layoutVolume(sampleDoc());
    const body = out.pages.filter(p => p.band === 'body');
    expect(body[0].label).toMatch(/^\d+$/);
  });
});
