// @vitest-environment node
/**
 * Directive paragraph headings, both emitters (user report 2026-09-15).
 *
 * SECNAV M-5216.5 7-2.d: "Underline any heading and capitalize its key
 * words using the Title Case format." MCO 5216.20B carries the same rule
 * for the five-paragraph (SMEAC) order, and POLICY_COMPLIANCE_AUDIT.md
 * line 168 records it as "Underlined Title Case runs".
 *
 * Three measured divergences:
 *   1. DOCX uppercased directive headings ("EXECUTION") while the PDF
 *      preview left them as authored. Commit 309c2aa fixed the PDF
 *      emitter and never touched the DOCX one, and no test pinned the
 *      pair, so the export drifted for seven months.
 *   2. Neither emitter underlined a paragraph heading. The DOCX run set
 *      `underline: undefined` "to ensure no underline"; the PDF run set
 *      `textDecoration: 'none'`.
 *   3. The DOCX letterhead ran in Arial while the PDF letterhead ran in
 *      the serif face, so Word and the preview disagreed on the header.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { FIXTURE_FORM_DATA } from './golden/fixture';
import { extractPdfTextLayout } from './golden/helpers';
import type { ParagraphData } from '@/types';

/** SMEAC headings as a drafter types them: Title Case, no markup. */
const SMEAC: ParagraphData[] = [
  { id: 1, level: 1, title: 'Situation', content: 'Situation body text.' },
  { id: 2, level: 1, title: 'Mission', content: 'Mission body text.' },
  { id: 3, level: 1, title: 'Execution', content: 'Execution body text.' },
  { id: 4, level: 2, title: "Commander's Intent", content: 'Intent body text.' },
  { id: 5, level: 2, title: 'Concept of Operations', content: 'Concept body text.' },
] as ParagraphData[];

const MCO_FORM = {
  ...FIXTURE_FORM_DATA,
  documentType: 'mco',
  orderPrefix: 'MCO',
  ssic: '5215.1K',
  subj: 'DIRECTIVE HEADING FIXTURE',
  line1: 'UNITED STATES MARINE CORPS',
  line2: 'MARINE CORPS BASE',
  line3: 'QUANTICO VA 22134-5001',
} as never;

const args = [MCO_FORM, [], [], [], [], SMEAC, []] satisfies Parameters<typeof generateDocxBlob>;

interface Run { underlined: boolean; bold: boolean; font: string; text: string }

function runsOf(paragraphXml: string): Run[] {
  const runs = paragraphXml.match(/<w:r>.*?<\/w:r>/gs) ?? [];
  return runs
    .map((r) => ({
      underlined: /<w:u\b/.test(r),
      // docx emits <w:b w:val="false"/> for an explicitly unbolded run,
      // so presence of the tag is not the test - its value is.
      bold: /<w:b\s(?![^>]*w:val="false")/.test(r) || /<w:b\/>/.test(r),
      font: r.match(/w:ascii="([^"]*)"/)?.[1] ?? '',
      text: r.match(/<w:t[^>]*>(.*?)<\/w:t>/s)?.[1] ?? '',
    }))
    .filter((r) => r.text.trim() !== '');
}

async function docxXml() {
  const blob = await generateDocxBlob(...args);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

describe('DOCX directive headings', () => {
  it('keeps the heading in the Title Case the drafter typed', async () => {
    const xml = await docxXml();
    for (const heading of ['Situation', 'Mission', 'Execution', 'Concept of Operations']) {
      expect(xml, `${heading} as authored`).toContain(`>${heading}<`);
      expect(xml.includes(`>${heading.toUpperCase()}<`), `${heading} not shouted`).toBe(false);
    }
  }, 60000);

  it('underlines the heading run and leaves it unbolded', async () => {
    const xml = await docxXml();
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    for (const heading of ['Situation', 'Execution', 'Concept of Operations']) {
      const p = paras.find((x) => x.includes(`>${heading}<`));
      expect(p, `${heading} paragraph`).toBeDefined();
      const runs = runsOf(p!);
      const run = runs.find((r) => r.text === heading);
      expect(run, `${heading} run`).toBeDefined();
      expect(run!.underlined, `${heading}: underlined per M-5216.5 7-2.d`).toBe(true);
      expect(run!.bold, `${heading}: directives carry no bold heading`).toBe(false);
      // The separating period is punctuation and stays off the rule.
      const period = runs[runs.indexOf(run!) + 1];
      expect(period.text, `${heading}: period follows`).toBe('.');
      expect(period.underlined, `${heading}: period not underlined`).toBe(false);
    }
  }, 60000);

  it('underlines the heading only, never the body text that follows', async () => {
    const xml = await docxXml();
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const p = paras.find((x) => x.includes('>Execution<'))!;
    const body = runsOf(p).find((r) => r.text.includes('Execution body text'));
    expect(body, 'body run').toBeDefined();
    expect(body!.underlined, 'body text is not underlined').toBe(false);
  }, 60000);

  it('runs the letterhead in the same face the PDF letterhead uses', async () => {
    const xml = await docxXml();
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const head = paras.find((x) => x.includes('UNITED STATES MARINE CORPS'))!;
    const run = runsOf(head)[0];
    // MCO 5215.1K locks a directive to Courier New, and the letterhead
    // is part of the directive: one face, not three.
    expect(run.font, 'letterhead runs in the document face').toBe('Courier New');
  }, 60000);
});

describe('PDF directive headings', () => {
  it('keeps the heading in the Title Case the drafter typed', async () => {
    const blob = await generateBasePDFBlob(...args);
    const layout = await extractPdfTextLayout(blob);
    const text = layout.map((i) => i.text).join('');
    expect(text).toContain('Execution');
    expect(text.includes('EXECUTION')).toBe(false);
  }, 60000);

  it('draws an underline under every paragraph heading', async () => {
    const blob = await generateBasePDFBlob(...args);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await blob.arrayBuffer());
    const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
    const page = await doc.getPage(1);
    const ops = await page.getOperatorList();
    // react-pdf draws textDecoration underline as a flat constructPath.
    // Headings are long, so filter to rules wider than a designator glyph.
    const wide: number[] = [];
    ops.fnArray.forEach((fn: number, i: number) => {
      if (fn !== pdfjs.OPS.constructPath) return;
      const [, , minMax] = ops.argsArray[i];
      const [x0, y0, x1, y1] = minMax as number[];
      if (Math.abs(y1 - y0) < 0.01 && x1 - x0 >= 12) wide.push(x1 - x0);
    });
    await doc.destroy();
    expect(wide.length, 'one underline per heading on page 1').toBeGreaterThanOrEqual(5);
  }, 60000);
});

describe('PDF Courier bold is a real bold face (user report 2026-09-15)', () => {
  /**
   * Liberation Mono registered the REGULAR file under fontWeight 'bold'
   * (only three Liberation files shipped), so every bold run in a
   * Courier document came out at normal weight in the preview while
   * Word, which has the real Courier New Bold, set it bold. The
   * letterhead department line M-5216.5 App C requires in bold is the
   * one a reader notices first.
   *
   * Measured on the output bytes: a PDF that bolds nothing embeds one
   * Mono subset, and one that bolds something embeds a second subset
   * whose BaseFont carries the -Bold suffix. Comparing the weight of
   * rendered glyphs would be the only stronger check and it cannot tell
   * a real bold from a synthesised one either.
   */
  async function baseFonts(): Promise<string[]> {
    const blob = await generateBasePDFBlob(...args);
    const bytes = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    return [...new Set([...bytes.matchAll(/\/BaseFont\s*\/[A-Z]{6}\+([A-Za-z0-9-]+)/g)].map((m) => m[1]))].sort();
  }

  it('a directive letterhead embeds the real LiberationMono-Bold subset', async () => {
    const fonts = await baseFonts();
    expect(fonts, 'Mono regular embedded').toContain('LiberationMono');
    expect(fonts, 'Mono bold embedded, not faked from the regular file')
      .toContain('LiberationMono-Bold');
    // The face lock still holds: no serif anywhere on a directive.
    expect(fonts.some((f) => f.startsWith('LiberationSerif')), 'no serif on a directive').toBe(false);
  }, 60000);
});
