/**
 * D.7: the Ctrl+K hint. R8 shipped the command palette with a global
 * Ctrl/Cmd+K listener and nothing on screen naming it, which the audit
 * recorded as one of the seven things the user is never told. The header
 * now prints the shortcut, and the label follows the platform the way
 * the listener does.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ModernAppShell } from '@/components/layout/ModernAppShell';
import {
  paletteShortcutLabel,
  DEFAULT_PALETTE_SHORTCUT,
  MAC_PALETTE_SHORTCUT,
} from '@/hooks/useCommandPaletteHint';

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

function renderShell(onOpenCommandPalette?: () => void) {
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
      onOpenCommandPalette={onOpenCommandPalette}
    >
      <div>editor</div>
    </ModernAppShell>,
  );
}

describe('paletteShortcutLabel', () => {
  it('names Ctrl on Windows and Linux', () => {
    expect(paletteShortcutLabel('Win32')).toBe(DEFAULT_PALETTE_SHORTCUT);
    expect(paletteShortcutLabel('Linux x86_64')).toBe(DEFAULT_PALETTE_SHORTCUT);
    expect(DEFAULT_PALETTE_SHORTCUT).toBe('Ctrl K');
  });

  it('names Cmd on macOS, by platform or by user agent', () => {
    expect(paletteShortcutLabel('MacIntel')).toBe(MAC_PALETTE_SHORTCUT);
    expect(paletteShortcutLabel('', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(MAC_PALETTE_SHORTCUT);
    expect(MAC_PALETTE_SHORTCUT).toBe('Cmd K');
  });
});

describe('header command palette hint', () => {
  it('prints the shortcut in a kbd element', () => {
    renderShell(vi.fn());
    const hint = screen.getByText('Ctrl K');
    expect(hint.tagName).toBe('KBD');
  });

  it('opens the palette when the hint is clicked', () => {
    const onOpen = vi.fn();
    renderShell(onOpen);
    fireEvent.click(screen.getByTitle('Command palette (Ctrl K)'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('still advertises the shortcut with no handler passed', () => {
    renderShell();
    expect(screen.getByText('Ctrl K').tagName).toBe('KBD');
    expect(screen.getByTitle('Command palette (Ctrl K)').tagName).toBe('SPAN');
  });
});
