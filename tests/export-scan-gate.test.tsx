/**
 * ExportScanGate: the dialog half of the pre-export consent gate.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { ExportScanGate } from '@/components/ExportScanGate';
import { hasExportAckHandler, requestExportAck, registerExportAckHandler } from '@/lib/export-gate';

afterEach(() => {
  cleanup();
  registerExportAckHandler(null);
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
});
