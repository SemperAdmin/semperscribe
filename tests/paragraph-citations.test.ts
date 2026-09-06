/**
 * getUiCitation and validateParagraphNumbering as pure module functions
 * (Phase A.5 hoisted them out of useParagraphs). Pins the citation
 * shapes for both numbering schemes and the sibling rule.
 */
import { describe, it, expect } from 'vitest';
import { getUiCitation, validateParagraphNumbering } from '@/hooks/useParagraphs';
import type { ParagraphData } from '@/types';

const p = (id: number, level: number): ParagraphData => ({ id, level, content: '' });

const tree = [
  p(1, 1),
  p(2, 2), p(3, 2),
  p(4, 3), p(5, 3),
  p(6, 4), p(7, 4),
  p(8, 1),
];

const cite = (list: ParagraphData[], index: number, options?: Parameters<typeof getUiCitation>[3]) =>
  getUiCitation(list[index], index, list, options);

describe('getUiCitation', () => {
  it('produces the standard naval letter forms', () => {
    expect(tree.map((_, i) => cite(tree, i))).toEqual(['1.', '1a', '1b', '1b(1)', '1b(2)', '1b2(a)', '1b2(b)', '2.']);
  });

  it('produces the four-digit directive forms', () => {
    const opts = { fourDigitNumbering: true, chapterNumber: 3 };
    expect(cite(tree, 0, opts)).toBe('3001.');
    expect(cite(tree, 1, opts)).toBe('3001.1');
    expect(cite(tree, 3, opts)).toBe('30012a');
    expect(cite(tree, 7, opts)).toBe('3002.');
  });

  it('numbers past z with double letters', () => {
    const many = [p(0, 1), ...Array.from({ length: 27 }, (_, i) => p(i + 1, 2))];
    expect(cite(many, 27)).toBe('1aa');
  });
});

describe('validateParagraphNumbering', () => {
  it('accepts a tree where every sub-paragraph has a sibling', () => {
    expect(validateParagraphNumbering(tree)).toEqual([]);
  });

  it('names a lone sub-paragraph and ignores a lone top-level one', () => {
    const lone = [p(1, 1), p(2, 2)];
    expect(validateParagraphNumbering(lone)).toEqual([
      'Paragraph 1a requires at least one sibling paragraph at the same level.',
    ]);
    expect(validateParagraphNumbering([p(1, 1)])).toEqual([]);
  });
});
