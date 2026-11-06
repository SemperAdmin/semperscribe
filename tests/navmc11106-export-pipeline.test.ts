/**
 * The NAVMC 11106 pipeline entry has the 10132's failure contract: a failed
 * fill throws on the export path and degrades to the notice page only for the
 * live preview, so a notice page is never downloaded as the Marine's form.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import type { FormData } from '@/types';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { exportNavmc11106Form } from '@/lib/navmc11106-export';

vi.mock('@/lib/navmc11106-export', () => ({ exportNavmc11106Form: vi.fn() }));

const FILL_ERROR = new Error('NAVMC 11106 cannot be exported. Block B1 Name: "Ễ" is not a character the form can print.');

const ctx = (extra: Partial<Parameters<typeof generatePdfForDocType>[0]> = {}) => ({
  formData: { documentType: 'navmc11106', nameOfMarine: 'MARINE, TEST' } as FormData,
  vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [],
  ...extra,
});

beforeEach(() => {
  vi.mocked(exportNavmc11106Form).mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('NAVMC 11106 fill failure', () => {
  it('throws on the default path and in export mode', async () => {
    vi.mocked(exportNavmc11106Form).mockRejectedValue(FILL_ERROR);
    await expect(generatePdfForDocType(ctx())).rejects.toThrow(/cannot be exported/);
    await expect(generatePdfForDocType(ctx({ mode: 'export' }))).rejects.toThrow(/cannot be exported/);
  });

  it('returns the one-page notice in preview mode', async () => {
    vi.mocked(exportNavmc11106Form).mockRejectedValueOnce(FILL_ERROR);
    const blob = await generatePdfForDocType(ctx({ mode: 'preview' }));
    expect(blob.type).toBe('application/pdf');
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });
});
