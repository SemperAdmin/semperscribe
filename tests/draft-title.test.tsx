/**
 * Handoff N-04 (3 Nov 26): every counseling draft saved to the library
 * was titled "Untitled", so picking the right Marine meant opening each.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { DocumentLibraryDialog } from '@/components/DocumentLibraryDialog';
import { counselingDraftTitle } from '@/lib/counseling';
import { defaultDraftTitle, savedLetterTitle } from '@/lib/draft-title';
import type { FormData, SavedLetter } from '@/types';

afterEach(cleanup);

const counseling = (extra: Record<string, unknown> = {}) => ({
  documentType: 'counseling',
  date: '3 Nov 26',
  counselingOccasion: 'initial',
  counselingMarineGrade: 'E-3',
  counselingMarineLastName: 'CARPENTER',
  ...extra,
}) as unknown as FormData;

const saved = (fd: FormData, id: string, name?: string): SavedLetter =>
  ({ ...fd, id, savedAt: '11/3/2026', ...(name !== undefined ? { name } : {}) }) as SavedLetter;

describe('counseling draft titles', () => {
  it('reads grade, last name, occasion and session date', () => {
    expect(counselingDraftTitle(counseling())).toBe('LCpl CARPENTER ICS 3 Nov 26');
    expect(counselingDraftTitle(counseling({ counselingOccasion: 'follow-on', counselingMarineGrade: 'E-8-1STSGT' })))
      .toBe('1stSgt CARPENTER Follow-on 3 Nov 26');
    expect(counselingDraftTitle(counseling({ counselingOccasion: 'pcs' }))).toBe('LCpl CARPENTER Counseling 3 Nov 26');
  });

  it('is empty without a last name, so the save falls back to Untitled', () => {
    expect(counselingDraftTitle(counseling({ counselingMarineLastName: '' }))).toBe('');
    expect(defaultDraftTitle(counseling({ counselingMarineLastName: '' }))).toBe('');
  });

  it('keeps the subject for every other document type', () => {
    expect(defaultDraftTitle({ documentType: 'basic', subj: 'RANGE TIME' } as FormData)).toBe('RANGE TIME');
  });

  it('a title the user set wins, and an old "Untitled" save shows its contents', () => {
    expect(savedLetterTitle(saved(counseling(), 'a', 'Carpenter first ICS'))).toBe('Carpenter first ICS');
    expect(savedLetterTitle(saved(counseling(), 'b', 'Untitled'))).toBe('LCpl CARPENTER ICS 3 Nov 26');
    expect(savedLetterTitle(saved(counseling({ counselingMarineLastName: '' }), 'c', 'Untitled'))).toBe('Untitled');
  });

  it('the library lists two counseling drafts by Marine and date', () => {
    const letters = [
      saved(counseling(), '2026-11-03T10:00:00.000Z', 'Untitled'),
      saved(counseling({ counselingMarineLastName: 'DOE', counselingMarineGrade: 'E-4', date: '2 Nov 26' }), '2026-11-03T11:00:00.000Z', 'Untitled'),
    ];
    render(
      <DocumentLibraryDialog open onOpenChange={vi.fn()} letters={letters}
        onLoad={vi.fn()} onRename={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText('LCpl CARPENTER ICS 3 Nov 26')).toBeInTheDocument();
    expect(screen.getByText('Cpl DOE ICS 2 Nov 26')).toBeInTheDocument();
    expect(screen.queryByText('Untitled')).not.toBeInTheDocument();
  });
});
