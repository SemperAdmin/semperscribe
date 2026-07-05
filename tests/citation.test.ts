/**
 * The shared citation ruleset (audit step 8, renderer convergence):
 * base SECNAV scheme, information-paper bullets, and MCO 5215.1K
 * four-digit numbering — one implementation for PDF and DOCX.
 */
import { describe, it, expect } from 'vitest';
import { generateDisplayCitation, generateCitation } from '@/lib/citation';
import type { ParagraphData } from '@/types';

function paras(levels: number[]): ParagraphData[] {
  return levels.map((level, i) => ({ id: i + 1, level, content: `Paragraph ${i + 1}` }));
}

describe('base scheme', () => {
  it('numbers each level per SECNAV M-5216.5', () => {
    const all = paras([1, 2, 3, 4, 5, 6, 7, 8]);
    const citations = all.map((p, i) => generateDisplayCitation(p, i, all));
    expect(citations).toEqual(['1.', 'a.', '(1)', '(a)', '1.', 'a.', '(1)', '(a)']);
  });

  it('counts same-level siblings under the same parent', () => {
    const all = paras([1, 2, 2, 1, 2]);
    const citations = all.map((p, i) => generateDisplayCitation(p, i, all));
    expect(citations).toEqual(['1.', 'a.', 'b.', '2.', 'a.']);
  });

  it('counts title-only structural paragraphs', () => {
    const all: ParagraphData[] = [
      { id: 1, level: 1, content: '', title: 'Situation' },
      { id: 2, level: 1, content: 'Body text.' },
    ];
    expect(generateDisplayCitation(all[1], 1, all)).toBe('2.');
  });

  it('generateCitation wrapper matches the display function', () => {
    const all = paras([1, 2, 2]);
    all.forEach((p, i) => {
      expect(generateCitation(p, i, all).citation).toBe(generateDisplayCitation(p, i, all));
    });
  });
});

describe('information-paper bullets', () => {
  it('renders bullets below level 1, numbers at level 1', () => {
    const all = paras([1, 2, 3, 4]);
    const opts = { documentType: 'information-paper' };
    const citations = all.map((p, i) => generateDisplayCitation(p, i, all, opts));
    expect(citations).toEqual(['1.', '•', '◦', '▪']);
  });
});

describe('MCO four-digit numbering', () => {
  it('renders {chapter}00N at level 1 and shifted schemes below', () => {
    const all = paras([1, 2, 3, 1]);
    const opts = { fourDigitNumbering: true, chapterNumber: 2 };
    const citations = all.map((p, i) => generateDisplayCitation(p, i, all, opts));
    expect(citations).toEqual(['2001.', '1.', 'a', '2002.']);
  });

  it('defaults to chapter 1', () => {
    const all = paras([1]);
    expect(generateDisplayCitation(all[0], 0, all, { fourDigitNumbering: true })).toBe('1001.');
  });
});
