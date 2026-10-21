// @vitest-environment node
/**
 * Preview and official export agree line for line (acceptance item 5 of
 * the handoff of 2026-10-21). The export writes each block as paragraphs
 * with wrapped lines rejoined by spaces, trusting Acrobat to re-wrap the
 * same words to the same lines at the same width and face. This test is
 * that trust made checkable: re-wrapping the exported field text with
 * the module's own metrics must give exactly the lines the preview drew.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout, readXfaPacket } from './golden/helpers';
import { exportOfficialForm } from '@/lib/xfa-form-fill';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { NAVMC10274_FIELDS, aaTextBox, flowAaBody, wrapAaText } from '@/lib/navmc10274-layout';
import { TLE_EXTENSION_FIXTURE } from './fixtures/navmc10274-tle-extension';
import type { FormData, ParagraphData } from '@/types';

const fx = TLE_EXTENSION_FIXTURE;
const slices = {
  formData: fx.formData as unknown as FormData,
  vias: fx.vias, references: fx.references, enclosures: fx.enclosures, copyTos: fx.copyTos,
  paragraphs: fx.paragraphs as unknown as ParagraphData[],
};

const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
const decode = (xml: string) =>
  xml.replace(/&#xD;/g, '\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const field = (xml: string, name: string) => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return m ? decode(m[1]) : '';
};
/** What Acrobat lays out from a field value: each paragraph re-wrapped at the field's width. */
const acrobatLines = (value: string, fieldName: keyof typeof NAVMC10274_FIELDS) =>
  value.split('\n').flatMap(p => (p.trim() ? wrapAaText(p, NAVMC10274_FIELDS[fieldName]) : ['']));

let datasets: string;
let drawn: { page: number; x: number; y: number; text: string }[];

beforeAll(async () => {
  registerNodeAssets();
  const official = await exportOfficialForm(slices as never);
  datasets = await readXfaPacket(new Uint8Array(await official.arrayBuffer()), 'datasets');
  const preview = await generatePdfForDocType({ ...slices, distList: [] } as never);
  drawn = await extractPdfTextLayout(preview);
}, 90_000);

function drawnIn(fieldName: keyof typeof NAVMC10274_FIELDS): string[] {
  const f = NAVMC10274_FIELDS[fieldName];
  const box = aaTextBox(f);
  // Inside the box on its page. The x range, not the left edge: pdf.js
  // reports the typed name's item from its first glyph at the centre
  // line, past the lead of spaces the line is drawn with.
  // pdf.js may split one drawn line into several items; items on one
  // baseline are rejoined in x order before comparing.
  const inBox = drawn
    .filter(i => i.page === f.page && i.x >= box.left - 1.5 && i.x <= box.left + box.width && i.y <= box.top && i.y >= box.top - box.height)
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: { y: number; text: string }[] = [];
  for (const i of inBox) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - i.y) < 0.5) last.text += i.text;
    else lines.push({ y: i.y, text: i.text });
  }
  return lines.map(l => squash(l.text));
}

describe('NAVMC 10274 preview and official export parity', () => {
  it('block 12: the exported SuppInfo re-wraps to the lines the preview drew, and to the flow', () => {
    const flow = flowAaBody(slices.paragraphs, slices.formData.sig);
    const fromExport = acrobatLines(field(datasets, 'SuppInfo'), 'SuppInfo').map(squash).filter(Boolean);
    const fromFlow = flow.block12.map(l => squash(l.text)).filter(Boolean);
    expect(fromExport).toEqual(fromFlow);
    expect(drawnIn('SuppInfo')).toEqual(fromFlow);
    expect(flow.block12.length).toBeLessThanOrEqual(30);
  });

  it('block 13: the typed name, alone, on both paths', () => {
    const fromExport = acrobatLines(field(datasets, 'ProcAct'), 'ProcAct').map(squash);
    expect(fromExport).toEqual(['', '', '', fx.formData.sig]);
    expect(drawnIn('ProcAct')).toEqual([fx.formData.sig]);
    const box = aaTextBox(NAVMC10274_FIELDS.ProcAct);
    const name = drawn.find(i => i.page === 3 && squash(i.text) === fx.formData.sig);
    expect(Math.abs(name!.y - (box.top - 0.891 * 10 - 3 * NAVMC10274_FIELDS.ProcAct.lineHeight))).toBeLessThan(1.5);
  });

  it('every small box carries the same words on both paths', () => {
    for (const name of ['NameFrom', 'OrgStat', 'Via1', 'AddrTo', 'NatOfAct', 'RefAuth', 'Encl1'] as const) {
      const fromExport = acrobatLines(field(datasets, name), name).map(squash).filter(Boolean);
      expect(drawnIn(name), name).toEqual(fromExport);
    }
    expect(field(datasets, 'Date')).toBe('2026-10-19');
    expect(drawn.some(i => i.page === 2 && i.text === '2026-10-19')).toBe(true);
  });
});
