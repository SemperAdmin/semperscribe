/**
 * Task 12 follow-up: the Volume document type is registered in
 * DOCUMENT_TYPES (src/lib/schemas.ts) and mounts its own editor from
 * DocumentLayout, but the sidebar's Directives group hardcodes its button
 * list rather than iterating DOCUMENT_TYPES, so a registered type never
 * appears there unless a button is added for it explicitly. This guards
 * against that gap regressing.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

afterEach(cleanup);

function renderSidebar(documentType: string) {
  const onDocumentTypeChange = vi.fn();
  render(
    <Sidebar
      documentType={documentType}
      onDocumentTypeChange={onDocumentTypeChange}
      formData={{ documentType }}
    />,
  );
  // Every group starts collapsed, and a collapsed Radix accordion renders
  // no content, so open the Directives group first.
  fireEvent.click(screen.getByRole('button', { name: /Directives/ }));
  return { onDocumentTypeChange };
}

describe('sidebar Directives group', () => {
  it('shows a Volume button', () => {
    renderSidebar('basic');
    expect(screen.getByRole('button', { name: /^Volume$/ })).toBeTruthy();
  });

  it('selects the volume document type on click', () => {
    const { onDocumentTypeChange } = renderSidebar('basic');
    fireEvent.click(screen.getByRole('button', { name: /^Volume$/ }));
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith('volume');
  });

  it('marks Volume selected when documentType is volume', () => {
    renderSidebar('volume');
    expect(screen.getByRole('button', { name: /^Volume$/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
