/**
 * SignaturePlacementModal: every open starts fresh on the last letter
 * page with no boxes, and the preview object URL is created once per blob
 * and revoked when it changes. Phase A.3 replaced the reset effect with a
 * keyed remount and the URL effect with a memo plus revoke-only cleanup.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ file, children }: { file: string; children?: React.ReactNode }) => (
    <div data-testid="doc" data-file={file}>{children}</div>
  ),
  // Reports a full-size page on mount so the modal's coordinate mapping
  // is live, which the drawing test below depends on.
  Page: ({ onLoadSuccess }: { onLoadSuccess?: (p: { width: number; height: number }) => void }) => {
    React.useEffect(() => { onLoadSuccess?.({ width: 612, height: 792 }); }, [onLoadSuccess]);
    return <div data-testid="page" className="react-pdf__Page__canvas" />;
  },
}));

import { SignaturePlacementModal } from '@/components/SignaturePlacementModal';

let urlCounter = 0;
const created: Blob[] = [];
const revoked: string[] = [];

beforeEach(() => {
  urlCounter = 0;
  created.length = 0;
  revoked.length = 0;
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: (b: Blob) => { created.push(b); return `blob:mock-${++urlCounter}`; },
    revokeObjectURL: (u: string) => { revoked.push(u); },
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function modal(open: boolean, pdfBlob: Blob | null, placeablePages = 3, totalPages = 5) {
  return (
    <SignaturePlacementModal
      open={open}
      onClose={vi.fn()}
      onConfirm={vi.fn()}
      pdfBlob={pdfBlob}
      totalPages={totalPages}
      placeablePages={placeablePages}
    />
  );
}

const pageLabel = () => screen.getByText(/^Page \d+ of \d+/);
const prev = () => screen.getAllByRole('button').find(b => b.querySelector('.lucide-chevron-left'))!;

describe('SignaturePlacementModal', () => {
  it('opens on the last letter page, not the last document page', () => {
    render(modal(true, new Blob(['x'])));
    expect(pageLabel()).toHaveTextContent('Page 3 of 5');
  });

  it('starts fresh on every open after the user navigated away', () => {
    const blob = new Blob(['x']);
    const { rerender } = render(modal(true, blob));
    fireEvent.click(prev());
    expect(pageLabel()).toHaveTextContent('Page 2 of 5');
    rerender(modal(false, blob));
    rerender(modal(true, blob));
    expect(pageLabel()).toHaveTextContent('Page 3 of 5');
  });

  it('follows a changed last letter page while open', () => {
    const blob = new Blob(['x']);
    const { rerender } = render(modal(true, blob, 3));
    rerender(modal(true, blob, 4));
    expect(pageLabel()).toHaveTextContent('Page 4 of 5');
  });

  it('creates one object URL per blob and revokes the old one on change', () => {
    const a = new Blob(['a']);
    const b = new Blob(['b']);
    const { rerender, unmount } = render(modal(true, a));
    expect(created).toEqual([a]);
    rerender(modal(false, a));
    rerender(modal(true, a));
    expect(created).toEqual([a]);
    expect(revoked).toEqual([]);
    rerender(modal(true, b));
    expect(created).toEqual([a, b]);
    expect(revoked).toEqual(['blob:mock-1']);
    unmount();
    expect(revoked).toEqual(['blob:mock-1', 'blob:mock-2']);
  });
});

describe('SignaturePlacementModal request link (P2-1)', () => {
  const rect = { left: 0, top: 0, right: 612, bottom: 792, width: 612, height: 792, x: 0, y: 0, toJSON() { return this; } };

  function drawBox() {
    const canvas = screen.getByTestId('page');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue(rect as DOMRect);
    const area = canvas.closest('.cursor-crosshair')!;
    fireEvent.mouseDown(area, { clientX: 100, clientY: 600 });
    fireEvent.mouseMove(area, { clientX: 300, clientY: 660 });
    fireEvent.mouseUp(area);
  }

  it('collects a password through the share dialog and passes it with the fields', async () => {
    const onConfirmAndCopyLink = vi.fn();
    render(
      <SignaturePlacementModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmAndCopyLink={onConfirmAndCopyLink}
        pdfBlob={new Blob(['x'])}
        totalPages={1}
      />,
    );
    const button = screen.getByRole('button', { name: /copy protected request link/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    drawBox();
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);
    // Nothing is copied until a password is set: the button opens the
    // dialog rather than calling the handler.
    expect(onConfirmAndCopyLink).not.toHaveBeenCalled();
    expect(screen.getByText(/Create Signature Request Link/)).toBeInTheDocument();
    expect(screen.getByLabelText('Create an unprotected link').closest('.hidden')).not.toBeNull();

    fireEvent.change(screen.getByLabelText('Link password'), { target: { value: 'twelve chars ok' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'twelve chars ok' } });
    fireEvent.click(screen.getByRole('button', { name: /generate & copy/i }));

    await waitFor(() => expect(onConfirmAndCopyLink).toHaveBeenCalledTimes(1));
    const [positions, options] = onConfirmAndCopyLink.mock.calls[0];
    expect(positions).toHaveLength(1);
    expect(positions[0].page).toBe(1);
    expect(options).toMatchObject({ password: 'twelve chars ok' });
  });
});
