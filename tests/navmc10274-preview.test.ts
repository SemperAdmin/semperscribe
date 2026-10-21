// @vitest-environment node
/**
 * NAVMC 10274 preview (src/services/pdf/navmc10274Generator.ts) drawn
 * from the layout module: three pages, every box at the form's geometry,
 * the body by the same flow the official export fills, nothing clipped
 * in silence.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout, type PdfTextItem } from './golden/helpers';
import { generateNavmc10274 } from '@/services/pdf/navmc10274Generator';
import {
  NAVMC10274_FIELDS,
  aaFirstBaselineOffset,
  aaSignatureLead,
  aaTextBox,
  flowAaBody,
} from '@/lib/navmc10274-layout';
import { timesRomanWidth } from '@/lib/times-roman-widths';
import { TLE_EXTENSION_FIXTURE } from './fixtures/navmc10274-tle-extension';
import type { Navmc10274Data } from '@/types/navmc';
import type { ParagraphData } from '@/types';

const fx = TLE_EXTENSION_FIXTURE;
const paragraphs = fx.paragraphs as unknown as ParagraphData[];

const data = (over: Partial<Navmc10274Data> = {}): Navmc10274Data => ({
  actionNo: '',
  ssic: fx.formData.ssic,
  date: '2026-10-19',
  from: fx.formData.from,
  orgStation: fx.formData.orgStation,
  to: fx.formData.to,
  via: '(1) Commanding Officer, Marine Aviation Training Support Group 23\n(2) Deputy Commandant for Manpower and Reserve Affairs (MPO)',
  subject: fx.formData.subj,
  reference: '(a) JTR, par. 050601\n(b) JTR, par. 050604',
  enclosure: '(1) MATSG-23 Reporting Endorsement of 3 Oct 26',
  copyTo: '',
  supplementalInfo: '',
  supplementalInfoParagraphs: paragraphs,
  signature: fx.formData.sig,
  ...over,
});

async function render(d: Navmc10274Data): Promise<PdfTextItem[]> {
  const bytes = await generateNavmc10274(d);
  return extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
}

/** Items the generator drew, as opposed to the template pages' own artwork text. */
const onPage = (items: PdfTextItem[], page: number) => items.filter(i => i.page === page);
const near = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;
// pdf.js collapses a run of spaces inside an item to one, so texts compare on single spacing.
const squash = (t: string) => t.replace(/\s+/g, ' ').trim();

let items: PdfTextItem[];
beforeAll(async () => {
  registerNodeAssets();
  items = await render(data());
}, 60_000);

describe('NAVMC 10274 preview geometry', () => {
  it('is the official form\'s three pages, always', () => {
    expect(Math.max(...items.map(i => i.page))).toBe(3);
  });

  it('centres the date picture in block 3 on the form\'s own baseline', () => {
    const date = onPage(items, 2).find(i => i.text === '2026-10-19');
    expect(date).toBeDefined();
    const box = aaTextBox(NAVMC10274_FIELDS.Date);
    const width = timesRomanWidth('2026-10-19', 9);
    expect(near(date!.x, box.left + (box.width - width) / 2)).toBe(true);
    expect(near(date!.y, box.top - aaFirstBaselineOffset(NAVMC10274_FIELDS.Date))).toBe(true);
  });

  it('draws block 12 line for line as the export flow lays it out, at the form\'s pitch', () => {
    const flow = flowAaBody(paragraphs, fx.formData.sig);
    const box = aaTextBox(NAVMC10274_FIELDS.SuppInfo);
    const drawn = onPage(items, 2)
      .filter(i => near(i.x, box.left) && i.y <= box.top && i.y >= box.top - box.height)
      .sort((a, b) => b.y - a.y);
    const expected = flow.block12.map(l => squash(l.text)).filter(Boolean);
    expect(drawn.map(i => squash(i.text))).toEqual(expected);
    // Pitch: consecutive non-blank lines of one paragraph sit 11.5 pt apart.
    expect(near(drawn[0].y - drawn[1].y, NAVMC10274_FIELDS.SuppInfo.lineHeight, 0.05)).toBe(true);
    expect(near(drawn[0].y, box.top - aaFirstBaselineOffset(NAVMC10274_FIELDS.SuppInfo))).toBe(true);
  });

  it('puts the typed name in block 13 on page 3, its first letter at the box\'s centre line', () => {
    const box = aaTextBox(NAVMC10274_FIELDS.ProcAct);
    const name = onPage(items, 3).find(i => i.text.trim() === fx.formData.sig);
    expect(name).toBeDefined();
    // The line is drawn from the box edge with its lead of spaces; the glyphs
    // start a lead's width further in, at the centre line, whether pdf.js
    // reports the item from the spaces or from the first glyph.
    const lead = timesRomanWidth(' '.repeat(aaSignatureLead()), 10);
    const glyphStart = name!.text.startsWith(' ') ? name!.x + lead : name!.x;
    expect(near(glyphStart, box.left + box.width / 2, 3)).toBe(true);
    expect(near(name!.y, box.top - aaFirstBaselineOffset(NAVMC10274_FIELDS.ProcAct))).toBe(true);
  });

  it('wraps the via inside block 6 at 9 pt instead of running into block 5', () => {
    const box = aaTextBox(NAVMC10274_FIELDS.Via1);
    const via = onPage(items, 2).filter(i => near(i.x, box.left) && i.y <= box.top && i.y >= box.top - box.height);
    expect(via.length).toBe(2);
    expect(via[0].text.startsWith('(1) ')).toBe(true);
    for (const line of via) expect(timesRomanWidth(line.text, 9)).toBeLessThanOrEqual(box.width + 0.01);
  });
});

describe('NAVMC 10274 preview surfaces what the form cannot hold', () => {
  it('marks the lines a small box clips instead of dropping them in silence', async () => {
    const out = await render(data({ to: Array.from({ length: 9 }, (_, i) => `Line ${i + 1}`).join('\n') }));
    const p2 = onPage(out, 2).map(i => i.text);
    expect(p2).toContain('Line 7');
    expect(p2).not.toContain('Line 8');
    expect(p2).toContain('2 lines past block 7');
  });

  it('marks text past block 13 and never adds a page the official form lacks', async () => {
    const many = Array.from({ length: 44 }, (_, i) => ({ id: 500 + i, level: 1, content: `Para ${i + 1}` })) as ParagraphData[];
    const out = await render(data({ supplementalInfoParagraphs: many }));
    expect(Math.max(...out.map(i => i.page))).toBe(3);
    expect(onPage(out, 3).map(i => i.text)).toContain('2 lines past block 13');
  });

  it('draws a character outside WinAnsi as "?" instead of throwing', async () => {
    const odd = [{ id: 1, level: 1, content: 'Arrow → here and ligature ﬁle' }] as ParagraphData[];
    const out = await render(data({ supplementalInfoParagraphs: odd, signature: '' }));
    expect(onPage(out, 2).map(i => squash(i.text))).toContain('1. Arrow ? here and ligature ?le');
  });

  it('keeps a pasted newline inside a paragraph from throwing or breaking the count', async () => {
    const pasted = [{ id: 1, level: 1, content: 'First half\nsecond half' }] as ParagraphData[];
    const out = await render(data({ supplementalInfoParagraphs: pasted, signature: '' }));
    expect(onPage(out, 2).map(i => squash(i.text))).toContain('1. First half second half');
  });
});
