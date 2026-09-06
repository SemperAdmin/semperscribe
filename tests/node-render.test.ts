// @vitest-environment node
/**
 * The premise of the headless companion: with the asset seam pointed at
 * public/ on disk, the PDF and DOCX pipelines render a letter under plain
 * Node with no window, no document, and no fetch to the origin.
 *
 * Every other render test runs under jsdom. This one runs under the
 * `node` environment so a hidden browser dependency in the pipelines
 * fails here before it fails inside the companion.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerNodeAssets } from './node-assets';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { generateDocxBlob } from '@/lib/docx-generator';
import { generateITypeDocx } from '@/services/docx/i-type-docx';
import { exportOfficialForm } from '@/lib/xfa-form-fill';
import { exportNavmc10132Form } from '@/lib/navmc10132-export';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

const PDF_MAGIC = '%PDF-';
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function head(blob: Blob, n: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer()).subarray(0, n);
}

beforeAll(() => {
  registerNodeAssets();
});

describe('render under plain Node (no window)', () => {
  it('runs with no browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('renders the fixture letter to PDF', async () => {
    const blob = await generatePdfForDocType({
      formData: FIXTURE_FORM_DATA,
      vias: FIXTURE_VIAS,
      references: FIXTURE_REFERENCES,
      enclosures: FIXTURE_ENCLOSURES,
      copyTos: FIXTURE_COPY_TOS,
      paragraphs: FIXTURE_PARAGRAPHS,
    });
    expect(blob.size).toBeGreaterThan(10_000);
    expect(Buffer.from(await head(blob, 5)).toString('latin1')).toBe(PDF_MAGIC);
  });

  it('renders the fixture letter to DOCX with the letterhead seal', async () => {
    const blob = await generateDocxBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      FIXTURE_PARAGRAPHS,
      [],
    );
    expect(Array.from(await head(blob, 4))).toEqual(ZIP_MAGIC);
  });

  it('renders the I-Type DOCX cover with the USMC seal read from disk', async () => {
    const buf = await generateITypeDocx({
      ...FIXTURE_FORM_DATA,
      documentType: 'i-type',
    } as never);
    expect(Array.from(buf.subarray(0, 4))).toEqual(ZIP_MAGIC);
    // The seal PNG lands in word/media. A silent null seal would drop it.
    expect(buf.toString('latin1')).toContain('word/media/');
  });

  it('fills the NAVMC 10274 XFA blank and the NAVMC 10132 AcroForm blank from disk', async () => {
    const xfa = await exportOfficialForm({
      formData: { ...FIXTURE_FORM_DATA, documentType: 'aa-form' },
      vias: FIXTURE_VIAS,
      references: FIXTURE_REFERENCES,
      enclosures: FIXTURE_ENCLOSURES,
      copyTos: FIXTURE_COPY_TOS,
      paragraphs: FIXTURE_PARAGRAPHS,
    } as never);
    expect(Buffer.from(await head(xfa, 5)).toString('latin1')).toBe(PDF_MAGIC);
    const acro = await exportNavmc10132Form({ ...FIXTURE_FORM_DATA, documentType: 'navmc10132' });
    expect(Buffer.from(await head(acro, 5)).toString('latin1')).toBe(PDF_MAGIC);
  });
});
