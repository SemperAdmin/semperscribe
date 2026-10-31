/**
 * Batch Generate (Mail Merge) end to end on a NAVMC 118(11) Page 11,
 * through the real useBatchGenerate hook: the export gate prompts on
 * the EDIPIs in the roster, each row renders a real Page 11 PDF, and
 * the downloaded ZIP holds one file per Marine named for that Marine.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import JSZip from 'jszip';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';
import { detectMergeFields, parseCsv } from '@/lib/merge-utils';
import { registerExportAckHandler } from '@/lib/export-gate';
import type { FormData } from '@/types';

const TEMPLATE = {
  documentType: 'page11',
  name: '',
  edipi: '',
  date: '',
  remarksLeft: '{{DATE}}: 6105 COUNSELING. {{RANK}} {{NAME}} was counseled this date.',
  remarksRight: '',
} as FormData;

const ROSTER = [
  'NAME,EDIPI,DATE,RANK',
  '"DOE, JOHN M.",1234567890,01 Mar 26,LCpl',
  '"SMITH, JANE A.",0987654321,02 Mar 26,Cpl',
  '',
].join('\n');

let downloaded: Blob | null;
let downloadName: string;
let gateFindings: string[][];

beforeEach(() => {
  downloaded = null;
  downloadName = '';
  gateFindings = [];
  registerExportAckHandler(async (findings) => {
    gateFindings.push(findings);
    return true;
  });
  // Capture the ZIP the hook hands to the browser download link.
  vi.spyOn(window.URL, 'createObjectURL').mockImplementation((obj) => {
    downloaded = obj as Blob;
    return 'blob:batch';
  });
  vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadName = this.download;
  });
});

afterEach(() => {
  registerExportAckHandler(null);
  vi.restoreAllMocks();
});

async function runPage11Batch(csv: string) {
  const { result } = renderHook(() => useBatchGenerate());
  const fields = detectMergeFields(TEMPLATE, [], ['name', 'edipi', 'date']);
  const { rows } = parseCsv(csv);
  await act(async () => {
    await result.current.runBatch(TEMPLATE, [], [], [], [], [], [], fields, rows);
  });
  return result;
}

describe('Page 11 batch generate', () => {
  it('prompts on the roster EDIPIs, then zips one Page 11 PDF per Marine', async () => {
    const result = await runPage11Batch(ROSTER);

    expect(result.current.status).toBe('done');
    expect(result.current.progress.errors).toEqual([]);
    expect(result.current.progress.currentLabel).toBe('Done! 2 of 2 documents generated.');

    // The pre-export scan saw the identifiers that arrive only in the rows.
    expect(gateFindings).toHaveLength(1);
    expect(gateFindings[0].join(' ')).toMatch(/EDIPI|DoD ID/i);

    expect(downloadName).toMatch(/^batch_export_\d{4}-\d{2}-\d{2}\.zip$/);
    expect(downloaded).not.toBeNull();
    const zip = await JSZip.loadAsync(await downloaded!.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(/_DOE_JOHN_M\.pdf$/);
    expect(names[1]).toMatch(/_SMITH_JANE_A\.pdf$/);
    for (const name of names) {
      const bytes = await zip.files[name].async('uint8array');
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    }
  }, 60_000);

  it('skips a row whose EDIPI Excel mangled, reports it, and zips the rest', async () => {
    const csv = ROSTER.trimEnd() + '\n"ROE, RICHARD",9.87654E+08,03 Mar 26,Pvt\n';
    const result = await runPage11Batch(csv);

    expect(result.current.status).toBe('done');
    expect(result.current.progress.errors).toEqual([
      { row: 3, label: 'ROE, RICHARD', error: expect.stringContaining('EDIPI "9.87654E+08" is not a 10-digit DoD ID') },
    ]);
    expect(result.current.progress.currentLabel).toBe('Done! 2 of 3 documents generated.');
    const zip = await JSZip.loadAsync(await downloaded!.arrayBuffer());
    const names = Object.keys(zip.files);
    expect(names).toHaveLength(2);
    expect(names.some((n) => n.includes('ROE'))).toBe(false);
  }, 60_000);

  it('downloads nothing when every row is refused', async () => {
    const result = await runPage11Batch('NAME,EDIPI,DATE,RANK\n"DOE, JOHN M.",123,01 Mar 26,LCpl\n');
    expect(result.current.status).toBe('error');
    expect(result.current.progress.currentLabel).toBe('No documents generated: every row had errors.');
    expect(downloaded).toBeNull();
  });

  it('stops the whole batch when the drafter declines the EDIPI prompt', async () => {
    registerExportAckHandler(async () => false);
    const result = await runPage11Batch(ROSTER);
    expect(result.current.status).toBe('idle');
    expect(downloaded).toBeNull();
  });
});
