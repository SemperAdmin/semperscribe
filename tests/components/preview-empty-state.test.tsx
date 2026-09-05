/**
 * D.8 (UX audit finding 9) - the preview names what it is waiting for.
 *
 * A fresh document used to render a blank grey rectangle under a red
 * compliance strip. The empty state now lists the required fields the
 * document type declares, read from the same definition in
 * src/lib/schemas.ts the schema validators run against, so the preview
 * and the compliance banner cannot disagree.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { LivePreview } from '@/components/layout/LivePreview';
import { requiredFieldStatus, isDocumentUnstarted } from '@/lib/required-fields';
import type { ParagraphData } from '@/types';

afterEach(cleanup);

const EMPTY_PARAGRAPHS: ParagraphData[] = [{ id: 1, level: 1, content: '', acronymError: '' }];

describe('required-field status', () => {
  it('reads the six required fields of a basic letter out of the schema definition', () => {
    const fields = requiredFieldStatus('basic', { documentType: 'basic' });
    expect(fields.map(f => f.label)).toEqual([
      'SSIC',
      'Originator Code',
      'Date',
      'From',
      'To',
      'Subject',
    ]);
    expect(fields.every(f => !f.filled)).toBe(true);
  });

  it('marks a field filled once it carries text', () => {
    const fields = requiredFieldStatus('basic', { documentType: 'basic', ssic: '1500', date: '5 Sep 26' });
    expect(fields.find(f => f.name === 'ssic')?.filled).toBe(true);
    expect(fields.find(f => f.name === 'date')?.filled).toBe(true);
    expect(fields.find(f => f.name === 'from')?.filled).toBe(false);
  });

  it('counts a document with only the pre-filled date as unstarted', () => {
    const fields = requiredFieldStatus('basic', { documentType: 'basic', date: '5 Sep 26' });
    expect(isDocumentUnstarted(fields, EMPTY_PARAGRAPHS)).toBe(true);
  });

  it('counts a document with any typed field or paragraph as started', () => {
    const withField = requiredFieldStatus('basic', { documentType: 'basic', ssic: '1500' });
    expect(isDocumentUnstarted(withField, EMPTY_PARAGRAPHS)).toBe(false);

    const blank = requiredFieldStatus('basic', { documentType: 'basic' });
    expect(isDocumentUnstarted(blank, [{ id: 1, level: 1, content: 'Request approval.', acronymError: '' }])).toBe(false);
  });

  it('returns nothing for a document type with no definition', () => {
    expect(requiredFieldStatus('not-a-type', {})).toEqual([]);
    expect(isDocumentUnstarted([], EMPTY_PARAGRAPHS)).toBe(false);
  });
});

describe('LivePreview empty state', () => {
  it('lists the required fields instead of rendering a blank preview', () => {
    const fields = requiredFieldStatus('basic', { documentType: 'basic', date: '5 Sep 26' });
    render(<LivePreview previewUrl="blob:preview" emptyStateFields={fields} />);

    expect(screen.getByText('Fill the header and your letter appears here.')).toBeInTheDocument();
    for (const label of ['SSIC', 'Originator Code', 'Date', 'From', 'To', 'Subject']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/write at least one paragraph and type the signature name/)).toBeInTheDocument();

    // The date arrives pre-filled, so it reads as done rather than owed.
    expect(screen.getByText('already filled')).toBeInTheDocument();

    // The blank render is not shown while the empty state is.
    expect(screen.queryByTitle('PDF Preview')).toBeNull();
  });

  it('renders the preview once the document has been started', () => {
    render(<LivePreview previewUrl="blob:preview" emptyStateFields={null} />);
    expect(screen.getByTitle('PDF Preview')).toBeInTheDocument();
    expect(screen.queryByText('Fill the header and your letter appears here.')).toBeNull();
  });
});
