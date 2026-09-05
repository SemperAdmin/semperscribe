/**
 * PageCountIndicator: the position-paper page badge. A new preview URL
 * resets the count to unknown during render (Phase A.3), then the
 * invisible Document reports the new count.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';

let pagesFor: Record<string, number> = {};
vi.mock('react-pdf', () => ({
  pdfjs: { GlobalWorkerOptions: {} },
  Document: ({ file, onLoadSuccess }: { file: string; onLoadSuccess: (i: { numPages: number }) => void }) => (
    <button data-testid="load" onClick={() => onLoadSuccess({ numPages: pagesFor[file] })}>{file}</button>
  ),
}));

import { PageCountIndicator } from '@/components/layout/PageCountIndicator';

afterEach(() => {
  cleanup();
  pagesFor = {};
});

async function load() {
  const btn = await screen.findByTestId('load');
  await act(async () => { btn.click(); });
}

describe('PageCountIndicator', () => {
  it('renders nothing for non-position-paper types', () => {
    render(<PageCountIndicator url="blob:a" documentType="basic" />);
    expect(screen.queryByTestId('load')).toBeNull();
  });

  it('shows the page status once the document reports its count', async () => {
    pagesFor = { 'blob:a': 3 };
    render(<PageCountIndicator url="blob:a" documentType="position-paper" />);
    expect(screen.queryByText(/Pages/)).toBeNull();
    await load();
    expect(screen.getByText('3 Pages (Over Limit)')).toBeInTheDocument();
  });

  it('drops the stale count when the URL changes and picks up the new one', async () => {
    pagesFor = { 'blob:a': 2, 'blob:b': 1 };
    const { rerender } = render(<PageCountIndicator url="blob:a" documentType="position-paper" />);
    await load();
    expect(screen.getByText('2 Pages (Allowed)')).toBeInTheDocument();
    rerender(<PageCountIndicator url="blob:b" documentType="position-paper" />);
    expect(screen.queryByText(/Page/)).toBeNull();
    await load();
    expect(screen.getByText('1 Page (Preferred)')).toBeInTheDocument();
  });
});
