/**
 * S5 — level 5-8 designator underlines, both emitters (audit gap G6).
 *
 * SECNAV M-5216.5 Fig 7-8: levels 5 and 6 use underlined number/letter
 * designators ("1.", "a." with only the character underlined, not the
 * period); levels 7 and 8 parenthesize them ("(1)", "(a)" with only
 * the inner character underlined, not the parentheses).
 *
 * Verification is against output bytes: DOCX run properties in
 * document.xml; PDF vector path operators in the content stream
 * (react-pdf draws each underline as a filled path).
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { FIXTURE_FORM_DATA } from './golden/fixture';
import type { ParagraphData } from '@/types';

// Clean fixture: one chain to level 8, content carries NO <u> markup,
// so every underline in the output belongs to a designator.
const CHAIN: ParagraphData[] = [
  { id: 1, level: 1, content: 'Level one content.' },
  { id: 2, level: 2, content: 'Level two content.' },
  { id: 3, level: 3, content: 'Level three content.' },
  { id: 4, level: 4, content: 'Level four content.' },
  { id: 5, level: 5, content: 'Level five content.' },
  { id: 6, level: 6, content: 'Level six content.' },
  { id: 7, level: 7, content: 'Level seven content.' },
  { id: 8, level: 8, content: 'Level eight content.' },
];

const args = [FIXTURE_FORM_DATA, [], [], [], [], CHAIN, []] as const;

interface Run { underlined: boolean; text: string }

function runsOf(paragraphXml: string): Run[] {
  const runs = paragraphXml.match(/<w:r>.*?<\/w:r>/gs) ?? [];
  return runs
    .map((r) => ({
      underlined: /<w:u\b/.test(r),
      text: (r.match(/<w:t[^>]*>(.*?)<\/w:t>/s)?.[1] ?? ''),
    }))
    .filter((r) => r.text !== '');
}

describe('DOCX designator underlines (Fig 7-8)', () => {
  it('levels 5-8: only the designator character is underlined', async () => {
    const blob = await generateDocxBlob(...args);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];

    const expectations: Array<[string, string, string[]]> = [
      // [content marker, underlined char, non-underlined siblings]
      ['Level five content', '1', ['.']],
      ['Level six content', 'a', ['.']],
      ['Level seven content', '1', ['(', ')']],
      ['Level eight content', 'a', ['(', ')']],
    ];
    for (const [marker, uChar, plain] of expectations) {
      const p = paras.find((x) => x.includes(marker));
      expect(p, marker).toBeDefined();
      const runs = runsOf(p!);
      const uRuns = runs.filter((r) => r.underlined);
      expect(uRuns.length, `${marker}: exactly one underlined run`).toBe(1);
      expect(uRuns[0].text, `${marker}: underlined char`).toBe(uChar);
      for (const ch of plain) {
        const sib = runs.find((r) => r.text === ch);
        expect(sib, `${marker}: sibling "${ch}" present`).toBeDefined();
        expect(sib!.underlined, `${marker}: "${ch}" must NOT be underlined`).toBe(false);
      }
    }
  });

  it('levels 1-4: no underlines anywhere', async () => {
    const blob = await generateDocxBlob(...args);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const paras = (xml.match(/<w:p\b.*?<\/w:p>/gs) ?? []).filter((p) =>
      /Level (one|two|three|four) content/.test(p),
    );
    expect(paras.length).toBe(4);
    for (const p of paras) {
      expect(/<w:u\b/.test(p)).toBe(false);
    }
  });
});

describe('PDF Courier designators (Fig 7-8)', () => {
  it('levels 7-8 keep BOTH parentheses around the underlined character', async () => {
    const blob = await generateBasePDFBlob(
      { ...FIXTURE_FORM_DATA, bodyFont: 'courier' }, [], [], [], [], CHAIN, [],
    );
    const { extractPdfTextLayout } = await import('./golden/helpers');
    const layout = await extractPdfTextLayout(blob);
    // Join each line's items by y coordinate, then find designator lines.
    const byY = new Map<number, string>();
    for (const i of layout.filter((x) => x.page === 1)) {
      byY.set(i.y, (byY.get(i.y) ?? '') + i.text);
    }
    const lines = [...byY.values()];
    const l7 = lines.find((l) => l.includes('Level seven content'));
    const l8 = lines.find((l) => l.includes('Level eight content'));
    expect(l7, 'level 7 line').toBeDefined();
    expect(l8, 'level 8 line').toBeDefined();
    expect(l7!.replace(/\u00A0/g, ' ').trimStart().startsWith('(1)'),
      `level 7 designator must read "(1)", got: ${l7!.trimStart().slice(0, 12)}`).toBe(true);
    expect(l8!.replace(/\u00A0/g, ' ').trimStart().startsWith('(a)'),
      `level 8 designator must read "(a)", got: ${l8!.trimStart().slice(0, 12)}`).toBe(true);
  }, 30000);
});

describe('PDF designator underlines (Fig 7-8)', () => {
  it('draws exactly four underline paths, one per level 5-8 designator', async () => {
    const blob = await generateBasePDFBlob(...args);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await blob.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const page = await doc.getPage(1);
    const ops = await page.getOperatorList();
    // react-pdf renders textDecoration underline as a constructPath op.
    // Filter to zero-height horizontal lines (underlines); the seal
    // image contributes one 72x72 bounding-box path that is not one.
    const underlines: Array<{ width: number }> = [];
    ops.fnArray.forEach((fn: number, i: number) => {
      if (fn !== pdfjs.OPS.constructPath) return;
      const [, , minMax] = ops.argsArray[i];
      const [x0, y0, x1, y1] = minMax as number[];
      if (Math.abs(y1 - y0) < 0.01 && x1 - x0 < 12) {
        underlines.push({ width: Math.round((x1 - x0) * 100) / 100 });
      }
    });
    await doc.destroy();
    expect(underlines.length, 'one underline per level 5-8 designator').toBe(4);
    // Widths equal the glyph advances at 12pt: digit 6.0pt, "a" 5.33pt.
    // Matching widths prove ONLY the character is underlined - a period
    // (+3pt) or parenthesis (+4pt) under the line would widen it.
    const widths = underlines.map((u) => u.width).sort((a, b) => a - b);
    expect(widths[0]).toBeCloseTo(5.33, 1); // level 6 "a"
    expect(widths[1]).toBeCloseTo(5.33, 1); // level 8 "(a)" inner
    expect(widths[2]).toBeCloseTo(6.0, 1);  // level 5 "1"
    expect(widths[3]).toBeCloseTo(6.0, 1);  // level 7 "(1)" inner
  }, 30000);
});
