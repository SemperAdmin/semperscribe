/**
 * SignaturePlacementModal: every open starts fresh on the last letter
 * page with no boxes, and the PDF blob is passed to react-pdf directly
 * rather than through an object URL, so no object URL is ever created.
 * Phase A.3 replaced the reset effect with a keyed remount; a later pass
 * removed the URL memo entirely once react-pdf started reading Blobs.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ file, children }: { file: unknown; children?: React.ReactNode }) => (
    <div data-testid="doc" data-file={file instanceof Blob ? 'blob-object' : String(file)}>{children}</div>
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

  it('passes the Blob itself to react-pdf and never creates an object URL', () => {
    const a = new Blob(['a']);
    const b = new Blob(['b']);
    const { rerender, unmount } = render(modal(true, a));
    expect(screen.getByTestId('doc')).toHaveAttribute('data-file', 'blob-object');
    expect(created).toEqual([]);
    rerender(modal(true, b));
    expect(screen.getByTestId('doc')).toHaveAttribute('data-file', 'blob-object');
    expect(created).toEqual([]);
    expect(revoked).toEqual([]);
    unmount();
    expect(created).toEqual([]);
    expect(revoked).toEqual([]);
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

/**
 * P8-1 / P8-2 (docs/audits 2026-09 accessibility): the placement canvas
 * was mouse-only. Boxes are now created from a button, are focusable
 * with a name, and move, resize, toggle and delete from the keyboard.
 * The page buttons have names. Mouse drawing above is unchanged.
 */
describe('SignaturePlacementModal keyboard placement (P8-1, P8-2)', () => {
  function renderOpen(totalPages = 2, placeablePages = 1) {
    const onConfirm = vi.fn();
    render(
      <SignaturePlacementModal
        open
        onClose={vi.fn()}
        onConfirm={onConfirm}
        pdfBlob={new Blob(['x'])}
        totalPages={totalPages}
        placeablePages={placeablePages}
      />,
    );
    return { onConfirm };
  }
  const addButton = () => screen.getByRole('button', { name: 'Add signature field' });
  const box = (n: number, p: number) => screen.getByRole('button', { name: `Signature field ${n}, page ${p}` });
  const px = (el: HTMLElement, prop: 'left' | 'bottom' | 'width' | 'height') => parseFloat(el.style[prop]);

  it('names the page buttons', () => {
    renderOpen();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
  });

  it('adds a default-size box from a button, focuses it, and enables Save', async () => {
    const { onConfirm } = renderOpen();
    const save = screen.getByRole('button', { name: 'Save Fields' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.click(addButton());
    const field = box(1, 1);
    expect(field).toHaveAttribute('tabindex', '0');
    await waitFor(() => expect(field).toHaveFocus());
    expect(px(field, 'width')).toBeGreaterThan(20);
    expect(px(field, 'height')).toBeGreaterThan(20);
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toHaveLength(1);
    expect(onConfirm.mock.calls[0][0][0].page).toBe(1);
  });

  it('cannot add a field on an enclosure page', () => {
    renderOpen(2, 1);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves with arrows (4 pt, Shift 16 pt) and resizes with Alt+arrows', () => {
    renderOpen();
    fireEvent.click(addButton());
    const field = box(1, 1);
    const x0 = px(field, 'left'), y0 = px(field, 'bottom'), w0 = px(field, 'width'), h0 = px(field, 'height');

    fireEvent.keyDown(field, { key: 'ArrowRight' });
    expect(px(field, 'left')).toBeCloseTo(x0 + 4);
    fireEvent.keyDown(field, { key: 'ArrowLeft', shiftKey: true });
    expect(px(field, 'left')).toBeCloseTo(x0 - 12);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(px(field, 'bottom')).toBeCloseTo(y0 + 4);
    fireEvent.keyDown(field, { key: 'ArrowDown', shiftKey: true });
    expect(px(field, 'bottom')).toBeCloseTo(y0 - 12);

    fireEvent.keyDown(field, { key: 'ArrowRight', altKey: true });
    expect(px(field, 'width')).toBeCloseTo(w0 + 4);
    fireEvent.keyDown(field, { key: 'ArrowDown', altKey: true, shiftKey: true });
    expect(px(field, 'height')).toBeCloseTo(h0 + 16);
    fireEvent.keyDown(field, { key: 'ArrowLeft', altKey: true });
    expect(px(field, 'width')).toBeCloseTo(w0);
    fireEvent.keyDown(field, { key: 'ArrowUp', altKey: true });
    expect(px(field, 'height')).toBeCloseTo(h0 + 12);
  });

  it('toggles selection with Enter and Space, and deletes with Delete', async () => {
    renderOpen();
    fireEvent.click(addButton());
    const field = box(1, 1);
    // A freshly added box is selected so its properties are editable.
    expect(field).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Signer Name')).toBeInTheDocument();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(field).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(field, { key: ' ' });
    expect(field).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(field, { key: 'Delete' });
    expect(screen.queryByRole('button', { name: 'Signature field 1, page 1' })).toBeNull();
    await waitFor(() => expect(addButton()).toHaveFocus());
    expect((screen.getByRole('button', { name: 'Save Fields' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('numbers boxes across pages and exposes the scroll region with a name', () => {
    // Opens on the last letter page (2).
    renderOpen(2, 2);
    fireEvent.click(addButton());
    fireEvent.click(addButton());
    expect(box(1, 2)).toBeInTheDocument();
    expect(box(2, 2)).toBeInTheDocument();
    // Stacked, not on top of one another.
    expect(px(box(2, 2), 'bottom')).not.toBeCloseTo(px(box(1, 2), 'bottom'));
    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    fireEvent.click(addButton());
    expect(box(3, 1)).toBeInTheDocument();
    const region = screen.getByRole('region', { name: /document page/i });
    expect(region).toHaveAttribute('tabindex', '0');
  });

  it('labels the properties inputs', () => {
    renderOpen();
    fireEvent.click(addButton());
    expect(screen.getByLabelText('Signer Name').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Reason').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Contact Info').tagName).toBe('TEXTAREA');
  });
});
