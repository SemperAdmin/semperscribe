/**
 * P6-16 (remediation 2026-09): the ceremony's File System Access save
 * did not abort a failed writable, leaving a zero-byte PDF under the
 * chosen name, and fell back to an anchor download without saying so.
 * Now the writable is aborted and the fallback is reported in a toast.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (opts: unknown) => toastMock(opts),
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));

import { SignatureCeremonyPanel } from '@/components/signature/SignatureCeremonyPanel';

afterEach(() => {
  cleanup();
  toastMock.mockReset();
  delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
});

describe('SignatureCeremonyPanel save (P6-16)', () => {
  it('aborts the writable when the write fails and reports the download fallback', async () => {
    const abort = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const handle = {
      getFile: vi.fn(),
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockRejectedValue(new Error('disk full')),
        close,
        abort,
      }),
    };
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn().mockResolvedValue(handle);
    const u = URL as unknown as Record<string, unknown>;
    u.createObjectURL = vi.fn(() => 'blob:x');
    u.revokeObjectURL = vi.fn();

    render(
      <SignatureCeremonyPanel
        routing={{ requestedSigner: 'I. M. MARINE' }}
        fileName="letter.pdf"
        generateSignReadyPdf={vi.fn().mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))}
        onDismiss={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Save PDF'));
    await waitFor(() => expect(screen.getByText('I signed it')).toBeTruthy());

    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    // Fell back to the anchor download, and said so.
    expect(u.createObjectURL).toHaveBeenCalled();
    expect(toastMock).toHaveBeenCalledOnce();
    expect(String(toastMock.mock.calls[0][0].description)).toMatch(/download/i);
    // No picker handle is held: the one-click re-read is not offered.
    expect(screen.queryByTestId('ceremony-check')).toBeNull();
  });
});
