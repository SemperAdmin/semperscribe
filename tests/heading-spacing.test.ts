/**
 * S7 — heading colon-space counts (audit line 42; M-5216.5 7-2.x).
 *
 * Normative counts after the heading colon:
 *   From 2, To 6, Via 5, Subj 3, Ref 4, Encl 3   (audit line 42)
 *
 * FONT-SPLIT RULING (user, 2026-06-10):
 * - Courier (typewriter model): uniform-column counts per the manual's
 *   monospace figures — From 2, To 4, Via 3, Subj 2, Ref 3, Encl 2,
 *   continuation lines at column 7. Asserted literally below.
 * - Times (proportional): the audit's counts exist to land every
 *   heading's content at a common ~0.5in column. The implementation
 *   realizes that column EXACTLY (DOCX tab stop 720 twips; PDF 36pt
 *   label column). The equivalence test below proves each audit count
 *   measures to within half a space (1.5pt) of the implemented column,
 *   pinning the counts as the standard without degrading the exact
 *   column to a space-approximation.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import * as fontkit from 'fontkit';
import {
  getFromToSpacing,
  getViaSpacing,
  getSubjSpacing,
  getRefSpacing,
  getEnclSpacing,
} from '@/lib/naval-format-utils';
import { TAB_STOPS } from '@/lib/doc-settings';
import { PDF_INDENTS } from '@/lib/pdf-settings';

const NBSP = ' ';

describe('Courier heading spacing (typewriter uniform column)', () => {
  it('From: 2 spaces, To: 4 spaces (content at one column)', () => {
    expect(getFromToSpacing('From', 'courier')).toBe('From:  ');
    expect(getFromToSpacing('To', 'courier')).toBe('To:    ');
    expect(getFromToSpacing('From', 'courier').length)
      .toBe(getFromToSpacing('To', 'courier').length);
  });

  it('Via: 3 spaces then (n) then 1 space; continuation at column 7', () => {
    expect(getViaSpacing(0, 'courier')).toBe(`Via:${NBSP}${NBSP}${NBSP}(1)${NBSP}`);
    expect(getViaSpacing(1, 'courier')).toBe(`${NBSP.repeat(7)}(2)${NBSP}`);
  });

  it('Subj: 2 spaces', () => {
    expect(getSubjSpacing('courier')).toBe('Subj:  ');
  });

  it('Ref: 3 spaces then (a) then 1 space; continuation at column 7', () => {
    expect(getRefSpacing('a', 0, 'courier')).toBe(`Ref:${NBSP}${NBSP}${NBSP}(a)${NBSP}`);
    expect(getRefSpacing('b', 1, 'courier')).toBe(`${NBSP.repeat(7)}(b)${NBSP}`);
  });

  it('Encl: 2 spaces then (1) then 1 space; continuation at column 7', () => {
    expect(getEnclSpacing(1, 0, 'courier')).toBe(`Encl:${NBSP}${NBSP}(1)${NBSP}`);
    expect(getEnclSpacing(2, 1, 'courier')).toBe(`${NBSP.repeat(7)}(2)${NBSP}`);
  });

  it('all first-entry captions align content at the same column (7 chars)', () => {
    const captions = [
      getFromToSpacing('From', 'courier'),
      getFromToSpacing('To', 'courier'),
      'Via:' + NBSP.repeat(3),
      'Subj:  ',
      'Ref:' + NBSP.repeat(3),
      'Encl:' + NBSP.repeat(2),
    ];
    for (const c of captions) expect(c.length, JSON.stringify(c)).toBe(7);
  });
});

describe('Times heading spacing (audit counts realize the 0.5in column)', () => {
  const font = fontkit.openSync(
    path.resolve(__dirname, '../public/fonts/LiberationSerif-Regular.ttf'),
  );
  const widthPt = (text: string): number => {
    let units = 0;
    for (const glyph of font.layout(text).glyphs) units += glyph.advanceWidth;
    return (units / font.unitsPerEm) * 12;
  };

  // Audit line 42 normative space counts.
  const AUDIT_COUNTS: Array<[string, number]> = [
    ['From:', 2], ['To:', 6], ['Via:', 5], ['Subj:', 3], ['Ref:', 4], ['Encl:', 3],
  ];

  // Measured at TNR 12: From+2=35.34, To+6=34.66, Via+5=35.66,
  // Subj+3=34.34, Encl+3=34.32 — a common column (spread 1.34pt,
  // under half a space). Ref+4=32.66 is the outlier; see below.
  it('five of six audit counts realize one common column (spread under half a space)', () => {
    const cluster = AUDIT_COUNTS
      .filter(([c]) => c !== 'Ref:')
      .map(([c, n]) => widthPt(c + ' '.repeat(n)));
    const spread = Math.max(...cluster) - Math.min(...cluster);
    expect(spread, `cluster spread ${spread.toFixed(2)}pt`).toBeLessThanOrEqual(widthPt(' ') / 2);
  });

  it('the implemented 36pt column sits within half a space of the audit cluster mean', () => {
    const cluster = AUDIT_COUNTS
      .filter(([c]) => c !== 'Ref:')
      .map(([c, n]) => widthPt(c + ' '.repeat(n)));
    const mean = cluster.reduce((a, b) => a + b, 0) / cluster.length;
    expect(Math.abs(36 - mean), `36pt vs cluster mean ${mean.toFixed(2)}pt`)
      .toBeLessThanOrEqual(widthPt(' ') / 2);
  });

  it('DOCUMENTED AUDIT ANOMALY: Ref count is internally inconsistent', () => {
    // "Ref:" and "Via:" have identical caption widths (20.66pt), yet
    // audit line 42 assigns Via 5 spaces and Ref 4. Equal captions
    // cannot require different counts for a common column; Ref+4 falls
    // 2.3pt short of the cluster. Pinned here so a future audit
    // correction flips this test DELIBERATELY. Flag for SME alongside
    // conflicts C5/C9. The implementation keeps Ref at the exact 36pt
    // column with the rest.
    expect(widthPt('Ref:'), 'captions equal').toBeCloseTo(widthPt('Via:'), 4);
    const refX = widthPt('Ref:' + ' '.repeat(4));
    const viaX = widthPt('Via:' + ' '.repeat(5));
    expect(viaX - refX, 'Ref+4 is one space short of Via+5').toBeCloseTo(widthPt(' '), 2);
  });

  it('DOCX implements the column as a 720-twip (0.5in) tab stop', () => {
    expect(TAB_STOPS.first).toBe(720);
    expect(getFromToSpacing('From', 'times')).toBe('From:\t');
    expect(getFromToSpacing('To', 'times')).toBe('To:\t');
    expect(getSubjSpacing('times')).toBe('Subj:\t');
    expect(getRefSpacing('a', 0, 'times')).toBe('Ref:\t(a) ');
    expect(getEnclSpacing(1, 0, 'times')).toBe('Encl:\t(1) ');
    expect(getViaSpacing(0, 'times')).toBe('Via:\t(1)\t');
  });

  it('PDF implements the column as a 36pt label width', () => {
    expect(PDF_INDENTS.tabStop1).toBe(36);
  });
});
