/**
 * D.4: `block` severity is documented as "export must refuse", and
 * getExportBlockers was called from exactly one place, the signature
 * ceremony. The ordinary PDF and DOCX download paths ran the
 * sensitive-data scan and nothing else, so a window-envelope violation
 * exported without complaint. These tests hold the gate on the
 * download path and on the batch generator, both ways: it refuses a
 * blocking document and it lets a clean one through.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { FormData, ParagraphData } from '@/types';

const generatePdfForDocType = vi.fn(async () => new Blob(['%PDF'], { type: 'application/pdf' }));
const generateDocxBlob = vi.fn(async () => new Blob(['docx']));
const downloadDocument = vi.fn(async () => {});

vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: (...args: unknown[]) => generatePdfForDocType(...(args as [])),
}));
vi.mock('@/services/export/index', () => ({
  downloadDocument: (...args: unknown[]) => downloadDocument(...(args as [])),
}));
vi.mock('@/lib/docx-generator', () => ({
  generateDocxBlob: (...args: unknown[]) => generateDocxBlob(...(args as [])),
}));

import { useDocumentExport } from '@/hooks/useDocumentExport';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';

const PARAGRAPHS: ParagraphData[] = [{ id: 1, level: 1, content: 'The unit requests approval.' }];

/**
 * A window-envelope letter with a Via addressee. Figure 7-3 allows no
 * Via line, so validateWindowEnvelope reports it at `block`.
 */
const BLOCKING: FormData = {
  documentType: 'basic',
  ssic: '1500',
  originatorCode: 'S-3',
  date: '5 Sep 26',
  from: 'Commanding Officer, Unit',
  to: 'Commanding Officer\nUnit One\nFPO AP 96000',
  subj: 'REQUEST FOR RANGE TIME',
  sig: 'J. A. SMITH',
  isWindowEnvelope: true,
} as FormData;

const CLEAN: FormData = { ...BLOCKING, isWindowEnvelope: false } as FormData;

const VIAS = ['Commander, Group'];

function slices(formData: FormData) {
  return {
    formData,
    vias: VIAS,
    references: [] as string[],
    enclosures: [] as string[],
    copyTos: [] as string[],
    paragraphs: PARAGRAPHS,
    distList: [] as string[],
  };
}

function mountExport(formData: FormData) {
  const onBlocked = vi.fn();
  const toast = vi.fn();
  const hook = renderHook(() =>
    useDocumentExport({
      data: slices(formData) as never,
      applySignatureFields: async (blob: Blob) => blob,
      toast,
      onBlocked,
    }),
  );
  return { ...hook, onBlocked, toast };
}

let clickedLinks = 0;

beforeEach(() => {
  clickedLinks = 0;
  generatePdfForDocType.mockClear();
  generateDocxBlob.mockClear();
  downloadDocument.mockClear();
  // jsdom has no object URLs and no real downloads. Count the clicks
  // instead: one click is one file delivered.
  window.URL.createObjectURL = vi.fn(() => 'blob:test') as typeof window.URL.createObjectURL;
  window.URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clickedLinks += 1;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDocumentExport export gate', () => {
  it.each(['pdf', 'docx'] as const)('refuses a %s download on a block-severity issue', async (format) => {
    const { result, onBlocked, toast } = mountExport(BLOCKING);
    await act(async () => {
      await result.current.generateDocument(format);
    });
    expect(onBlocked).toHaveBeenCalledTimes(1);
    const blockers = onBlocked.mock.calls[0][0];
    expect(blockers.map((b: { id: string }) => b.id)).toContain('window-via');
    expect(blockers.every((b: { severity: string }) => b.severity === 'block')).toBe(true);
    expect(clickedLinks).toBe(0);
    expect(generatePdfForDocType).not.toHaveBeenCalled();
    expect(generateDocxBlob).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Export blocked' }),
    );
  });

  it.each(['pdf', 'docx'] as const)('delivers a %s download when the document is clear', async (format) => {
    const { result, onBlocked } = mountExport(CLEAN);
    await act(async () => {
      await result.current.generateDocument(format);
    });
    expect(onBlocked).not.toHaveBeenCalled();
    expect(clickedLinks).toBe(1);
  });
});

describe('useBatchGenerate export gate', () => {
  it('refuses the batch on a block-severity issue and names the rule', async () => {
    const { result } = renderHook(() => useBatchGenerate());
    await act(async () => {
      await result.current.runBatch(
        BLOCKING, PARAGRAPHS, VIAS, [], [], [], [], [], [{ TO: 'Unit One' }],
      );
    });
    expect(result.current.status).toBe('error');
    expect(result.current.progress.currentLabel).toContain('Export blocked');
    expect(result.current.progress.currentLabel).toContain('Fig 7-3');
    expect(clickedLinks).toBe(0);
    expect(generatePdfForDocType).not.toHaveBeenCalled();
  });

  it('runs the batch when the template is clear', async () => {
    const { result } = renderHook(() => useBatchGenerate());
    await act(async () => {
      await result.current.runBatch(
        CLEAN, PARAGRAPHS, VIAS, [], [], [], [], [], [{ TO: 'Unit One' }],
      );
    });
    expect(result.current.status).toBe('done');
    expect(generatePdfForDocType).toHaveBeenCalledTimes(1);
    expect(clickedLinks).toBe(1);
  });
});
