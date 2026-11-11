/**
 * The sidebar lists its document types by hand, so a type registered in
 * DOCUMENT_TYPES appears there only if a button is added for it. Volume
 * went missing that way once (sidebar-volume-option.test.tsx), and
 * Change Transmittal could be opened only from the command palette until
 * the host report of 2026-11-10. This holds every registered type to a
 * sidebar button.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { resolvePickerType } from '@/lib/document-type-options';

afterEach(cleanup);

describe('sidebar covers the registry', () => {
  it('has a button for every registered document type', () => {
    const onDocumentTypeChange = vi.fn();
    const { container } = render(
      <Sidebar documentType="basic" onDocumentTypeChange={onDocumentTypeChange} formData={{ documentType: 'basic' }} />,
    );
    // The accordion is type="multiple", so every group stays open once clicked.
    container.querySelectorAll<HTMLElement>('[data-radix-collection-item], button[aria-expanded="false"]').forEach((t) => {
      if (t.getAttribute('aria-expanded') === 'false') fireEvent.click(t);
    });
    // Every type button, not the group triggers. AMHS sits outside the
    // groups as its own button.
    screen.getAllByRole('button').filter((b) => !b.hasAttribute('aria-expanded')).forEach((b) => fireEvent.click(b));

    const reached = new Set(
      onDocumentTypeChange.mock.calls.map(([key]) => resolvePickerType(String(key)).documentType),
    );
    const missing = Object.keys(DOCUMENT_TYPES).filter((k) => !reached.has(k));
    expect(missing).toEqual([]);
  });

  it('selects the change transmittal from the Directives group', () => {
    const onDocumentTypeChange = vi.fn();
    render(<Sidebar documentType="basic" onDocumentTypeChange={onDocumentTypeChange} formData={{ documentType: 'basic' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Directives/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Change Transmittal$/ }));
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith('change-transmittal');
  });
});
