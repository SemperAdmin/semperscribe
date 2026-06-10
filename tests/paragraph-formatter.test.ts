import { describe, it, expect } from 'vitest';
import { generateCitation } from '@/lib/paragraph-formatter';
import { FIXED_LADDER } from '@/lib/indent-engine';
import { ParagraphData } from '@/types';

// Helper to create paragraph data
function p(id: number, level: number, content: string = 'text'): ParagraphData {
  return { id, level, content };
}

describe('FIXED_LADDER (P3.2 — USMC directive 4-space ladder, MCO 5215.1K para 33)', () => {
  it('defines character columns for levels 1-8', () => {
    for (let level = 1; level <= 8; level++) {
      expect(FIXED_LADDER[level]).toBeDefined();
    }
  });

  it('cascades 4 character columns per level', () => {
    for (let level = 1; level <= 7; level++) {
      const current = FIXED_LADDER[level];
      const next = FIXED_LADDER[level + 1];
      expect(next.citationChars - current.citationChars).toBe(4);
      expect(next.textChars - current.textChars).toBe(4);
    }
  });

  it('text column sits 4 characters past the designator column', () => {
    for (let level = 1; level <= 8; level++) {
      const spec = FIXED_LADDER[level];
      expect(spec.textChars - spec.citationChars).toBe(4);
    }
  });
});

describe('generateCitation', () => {
  describe('Level 1: Arabic numerals with period', () => {
    it('generates "1." for the first paragraph', () => {
      const paragraphs = [p(1, 1)];
      expect(generateCitation(paragraphs[0], 0, paragraphs).citation).toBe('1.');
    });

    it('generates sequential numbers for multiple level-1 paragraphs', () => {
      const paragraphs = [p(1, 1), p(2, 1), p(3, 1)];
      expect(generateCitation(paragraphs[0], 0, paragraphs).citation).toBe('1.');
      expect(generateCitation(paragraphs[1], 1, paragraphs).citation).toBe('2.');
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('3.');
    });

    it('counts correctly with sub-paragraphs interspersed', () => {
      const paragraphs = [
        p(1, 1),          // 1.
        p(2, 2, 'sub1'),  // a.
        p(3, 2, 'sub2'),  // b.
        p(4, 1),          // 2.
      ];
      expect(generateCitation(paragraphs[0], 0, paragraphs).citation).toBe('1.');
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('2.');
    });
  });

  describe('Level 2: Lowercase letters with period', () => {
    it('generates "a." for the first sub-paragraph', () => {
      const paragraphs = [p(1, 1), p(2, 2)];
      expect(generateCitation(paragraphs[1], 1, paragraphs).citation).toBe('a.');
    });

    it('generates sequential letters', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 2), p(4, 2)];
      expect(generateCitation(paragraphs[1], 1, paragraphs).citation).toBe('a.');
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('b.');
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('c.');
    });

    it('restarts counting under a new parent', () => {
      const paragraphs = [
        p(1, 1),  // 1.
        p(2, 2),  // a.
        p(3, 2),  // b.
        p(4, 1),  // 2.
        p(5, 2),  // a. (restarts)
      ];
      expect(generateCitation(paragraphs[4], 4, paragraphs).citation).toBe('a.');
    });
  });

  describe('Level 3: Arabic numerals with parentheses', () => {
    it('generates "(1)" for the first level-3 paragraph', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3)];
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('(1)');
    });

    it('generates sequential parenthesized numbers', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 3), p(5, 3)];
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('(1)');
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('(2)');
      expect(generateCitation(paragraphs[4], 4, paragraphs).citation).toBe('(3)');
    });
  });

  describe('Level 4: Lowercase letters with parentheses', () => {
    it('generates "(a)" for the first level-4 paragraph', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 4)];
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('(a)');
    });

    it('generates sequential parenthesized letters', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 4), p(5, 4)];
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('(a)');
      expect(generateCitation(paragraphs[4], 4, paragraphs).citation).toBe('(b)');
    });
  });

  describe('Levels 5-8: Repeat pattern with underline (citation string only)', () => {
    it('Level 5 generates "1." format (underline applied in rendering)', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 4), p(5, 5)];
      expect(generateCitation(paragraphs[4], 4, paragraphs).citation).toBe('1.');
    });

    it('Level 6 generates "a." format', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 4), p(5, 5), p(6, 6)];
      expect(generateCitation(paragraphs[5], 5, paragraphs).citation).toBe('a.');
    });

    it('Level 7 generates "(1)" format', () => {
      const paragraphs = [p(1, 1), p(2, 2), p(3, 3), p(4, 4), p(5, 5), p(6, 6), p(7, 7)];
      expect(generateCitation(paragraphs[6], 6, paragraphs).citation).toBe('(1)');
    });

    it('Level 8 generates "(a)" format', () => {
      const paragraphs = [
        p(1, 1), p(2, 2), p(3, 3), p(4, 4),
        p(5, 5), p(6, 6), p(7, 7), p(8, 8),
      ];
      expect(generateCitation(paragraphs[7], 7, paragraphs).citation).toBe('(a)');
    });
  });

  describe('Complex nested structure', () => {
    it('handles a realistic 5-paragraph SMEAC outline', () => {
      const paragraphs = [
        p(1, 1),   // 1. Situation
        p(2, 2),   //   a.
        p(3, 2),   //   b.
        p(4, 1),   // 2. Mission
        p(5, 1),   // 3. Execution
        p(6, 2),   //   a.
        p(7, 3),   //     (1)
        p(8, 3),   //     (2)
        p(9, 2),   //   b.
        p(10, 1),  // 4. Admin and Logistics
        p(11, 1),  // 5. Command and Signal
      ];

      expect(generateCitation(paragraphs[0], 0, paragraphs).citation).toBe('1.');
      expect(generateCitation(paragraphs[1], 1, paragraphs).citation).toBe('a.');
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('b.');
      expect(generateCitation(paragraphs[3], 3, paragraphs).citation).toBe('2.');
      expect(generateCitation(paragraphs[4], 4, paragraphs).citation).toBe('3.');
      expect(generateCitation(paragraphs[5], 5, paragraphs).citation).toBe('a.');
      expect(generateCitation(paragraphs[6], 6, paragraphs).citation).toBe('(1)');
      expect(generateCitation(paragraphs[7], 7, paragraphs).citation).toBe('(2)');
      expect(generateCitation(paragraphs[8], 8, paragraphs).citation).toBe('b.');
      expect(generateCitation(paragraphs[9], 9, paragraphs).citation).toBe('4.');
      expect(generateCitation(paragraphs[10], 10, paragraphs).citation).toBe('5.');
    });

    it('skips empty content paragraphs in count (but not the target)', () => {
      const paragraphs = [
        p(1, 1),
        p(2, 2, ''),       // empty content - skipped
        p(3, 2, 'real'),   // counts as "a." since empty is skipped
      ];
      // The empty paragraph (index 1) is skipped when counting
      // So paragraph at index 2 should be "a."
      expect(generateCitation(paragraphs[2], 2, paragraphs).citation).toBe('a.');
    });
  });
});
