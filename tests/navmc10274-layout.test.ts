// @vitest-environment node
/**
 * NAVMC 10274 layout: the one geometry both renderers read (owner's
 * handoff of 2026-10-21 and the rulings in src/lib/navmc10274-layout.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  AA_DEFAULT_LINE_HEIGHT,
  AA_SIGNATURE_BLANK_LINES,
  NAVMC10274_FIELDS,
  aaBlockText,
  aaBodyParagraphs,
  aaLineCapacity,
  aaLinesFor,
  aaSignatureLead,
  aaUsableWidth,
  aaFieldFrame,
  aaFieldValues,
  aaFirstBaselineOffset,
  aaTextBox,
  aaViaLines,
  flowAaBody,
  normalizeAaDate,
  sanitizeForTimesRoman,
  wrapAaValue,
} from '@/lib/navmc10274-layout';
import { timesRomanWidth } from '@/lib/times-roman-widths';
import { TLE_EXTENSION_FIXTURE } from './fixtures/navmc10274-tle-extension';
import type { ParagraphData } from '@/types';

// Distinct ids: countSiblingPosition counts a blank paragraph only when it IS
// the paragraph being numbered, which it tells by id.
let nextId = 0;
const p = (content: string, level = 1, extra: Partial<ParagraphData> = {}): ParagraphData =>
  ({ id: ++nextId, level, content, ...extra }) as ParagraphData;
const ones = (n: number) => Array.from({ length: n }, (_, i) => p(`Para ${i + 1}`));

describe('the measured form', () => {
  it('holds the measured capacities at the safe pitch', () => {
    const { SuppInfo, ProcAct, RefAuth, Encl1, Via1, NameFrom, AddrTo } = NAVMC10274_FIELDS;
    expect(SuppInfo.lineHeight).toBe(AA_DEFAULT_LINE_HEIGHT);
    expect(aaLineCapacity(SuppInfo)).toBe(30);
    expect(aaLineCapacity(ProcAct)).toBe(59);
    expect(aaLineCapacity(RefAuth)).toBe(7);
    expect(aaLineCapacity(Encl1)).toBe(7);
    expect(aaLineCapacity(Via1)).toBe(2);
    expect(aaLineCapacity(NameFrom)).toBe(2);
    expect(aaLineCapacity(AddrTo)).toBe(7);
    expect(aaUsableWidth(SuppInfo)).toBeCloseTo(553.99, 1);
    expect(aaUsableWidth(AddrTo)).toBeCloseTo(262.8, 1);
  });

  it('counts the lines a value takes in a small box', () => {
    const via = 'Commanding Officer, Marine Aviation Training Support Group 23';
    expect(aaLinesFor(via, NAVMC10274_FIELDS.Via1)).toBe(1);
    expect(aaLinesFor(`(1) ${via}\n(2) Deputy Commandant for Manpower and Reserve Affairs (MPO)`, NAVMC10274_FIELDS.Via1)).toBe(2);
    expect(aaLinesFor('a\n\nb', NAVMC10274_FIELDS.CopyTo)).toBe(3);
  });
});

describe('normalizeAaDate', () => {
  it('writes the form\'s own picture, YYYY-MM-DD', () => {
    expect(normalizeAaDate('19 Oct 26')).toBe('2026-10-19');
    expect(normalizeAaDate('2026-10-19')).toBe('2026-10-19');
    expect(normalizeAaDate('')).toBe('');
    expect(normalizeAaDate('today')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalizeAaDate('not a date')).toBe('not a date');
  });

  it('reads the app\'s own "D Mon YY" by hand, with no engine parser and no time zone', () => {
    expect(normalizeAaDate('1 Jan 26')).toBe('2026-01-01');
    expect(normalizeAaDate('17 Jul 2026')).toBe('2026-07-17');
    expect(normalizeAaDate('3 Sept 26')).toBe('2026-09-03');
    expect(normalizeAaDate(' 19 October 26 ')).toBe('2026-10-19');
    expect(normalizeAaDate('31 Feb 26')).toBe('31 Feb 26'); // no such day: back as typed
    expect(normalizeAaDate('29 Feb 28')).toBe('2028-02-29');
  });

  it('reads a string carrying its own zone in that zone, so the day named is the day written', () => {
    expect(normalizeAaDate('2026-10-19T00:00:00.000Z')).toBe('2026-10-19');
    expect(normalizeAaDate('2026-10-19T23:30:00Z')).toBe('2026-10-19');
    expect(normalizeAaDate('2026-10-19T00:00:00+10:00')).toBe('2026-10-18');
  });
});

describe('aaViaLines', () => {
  it('drops empty entries, leaves one via bare and numbers two or more', () => {
    expect(aaViaLines([])).toEqual([]);
    expect(aaViaLines(['', '  '])).toEqual([]);
    expect(aaViaLines([' CO, MATSG-23 '])).toEqual(['CO, MATSG-23']);
    expect(aaViaLines(['CO, MATSG-23', '', 'DC M&RA (MPO)'])).toEqual(['(1) CO, MATSG-23', '(2) DC M&RA (MPO)']);
  });
});

describe('aaBodyParagraphs', () => {
  it('numbers on the unfiltered index, so a blank paragraph never renumbers its neighbours', () => {
    expect(aaBodyParagraphs([p('First'), p(''), p('Third')])).toEqual(['1.  First', '2.  Third']);
    expect(aaBodyParagraphs([p(''), p('Second'), p('Third')])).toEqual(['1.  Second', '2.  Third']);
    expect(aaBodyParagraphs([p('A'), p('a1', 2), p(''), p('D'), p('e', 2), p('f', 2)])).toEqual([
      '1.  A', '    a.  a1', '2.  D', '    a.  e', '    b.  f',
    ]);
  });

  it('prints a title-only paragraph under its number, as the preview always did', () => {
    expect(aaBodyParagraphs([p('First'), p('', 1, { title: 'Execution' }), p('Third')])).toEqual([
      '1.  First', '2.  Execution', '3.  Third',
    ]);
  });

  it('indents four spaces per sub-level with two spaces after the citation', () => {
    expect(aaBodyParagraphs([p('Top'), p('Sub', 2), p('Sub-sub', 3)])).toEqual([
      '1.  Top', '    a.  Sub', '        (1)  Sub-sub',
    ]);
  });
});

describe('flowAaBody', () => {
  it('keeps a short body and its signature in block 12', () => {
    const flow = flowAaBody([p('First'), p('Second')], 'F. M. LASTNAME');
    expect(flow.block13).toEqual([]);
    expect(flow.signatureBlock).toBe(12);
    const texts = flow.block12.map((l) => l.text);
    expect(texts.slice(0, 3)).toEqual(['1.  First', '', '2.  Second']);
    expect(texts.slice(-4, -1)).toEqual(['', '', '']);
    expect(texts[texts.length - 1]).toBe(`${' '.repeat(aaSignatureLead())}F. M. LASTNAME`);
    expect(flow.fits).toBe(true);
  });

  it('starts the typed name at the centre line of block 12', () => {
    const lead = aaSignatureLead();
    const width = timesRomanWidth(' '.repeat(lead), 10);
    expect(Math.abs(width - aaUsableWidth(NAVMC10274_FIELDS.SuppInfo) / 2)).toBeLessThan(timesRomanWidth(' ', 10));
  });

  it('continues into block 13 and never splits the signature group', () => {
    // 15 one-line paragraphs are 29 lines with their separators: the name's
    // four lines cannot follow in block 12's 30, so the whole group moves.
    const flow = flowAaBody(ones(15), 'F. M. LASTNAME');
    expect(flow.block12).toHaveLength(29);
    expect(flow.block12[28].text).toBe('15.  Para 15');
    // The name keeps its three blank lines when it opens block 13 (ruling, second round).
    expect(flow.block13.map((l) => l.text)).toEqual(['', '', '', `${' '.repeat(aaSignatureLead())}F. M. LASTNAME`]);
    expect(flow.signatureBlock).toBe(13);
    expect(flow.fits).toBe(true);
    // A block never opens on a blank line, and block 12 never ends on one:
    // 16 paragraphs are 31 lines, the 30th is a separator, so block 12
    // keeps 29 and block 13 opens on the text.
    const long = flowAaBody(ones(16), '');
    expect(long.block12).toHaveLength(29);
    expect(long.block13[0].text).toBe('16.  Para 16');
  });

  it('reports the body that overruns block 12 plus block 13', () => {
    // 43 one-line paragraphs: 29 lines in block 12, then 55 text lines plus
    // the four-line signature group fill block 13's 59 exactly.
    expect(flowAaBody(ones(43), 'X').fits).toBe(true);
    const over = flowAaBody(ones(44), 'X');
    expect(over.fits).toBe(false);
    expect(over.block13).toHaveLength(57 + AA_SIGNATURE_BLANK_LINES + 1);
    expect(over.totalLines).toBe(29 + 57 + AA_SIGNATURE_BLANK_LINES + 1);
  });

  it('lays out the owner\'s TLE extension request: body in block 12, name in block 13', () => {
    const flow = flowAaBody(TLE_EXTENSION_FIXTURE.paragraphs, TLE_EXTENSION_FIXTURE.formData.sig as string);
    expect(flow.fits).toBe(true);
    expect(flow.block12.length).toBeLessThanOrEqual(30);
    expect(flow.block12.length).toBeGreaterThanOrEqual(27);
    expect(flow.block12[0].text.startsWith('1.  Per references (a), (b), and (c)')).toBe(true);
    expect(flow.signatureBlock).toBe(13);
    expect(flow.block13.map((l) => l.text.trim())).toEqual(['', '', '', 'F. M. LASTNAME']);
  });
});

describe('aaBlockText', () => {
  it('rejoins wrapped lines with spaces and keeps paragraph breaks and the name\'s lead', () => {
    const flow = flowAaBody([p('First'), p('Second')], 'F. M. LASTNAME');
    const text = aaBlockText(flow.block12);
    expect(text.startsWith('1.  First\n\n2.  Second\n\n\n\n')).toBe(true);
    expect(text.endsWith(`${' '.repeat(aaSignatureLead())}F. M. LASTNAME`)).toBe(true);
    const long = flowAaBody([p(Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '))], '');
    expect(long.block12.length).toBeGreaterThan(1);
    expect(aaBlockText(long.block12)).not.toContain('\n');
  });
});

describe('page geometry', () => {
  // The hand-measured preview boxes of 2026-05 (public/templates/navmc10274/boxes.json)
  // were taken off the rendered page; the XFA positions reproduce them to a point.
  it('places block 3 (Date) where the rendered form shows it', () => {
    const frame = aaFieldFrame(NAVMC10274_FIELDS.Date);
    expect(frame.left).toBeCloseTo(405.0, 0);
    expect(frame.width).toBeCloseTo(180, 0);
    const box = aaTextBox(NAVMC10274_FIELDS.Date);
    expect(box.top).toBeCloseTo(699, 0); // caption and 1 mm inset under the frame's top at 709.8
    expect(aaFirstBaselineOffset(NAVMC10274_FIELDS.Date)).toBeCloseTo(8.02, 2);
  });

  it('places block 12 and its 30 lines where the rendered form shows them', () => {
    const box = aaTextBox(NAVMC10274_FIELDS.SuppInfo);
    expect(box.left).toBeCloseTo(29.2, 0);
    expect(box.top).toBeCloseTo(411.4, 0);
    expect(box.height).toBeCloseTo(355.9, 0);
    expect(box.width).toBeCloseTo(554.0, 0);
  });

  it('puts block 13 on page 3 filling the content area', () => {
    const f = NAVMC10274_FIELDS.ProcAct;
    expect(f.page).toBe(3);
    const frame = aaFieldFrame(f);
    expect(frame.left).toBeCloseTo(27, 0);
    expect(frame.top).toBeCloseTo(729, 0);
    expect(frame.height).toBeCloseTo(693, 0);
  });
});

describe('sanitizeForTimesRoman', () => {
  it('keeps WinAnsi, swaps the no-break space, reports everything else', () => {
    expect(sanitizeForTimesRoman('Caf\u00e9 \u2018quoted\u2019 \u2013 \u2014 \u2026 \u20ac')).toEqual({ text: 'Caf\u00e9 \u2018quoted\u2019 \u2013 \u2014 \u2026 \u20ac', replaced: [] });
    expect(sanitizeForTimesRoman('a\u00a0b')).toEqual({ text: 'a b', replaced: [] });
    expect(sanitizeForTimesRoman('x \u2192 y \uFB01')).toEqual({ text: 'x ? y ?', replaced: ['\u2192', '\uFB01'] });
  });
});

describe('wrapAaValue and whitespace', () => {
  it('keeps a blank line in a multi-line box and wraps each paragraph', () => {
    expect(wrapAaValue('A\n\nB', NAVMC10274_FIELDS.AddrTo)).toEqual(['A', '', 'B']);
  });

  it('collapses a newline inside a paragraph to one space before numbering', () => {
    expect(aaBodyParagraphs([p('First half\nsecond   half')])).toEqual(['1.  First half second half']);
  });
});

describe('aaFieldValues', () => {
  it('builds every small box once for the export, the preview and the validator', () => {
    const values = aaFieldValues({
      formData: { documentType: 'aa-form', actionNo: '', ssic: '4650', date: '19 Oct 26', from: 'F', orgStation: 'O', to: 'T', subj: 'S', startingReferenceLevel: 'c', startingEnclosureNumber: '2' },
      vias: ['V1', '', 'V2'],
      references: ['R1', 'R2'],
      enclosures: ['E1'],
      copyTos: ['C1', ' '],
    });
    const byName = Object.fromEntries(values.map(v => [v.field.name, v.value]));
    expect(byName).toEqual({
      ActNum: '', FileNum: '4650', Date: '2026-10-19', NameFrom: 'F', OrgStat: 'O',
      Via1: '(1) V1\n(2) V2', AddrTo: 'T', NatOfAct: 'S', CopyTo: 'C1',
      RefAuth: '(a) R1\n(b) R2', // a non-endorsement always starts at (a)
      Encl1: '(1) E1', // and at (1): only an endorsement continues a sequence
    });
    expect(values.find(v => v.field.name === 'AddrTo')?.formField).toBe('to');
    expect(values.find(v => v.field.name === 'Via1')?.formField).toBeUndefined();
  });
});
