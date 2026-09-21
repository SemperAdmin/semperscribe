// tests/volume/page-bands.test.ts
import { describe, it, expect } from 'vitest';
import { toRoman, bodyPageLabel, refPageLabel } from '@/lib/volume/page-bands';

describe('page bands', () => {
  it('lower-roman front matter', () => {
    expect(toRoman(1)).toBe('i');
    expect(toRoman(4)).toBe('iv');
  });
  it('references band', () => {
    expect(refPageLabel(1)).toBe('REF-1');
  });
  it('auto: chapter-page when multi-chapter', () => {
    expect(bodyPageLabel({ chapter: 1, page: 3, multiChapter: true, band: 'auto' })).toBe('1-3');
  });
  it('auto: sequential when single-chapter', () => {
    expect(bodyPageLabel({ chapter: 1, page: 4, multiChapter: false, band: 'auto' })).toBe('4');
  });
  it('explicit band overrides auto', () => {
    expect(bodyPageLabel({ chapter: 2, page: 7, multiChapter: false, band: 'chapter-page' })).toBe('2-7');
    expect(bodyPageLabel({ chapter: 2, page: 7, multiChapter: true, band: 'sequential' })).toBe('7');
  });
});
