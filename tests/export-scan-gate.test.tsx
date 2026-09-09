/**
 * ExportScanGate: the dialog half of the pre-export consent gate.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (opts: unknown) => toastMock(opts),
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ExportScanGate } from '@/components/ExportScanGate';
import { hasExportAckHandler, requestExportAck, registerExportAckHandler } from '@/lib/export-gate';

afterEach(() => {
  cleanup();
  registerExportAckHandler(null);
  toastMock.mockReset();
});

describe('ExportScanGate', () => {
  it('registers the handler on mount and releases it on unmount', () => {
    expect(hasExportAckHandler()).toBe(false);
    const { unmount } = render(<ExportScanGate />);
    expect(hasExportAckHandler()).toBe(true);
    unmount();
    expect(hasExportAckHandler()).toBe(false);
  });

  it('shows the findings and resolves true on Export anyway', async () => {
    render(<ExportScanGate />);
    const pending = requestExportAck(['Possible SSN detected']);
    await waitFor(() => expect(screen.getByText('Sensitive data detected')).toBeInTheDocument());
    expect(screen.getByText('Possible SSN detected')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Export anyway'));
    expect(await pending).toBe(true);
  });

  it('resolves false on Cancel and edit', async () => {
    render(<ExportScanGate />);
    const pending = requestExportAck(['Possible EDIPI detected']);
    await waitFor(() => expect(screen.getByText('Possible EDIPI detected')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cancel and edit'));
    expect(await pending).toBe(false);
  });

  it('refuses a pending prompt when unmounted mid-question', async () => {
    const { unmount } = render(<ExportScanGate />);
    const pending = requestExportAck(['Possible SSN detected']);
    await waitFor(() => expect(screen.getByText('Possible SSN detected')).toBeInTheDocument());
    unmount();
    expect(await pending).toBe(false);
  });

  // P6-15 (remediation 2026-09): a second prompt while one was open
  // overwrote resolveRef, leaving the first export awaiting forever.
  it('settles a superseded prompt with false before taking the next one', async () => {
    render(<ExportScanGate />);
    const first = requestExportAck(['Possible SSN detected']);
    await waitFor(() => expect(screen.getByText('Possible SSN detected')).toBeInTheDocument());
    const second = requestExportAck(['Possible EDIPI detected']);
    expect(await first).toBe(false);
    await waitFor(() => expect(screen.getByText('Possible EDIPI detected')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Export anyway'));
    expect(await second).toBe(true);
  });

  it('toasts when an unmount refuses a pending prompt', async () => {
    const { unmount } = render(<ExportScanGate />);
    const pending = requestExportAck(['Possible SSN detected']);
    await waitFor(() => expect(screen.getByText('Possible SSN detected')).toBeInTheDocument());
    unmount();
    expect(await pending).toBe(false);
    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(toastMock.mock.calls[0][0]).toMatchObject({ variant: 'destructive' });
    expect(String(toastMock.mock.calls[0][0].title)).toMatch(/export/i);
  });
});
