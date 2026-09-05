/**
 * RevisionCompareDialog: defaults to the two most recent saves on open,
 * keeps a manual pick while open, and re-defaults on the next open.
 * Phase A.3 moved the defaulting from an effect to a render-time
 * derivation keyed on the dialog phase.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { RevisionCompareDialog } from '@/components/RevisionCompareDialog';
import type { SavedLetter } from '@/types';

afterEach(cleanup);

function letter(id: string, subj: string): SavedLetter {
  return {
    documentType: 'basic', id, savedAt: id, subj, from: 'CO', to: 'CMC', sig: 'J. SMITH',
    vias: [], references: [], enclosures: [], copyTos: [], distList: [],
    paragraphs: [{ id: 1, level: 1, content: 'Body.' }],
  } as SavedLetter;
}

const newest = letter('2026-09-03T00:00:00.000Z', 'THIRD');
const middle = letter('2026-09-02T00:00:00.000Z', 'SECOND');
const oldest = letter('2026-09-01T00:00:00.000Z', 'FIRST');
const letters = [newest, middle, oldest];

function dialog(open: boolean, list: SavedLetter[] = letters) {
  return <RevisionCompareDialog open={open} onOpenChange={vi.fn()} letters={list} onRestore={vi.fn()} />;
}

describe('RevisionCompareDialog', () => {
  it('compares the two most recent saves as soon as it opens', () => {
    render(dialog(true));
    expect(screen.getByText('1 changed')).toBeInTheDocument();
    expect(screen.getByText('SECOND')).toBeInTheDocument();
    expect(screen.getByText('THIRD')).toBeInTheDocument();
  });

  it('asks for a second save when fewer than two exist, then defaults once one arrives', () => {
    const { rerender } = render(dialog(true, [newest]));
    expect(screen.getByText('Nothing to compare yet.')).toBeInTheDocument();
    rerender(dialog(true, [newest, middle]));
    expect(screen.getByText('1 changed')).toBeInTheDocument();
  });

  it('keeps the selection while open when the list identity changes', () => {
    const { rerender } = render(dialog(true));
    rerender(dialog(true, [...letters]));
    expect(screen.getByText('1 changed')).toBeInTheDocument();
  });

  it('re-defaults on the next open', () => {
    const { rerender } = render(dialog(true, [middle, oldest]));
    expect(screen.getByText('FIRST')).toBeInTheDocument();
    rerender(dialog(false, [middle, oldest]));
    rerender(dialog(true, letters));
    expect(screen.getByText('SECOND')).toBeInTheDocument();
    expect(screen.getByText('THIRD')).toBeInTheDocument();
    expect(screen.queryByText('FIRST')).toBeNull();
  });
});
