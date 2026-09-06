/**
 * DocumentImportModal: the editable copy of the parse result. Edits stick
 * while the result is unchanged; a new result (re-parse under another
 * document type) replaces them. Phase A.3 derives the copy during render.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DocumentImportModal } from '@/components/import/DocumentImportModal';
import type { ExtractionResult } from '@/services/import/extractionTypes';

afterEach(cleanup);

function result(subj: string, documentType = 'basic'): ExtractionResult {
  return {
    documentType,
    fields: { subj: { value: subj, confidence: 'high', sourceLines: [0] } },
    vias: [], references: [], enclosures: [], copyTos: [], distList: [],
    paragraphs: [], unmatchedText: [], warnings: [],
  };
}

function modal(r: ExtractionResult | null) {
  return (
    <DocumentImportModal
      open
      fileName="letter.docx"
      result={r}
      detection={null}
      onChangeDocumentType={vi.fn()}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

const subject = () => screen.getByLabelText('Subject') as HTMLInputElement;

describe('DocumentImportModal', () => {
  it('seeds the review grid from the parse result', () => {
    render(modal(result('ORIGINAL SUBJECT')));
    expect(subject().value).toBe('ORIGINAL SUBJECT');
  });

  it('keeps an edit while the same result is rendered again', () => {
    const r = result('ORIGINAL SUBJECT');
    const { rerender } = render(modal(r));
    fireEvent.change(subject(), { target: { value: 'EDITED SUBJECT' } });
    rerender(modal(r));
    expect(subject().value).toBe('EDITED SUBJECT');
  });

  it('replaces the edits when a new result arrives', () => {
    const { rerender } = render(modal(result('ORIGINAL SUBJECT')));
    fireEvent.change(subject(), { target: { value: 'EDITED SUBJECT' } });
    rerender(modal(result('REPARSED SUBJECT', 'mfr')));
    expect(subject().value).toBe('REPARSED SUBJECT');
  });
});
