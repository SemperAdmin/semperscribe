/**
 * D.1 - standard-letter output correctness in the PDF.
 *
 * Rule 1, SECNAV M-5216.5 7-2.15.b: "Type 'Copy to:' at the left margin
 * on the second line below the signature line." The signature line here
 * is the last line of the signature block, which is the delegation line
 * when one is present. Second line below means one blank line between,
 * so the y delta from that line to "Copy to:" is two line heights. At 12
 * point type the line height is 13.8 pt in Times and 13.6 pt in Courier,
 * and the blank line is a 13.8 pt spacer in both, so the expected delta
 * is 27.6 pt in Times and 27.4 pt in Courier. Before this phase the PDF
 * put "Copy to:" one line below (13.8 pt and 13.6 pt), while the DOCX
 * emitter already pushed the blank line.
 *
 * Rule 2, SECNAV M-5216.5 Fig 7-1 para 3.a: "Do not start a paragraph at
 * the bottom of the page unless at least two lines of text will remain
 * on that page and at least two lines of text will carry over to the
 * next page." The correspondence branch of the PDF paragraph renderer
 * carried orphans and widows of two; the Courier branch, which serves
 * every Courier letter and every USMC directive, did not. The layout
 * sweep below walks a page break across a long final paragraph one line
 * at a time and holds the floor on both sides of every split.
 *
 * Measured with @react-pdf/renderer 4.5.1. Its layout engine reads the
 * props at render time: raising them to four moves the same split from
 * nine lines and two lines to seven lines and four lines. Two happens to
 * be the engine's own fallback, so at this value the props state the
 * rule rather than change today's output. They pin it against a future
 * default and against anyone lowering it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout, type PdfTextItem } from './golden/helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

const LINE_TIMES = 13.8;
const LINE_COURIER = 13.6;
const BLANK_LINE = 13.8;

interface Row {
  page: number;
  y: number;
  text: string;
  flat: string;
}

/**
 * Collapse the positioned text items into one row per baseline. Courier
 * output splits a line into a run per word, so a row is the join of every
 * item sharing a page and a y.
 */
function rows(items: PdfTextItem[]): Row[] {
  const byBaseline = new Map<string, { page: number; y: number; text: string }>();
  for (const item of items) {
    const key = `${item.page}|${item.y}`;
    const prev = byBaseline.get(key);
    byBaseline.set(key, { page: item.page, y: item.y, text: (prev?.text ?? '') + item.text });
  }
  return [...byBaseline.values()]
    .sort((a, b) => a.page - b.page || b.y - a.y)
    .map((r) => ({ ...r, flat: r.text.replace(/\s/g, '') }));
}

function rowY(all: Row[], flatNeedle: string): number {
  const hit = all.find((r) => r.flat.includes(flatNeedle));
  expect(hit, `row containing ${flatNeedle}`).toBeDefined();
  return hit!.y;
}

const SHORT_BODY = [
  { id: 1, level: 1, content: 'Situation. Body paragraph one.', title: '' },
] as never[];

describe('D.1 "Copy to:" sits on the second line below the signature line (7-2.15.b)', () => {
  it('basic letter in Times: two line heights below the delegation line', async () => {
    const blob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, FIXTURE_PARAGRAPHS, [],
    );
    const all = rows(await extractPdfTextLayout(blob));

    const name = rowY(all, 'I.M.MARINE');
    const delegation = rowY(all, 'Bydirection');
    const copyTo = rowY(all, 'Copyto:');

    // The signature block itself is unchanged: the delegation line sits
    // one line below the name.
    expect(name - delegation).toBeCloseTo(LINE_TIMES, 1);
    // One blank line then the label: the second line below.
    expect(delegation - copyTo).toBeCloseTo(LINE_TIMES + BLANK_LINE, 1);
    // The addressees follow on consecutive lines, no extra gap.
    const first = rowY(all, 'CommandingGeneral,IMEF');
    expect(copyTo - first).toBeCloseTo(LINE_TIMES, 1);
  }, 60000);

  it('first endorsement: two line heights below the delegation line', async () => {
    const form = {
      ...FIXTURE_FORM_DATA,
      documentType: 'endorsement',
      endorsementLevel: 'FIRST',
      basicLetterReference: 'CO ltr 1000 Ser 001 of 10 Feb 26',
    } as never;
    const blob = await generateBasePDFBlob(form, [], [], [], FIXTURE_COPY_TOS, SHORT_BODY, []);
    const all = rows(await extractPdfTextLayout(blob));

    expect(all.some((r) => r.flat.includes('FIRSTENDORSEMENT')), 'endorsement line').toBe(true);
    const delegation = rowY(all, 'Bydirection');
    const copyTo = rowY(all, 'Copyto:');
    expect(delegation - copyTo).toBeCloseTo(LINE_TIMES + BLANK_LINE, 1);
  }, 60000);

  it('basic letter in Courier: same rule at Courier line height', async () => {
    const form = { ...FIXTURE_FORM_DATA, bodyFont: 'courier' } as never;
    const blob = await generateBasePDFBlob(
      form, FIXTURE_VIAS, FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, FIXTURE_PARAGRAPHS, [],
    );
    const all = rows(await extractPdfTextLayout(blob));
    const delegation = rowY(all, 'Bydirection');
    const copyTo = rowY(all, 'Copyto:');
    expect(delegation - copyTo).toBeCloseTo(LINE_COURIER + BLANK_LINE, 1);
  }, 60000);

  it('a letter without copy-tos ends at the signature block, unchanged', async () => {
    const blob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES, [], FIXTURE_PARAGRAPHS, [],
    );
    const all = rows(await extractPdfTextLayout(blob));
    expect(all.some((r) => r.flat.includes('Copyto:'))).toBe(false);
    // Golden geometry for everything above the copy-to block is untouched:
    // the signature name and delegation keep their committed baselines.
    expect(rowY(all, 'I.M.MARINE')).toBeCloseTo(215.2, 1);
    expect(rowY(all, 'Bydirection')).toBeCloseTo(201.4, 1);
  }, 60000);

  it('MCO directive keeps its own copy-to spacing, one blank line', async () => {
    const form = {
      ...FIXTURE_FORM_DATA,
      documentType: 'mco',
      ssic: '5215.1K',
      orderPrefix: 'MCO',
      distribution: {
        type: 'pcn-with-copy',
        pcn: '10208490000',
        statementCode: 'A',
        copyTo: [{ code: '7000110', qty: 2 }],
      },
    } as never;
    const blob = await generateBasePDFBlob(form, [], [], [], [], SHORT_BODY, []);
    const all = rows(await extractPdfTextLayout(blob));
    const delegation = rowY(all, 'Bydirection');
    const distribution = rowY(all, 'DISTRIBUTION:');
    const copyTo = rowY(all, 'Copyto:');
    // The directive branch already carried a one-line top margin on each
    // block, which puts each label on the second line below the one above.
    expect(delegation - distribution).toBeCloseTo(LINE_COURIER + BLANK_LINE, 1);
    expect(distribution - copyTo).toBeCloseTo(LINE_COURIER + BLANK_LINE, 1);
  }, 60000);
});

/**
 * Page-break sweep for the Courier branch. A fixed long final paragraph
 * follows a spacer paragraph whose word count grows one step at a time,
 * which walks the page break through the final paragraph line by line.
 */
const TAIL_OPENER = 'Thefinalparagraph';
const TAIL =
  'The final paragraph runs long on purpose so it has enough lines to be split by ' +
  'a page break. It must never leave a single line stranded at the foot of one ' +
  'page or carried alone to the top of the next, because the two line floor in ' +
  'figure seven dash one paragraph three a forbids exactly that arrangement and ' +
  'every drafter is held to it when the letter is reviewed for release by the ' +
  'commanding officer. The sentences here carry no meaning beyond filling lines ' +
  'at a predictable rate so the harness can walk the page break across the whole ' +
  'paragraph one line at a time and watch where the split falls each time it ' +
  'renders the document again with one more line of text ahead of it.';

function spacer(words: number): string {
  return Array.from({ length: words }, (_, i) => `filler${String(i % 10)}`).join(' ') + '.';
}

async function tailSplit(words: number): Promise<number[]> {
  const paragraphs = [
    { id: 1, level: 1, content: spacer(words) },
    { id: 2, level: 1, content: TAIL },
  ] as never[];
  const form = { ...FIXTURE_FORM_DATA, bodyFont: 'courier' } as never;
  const blob = await generateBasePDFBlob(form, [], [], [], [], paragraphs, []);
  const all = rows(await extractPdfTextLayout(blob))
    // Drop the repeated Subj header on continuation pages and the
    // centred page number, neither of which belongs to the paragraph.
    .filter((r) => !r.flat.startsWith('Subj:') && !/^\d+$/.test(r.flat));

  const start = all.findIndex((r) => r.flat.includes(TAIL_OPENER));
  const stop = all.findIndex((r) => r.flat.includes('I.M.MARINE'));
  expect(start, 'final paragraph found').toBeGreaterThanOrEqual(0);
  const tail = all.slice(start, stop > start ? stop : undefined);

  const perPage = new Map<number, number>();
  for (const r of tail) perPage.set(r.page, (perPage.get(r.page) ?? 0) + 1);
  return [...perPage.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

describe('D.1 two-line orphan and widow floor on the Courier branch (Fig 7-1 3.a)', () => {
  it('no split of a Courier final paragraph ever leaves a single line', async () => {
    const observed: string[] = [];
    for (let words = 200; words <= 226; words += 2) {
      const split = await tailSplit(words);
      observed.push(`${words}:${split.join('/')}`);
      expect(split.length, `${words} words: paragraph spans at most two pages`).toBeLessThanOrEqual(2);
      for (const lines of split) {
        expect(lines, `${words} words: fragment sizes ${split.join('/')}`).toBeGreaterThanOrEqual(2);
      }
    }
    // The sweep must actually cross a page break, or it proves nothing.
    expect(observed.some((o) => o.includes('/')), `sweep saw a split: ${observed.join(' ')}`).toBe(true);
    // And it must also see the paragraph move whole, which is the other
    // half of the rule.
    expect(observed.some((o) => !o.includes('/')), `sweep saw a whole move: ${observed.join(' ')}`).toBe(true);
  }, 300000);

  it('both non-correspondence paragraph branches declare the floor in source', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/components/pdf/NavalLetterPDF.tsx'),
      'utf8',
    );
    const declarations = source.match(/orphans=\{2\} widows=\{2\}/g) ?? [];
    // Correspondence branch, Courier branch, and the two halves of the
    // Times row layout which serves the formats with no indent spec.
    expect(declarations.length, 'orphans/widows declared on every paragraph branch').toBe(4);
  });
});
