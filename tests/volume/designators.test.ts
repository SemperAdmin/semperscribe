// tests/volume/designators.test.ts
import { describe, it, expect } from 'vitest';
import {
  sectionDesignator, paragraphDesignator, subParaDesignator,
  correspondenceDesignator, referenceDesignator,
} from '@/lib/volume/designators';

describe('designators', () => {
  it('formats section CCSS zero-padded, no period by default', () => {
    expect(sectionDesignator(1, 3, false)).toBe('0103');
    expect(sectionDesignator(17, 3, true)).toBe('1703.');
  });
  it('formats paragraph CCSSPP.', () => {
    expect(paragraphDesignator(1, 3, 1)).toBe('010301.');
    expect(paragraphDesignator(10, 2, 12)).toBe('100212.');
  });
  it('formats sub-para upper then arabic', () => {
    expect(subParaDesignator('upper', 1)).toBe('A.');
    expect(subParaDesignator('upper', 27)).toBe('AA.');
    expect(subParaDesignator('arabic', 3)).toBe('3.');
  });
  it('formats correspondence ladder a. (1) (a)', () => {
    expect(correspondenceDesignator(0, 1)).toBe('a.');
    expect(correspondenceDesignator(1, 1)).toBe('(1)');
    expect(correspondenceDesignator(2, 1)).toBe('(a)');
    expect(correspondenceDesignator(0, 28)).toBe('ab.');
    expect(correspondenceDesignator(2, 28)).toBe('(ab)');
  });
  it('formats reference designator continuing past z', () => {
    expect(referenceDesignator(0)).toBe('(a)');
    expect(referenceDesignator(26)).toBe('(aa)');
    expect(referenceDesignator(27)).toBe('(bb)');
  });
});
