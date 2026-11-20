/** The desktop sidebar collapses to an icon rail (docs/PARAGRAPH_LEVELS_AND_SIDEBAR_PLAN.md, Feature B). */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Sidebar } from '@/components/layout/Sidebar';

afterEach(cleanup);

function Harness({ initial = false }: { initial?: boolean }) {
  const [collapsed, setCollapsed] = useState(initial);
  return (
    <Sidebar
      documentType="basic"
      onDocumentTypeChange={vi.fn()}
      formData={{ documentType: 'basic' }}
      collapsed={collapsed}
      onToggleCollapsed={() => setCollapsed((c) => !c)}
    />
  );
}

describe('sidebar collapse', () => {
  it('flips aria-expanded and moves focus to the expand button', () => {
    render(<Harness />);
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(collapse).toHaveAttribute('aria-controls');
    fireEvent.click(collapse);
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(expand).toHaveFocus();
    fireEvent.click(expand);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus();
  });

  it('shows the three labeled rail buttons when collapsed', () => {
    render(<Harness initial />);
    for (const name of ['Expand sidebar', 'Document type', 'Find in document']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('Find in document expands and focuses the search input', () => {
    render(<Harness initial />);
    fireEvent.click(screen.getByRole('button', { name: 'Find in document' }));
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Find in document' })).toHaveFocus();
  });

  it('Document type expands and focuses the first accordion trigger', () => {
    render(<Harness initial />);
    fireEvent.click(screen.getByRole('button', { name: 'Document type' }));
    expect(screen.getByRole('button', { name: /Standard Letter/ })).toHaveFocus();
  });

  it('renders no collapse button without onToggleCollapsed', () => {
    render(<Sidebar documentType="basic" onDocumentTypeChange={vi.fn()} formData={{ documentType: 'basic' }} />);
    expect(screen.queryByRole('button', { name: /sidebar/i })).toBeNull();
  });
});
