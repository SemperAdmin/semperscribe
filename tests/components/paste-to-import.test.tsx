/**
 * R11 (D.7): paste-to-import. The extraction pipeline was already split
 * from file reading, so pasted letter text joins it at the detect-and-
 * parse step and lands on the same review-fields modal a .docx or .pdf
 * lands on. The fixture is the clean basic letter the parser tests use.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { DocumentImportModal } from '@/components/import/DocumentImportModal';
import { useDocumentImport } from '@/hooks/useDocumentImport';
import type { ImportPayload } from '@/services/import/extractionTypes';

afterEach(cleanup);

/** The same letter tests/services/import/correspondenceParser.test.ts parses. */
const PASTED_LETTER = `
UNITED STATES MARINE CORPS
3D MARINE DIVISION
UNIT 38410
5216
G-1
16 Feb 26

From: Commanding Officer, 3d Marine Division
To:   Commanding General, III Marine Expeditionary Force
Via:  (1) Chief of Staff
      (2) Assistant Chief of Staff, G-1

Subj: STANDARD SUBJECT LINE FOR TESTING

Ref:  (a) MCO 5215.1K
      (b) SECNAV M-5216.5

Encl: (1) Sample Enclosure One
      (2) Sample Enclosure Two

1. This is the first paragraph of the letter body.

2. This is the second paragraph.

I. M. MARINE

Copy to:
CMC (ARDB)
`;

function importHook() {
  const applyImport = vi.fn<(payload: ImportPayload) => void>();
  const toast = vi.fn();
  const hook = renderHook(() => useDocumentImport({ applyImport, toast }));
  return { hook, applyImport, toast };
}

describe('useDocumentImport.importFromText', () => {
  it('parses pasted letter text into the review fields', () => {
    const { hook } = importHook();

    act(() => hook.result.current.startPasteImport());
    expect(hook.result.current.isOpen).toBe(true);
    expect(hook.result.current.result).toBeNull();

    act(() => hook.result.current.importFromText(PASTED_LETTER));

    const parsed = hook.result.current.result!;
    expect(parsed).not.toBeNull();
    expect(hook.result.current.fileName).toBe('pasted text');
    expect(parsed.fields.from?.value).toBe('Commanding Officer, 3d Marine Division');
    expect(parsed.fields.to?.value).toBe('Commanding General, III Marine Expeditionary Force');
    expect(parsed.fields.subj?.value).toBe('STANDARD SUBJECT LINE FOR TESTING');
    expect(parsed.fields.ssic?.value).toBe('5216');
    expect(parsed.vias).toEqual(['Chief of Staff', 'Assistant Chief of Staff, G-1']);
    expect(parsed.references).toEqual(['MCO 5215.1K', 'SECNAV M-5216.5']);
    expect(parsed.enclosures).toEqual(['Sample Enclosure One', 'Sample Enclosure Two']);
    expect(parsed.paragraphs.map(p => p.content)).toEqual([
      'This is the first paragraph of the letter body.',
      'This is the second paragraph.',
    ]);
  });

  it('records the source as text, so no extractor runs', () => {
    const { hook } = importHook();
    act(() => hook.result.current.importFromText(PASTED_LETTER));
    expect(hook.result.current.detection?.documentType).toBe('basic');
  });

  it('refuses blank text instead of opening an empty review', () => {
    const { hook, toast } = importHook();
    act(() => hook.result.current.importFromText('   \n\n  '));
    expect(hook.result.current.result).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('applies the reviewed payload through the same import path a file uses', () => {
    const { hook, applyImport } = importHook();
    act(() => hook.result.current.importFromText(PASTED_LETTER));
    act(() => hook.result.current.confirmImport(hook.result.current.result!));

    expect(applyImport).toHaveBeenCalledTimes(1);
    const payload = applyImport.mock.calls[0][0];
    expect(payload.formData.documentType).toBe('basic');
    expect(payload.formData.subj).toBe('STANDARD SUBJECT LINE FOR TESTING');
    expect(hook.result.current.isOpen).toBe(false);
  });
});

describe('DocumentImportModal paste step', () => {
  it('hands the pasted text to the pipeline and disables the read until there is some', () => {
    const onImportText = vi.fn();
    render(
      <DocumentImportModal
        open
        fileName=""
        result={null}
        detection={null}
        onChangeDocumentType={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        onImportText={onImportText}
      />,
    );

    const read = screen.getByRole('button', { name: 'Read Pasted Text' });
    expect(read).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Letter text'), { target: { value: PASTED_LETTER } });
    expect(read).toBeEnabled();
    fireEvent.click(read);

    expect(onImportText).toHaveBeenCalledWith(PASTED_LETTER);
  });

  it('renders nothing on the paste step when no paste handler is wired', () => {
    const { container } = render(
      <DocumentImportModal
        open
        fileName=""
        result={null}
        detection={null}
        onChangeDocumentType={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
