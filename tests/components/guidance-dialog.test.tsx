/**
 * GuidanceDialog: preselects the active document type when opened, keeps
 * the user's pick while open, and re-preselects on the next open. Phase
 * A.2 moved the preselection from an effect to a render-time derivation.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { GuidanceDialog } from '@/components/GuidanceDialog';
import { GUIDANCE } from '@/lib/guidance-data';

afterEach(cleanup);

const heading = () => screen.getByRole('heading', { level: 3 });
const mfr = GUIDANCE.find(g => g.type === 'mfr')!;
const endorsement = GUIDANCE.find(g => g.type === 'endorsement')!;

describe('GuidanceDialog', () => {
  it('shows the first entry when opened with no document type', () => {
    render(<GuidanceDialog open onOpenChange={vi.fn()} />);
    expect(heading()).toHaveTextContent(GUIDANCE[0].label);
  });

  it('preselects the active document type on open', () => {
    render(<GuidanceDialog open onOpenChange={vi.fn()} documentType="mfr" />);
    expect(heading()).toHaveTextContent(mfr.label);
  });

  it('keeps a manual pick while open and re-preselects on the next open', () => {
    const { rerender } = render(<GuidanceDialog open onOpenChange={vi.fn()} documentType="mfr" />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(endorsement.label) }));
    expect(heading()).toHaveTextContent(endorsement.label);
    rerender(<GuidanceDialog open={false} onOpenChange={vi.fn()} documentType="mfr" />);
    rerender(<GuidanceDialog open onOpenChange={vi.fn()} documentType="mfr" />);
    expect(heading()).toHaveTextContent(mfr.label);
  });

  it('ignores an unknown document type', () => {
    render(<GuidanceDialog open onOpenChange={vi.fn()} documentType="no-such-type" />);
    expect(heading()).toHaveTextContent(GUIDANCE[0].label);
  });
});

/**
 * Host report 2026-11-10: opening the guide on a type with no entry
 * (Volume, SECNAV Instruction and Notice, I-Type, Change Transmittal)
 * showed whichever entry was viewed last. guidance-data.ts promised a
 * generic note for those types and the dialog never built one.
 */
describe('GuidanceDialog on a type with no entry', () => {
  it('names the active type instead of keeping the last entry viewed', () => {
    const { rerender } = render(<GuidanceDialog open onOpenChange={vi.fn()} documentType="mfr" />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(endorsement.label) }));
    rerender(<GuidanceDialog open={false} onOpenChange={vi.fn()} documentType="dd368" />);
    rerender(<GuidanceDialog open onOpenChange={vi.fn()} documentType="dd368" />);
    expect(heading()).toHaveTextContent('Conditional Release (DD 368)');
    expect(screen.getByText(/no guide entry/i)).toBeInTheDocument();
  });

  it('switches away from the note when the user picks an entry', () => {
    render(<GuidanceDialog open onOpenChange={vi.fn()} documentType="dd368" />);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(mfr.label) }));
    expect(heading()).toHaveTextContent(mfr.label);
  });

  it.each(['change-transmittal', 'secnav-instruction', 'secnav-notice', 'volume', 'i-type'])(
    'has a written entry for %s',
    (type) => {
      expect(GUIDANCE.find((g) => g.type === type)).toBeDefined();
    },
  );
});
