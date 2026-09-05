/**
 * D.2 (UX_POLICY_PLAN_2026-09) - the header save state tells the truth.
 *
 * `isDirty` and `lastSavedAt` were declared on the shell and consumed in
 * its header, and no caller ever passed them, so the indicator read
 * "Draft" before typing, after typing a full letter, and after Save
 * Draft alike. The three states are pinned here, and page.tsx supplies
 * the props.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ModernAppShell } from '@/components/layout/ModernAppShell';

vi.mock('@/components/layout/LivePreview', () => ({
  LivePreview: () => <aside data-testid="preview-aside" />,
}));
vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <nav data-testid="sidebar" />,
}));
vi.mock('@/components/layout/HeaderActions', () => ({
  HeaderActions: () => <div data-testid="header-actions" />,
}));

afterEach(cleanup);

function renderShell(state: { isDirty?: boolean; lastSavedAt?: Date | null }) {
  return render(
    <ModernAppShell
      documentType="basic"
      onDocumentTypeChange={vi.fn()}
      onExportDocx={vi.fn()}
      onGeneratePdf={vi.fn()}
      onSave={vi.fn()}
      onLoadDraft={vi.fn()}
      onImport={vi.fn()}
      onClearForm={vi.fn()}
      savedLetters={[]}
      onLoadTemplateUrl={vi.fn()}
      onExportNldp={vi.fn()}
      onUpdatePreview={vi.fn()}
      isDirty={state.isDirty}
      lastSavedAt={state.lastSavedAt}
    >
      <div>editor</div>
    </ModernAppShell>,
  );
}

describe('header save indicator', () => {
  it('reads Draft before any change', () => {
    renderShell({ isDirty: false, lastSavedAt: null });
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByText(/Unsaved changes/)).toBeNull();
    expect(screen.queryByText(/^Saved /)).toBeNull();
  });

  it('reads Unsaved changes while the document is dirty', () => {
    renderShell({ isDirty: true, lastSavedAt: new Date('2026-09-05T14:31:00') });
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.queryByText('Draft')).toBeNull();
  });

  it('reads the time of the last explicit save', () => {
    const savedAt = new Date('2026-09-05T14:31:00');
    renderShell({ isDirty: false, lastSavedAt: savedAt });
    const expected = savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    expect(screen.getByText(`Saved ${expected}`)).toBeInTheDocument();
  });
});
