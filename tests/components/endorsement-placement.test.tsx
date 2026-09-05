/**
 * E.1 and E.3 - the endorsement details (SECNAV M-5216.5 9-1 and
 * 9-2.1.a).
 *
 * Placement is chosen in the document-type picker, so the section has
 * no placement control of its own. It has to hide the page-numbering
 * inputs a same-page endorsement has no use for, offer the 9-2.1.a
 * omission with the rule stated, and take the letter being endorsed.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EndorsementDetailsSection } from '@/components/document/EndorsementDetailsSection';
import type { FormData, SavedLetter } from '@/types';
import type { SamePageStatus } from '@/lib/same-page-host';

/** The preview line, which shares "FIRST ENDORSEMENT" with the level picker. */
function previewText(): string {
  return screen.getByText('Preview:').parentElement?.textContent ?? '';
}

interface HarnessProps {
  initial: Partial<FormData>;
  savedLetters?: SavedLetter[];
  samePageStatus?: SamePageStatus | null;
  onAttachHostFile?: (file: File) => void;
  onSelectHostDraft?: (id: string) => void;
  onClearHost?: () => void;
}

function Harness({ initial, ...rest }: HarnessProps) {
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
  return <EndorsementDetailsSection formData={formData} setFormData={setFormData} {...rest} />;
}

describe('endorsement placement control', () => {
  it('reads an unset placement as new page and shows the page-numbering inputs', () => {
    render(<Harness initial={{}} />);
    expect(screen.getByText('Last Page # of Previous Document')).toBeTruthy();
    expect(screen.getByText(/Endorsement starts on page/)).toBeTruthy();
    // No omission checkbox and no letter to attach on a new-page endorsement.
    expect(screen.queryByLabelText(/Omit SSIC/)).toBeNull();
    expect(screen.queryByText('Letter being endorsed')).toBeNull();
    // E.2: placement is the picker's, so the section offers no radio for it.
    expect(screen.queryByLabelText('New page')).toBeNull();
    expect(screen.queryByLabelText(/Same page/)).toBeNull();
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

  it('a same-page endorsement takes the 9-2.1.a omission by default and shortens the preview', () => {
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} />);
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

  it('states the 9-1 rule and Figure 9-1 beside the letter being endorsed', () => {
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} />);
    expect(screen.getByText(/Paragraph 9-1 and Figure 9-1/)).toBeTruthy();
    expect(screen.getByText(/keeps its own letterhead and seal; the endorsement adds none/)).toBeTruthy();
  });
});

describe('letter being endorsed (E.3)', () => {
  const letters: SavedLetter[] = [
    { id: 'L1', documentType: 'basic', name: 'Training request', savedAt: '', vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [] },
    { id: 'L2', documentType: 'endorsement', endorsementPlacement: 'same-page', name: 'Another block', savedAt: '', vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [] },
  ];

  it('offers a PDF input and the library letters when nothing is attached', () => {
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} savedLetters={letters} />);
    expect(screen.getByLabelText('Attach the signed letter as a PDF')).toBeTruthy();
    expect(screen.getByLabelText('Letter from library')).toBeTruthy();
    expect(screen.getByText(/block alone/)).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();
  });

  it('hands an attached PDF to the owner', () => {
    const onAttachHostFile = vi.fn();
    render(<Harness initial={{ endorsementPlacement: 'same-page' }} onAttachHostFile={onAttachHostFile} />);
    const file = new File(['%PDF-1.4'], 'basic-letter.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Attach the signed letter as a PDF'), { target: { files: [file] } });
    expect(onAttachHostFile).toHaveBeenCalledWith(file);
  });

  it('names the attached letter, reports where the endorsement landed, and removes it', () => {
    const onClearHost = vi.fn();
    render(
      <Harness
        initial={{ endorsementPlacement: 'same-page', samePageHost: { kind: 'file', fileId: 'f1', fileName: 'basic-letter.pdf' } }}
        samePageStatus={{ status: 'fits', page: 1, pages: 1 }}
        onClearHost={onClearHost}
      />,
    );
    expect(screen.getByTestId('same-page-host-label').textContent).toBe('basic-letter.pdf');
    expect(screen.getByTestId('same-page-host-status').textContent).toContain('Fits on the signature page');
    expect(screen.queryByLabelText('Attach the signed letter as a PDF')).toBeNull();
    fireEvent.click(screen.getByText('Remove'));
    expect(onClearHost).toHaveBeenCalled();
  });

  it('reports the new-page fallback when the block does not fit', () => {
    render(
      <Harness
        initial={{ endorsementPlacement: 'same-page', samePageHost: { kind: 'draft', letterId: 'L1', title: 'Training request' } }}
        samePageStatus={{ status: 'new-page', reason: 'Too long.', startsOnPage: 2, pages: 3 }}
      />,
    );
    expect(screen.getByTestId('same-page-host-label').textContent).toBe('Training request');
    expect(screen.getByTestId('same-page-host-status').textContent).toContain('new-page endorsement starting on page 2 of 3');
  });
});
