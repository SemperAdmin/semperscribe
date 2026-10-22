/**
 * The preview sheet below 1280 px takes the official-form route the
 * desktop pane takes. Before this, the sheet received only the blob URL
 * and put it in an iframe, and a browser's own PDF viewer shows a
 * dynamic XFA form (the NAVMC 10274 export) as its "Please wait..."
 * placeholder page: every phone and tablet user saw that instead of the
 * form (owner's report, 2026-10-21).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/components/layout/XfaFormPreview', () => ({
  XfaFormPreview: ({ blob }: { blob: Blob }) => <div data-testid="official-form-preview" data-size={blob.size} />,
}));

import { PreviewModal } from '@/components/layout/PreviewModal';

afterEach(cleanup);

const blob = new Blob(['%PDF-xfa'], { type: 'application/pdf' });

describe('PreviewModal official-form route', () => {
  it('lays the official XFA form out through pdf.js, never an iframe', () => {
    render(
      <PreviewModal open onOpenChange={() => {}} documentType="aa-form" previewUrl="blob:x" previewBlob={blob} previewKind="official-xfa" />,
    );
    expect(screen.getByTestId('official-form-preview').getAttribute('data-size')).toBe(String(blob.size));
    expect(screen.queryByTitle('PDF Preview')).toBeNull();
  });

  it('keeps the iframe for an ordinary PDF preview', () => {
    render(
      <PreviewModal open onOpenChange={() => {}} documentType="basic" previewUrl="blob:x" previewBlob={blob} previewKind="pdf" />,
    );
    expect(screen.getByTitle('PDF Preview')).toBeTruthy();
    expect(screen.queryByTestId('official-form-preview')).toBeNull();
  });

  it('falls back to the iframe when no blob accompanies the official kind', () => {
    render(
      <PreviewModal open onOpenChange={() => {}} documentType="aa-form" previewUrl="blob:x" previewKind="official-xfa" />,
    );
    expect(screen.getByTitle('PDF Preview')).toBeTruthy();
  });
});
