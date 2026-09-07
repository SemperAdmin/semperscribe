/**
 * What the PDF pipeline does when the NAVMC 10132 fill fails.
 *
 * AUDIT P6-5. `PIPELINE_MAP.navmc10132` caught every fill failure and
 * returned a notice page instead. That was written for the live preview,
 * which renders on a timer and must not crash the pane. But the EXPORT ran
 * through the same entry, so a failed fill downloaded a one-page notice
 * while the toast said "Official Form Exported ... filled and still
 * editable", and the companion answered 200 and wrote the notice to disk
 * as the Marine's Unit Punishment Book.
 *
 * The placeholder is now the preview's alone: `mode: 'preview'` asks for
 * it, and every other caller, the default, gets the failure.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FormData } from '@/types';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { exportNavmc10132FormWithReport } from '@/lib/navmc10132-export';

vi.mock('@/lib/navmc10132-export', () => ({
  exportNavmc10132FormWithReport: vi.fn(),
}));

const FILL_ERROR = new Error('No official blank registered for NAVMC 10132.');

function ctx(extra: Partial<Parameters<typeof generatePdfForDocType>[0]> = {}) {
  return {
    formData: { documentType: 'navmc10132', accusedName: 'THOMPSON, JAMAL R' } as FormData,
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
    paragraphs: [],
    ...extra,
  };
}

async function text(blob: Blob): Promise<string> {
  return Buffer.from(await blob.arrayBuffer()).toString('latin1');
}

beforeEach(() => {
  vi.mocked(exportNavmc10132FormWithReport).mockReset();
});

describe('a fill failure on the export path', () => {
  it('throws by default, with the underlying message', async () => {
    vi.mocked(exportNavmc10132FormWithReport).mockRejectedValueOnce(FILL_ERROR);
    await expect(generatePdfForDocType(ctx())).rejects.toThrow(/No official blank registered/);
  });

  it('throws when asked for an export explicitly', async () => {
    vi.mocked(exportNavmc10132FormWithReport).mockRejectedValueOnce(FILL_ERROR);
    await expect(generatePdfForDocType(ctx({ mode: 'export' }))).rejects.toThrow(/No official blank registered/);
  });

  it('never hands the export the notice page', async () => {
    vi.mocked(exportNavmc10132FormWithReport).mockRejectedValueOnce(FILL_ERROR);
    let blob: Blob | null = null;
    try {
      blob = await generatePdfForDocType(ctx());
    } catch {
      // expected
    }
    expect(blob).toBeNull();
  });
});

describe('a fill failure on the live preview', () => {
  it('degrades to the notice page, so the pane keeps rendering', async () => {
    vi.mocked(exportNavmc10132FormWithReport).mockRejectedValueOnce(FILL_ERROR);
    const blob = await generatePdfForDocType(ctx({ mode: 'preview' }));
    expect(blob.type).toBe('application/pdf');
    const body = await text(blob);
    expect(body.startsWith('%PDF-')).toBe(true);
    // The notice is one page with no form fields; the filled UPB has both.
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(await blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });
});

describe('a fill that succeeds', () => {
  it('returns the filled blob and hands the report to the caller that asked', async () => {
    const filled = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });
    const report = { path: 'incremental' as const, refused: ['18 ACCUSED FULL NAME'], baseMissing: false };
    vi.mocked(exportNavmc10132FormWithReport).mockResolvedValueOnce({ blob: filled, report });
    const onNavmc10132Report = vi.fn();

    const blob = await generatePdfForDocType(ctx({ onNavmc10132Report }));

    expect(blob).toBe(filled);
    expect(onNavmc10132Report).toHaveBeenCalledWith(report);
  });
});
