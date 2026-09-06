/**
 * Pre-export consent gate: scan thresholds and handler resolution.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  exportFindings,
  requestExportAck,
  clearedForExport,
  registerExportAckHandler,
  hasExportAckHandler,
} from '@/lib/export-gate';

afterEach(() => {
  registerExportAckHandler(null);
  vi.restoreAllMocks();
});

describe('exportFindings', () => {
  it('returns nothing for a routine letter', () => {
    expect(
      exportFindings({
        subj: 'REQUEST FOR ADDITIONAL RANGE TIME',
        paragraphs: [{ content: 'Request approval for range time on 12 Sep 26.' }],
      }),
    ).toEqual([]);
  });

  it('reports an SSN pattern', () => {
    const findings = exportFindings({ paragraphs: [{ content: 'SSN 123-45-6789 on file.' }] });
    expect(findings).toContain('Possible SSN detected');
  });

  it('reports a ten-digit EDIPI pattern', () => {
    const findings = exportFindings({ paragraphs: [{ content: 'EDIPI 1234567890.' }] });
    expect(findings).toContain('Possible EDIPI detected');
  });

  it('ignores a single PHI keyword', () => {
    expect(exportFindings({ paragraphs: [{ content: 'Assigned as Medical Officer.' }] })).toEqual([]);
  });

  it('reports two or more distinct PHI keywords together', () => {
    const findings = exportFindings({
      paragraphs: [{ content: 'The patient received treatment at the clinic.' }],
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatch(/^Possible PHI keywords: /);
    expect(findings[0]).toContain('patient');
    expect(findings[0]).toContain('treatment');
  });
});

describe('requestExportAck', () => {
  it('clears an empty finding list without consulting anyone', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await requestExportAck([])).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('routes findings to the registered handler and returns its answer', async () => {
    const seen: string[][] = [];
    registerExportAckHandler(async findings => {
      seen.push(findings);
      return true;
    });
    expect(hasExportAckHandler()).toBe(true);
    expect(await requestExportAck(['Possible SSN detected'])).toBe(true);
    expect(seen).toEqual([['Possible SSN detected']]);
  });

  it('honours a handler refusal', async () => {
    registerExportAckHandler(async () => false);
    expect(await requestExportAck(['Possible SSN detected'])).toBe(false);
  });

  it('falls back to window.confirm when no dialog is mounted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(hasExportAckHandler()).toBe(false);
    expect(await requestExportAck(['Possible EDIPI detected'])).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('Possible EDIPI detected');
  });

  it('unregistering restores the fallback', async () => {
    registerExportAckHandler(async () => true);
    registerExportAckHandler(null);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(await requestExportAck(['Possible SSN detected'])).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('clearedForExport', () => {
  it('scans and prompts in one call', async () => {
    const seen: string[][] = [];
    registerExportAckHandler(async findings => {
      seen.push(findings);
      return false;
    });
    expect(await clearedForExport({ body: 'clean text' })).toBe(true);
    expect(seen).toEqual([]);
    expect(await clearedForExport({ body: 'SSN 123-45-6789' })).toBe(false);
    expect(seen).toEqual([['Possible SSN detected']]);
  });
});
