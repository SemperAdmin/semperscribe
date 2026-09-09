/**
 * P6-3 (remediation 2026-09) - the recovery prompt never discards by
 * accident. Escape and an outside click used to run the Discard path
 * (clear the working copy, delete its files). Dismissing now keeps the
 * copy for later, and Discard is the explicit button, confirmed once
 * inside the dialog.
 *
 * P6-9: the same file hosts the unsaved-work confirmation used before a
 * draft, an .nldp or a template replaces a dirty document.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { RecoveryDialog, UnsavedWorkDialog } from '@/components/RecoveryDialog';
import type { WorkingCopy } from '@/lib/autosave';
import type { FormData } from '@/types';

afterEach(cleanup);

const copy: WorkingCopy = {
  sessionId: 'other-tab',
  formData: { documentType: 'basic', subj: 'RECOVERABLE LETTER' } as unknown as FormData,
  paragraphs: [{ id: 1, level: 1, content: 'body', acronymError: '' }],
  vias: [], references: [], enclosures: [], copyTos: [], distList: [],
  savedAt: '2026-09-07T10:00:00.000Z',
  updatedAt: Date.parse('2026-09-07T10:00:00.000Z'),
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof RecoveryDialog>> = {}) {
  const props = {
    copy,
    onRestore: vi.fn(),
    onDiscard: vi.fn(),
    onLater: vi.fn(),
    ...overrides,
  };
  render(<RecoveryDialog {...props} />);
  return props;
}

describe('RecoveryDialog', () => {
  it('Escape keeps the copy: onLater fires, onDiscard does not', () => {
    const props = renderDialog();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(props.onLater).toHaveBeenCalledTimes(1);
  });

  it('Keep for later is an explicit no-delete path', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /keep for later/i }));
    expect(props.onLater).toHaveBeenCalledTimes(1);
    expect(props.onDiscard).not.toHaveBeenCalled();
  });

  it('Discard asks once inside the dialog before it fires', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(screen.getByText(/discard this copy/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /yes, discard/i }));
    expect(props.onDiscard).toHaveBeenCalledTimes(1);
    expect(props.onLater).not.toHaveBeenCalled();
  });

  it('Cancel steps back from the discard confirmation without discarding', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(props.onLater).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^discard$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
  });

  it('Restore fires straight away', () => {
    const props = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /restore/i }));
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });

  it('says how many other copies wait behind this one', () => {
    renderDialog({ remaining: 2 });
    expect(screen.getByText(/2 more/i)).toBeInTheDocument();
  });

  it('shows the subject of the copy on offer', () => {
    renderDialog();
    expect(screen.getByText('RECOVERABLE LETTER')).toBeInTheDocument();
  });
});

describe('UnsavedWorkDialog', () => {
  it('confirms before unsaved work is replaced, and dismisses without replacing', () => {
    const onConfirm = vi.fn();
    const onDismiss = vi.fn();
    render(
      <UnsavedWorkDialog
        pending={{ action: 'Load draft', description: 'Loading "X" replaces the document you are editing.' }}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );
    expect(screen.getByText(/replaces the document/i)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /load draft/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when nothing is pending', () => {
    render(<UnsavedWorkDialog pending={null} onConfirm={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
