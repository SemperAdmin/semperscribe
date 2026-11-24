/**
 * The DD 1561 skips the letter passes the NAVMC 11106 skips: the
 * signature-field stamp (blocks 9b and 15d are the form's own /Sig fields)
 * and the enclosure merge (rows left over from a type switch; its only
 * attachment, the block 10 continuation page, is part of the fill). The
 * export toast names the CAC signature blocks and any continuation page, and
 * a fill refusal reaches the toast in plain words.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FormData } from '@/types';
import { DD1561_SAMPLE_T, DD1561_SAMPLE_T5 } from './fixtures/dd1561-samples';

const generatePdfForDocType = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
const mergeAttachmentsIntoPdf = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
const computeMergeItems = vi.fn(() => [{ stub: true }]);
const addMultipleSignatureFields = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));

vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: (...a: unknown[]) => generatePdfForDocType(...(a as [])),
}));
vi.mock('@/lib/enclosure-attachments', () => ({
  mergeAttachmentsIntoPdf: (...a: unknown[]) => mergeAttachmentsIntoPdf(...(a as [])),
  computeMergeItems: (...a: unknown[]) => computeMergeItems(...(a as [])),
}));
vi.mock('@/lib/export-gate', () => ({ clearedForExport: async () => true }));
vi.mock('@/lib/pdf-signature-field', () => ({
  addMultipleSignatureFields: (...a: unknown[]) => addMultipleSignatureFields(...(a as [])),
}));

import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useLivePreview } from '@/hooks/useLivePreview';

const SIG = [{ page: 1, x: 10, y: 10, width: 100, height: 30 }];
const ROWS = [{ id: 'r1' }] as never;
const FILES = new Map([['r1', { name: 'orders.pdf' }]]) as never;
const withSig = (d: FormData) => ({ ...d, signatureFields: SIG }) as unknown as FormData;

const slices = (formData: FormData) => ({
  formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
});

beforeEach(() => {
  generatePdfForDocType.mockClear();
  mergeAttachmentsIntoPdf.mockClear();
  computeMergeItems.mockClear();
  addMultipleSignatureFields.mockClear();
  window.URL.createObjectURL = vi.fn(() => 'blob:test') as typeof window.URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function runExport(formData: FormData) {
  const applySignatureFields = vi.fn(async (b: Blob) => b);
  const toast = vi.fn();
  const { result } = renderHook(() =>
    useDocumentExport({ data: slices(formData) as never, applySignatureFields, enclosureRows: ROWS, enclosureFiles: FILES, toast }));
  await act(async () => { await result.current.generateDocument('pdf'); });
  return { applySignatureFields, toast };
}

describe('DD 1561 export', () => {
  it('skips the signature-field pass and the enclosure merge', async () => {
    const { applySignatureFields } = await runExport(withSig(DD1561_SAMPLE_T));
    expect(generatePdfForDocType).toHaveBeenCalledWith(expect.objectContaining({ mode: 'export' }));
    expect(applySignatureFields).not.toHaveBeenCalled();
    expect(mergeAttachmentsIntoPdf).not.toHaveBeenCalled();
  });

  it('toasts the fillable form and both CAC signature blocks, no continuation for three rows', async () => {
    const { toast } = await runExport(DD1561_SAMPLE_T);
    const call = toast.mock.calls.find(([t]) => t.title === 'Official Form Exported');
    expect(call).toBeDefined();
    const text = call![0].description as string;
    expect(text).toContain('fillable DD 1561');
    expect(text).toContain('any PDF viewer');
    expect(text).toMatch(/member signs 9b/);
    expect(text).toMatch(/certifying official signs 15d/);
    expect(text).not.toContain('continuation');
  });

  it('names the continuation page when rows 4+ exist', async () => {
    const { toast } = await runExport(DD1561_SAMPLE_T5);
    const call = toast.mock.calls.find(([t]) => t.title === 'Official Form Exported');
    expect(call![0].description).toContain('continuation page with the other 2 rows');
  });

  it('shows the fill refusal text when the export fails', async () => {
    generatePdfForDocType.mockRejectedValueOnce(new Error('DD 1561 cannot be exported. Block 2 Grade: too long. Shorten it.'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { toast } = await runExport(DD1561_SAMPLE_T);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'PDF export failed',
      description: 'Nothing was downloaded. DD 1561 cannot be exported. Block 2 Grade: too long. Shorten it.',
    }));
  });
});

describe('DD 1561 live preview', () => {
  it('renders through the dd1561 pipeline in preview mode and merges no enclosures', async () => {
    const hook = renderHook(() => useLivePreview(slices(withSig(DD1561_SAMPLE_T)), { enclosureRows: ROWS, enclosureFiles: FILES }));
    await act(async () => { await hook.result.current.updatePreview(); });
    expect(generatePdfForDocType).toHaveBeenCalledWith(expect.objectContaining({ mode: 'preview' }));
    expect(mergeAttachmentsIntoPdf).not.toHaveBeenCalled();
    expect(addMultipleSignatureFields).not.toHaveBeenCalled();
  });

  it('does not stamp signature fields onto a DD 1561', async () => {
    const hook = renderHook(() => useLivePreview(slices(withSig(DD1561_SAMPLE_T))));
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    let out: Blob | undefined;
    await act(async () => { out = await hook.result.current.applySignatureFields(blob); });
    expect(out).toBe(blob);
  });
});
