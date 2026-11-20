/**
 * NAVMC 10922 routing after the owner's 2026-11-20 decision: no official-XFA
 * route. Every PDF export, START included, is the fillable rebuild from the
 * pipeline, with the signature-field and enclosure passes still applied, and
 * the live preview shows that same PDF.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FormData } from '@/types';
import { exportsOfficialXfa, OFFICIAL_XFA_EXPORT_TYPES } from '@/lib/official-form-route';

const generatePdfForDocType = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
const mergeAttachmentsIntoPdf = vi.fn(async () => new Uint8Array([37, 80, 68, 70]));
const computeMergeItems = vi.fn(() => [{ stub: true }]);
const exportOfficialForm = vi.fn(async () => new Blob(['XFA'], { type: 'application/pdf' }));

vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: (...a: unknown[]) => generatePdfForDocType(...(a as [])),
}));
vi.mock('@/lib/enclosure-attachments', () => ({
  mergeAttachmentsIntoPdf: (...a: unknown[]) => mergeAttachmentsIntoPdf(...(a as [])),
  computeMergeItems: (...a: unknown[]) => computeMergeItems(...(a as [])),
}));
vi.mock('@/lib/xfa-form-fill', () => ({
  exportOfficialForm: (...a: unknown[]) => exportOfficialForm(...(a as [])),
  navmc10274FieldValues: () => ({}),
}));
vi.mock('@/lib/export-gate', () => ({ clearedForExport: async () => true }));
// The 10922's own validators are covered elsewhere; this file is about routing.
vi.mock('@/lib/letter-validators', async (orig) => ({
  ...(await orig<typeof import('@/lib/letter-validators')>()),
  getExportBlockers: () => [],
}));

import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useLivePreview } from '@/hooks/useLivePreview';

const ROWS = [{ id: 'r1', fileId: 'f1' }] as never;
const FILES = new Map([['f1', { name: 'cert.pdf' }]]) as never;
const slices = (formData: FormData) => ({
  formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
});
const f10922 = (reason: string) => ({ documentType: 'navmc10922', reason, nameOfMarine: 'MARINE, TEST' }) as unknown as FormData;

beforeEach(() => {
  generatePdfForDocType.mockClear();
  mergeAttachmentsIntoPdf.mockClear();
  exportOfficialForm.mockClear();
  window.URL.createObjectURL = vi.fn(() => 'blob:test') as typeof window.URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('official XFA route table', () => {
  it('no longer carries the NAVMC 10922', () => {
    expect(exportsOfficialXfa('navmc10922')).toBe(false);
    expect(OFFICIAL_XFA_EXPORT_TYPES).toEqual(['aa-form', 'page11']);
    expect(exportsOfficialXfa('aa-form')).toBe(true);
  });
});

describe.each(['gain', 'start'])('NAVMC 10922 export (%s)', (reason) => {
  it('exports the fillable rebuild with the signature and enclosure passes, never the XFA blank', async () => {
    const applySignatureFields = vi.fn(async (b: Blob) => b);
    const toast = vi.fn();
    const { result } = renderHook(() => useDocumentExport({
      data: slices(f10922(reason)) as never, applySignatureFields, enclosureRows: ROWS, enclosureFiles: FILES, toast,
    }));
    await act(async () => { await result.current.generateDocument('pdf'); });

    expect(exportOfficialForm).not.toHaveBeenCalled();
    expect(generatePdfForDocType).toHaveBeenCalled();
    expect(applySignatureFields).toHaveBeenCalled();
    expect(mergeAttachmentsIntoPdf).toHaveBeenCalled();
    const last = toast.mock.calls.at(-1)?.[0] as { title: string; description: string };
    expect(last.title).toBe('Fillable Form Exported');
    expect(last.description).toContain('any PDF viewer');
    expect(last.description).toContain('CUI (when filled in)');
    expect(last.description).not.toContain('placeholder page');
  });
});

describe('NAVMC 10922 live preview', () => {
  it('shows the same fillable rebuild as a plain PDF, not the XFA viewer', async () => {
    const hook = renderHook(() => useLivePreview(slices(f10922('gain'))));
    await act(async () => { await hook.result.current.updatePreview(); });
    expect(exportOfficialForm).not.toHaveBeenCalled();
    expect(generatePdfForDocType).toHaveBeenCalled();
    expect(hook.result.current.previewKind).toBe('pdf');
    expect(hook.result.current.previewFieldValues).toBeUndefined();
  });
});
