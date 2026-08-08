/**
 * NLDP 1.1: every exported paragraph carries a designator identical to
 * lib/citation.ts for the same tree — the numbering rule has exactly
 * one implementation and the export uses it.
 */
import { describe, it, expect } from 'vitest';
import { createNLDPFile } from '@/lib/nldp-utils';
import { generateCitation } from '@/lib/citation';
import type { ParagraphData } from '@/types';

const FORM = { documentType: 'mco', ssic: '5215.1K', subj: 'TEST' };

function para(id: number, level: number, content = `para ${id}`): ParagraphData {
  return { id, level, content } as ParagraphData;
}

describe('NLDP export designators', () => {
  it('populates a designator on every paragraph, matching lib/citation.ts', async () => {
    // A realistic tree: 1. / a. / (1) / (2) / b. / 2. / a.
    const tree = [
      para(1, 1), para(2, 2), para(3, 3), para(4, 3),
      para(5, 2), para(6, 1), para(7, 2),
    ];
    const file = await createNLDPFile(FORM, [], [], [], [], tree);

    expect(file.data.paragraphs).toHaveLength(tree.length);
    file.data.paragraphs.forEach((p, i) => {
      expect(p.designator, `paragraph ${i}`).toBeTruthy();
      expect(p.designator).toBe(generateCitation(tree[i], i, tree).citation);
    });
    expect(file.data.paragraphs.map(p => p.designator)).toEqual([
      '1.', 'a.', '(1)', '(2)', 'b.', '2.', 'a.',
    ]);
  });

  it('restarts sub-level counters under a new parent (sibling counting)', async () => {
    const tree = [para(1, 1), para(2, 2), para(3, 1), para(4, 2)];
    const file = await createNLDPFile(FORM, [], [], [], [], tree);
    expect(file.data.paragraphs.map(p => p.designator)).toEqual(['1.', 'a.', '2.', 'a.']);
  });

  it('deep levels follow the SECNAV M-5216.5 ladder', async () => {
    const tree = [1, 2, 3, 4, 5, 6, 7, 8].map(level => para(level, level));
    const file = await createNLDPFile(FORM, [], [], [], [], tree);
    expect(file.data.paragraphs.map(p => p.designator)).toEqual([
      '1.', 'a.', '(1)', '(a)', '1.', 'a.', '(1)', '(a)',
    ]);
  });
});
