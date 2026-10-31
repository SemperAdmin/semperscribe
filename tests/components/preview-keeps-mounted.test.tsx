/**
 * A preview being regenerated stays on screen under the spinner. Before
 * this, both the desktop pane (LivePreview) and the phone sheet
 * (PreviewModal) swapped the preview out for the spinner on every
 * auto-refresh, which unmounted it: the form flashed away 1.5 s after
 * each keystroke, and an e2e screenshot of the official form failed with
 * "Element is not attached to the DOM" when a late refresh landed
 * mid-shot (SemperAdmin/semperscribe#141, run 41185498405).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/components/layout/XfaFormPreview', () => ({
  XfaFormPreview: () => <div data-testid="official-form-preview" />,
}));

vi.mock('@/components/layout/PageCountIndicator', () => ({
  PageCountIndicator: () => null,
}));

import { PreviewModal } from '@/components/layout/PreviewModal';
import { LivePreview } from '@/components/layout/LivePreview';

afterEach(cleanup);

const blob = new Blob(['%PDF-'], { type: 'application/pdf' });

type Props = { isLoading?: boolean; previewKind?: 'pdf' | 'official-xfa'; previewUrl?: string; previewBlob?: Blob | null };
const surfaces: [string, (p: Props) => React.ReactElement][] = [
  ['phone sheet (PreviewModal)', (p) => <PreviewModal open onOpenChange={() => {}} documentType="aa-form" {...p} />],
  ['desktop pane (LivePreview)', (p) => <LivePreview documentType="aa-form" {...p} />],
];

describe.each(surfaces)('%s', (_name, ui) => {
  it('keeps the same official form element attached while the next preview generates', () => {
    const { rerender } = render(ui({ previewUrl: 'blob:x', previewBlob: blob, previewKind: 'official-xfa' }));
    const form = screen.getByTestId('official-form-preview');
    rerender(ui({ previewUrl: 'blob:x', previewBlob: blob, previewKind: 'official-xfa', isLoading: true }));
    expect(screen.getByText('Generating preview...')).toBeTruthy();
    expect(screen.getByTestId('official-form-preview')).toBe(form);
    expect(form.isConnected).toBe(true);
    rerender(ui({ previewUrl: 'blob:x', previewBlob: blob, previewKind: 'official-xfa' }));
    expect(screen.queryByText('Generating preview...')).toBeNull();
    expect(screen.getByTestId('official-form-preview')).toBe(form);
  });

  it('keeps the same PDF iframe while the next preview generates', () => {
    const { rerender } = render(ui({ previewUrl: 'blob:x', previewBlob: blob, previewKind: 'pdf' }));
    const frame = screen.getByTitle('PDF Preview');
    rerender(ui({ previewUrl: 'blob:x', previewBlob: blob, previewKind: 'pdf', isLoading: true }));
    expect(screen.getByTitle('PDF Preview')).toBe(frame);
    expect(screen.getByText('Generating preview...')).toBeTruthy();
  });

  it('shows the spinner alone for the first preview, with no "not available" behind it', () => {
    render(ui({ isLoading: true }));
    expect(screen.getByText('Generating preview...')).toBeTruthy();
    expect(screen.queryByText('Preview not available', { selector: 'p' })).toBeNull();
    expect(screen.queryByTitle('PDF Preview')).toBeNull();
  });

  it('says the preview is not available when there is none and nothing is generating', () => {
    render(ui({}));
    expect(screen.getByText('Preview not available', { selector: 'p' })).toBeTruthy();
  });
});
