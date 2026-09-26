// @vitest-environment node
/**
 * NAVMC 118(11) remarks flow: the four MARADMIN 192/26 shaving entries
 * each run past one column, so the flow carries them into the right
 * column and, when longer, onto continuation pages, with no words lost
 * (owner's screenshot of the clipped left column, 2026-09-26).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import { PAGE11_FLOW, columnText, flowPage11, flowPage11FormData, measureTimes, validatePage11Flow, wrapParagraph } from '@/lib/page11-flow';
import { timesRomanWidth } from '@/lib/times-roman-widths';
import { generateNavmc11811 } from '@/services/pdf/navmc11811Generator';
import { runLetterValidators } from '@/lib/letter-validators';
import type { FormData } from '@/types';

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
const SHAVING = ['page11-6105-shaving-six-month-enlisted', 'page11-6105-shaving-six-month-officer', 'page11-6105-shaving-final-enlisted', 'page11-6105-shaving-final-officer'];
const entryOf = (id: string) => JSON.parse(readFileSync(join(GLOBAL_DIR, `${id}.nldp`), 'utf-8')).data.formData.remarksLeft as string;
const words = (t: string) => t.split(/\s+/).filter(Boolean);

beforeAll(() => registerNodeAssets());

describe('measure', () => {
  it('matches the Times-Roman metrics pdf-lib embeds', () => {
    expect(timesRomanWidth('a', 9)).toBeCloseTo(0.444 * 9, 5);
    expect(timesRomanWidth(' ', 9)).toBeCloseTo(0.25 * 9, 5);
    expect(measureTimes('_____________________          _____________________')).toBeLessThan(PAGE11_FLOW.lineWidth);
  });
});

describe('wrapParagraph', () => {
  it('returns a fitting paragraph untouched, spaces included', () => {
    const sig = 'Signature of Marine            Signature of CO';
    expect(wrapParagraph(sig, measureTimes, 260)).toEqual([sig]);
  });

  it('breaks at whitespace, never inside a word, and loses no words', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const lines = wrapParagraph(text, measureTimes, 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(measureTimes(line)).toBeLessThanOrEqual(120);
    expect(lines.join(' ')).toBe(text);
  });
});

describe('flowPage11', () => {
  it('keeps a short entry in the left column with an empty right column', () => {
    const flow = flowPage11('Short entry.\n\nSecond paragraph.', '');
    expect(flow.pages).toHaveLength(1);
    expect(columnText(flow.pages[0].left)).toBe('Short entry.\n\nSecond paragraph.');
    expect(flow.pages[0].right.lines).toEqual([]);
  });

  it('always returns one page, both columns empty, for an empty entry', () => {
    for (const [l, r] of [['', ''], ['   ', ''], ['', '\n\n']]) {
      const flow = flowPage11(l, r);
      expect(flow.pages).toHaveLength(1);
      expect(flow.pages[0].left.lines).toEqual([]);
      expect(flow.pages[0].right.lines).toEqual([]);
      expect(columnText(flow.pages[0].left)).toBe('');
    }
    expect(flowPage11FormData({}).pages).toHaveLength(1);
  });

  it('puts a typed right-column entry after the left one', () => {
    const flow = flowPage11('First entry.', 'Second entry.');
    expect(columnText(flow.pages[0].left)).toBe('First entry.\n\nSecond entry.');
  });

  it.each(SHAVING)('%s flows past the left column onto one page, nothing lost', (id) => {
    const text = entryOf(id);
    const flow = flowPage11(text, '');
    expect(flow.pages).toHaveLength(1);
    expect(flow.pages[0].left.lines).toHaveLength(PAGE11_FLOW.linesPerColumn);
    expect(flow.pages[0].right.lines.length).toBeGreaterThan(0);
    expect(flow.pages[0].right.lines[0].text.trim()).not.toBe('');
    const rejoined = `${columnText(flow.pages[0].left)} ${columnText(flow.pages[0].right)}`;
    expect(words(rejoined)).toEqual(words(text));
  });

  it('adds a continuation page when two entries overrun two columns', () => {
    const flow = flowPage11(entryOf(SHAVING[0]), entryOf(SHAVING[2]));
    expect(flow.pages.length).toBeGreaterThanOrEqual(2);
    for (const page of flow.pages) {
      expect(page.left.lines.length).toBeLessThanOrEqual(PAGE11_FLOW.linesPerColumn);
      expect(page.right.lines.length).toBeLessThanOrEqual(PAGE11_FLOW.linesPerColumn);
    }
    const all = flow.pages.flatMap((p) => [columnText(p.left), columnText(p.right)]).join(' ');
    expect(words(all)).toEqual([...words(entryOf(SHAVING[0])), ...words(entryOf(SHAVING[2]))]);
  });

  it('warns on a continuation page and stays silent inside one page', () => {
    const one = { documentType: 'page11', remarksLeft: entryOf(SHAVING[1]), remarksRight: '' } as FormData;
    expect(validatePage11Flow(one)).toEqual([]);
    const two = { ...one, remarksRight: entryOf(SHAVING[3]) } as FormData;
    const issues = validatePage11Flow(two);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].id).toBe('page11-continuation');
    expect(runLetterValidators(two, [], [], []).some((i) => i.id === 'page11-continuation')).toBe(true);
    expect(validatePage11Flow({ documentType: 'basic' } as FormData)).toEqual([]);
  });
});

describe('the redraw', () => {
  it('prints the whole six-month entry across both columns of one page', async () => {
    const text = entryOf(SHAVING[0]);
    const bytes = await generateNavmc11811({ name: 'MARINE, TEST A.', edipi: '1234567890', remarksLeft: text, remarksRight: '' });
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    expect(Math.max(...items.map((i) => i.page))).toBe(1);
    const printed = items.map((i) => i.text).join(' ');
    expect(printed).toContain('Signature of Commanding Officer');
    expect(printed).toContain('(CBRN) attack');
    // The right column holds the tail: something printed right of the gutter.
    expect(items.some((i) => i.page === 1 && i.x > 300 && /Signature/.test(i.text))).toBe(true);
  });

  it('adds a continuation page carrying the name and DoD ID', async () => {
    const bytes = await generateNavmc11811({ name: 'MARINE, TEST A.', edipi: '1234567890', remarksLeft: entryOf(SHAVING[0]), remarksRight: entryOf(SHAVING[2]) });
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    const pages = Math.max(...items.map((i) => i.page));
    expect(pages).toBeGreaterThanOrEqual(2);
    const onPage2 = items.filter((i) => i.page === 2).map((i) => i.text).join(' ');
    expect(onPage2).toContain('MARINE, TEST A.');
    expect(onPage2).toContain('1234567890');
    // The second entry's tail, signature lines included, lands on page 2.
    expect(onPage2).toContain('Signature of Commanding Officer');
    expect(onPage2).toContain('I choose to');
  });

  it('flows through the form data helper the export hook uses', () => {
    expect(flowPage11FormData({ remarksLeft: entryOf(SHAVING[0]), remarksRight: '' }).pages).toHaveLength(1);
  });
});
