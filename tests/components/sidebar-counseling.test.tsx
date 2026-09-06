/**
 * The sidebar lists the Counseling Worksheet under its own group, not
 * under Forms (owner decision, 2026-09-06).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

afterEach(cleanup);

describe('sidebar counseling group', () => {
  it('offers the worksheet in a Counseling Worksheets group and hands over its type id', () => {
    const onDocumentTypeChange = vi.fn();
    render(<Sidebar documentType="basic" onDocumentTypeChange={onDocumentTypeChange} formData={{ documentType: 'basic' }} />);
    fireEvent.click(screen.getByRole('button', { name: /Counseling Worksheets/ }));
    const entry = screen.getByRole('button', { name: 'Counseling Worksheet' });
    expect(entry).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(entry);
    expect(onDocumentTypeChange).toHaveBeenLastCalledWith('counseling');
  });

  it('keeps the worksheet out of the Forms group', () => {
    render(<Sidebar documentType="counseling" onDocumentTypeChange={vi.fn()} formData={{ documentType: 'counseling' }} />);
    fireEvent.click(screen.getByRole('button', { name: /^Forms$/ }));
    expect(screen.queryByRole('button', { name: 'Counseling Worksheet' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Counseling Worksheets/ }));
    expect(screen.getByRole('button', { name: 'Counseling Worksheet' })).toHaveAttribute('aria-pressed', 'true');
  });
});
