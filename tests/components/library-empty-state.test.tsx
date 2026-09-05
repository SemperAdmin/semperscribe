/**
 * D.7: the document library empty state. The audit's admin corporal met
 * an honest message with no action on it, "No saved documents yet. Use
 * File, Save Draft." The message stays and now carries the Save Draft
 * path it names, held back while the document on screen is empty.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DocumentLibraryDialog } from '@/components/DocumentLibraryDialog';
import type { SavedLetter } from '@/types';

afterEach(cleanup);

const SAVED: SavedLetter = {
  documentType: 'basic', id: '2026-09-05T00:00:00.000Z', savedAt: '9/5/2026',
  subj: 'REQUEST FOR RANGE TIME', from: 'CO', to: 'CG', sig: 'I. M. MARINE',
  vias: [], references: [], enclosures: [], copyTos: [], distList: [],
  paragraphs: [{ id: 1, level: 1, content: 'Body.' }],
} as SavedLetter;

function library(overrides: Partial<React.ComponentProps<typeof DocumentLibraryDialog>> = {}) {
  return (
    <DocumentLibraryDialog
      open
      onOpenChange={vi.fn()}
      letters={[]}
      onLoad={vi.fn()}
      onRename={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      {...overrides}
    />
  );
}

const saveAction = () => screen.queryByRole('button', { name: 'Save this document now' });

describe('DocumentLibraryDialog empty state', () => {
  it('offers to save the document on screen when it holds content', () => {
    const onSaveCurrent = vi.fn();
    render(library({ onSaveCurrent, canSaveCurrent: true }));

    expect(screen.getByText(/No saved documents yet/)).toBeInTheDocument();
    fireEvent.click(saveAction()!);
    expect(onSaveCurrent).toHaveBeenCalledTimes(1);
  });

  it('holds the action back on an empty document', () => {
    render(library({ onSaveCurrent: vi.fn(), canSaveCurrent: false }));

    expect(screen.getByText(/No saved documents yet/)).toBeInTheDocument();
    expect(saveAction()).not.toBeInTheDocument();
  });

  it('does not offer to save over a search which matched nothing', () => {
    render(library({ letters: [SAVED], onSaveCurrent: vi.fn(), canSaveCurrent: true }));
    fireEvent.change(screen.getByPlaceholderText('Search by name, subject, or type'), {
      target: { value: 'zzz' },
    });

    expect(screen.getByText('No documents match your search.')).toBeInTheDocument();
    expect(saveAction()).not.toBeInTheDocument();
  });
});
