/**
 * A type switch keeps enclosureRows and formData.signatureFields, so the
 * signature-field and enclosure-merge passes would run on a NAVMC 11106 whose
 * editors are hidden. They are skipped for this form only, in export and in
 * the live preview. Export errors for this form also reach the toast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FormData } from '@/types';

const generatePdfForDocType = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
const mergeAttachmentsIntoPdf = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
const computeMergeItems = vi.fn(() => [{ stub: true }]);

vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: (...a: unknown[]) => generatePdfForDocType(...(a as [])),
}));
vi.mock('@/lib/enclosure-attachments', () => ({
  mergeAttachmentsIntoPdf: (...a: unknown[]) => mergeAttachmentsIntoPdf(...(a as [])),
  computeMergeItems: (...a: unknown[]) => computeMergeItems(...(a as [])),
}));

vi.mock('@/lib/export-gate', () => ({ clearedForExport: async () => true }));
vi.mock('@/lib/pdf-signature-field', () => ({
  addMultipleSignatureFields: async () => new Uint8Array([37, 80, 68, 70]),
}));

import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useLivePreview } from '@/hooks/useLivePreview';

const SIG = [{ page: 1, x: 10, y: 10, width: 100, height: 30 }];
const ROWS = [{ id: 'r1' }] as never;
const FILES = new Map([['r1', { name: 'counseling.pdf' }]]) as never;

const slices = (formData: FormData) => ({
  formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
});
const f11106 = { documentType: 'navmc11106', nameOfMarine: 'MARINE, TEST', grade: 'SGT', edipi: '1234567890', dutyStation: 'OKINAWA JP', signatureFields: SIG } as unknown as FormData;
const basic = {
  documentType: 'basic', ssic: '1500', originatorCode: 'S-3', date: '5 Sep 26', from: 'Commanding Officer, Unit',
  to: 'Commanding Officer, Unit One', subj: 'REQUEST FOR RANGE TIME', sig: 'J. A. SMITH', signatureFields: SIG,
} as unknown as FormData;

beforeEach(() => {
  generatePdfForDocType.mockClear();
  mergeAttachmentsIntoPdf.mockClear();
  computeMergeItems.mockClear();
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

describe('export of leftover signature fields and enclosures', () => {
  it('skips both passes for a NAVMC 11106', async () => {
    const { applySignatureFields } = await runExport(f11106);
    expect(generatePdfForDocType).toHaveBeenCalled();
    expect(applySignatureFields).not.toHaveBeenCalled();
    expect(mergeAttachmentsIntoPdf).not.toHaveBeenCalled();
  });

  it('still runs both passes for another document type', async () => {
    const { applySignatureFields } = await runExport(basic);
    expect(applySignatureFields).toHaveBeenCalled();
    expect(mergeAttachmentsIntoPdf).toHaveBeenCalled();
  });
});

describe('live preview of leftover signature fields and enclosures', () => {
  const preview = async (formData: FormData) => {
    const hook = renderHook(() => useLivePreview(slices(formData), { enclosureRows: ROWS, enclosureFiles: FILES }));
    await act(async () => { await hook.result.current.updatePreview(); });
  };

  it('skips the enclosure merge for a NAVMC 11106', async () => {
    await preview(f11106);
    expect(mergeAttachmentsIntoPdf).not.toHaveBeenCalled();
  });

  it('still merges enclosures for another document type', async () => {
    await preview(basic);
    expect(mergeAttachmentsIntoPdf).toHaveBeenCalled();
  });

  it('does not stamp signature fields onto a NAVMC 11106', async () => {
    const hook = renderHook(() => useLivePreview(slices(f11106)));
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    let out: Blob | undefined;
    await act(async () => { out = await hook.result.current.applySignatureFields(blob); });
    expect(out).toBe(blob);
  });
});

describe('export failure text', () => {
  it('shows the message from the NAVMC 11106 export, as it does for the 10132', async () => {
    generatePdfForDocType.mockRejectedValueOnce(new Error('NAVMC 11106 cannot be exported. Block B1 Name: "Ễ" is not a character the form can print.'));
    const { toast } = await runExport(f11106);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'PDF export failed',
      description: expect.stringContaining('Nothing was downloaded. NAVMC 11106 cannot be exported. Block B1 Name'),
    }));
  });

  it('keeps the generic text for other document types', async () => {
    generatePdfForDocType.mockRejectedValueOnce(new Error('internal detail'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { toast } = await runExport(basic);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'The document did not render. The browser console carries the detail.',
    }));
  });
});
