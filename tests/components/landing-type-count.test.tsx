/**
 * The landing page read "26 document types" while the registry held 32,
 * because the number was typed in by hand. The count now comes from the
 * registry, and this test holds the landing copy to it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { LandingPage, DOCUMENT_TYPE_COUNT } from '@/components/layout/LandingPage';
import { DOCUMENT_TYPES } from '@/lib/schemas';

afterEach(cleanup);

describe('landing page document type count', () => {
  it('counts every registry type', () => {
    expect(DOCUMENT_TYPE_COUNT).toBe(Object.keys(DOCUMENT_TYPES).length);
  });

  it('shows the registry count in the hero chip and the workflow step', () => {
    const { container } = render(<LandingPage onSelectType={vi.fn()} />);
    expect(screen.getByText(`${DOCUMENT_TYPE_COUNT} document types`)).toBeInTheDocument();
    const counts = [...(container.textContent ?? '').matchAll(/(\d+) document types/g)].map((m) => Number(m[1]));
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(counts)).toEqual(new Set([DOCUMENT_TYPE_COUNT]));
  });
});
