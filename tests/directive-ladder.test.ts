/**
 * P3.2/P3.3 — USMC directive geometry (MCO 5215.1K paras 33, 37).
 *
 * Ladder: designator at character column (level-1)*4 in Courier; two
 * spaces after period designators, one after parenthesized; runover
 * lines return to the left margin (no hanging indent).
 * Signature: 5th line below the last text line (4 blanks) for
 * MCO/MCBul; correspondence keeps the 4th line (M-5216.5 7-2.16).
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const NBSP = ' ';

const DIRECTIVE_PARAGRAPHS = [
  { id: 1, level: 1, content: 'Situation. Top level paragraph.' },
  { id: 2, level: 2, content: 'Second level paragraph, four columns in.' },
  { id: 3, level: 3, content: 'Third level paragraph, eight columns in.' },
  { id: 4, level: 4, content: 'Fourth level paragraph at twelve columns with enough words to force the line to wrap so the runover margin is observable in the PDF text layout.' },
] as never[];

function mcoForm(extra: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'mco',
    directiveTitle: 'FIXTURE ORDER',
    sig: 'I. M. MARINE',
    ...extra,
  } as never;
}

async function docxParas(form: never): Promise<string[]> {
  const blob = await generateDocxBlob(form, [], [], [], [], DIRECTIVE_PARAGRAPHS, []);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.match(/<w:p\b.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
}

function textOf(p: string): string {
  return (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
    .map((t) => t.replace(/<[^>]+>/g, '')).join('');
}

describe('DOCX directive ladder (MCO 5215.1K para 33)', () => {
  it('designators sit at character columns 0/4/8/12 with 2/1 trailing spaces', async () => {
    const paras = (await docxParas(mcoForm())).map(textOf);
    const body = [
      paras.find((t) => t.includes('Situation. Top level')),
      paras.find((t) => t.includes('Second level')),
      paras.find((t) => t.includes('Third level')),
      paras.find((t) => t.includes('Fourth level')),
    ];
    expect(body[0]).toMatch(new RegExp(`^1\\.${NBSP}{2}`));
    expect(body[1]).toMatch(new RegExp(`^${NBSP}{4}a\\.${NBSP}{2}`));
    expect(body[2]).toMatch(new RegExp(`^${NBSP}{8}\\(1\\)${NBSP}{1}T`));
    expect(body[3]).toMatch(new RegExp(`^${NBSP}{12}\\(a\\)${NBSP}{1}F`));
  });

  it('directive paragraphs carry no hanging indent (runover at left margin)', async () => {
    const paras = await docxParas(mcoForm());
    const wrapping = paras.find((p) => textOf(p).includes('Fourth level'));
    expect(wrapping).toBeDefined();
    expect(wrapping!.includes('<w:ind')).toBe(false);
  });

  it('MCO signature lands on the 5th line below text (4 blanks)', async () => {
    const paras = await docxParas(mcoForm());
    const texts = paras.map(textOf);
    const sigIdx = texts.findIndex((t) => t === 'I. M. MARINE');
    const lastBody = texts.findIndex((t) => t.includes('Fourth level'));
    expect(sigIdx).toBeGreaterThan(lastBody);
    expect(sigIdx - lastBody).toBe(5);
    for (let k = lastBody + 1; k < sigIdx; k++) expect(texts[k]).toBe('');
  });

  it('correspondence keeps the 4th-line signature (regression)', async () => {
    const paras = await docxParas({ ...FIXTURE_FORM_DATA, documentType: 'basic', sig: 'I. M. MARINE' } as never);
    const texts = paras.map(textOf);
    const sigIdx = texts.findIndex((t) => t === 'I. M. MARINE');
    let blanks = 0;
    for (let k = sigIdx - 1; k > 0 && texts[k] === ''; k--) blanks++;
    expect(blanks).toBe(3);
  });
});

describe('PDF directive ladder (MCO 5215.1K para 33)', () => {
  it('designators at x = margin + column*7.2pt; runover at left margin', async () => {
    const blob = await generateBasePDFBlob(mcoForm(), [], [], [], [], DIRECTIVE_PARAGRAPHS, []);
    const layout = await extractPdfTextLayout(blob);

    const MARGIN = 72;  // 1-inch left margin in PDF points
    const CHAR = 7.2;   // Courier 12 advance

    // Reconstruct lines: group items by (page, y), sort by x.
    const lines = new Map<string, { x: number; text: string }[]>();
    for (const i of layout) {
      const key = `${i.page}:${i.y}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key)!.push({ x: i.x, text: i.text });
    }
    const rebuilt = [...lines.values()].map((items) => {
      items.sort((a, b) => a.x - b.x);
      return { x: items[0].x, text: items.map((i) => i.text).join('') };
    });
    const lineWith = (frag: string) => rebuilt.find((l) => l.text.includes(frag));

    // Designator columns 0/4/8/12 -> line start x (MCO 5215.1K para 33).
    for (const [frag, des, col] of [
      ['Situation. Top level', '1.', 0],
      ['Second level', 'a.', 4],
      ['Third level', '(1)', 8],
      ['Fourth level', '(a)', 12],
    ] as const) {
      const line = lineWith(frag);
      expect(line, frag).toBeDefined();
      expect(line!.x, `${des} starts at column ${col}`).toBeCloseTo(MARGIN + col * CHAR, 1);
      expect(line!.text.startsWith(des), `${des} leads the line`).toBe(true);
    }

    // Spacing after designators: 2 spaces after periods, 1 after parens
    // (text column = designator column + designator chars + spaces).
    const l1 = layout.find((i) => i.text === 'Situation.');
    const l3 = layout.find((i) => i.text === 'Third');
    expect(l1!.x, 'level-1 text at column 4').toBeCloseTo(MARGIN + 4 * CHAR, 1);
    expect(l3!.x, 'level-3 text at column 12').toBeCloseTo(MARGIN + 12 * CHAR, 1);

    // Runover: the level-4 paragraph wraps; the continuation line
    // returns to the LEFT MARGIN, not the text column.
    const cont = rebuilt.find((l) => l.text.includes('observable'));
    expect(cont, 'wrapped continuation line').toBeDefined();
    expect(cont!.x, 'runover returns to left margin').toBe(MARGIN);
  });
});
