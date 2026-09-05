/**
 * E.1 - the placement control (SECNAV M-5216.5 9-1 and 9-2.1.a).
 *
 * The control has to do three things: default to the placement every
 * saved document already had, hide the page-numbering inputs a same-page
 * endorsement has no use for, and offer the 9-2.1.a omission with the
 * rule stated rather than assumed.
 */
import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EndorsementDetailsSection } from '@/components/document/EndorsementDetailsSection';
import type { FormData } from '@/types';

/** The preview line, which shares "FIRST ENDORSEMENT" with the level picker. */
function previewText(): string {
  return screen.getByText('Preview:').parentElement?.textContent ?? '';
}

function Harness({ initial }: { initial: Partial<FormData> }) {
  const [formData, setFormData] = useState<FormData>({
    documentType: 'endorsement',
    endorsementLevel: 'FIRST',
    basicLetterReference: 'CO ltr 1000 Ser 11/273 of 22 Apr 26',
    startingReferenceLevel: 'c',
    startingEnclosureNumber: '2',
    startingPageNumber: 2,
    previousPackagePageCount: 1,
    ...initial,
  });
  return <EndorsementDetailsSection formData={formData} setFormData={setFormData} />;
}

describe('endorsement placement control', () => {
  it('reads an unset placement as New page and shows the page-numbering inputs', () => {
    render(<Harness initial={{}} />);
    expect(screen.getByLabelText('New page').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Last Page # of Previous Document')).toBeTruthy();
    expect(screen.getByText(/Endorsement starts on page/)).toBeTruthy();
    // No omission checkbox until same-page is chosen.
    expect(screen.queryByLabelText(/Omit SSIC/)).toBeNull();
  });

  it('hides the page-numbering inputs and keeps identifier sequencing on same-page', () => {
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} />);
    expect(screen.queryByText('Last Page # of Previous Document')).toBeNull();
    expect(screen.queryByText(/Endorsement starts on page/)).toBeNull();
    expect(screen.getByText(/adds no page, so it carries no page number/)).toBeTruthy();
    // 9-2.3 and 9-2.4 apply to both placements.
    expect(screen.getByText('Start References At Letter')).toBeTruthy();
    expect(screen.getByText('Start Enclosures At Number')).toBeTruthy();
  });

  it('switching to same-page turns the 9-2.1.a omission on and shortens the preview', () => {
    render(<Harness initial={{}} />);
    expect(previewText()).toContain('ENDORSEMENT on CO ltr 1000');

    fireEvent.click(screen.getByLabelText(/Same page/));

    const omit = screen.getByLabelText(/Omit SSIC/);
    expect(omit.getAttribute('aria-checked')).toBe('true');
    expect(previewText()).toContain('FIRST ENDORSEMENT');
    expect(previewText()).not.toContain('ENDORSEMENT on');
    expect(screen.getByText(/9-2.1.a/)).toBeTruthy();
  });

  it('clearing the omission restores the basic letter identification in the preview', () => {
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} />);
    expect(previewText()).not.toContain('ENDORSEMENT on');
    fireEvent.click(screen.getByLabelText(/Omit SSIC/));
    expect(previewText()).toContain('ENDORSEMENT on CO ltr 1000');
  });

  it('states the 9-1 fit rule beside the choice', () => {
    render(<Harness initial={{}} />);
    expect(screen.getByText(/Paragraph 9-1/)).toBeTruthy();
    expect(screen.getByLabelText(/Same page/).textContent ?? '').toBe('');
    expect(screen.getByText(/added to the signature page of the document it endorses/)).toBeTruthy();
  });
});
