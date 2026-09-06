/**
 * E.2: the sidebar shows "Endorsement" and "Same-Page Endorsement" as
 * two options. Selection is read from the document type and the
 * placement together, and each option hands the type-change handler
 * its own picker id.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SAME_PAGE_ENDORSEMENT_OPTION } from '@/lib/document-type-options';

afterEach(cleanup);

function renderSidebar(documentType: string, endorsementPlacement?: 'new-page' | 'same-page') {
  const onDocumentTypeChange = vi.fn();
  render(
    <Sidebar
      documentType={documentType}
      onDocumentTypeChange={onDocumentTypeChange}
      formData={{ documentType, endorsementPlacement }}
    />,
  );
  // Every group starts collapsed, and a collapsed Radix accordion
  // renders no content, so open the Standard Letter group first.
  fireEvent.click(screen.getByRole('button', { name: /Standard Letter/ }));
  return { onDocumentTypeChange };
}

const endorsement = () => screen.getByRole('button', { name: 'Endorsement' });
const samePage = () => screen.getByRole('button', { name: 'Same-Page Endorsement' });

describe('sidebar endorsement options', () => {
  it('marks the same-page option selected for a same-page endorsement', () => {
    renderSidebar('endorsement', 'same-page');
    expect(samePage()).toHaveAttribute('aria-pressed', 'true');
    expect(endorsement()).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the endorsement selected for a new-page or unset placement', () => {
    renderSidebar('endorsement');
    expect(endorsement()).toHaveAttribute('aria-pressed', 'true');
    expect(samePage()).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks neither for a basic letter', () => {
    renderSidebar('basic');
    expect(endorsement()).toHaveAttribute('aria-pressed', 'false');
    expect(samePage()).toHaveAttribute('aria-pressed', 'false');
  });

  it('hands each option its own picker id', () => {
    const { onDocumentTypeChange } = renderSidebar('basic');
    fireEvent.click(samePage());
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith(SAME_PAGE_ENDORSEMENT_OPTION);
    fireEvent.click(endorsement());
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith('endorsement');
  });
});
