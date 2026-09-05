/**
 * SignaturePlacementModal: every open starts fresh on the last letter
 * page with no boxes, and the preview object URL is created once per blob
 * and revoked when it changes. Phase A.3 replaced the reset effect with a
 * keyed remount and the URL effect with a memo plus revoke-only cleanup.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ file, children }: { file: string; children?: React.ReactNode }) => (
    <div data-testid="doc" data-file={file}>{children}</div>
  ),
  Page: () => <div data-testid="page" />,
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
