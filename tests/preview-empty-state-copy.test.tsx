/**
 * Host report 2026-11-11: the empty preview said "Fill the header and
 * your letter appears here" and "Then write at least one paragraph and
 * type the signature name in the closing block" for every type. Page 11,
 * NAVMC 11106 and DD 368 have no paragraphs and no closing block, and
 * none of the forms is a letter. The copy now names the type and asks
 * only for the parts the type has.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { previewEmptyStateCopy } from '@/lib/required-fields';
import { PreviewEmptyState } from '@/components/layout/LivePreview';
import { DOCUMENT_TYPES } from '@/lib/schemas';

afterEach(cleanup);

describe('empty preview copy', () => {
  it.each(['page11', 'navmc11106', 'dd368', 'navmc10922', 'navmc10132', 'tla-packet', 'counseling'])(
    '%s asks for no paragraph or signature and is not called a letter',
    (type) => {
      const copy = previewEmptyStateCopy(type);
      expect(copy.followUp).toBeNull();
      expect(copy.headline).not.toMatch(/letter/i);
      expect(copy.headline).toContain(DOCUMENT_TYPES[type].name);
    },
  );

  it('asks a basic letter for a paragraph and the signature name', () => {
    expect(previewEmptyStateCopy('basic').followUp).toBe(
      'Then write at least one paragraph and type the signature name in the closing block.',
    );
  });

  it('asks a staffing paper for a paragraph only, since it has no closing block', () => {
    expect(previewEmptyStateCopy('position-paper').followUp).toBe('Then write at least one paragraph.');
  });

  it('renders the type-specific copy', () => {
    const { container } = render(
      <PreviewEmptyState documentType="dd368" fields={[{ name: 'x', label: 'Name (1.a)', filled: false }]} />,
    );
    expect(container.textContent).not.toMatch(/your letter|closing block|paragraph/i);
    expect(container.textContent).toContain('Conditional Release (DD 368)');
  });
});
