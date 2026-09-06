/**
 * D.2 (UX_POLICY_PLAN_2026-09) - compliance feedback at every viewport
 * width.
 *
 * The banner used to live inside the preview aside, which carries
 * `hidden xl:flex`, so below 1280 px a drafter got no validation
 * feedback at all and the mobile preview sheet was never handed the
 * issues. jsdom has no viewport width to assert on, so the shape of the
 * fix is what these pin: the shell renders the banner itself, with the
 * preview aside stubbed out entirely, and the sheet renders the issues
 * it is given.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import { PreviewModal } from '@/components/layout/PreviewModal';
import type { PreviewIssue } from '@/components/layout/ComplianceBanner';

// The aside is stubbed: anything the test finds came from the shell.
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

const ISSUES: PreviewIssue[] = [
  { id: 'ssic-required', severity: 'block', rule: 'SSIC required', detail: 'Every naval letter carries an SSIC.', citation: 'SECNAV M-5216.5 2-3' },
  { id: 'subj-required', severity: 'fail', rule: 'Subject required', detail: 'The subject line is missing.', citation: 'SECNAV M-5216.5 7-2.9' },
];

function renderShell(issues?: PreviewIssue[]) {
  return render(
    <ModernAppShell
      documentType="basic"
      onDocumentTypeChange={vi.fn()}
      validationIssues={issues}
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
      onCompliance={vi.fn()}
    >
      <div>editor</div>
    </ModernAppShell>,
  );
}

describe('compliance banner in the shell', () => {
  it('renders above the editor with the preview aside stubbed out', () => {
    renderShell(ISSUES);
    const banner = screen.getByText(/EXPORT BLOCKED/).closest('div') as HTMLElement;
    expect(banner).toBeInTheDocument();
    expect(banner.closest('aside')).toBeNull();
    expect(banner.textContent).toContain('SSIC required');
    expect(banner.textContent).toContain('Subject required');
  });

  it('announces the failures once', () => {
    renderShell(ISSUES);
    const alerts = screen.getAllByRole('alert').filter((el) => /EXPORT BLOCKED|Compliance:/.test(el.textContent ?? ''));
    expect(alerts).toHaveLength(1);
  });

  it('renders nothing when the document has no blocking or failing issue', () => {
    renderShell([{ id: 'acronym', severity: 'warn', rule: 'Acronym first use', detail: 'Spell it out.', citation: 'SECNAV M-5216.5 2-17' }]);
    expect(screen.queryByText(/EXPORT BLOCKED|Compliance:/)).toBeNull();
  });
});

describe('preview sheet', () => {
  it('shows the issues it is given', () => {
    render(
      <PreviewModal
        open
        onOpenChange={vi.fn()}
        documentType="basic"
        issues={ISSUES}
      />,
    );
    const banner = screen.getByText(/EXPORT BLOCKED/).closest('div') as HTMLElement;
    expect(banner.textContent).toContain('SSIC required');
    expect(banner.textContent).toContain('Subject required');
  });

  it('leaves the announcement to the shell', () => {
    render(
      <PreviewModal
        open
        onOpenChange={vi.fn()}
        documentType="basic"
        issues={ISSUES}
      />,
    );
    const banner = screen.getByText(/EXPORT BLOCKED/).closest('div') as HTMLElement;
    expect(banner.getAttribute('role')).toBeNull();
  });
});
