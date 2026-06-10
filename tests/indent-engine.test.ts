/**
 * RelativeIndentEngine and FixedLadderEngine unit tests.
 *
 * Authority: SECNAV M-5216.5 Fig 7-8 (each subdivision aligns under the
 * first letter of the parent paragraph's text — content-relative);
 * M-5216.5 7-2.13 / POLICY_COMPLIANCE_AUDIT.md line 43 (runover lines
 * return to the left margin). Width values derive from the generated
 * Liberation metric tables (TNR/Courier New metric-compatible).
 */
import { describe, it, expect } from 'vitest';
import {
  RelativeIndentEngine,
  FixedLadderEngine,
  FIXED_LADDER,
  isCorrespondenceType,
  spacesAfterCitation,
} from '@/lib/indent-engine';
import type { ParagraphData } from '@/types';

const engine = new RelativeIndentEngine();
const fixed = new FixedLadderEngine();

function p(id: number, level: number, content = 'text'): ParagraphData {
  return { id, level, content };
}

// TNR (Liberation Serif) advance widths at 12pt, in points:
// digit = 6.0, "." = 3.0, "a" = 5.32617..., "(" = ")" = 3.99609..., space = 3.0
const DIGIT = 0.5 * 12;
const DOT = 0.25 * 12;
const LOWER_A = 0.44384765625 * 12;
const PAREN = 0.3330078125 * 12;
const SPACE = 0.25 * 12;

describe('RelativeIndentEngine — Times New Roman', () => {
  it('level 1 designator starts at the margin', () => {
    const specs = engine.computeSpecs([p(1, 1)], 'times');
    expect(specs[0].citation).toBe('1.');
    expect(specs[0].firstLineTwips).toBe(0);
    expect(specs[0].firstLinePoints).toBe(0);
  });

  it('level 1 text starts after "1." plus two spaces (15pt = 300 twips)', () => {
    const specs = engine.computeSpecs([p(1, 1)], 'times');
    const expectedPt = DIGIT + DOT + 2 * SPACE; // 6 + 3 + 6 = 15pt
    expect(specs[0].textStartPoints).toBeCloseTo(expectedPt, 2);
    expect(specs[0].textStartTwips).toBe(Math.round(expectedPt * 20)); // 300
  });

  it('subparagraph designator aligns under the first letter of parent text (Fig 7-8)', () => {
    const specs = engine.computeSpecs([p(1, 1), p(2, 2)], 'times');
    // "a." starts exactly where the parent's text starts.
    expect(specs[1].firstLinePoints).toBeCloseTo(specs[0].textStartPoints, 2);
    expect(specs[1].firstLineTwips).toBe(specs[0].textStartTwips);
  });

  it('is content-relative: children of "12." sit further right than children of "1." (Fig 7-8)', () => {
    // Twelve level-1 paragraphs, then one child of the twelfth.
    const many: ParagraphData[] = [
      ...Array.from({ length: 12 }, (_, i) => p(i + 1, 1)),
      p(13, 2),
    ];
    const specsMany = engine.computeSpecs(many, 'times');
    const childOf12 = specsMany[12];
    expect(specsMany[11].citation).toBe('12.');
    // Parent prefix "12." = 6+6+3 = 15pt, + 2 spaces = 21pt.
    expect(childOf12.firstLinePoints).toBeCloseTo(2 * DIGIT + DOT + 2 * SPACE, 2);

    const specsOne = engine.computeSpecs([p(1, 1), p(2, 2)], 'times');
    expect(childOf12.firstLinePoints).toBeGreaterThan(specsOne[1].firstLinePoints);
  });

  it('uses one space after parenthesized designators, two after periods', () => {
    expect(spacesAfterCitation('1.')).toBe(2);
    expect(spacesAfterCitation('a.')).toBe(2);
    expect(spacesAfterCitation('(1)')).toBe(1);
    expect(spacesAfterCitation('(a)')).toBe(1);
  });

  it('walks the full 8-level chain with monotonically increasing positions', () => {
    const chain = Array.from({ length: 8 }, (_, i) => p(i + 1, i + 1));
    const specs = engine.computeSpecs(chain, 'times');
    for (let i = 1; i < 8; i++) {
      expect(specs[i].firstLinePoints).toBeGreaterThan(specs[i - 1].firstLinePoints);
      // Each child starts exactly at its parent's text start.
      expect(specs[i].firstLinePoints).toBeCloseTo(specs[i - 1].textStartPoints, 2);
    }
  });

  it('level 3 "(1)" example: starts under level-2 text, one space after', () => {
    const specs = engine.computeSpecs([p(1, 1), p(2, 2), p(3, 3)], 'times');
    expect(specs[2].citation).toBe('(1)');
    expect(specs[2].firstLinePoints).toBeCloseTo(specs[1].textStartPoints, 2);
    const expectedText = specs[2].firstLinePoints + (PAREN + DIGIT + PAREN) + 1 * SPACE;
    expect(specs[2].textStartPoints).toBeCloseTo(expectedText, 2);
  });

  it('synthesizes canonical parent positions for orphan levels (defensive)', () => {
    const specs = engine.computeSpecs([p(1, 3)], 'times');
    // Parent chain "1." then "a." synthesized: level 3 starts at
    // (1. + 2sp) + (a. + 2sp) = 15 + (5.326 + 3 + 6) = 29.326pt
    const expected = (DIGIT + DOT + 2 * SPACE) + (LOWER_A + DOT + 2 * SPACE);
    expect(specs[0].firstLinePoints).toBeCloseTo(expected, 2);
  });
});

describe('RelativeIndentEngine — Courier (character columns)', () => {
  it('matches the typewriter 4-column ladder for single-digit designators', () => {
    // Fig 7-8 typewriter model: "1." + 2 spaces = 4 columns, "a." + 2 = 4 more.
    const specs = engine.computeSpecs([p(1, 1), p(2, 2), p(3, 3), p(4, 4)], 'courier');
    expect(specs.map((s) => s.prefixChars)).toEqual([0, 4, 8, 12]);
    // "(1)" + 1 space = 4 columns wide as well.
    expect(specs[3].textStartChars).toBe(16);
  });

  it('shifts children one column further under "10." (content-relative)', () => {
    const many: ParagraphData[] = [
      ...Array.from({ length: 10 }, (_, i) => p(i + 1, 1)),
      p(11, 2),
    ];
    const specs = engine.computeSpecs(many, 'courier');
    expect(specs[9].citation).toBe('10.');
    // "10." = 3 chars + 2 spaces = 5 columns.
    expect(specs[10].prefixChars).toBe(5);
  });
});

describe('FixedLadderEngine (pre-Phase-1 behavior, directive fallback)', () => {
  it('reproduces the legacy 0.25-inch cascade exactly', () => {
    const chain = Array.from({ length: 8 }, (_, i) => p(i + 1, i + 1));
    const specs = fixed.computeSpecs(chain, 'times');
    specs.forEach((spec, i) => {
      const level = i + 1;
      expect(spec.firstLineTwips).toBe(FIXED_LADDER[level].citation);
      expect(spec.textStartTwips).toBe(FIXED_LADDER[level].text);
      expect(spec.prefixChars).toBe((level - 1) * 4);
    });
  });
});

describe('isCorrespondenceType', () => {
  it('excludes directives and message/form types', () => {
    for (const t of ['mco', 'bulletin', 'change-transmittal', 'amhs', 'page11', 'aa-form']) {
      expect(isCorrespondenceType(t), t).toBe(false);
    }
  });
  it('includes the correspondence family', () => {
    for (const t of [
      'basic', 'multiple-address', 'endorsement', 'mfr', 'from-to-memo',
      'letterhead-memo', 'moa', 'mou', 'business-letter',
      'executive-correspondence', 'dla-memorandum', 'dla-business-letter',
      'information-paper', 'position-paper', 'decision-paper', 'coordination-page',
    ]) {
      expect(isCorrespondenceType(t), t).toBe(true);
    }
  });
});
