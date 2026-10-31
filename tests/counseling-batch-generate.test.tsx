/**
 * Batch Generate end to end on a Counseling Worksheet, through the real
 * useBatchGenerate hook and the dialog: one worksheet per Marine on the
 * roster, two Marines with one last name kept apart in the ZIP, a row
 * with an unreadable grade refused, and the warning when the worksheet
 * already holds one Marine's assessment.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, render, screen, cleanup, fireEvent } from '@testing-library/react';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useBatchGenerate } from '@/hooks/useBatchGenerate';
import { BatchGenerateModal } from '@/components/BatchGenerateModal';
import { defaultMergeFormKeys, detectMergeFields, parseCsv } from '@/lib/merge-utils';
import { registerExportAckHandler } from '@/lib/export-gate';
import type { FormData } from '@/types';

const SESSION = {
  documentType: 'counseling',
  date: '2 Nov 26',
  counselingOccasion: 'initial',
  counselingMarineComponent: 'active',
  counselingSeniorLastName: 'LEADER',
  counselingSeniorFirstName: 'SAMPLE',
  counselingSeniorGrade: 'E-6',
} as FormData;

const ROSTER = [
  'LAST_NAME,FIRST_NAME,MI,GRADE,EDIPI',
  'DOE,JOHN,M,LCpl,1234567890',
  'DOE,RICHARD,,Cpl,1112223334',
  'ROE,PAT,,Lance,2223334445',
  '',
].join('\n');

let downloaded: Blob | null;

beforeEach(() => {
  downloaded = null;
  registerExportAckHandler(async () => true);
  vi.spyOn(window.URL, 'createObjectURL').mockImplementation((obj) => {
    downloaded = obj as Blob;
    return 'blob:batch';
  });
  vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  registerExportAckHandler(null);
  vi.restoreAllMocks();
  cleanup();
});

describe('Counseling batch generate', () => {
  it('zips one worksheet per Marine, keeps the two DOEs apart, and refuses the unreadable grade', async () => {
    const { result } = renderHook(() => useBatchGenerate());
    const fields = detectMergeFields(SESSION, [], defaultMergeFormKeys('counseling'));
    const { rows } = parseCsv(ROSTER);
    await act(async () => {
      await result.current.runBatch(SESSION, [], [], [], [], [], [], fields, rows);
    });

    expect(result.current.status).toBe('done');
    expect(result.current.progress.errors).toEqual([
      { row: 3, label: 'ROE, PAT', error: expect.stringContaining('GRADE "Lance" is not a Marine grade') },
    ]);
    const zip = await JSZip.loadAsync(await downloaded!.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual([
      'Counseling - DOE - 2 Nov 26_DOE_JOHN.pdf',
      'Counseling - DOE - 2 Nov 26_DOE_RICHARD.pdf',
    ]);
  }, 60_000);

  it('never lets a second Marine with the same name overwrite the first in the ZIP', async () => {
    const { result } = renderHook(() => useBatchGenerate());
    const fields = detectMergeFields(SESSION, [], defaultMergeFormKeys('counseling'));
    const { rows } = parseCsv('LAST_NAME,FIRST_NAME,GRADE,EDIPI\nDOE,JOHN,LCpl,1234567890\nDOE,JOHN,Cpl,5556667778\n');
    await act(async () => {
      await result.current.runBatch(SESSION, [], [], [], [], [], [], fields, rows);
    });
    const zip = await JSZip.loadAsync(await downloaded!.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual([
      'Counseling - DOE - 2 Nov 26_DOE_JOHN.pdf',
      'Counseling - DOE - 2 Nov 26_DOE_JOHN_2.pdf',
    ]);
  }, 60_000);
});

describe('Batch Generate dialog on a Counseling Worksheet', () => {
  const renderModal = (formData: FormData) => render(
    <BatchGenerateModal open onOpenChange={() => {}} formData={formData} paragraphs={[]}
      vias={[]} references={[]} enclosures={[]} copyTos={[]} distList={[]} />,
  );
  const checked = (label: string) =>
    screen.getByText(label, { selector: 'span' }).closest('label')!.querySelector('[role="checkbox"]')!.getAttribute('aria-checked');

  it('opens with the Marine\'s name, grade and EDIPI selected and no letter columns', () => {
    renderModal(SESSION);
    for (const l of ['LAST_NAME', 'FIRST_NAME', 'MI', 'GRADE', 'EDIPI']) expect(checked(l)).toBe('true');
    for (const l of ['DOR', 'PMOS', 'DATE']) expect(checked(l)).toBe('false');
    expect(screen.queryByText('TO', { selector: 'span' })).toBeNull();
    expect(screen.queryByText('Copied to every worksheet:')).toBeNull();
  });

  it('warns that a library sample\'s assessment and signatures would be copied to every Marine', () => {
    const sample = JSON.parse(readFileSync(join(__dirname, '..', 'public', 'templates', 'global', 'counseling-initial.nldp'), 'utf-8')).data.formData;
    renderModal(sample);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Copied to every worksheet:');
    expect(alert.textContent).toContain('Strengths');
    expect(alert.textContent).toContain("Marine's comments");
    expect(alert.textContent).toContain('Marine signed date');
    // The warning informs; it does not block the batch.
    expect((screen.getByRole('button', { name: /Continue/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
  });
});
