/**
 * adminSubsections survives a document load (user report 2026-09-15).
 *
 * Loading any template or draft threw:
 *
 *   TypeError: Cannot read properties of undefined (reading
 *   'reportsRequired')   at page.tsx:597
 *
 * The page seeded `adminSubsections` in its initial useState and nowhere
 * else. `blankFormData` - which every draft, template, .nldp and
 * share-link load runs through since P6-9 - rebuilt the document without
 * it, so the key came back undefined. The Reports-to-Admin sync then
 * read `prev.adminSubsections!.reportsRequired` through a non-null
 * assertion that was not true, and a directive with any titled report
 * crashed the app on load.
 *
 * Both halves are covered here: the blank document carries the key, and
 * the sync writes through a default instead of an assertion.
 *
 * The page renders with its shell, editor and preview stubbed, the same
 * arrangement tests/p6-save-integrity.test.tsx uses; everything the test
 * exercises is real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import type { SavedLetter, FormData, AdminSubsections } from '@/types';

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn(), toasts: [] }),
}));

vi.mock('@/hooks/useLivePreview', () => ({
  useLivePreview: () => ({
    previewUrl: null, isGeneratingPreview: false, updatePreview: vi.fn(),
    applySignatureFields: vi.fn(), samePageStatus: null,
  }),
}));

vi.mock('@/components/layout/ModernAppShell', () => ({
  ModernAppShell: (props: {
    isDirty?: boolean; lastSavedAt?: Date | null; onSave: () => void;
    savedLetters: SavedLetter[]; onLoadDraft: (id: string) => void;
    onImport: (payload: unknown) => void;
    children?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="save-state">
        {props.isDirty ? 'Unsaved changes' : props.lastSavedAt ? 'Saved' : 'Draft'}
      </div>
      <button onClick={props.onSave}>Save Draft</button>
      {/* The template loader's own last step: handleLoadTemplateUrl
          fetches the JSON and hands it to this same handler. A template
          file carries no adminSubsections, which is what made the load
          crash where a draft (saved from a document that had the key)
          did not. */}
      <button
        onClick={() => props.onImport({
          formData: {
            documentType: 'mco',
            orderPrefix: 'MCO',
            subj: 'TEMPLATE ORDER',
            reports: [{ title: 'Quarterly Muster', controlSymbol: '5678' }],
          },
          paragraphs: [{ id: 1, level: 1, title: 'Situation', content: 'Body.' }],
        })}
      >
        Load Template
      </button>
      <ul>
        {props.savedLetters.map((l) => (
          <li key={l.id}>
            <button onClick={() => props.onLoadDraft(l.id)}>Load {l.name}</button>
          </li>
        ))}
      </ul>
      {props.children}
    </div>
  ),
}));

vi.mock('@/components/document/DocumentLayout', () => ({
  DocumentLayout: (props: { formData: FormData; setFormData: React.Dispatch<React.SetStateAction<FormData>> }) => (
    <div>
      <button
        onClick={() => props.setFormData((prev) => ({
          ...prev,
          documentType: 'mco',
          orderPrefix: 'MCO',
          subj: 'REPORTING ORDER',
          reports: [{ title: 'Annual Inventory', controlSymbol: '1234' }],
        } as unknown as FormData))}
      >
        Make Order With Report
      </button>
      <button onClick={() => props.setFormData((prev) => ({ ...prev, subj: 'EDITED' }))}>
        Edit Subject
      </button>
      <pre data-testid="form-data">{JSON.stringify(props.formData)}</pre>
    </div>
  ),
}));

vi.mock('@/components/gunnybot/GunnyBotPanel', () => ({ GunnyBotPanel: () => null }));
vi.mock('@/components/gunnybot/GunnyBotRuntime', () => ({ GunnyBotRuntime: () => null }));
vi.mock('@/components/ExportScanGate', () => ({ ExportScanGate: () => null }));
vi.mock('@/components/DocumentLibraryDialog', () => ({ DocumentLibraryDialog: () => null }));
vi.mock('@/components/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPalette: () => [false, vi.fn()],
}));

import Page from '@/app/page';

const formData = () =>
  JSON.parse(screen.getByTestId('form-data').textContent || '{}') as Record<string, unknown>;
const admin = () => formData().adminSubsections as AdminSubsections | undefined;
const saveState = () => screen.getByTestId('save-state').textContent;

/** Autosave and the change counter arm 2s after mount; wait them out. */
async function armAutosave() {
  await act(async () => { await new Promise((r) => setTimeout(r, 2100)); });
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  sessionStorage.clear();
  localStorage.clear();
  toastMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('adminSubsections through a document load', () => {
  it('a directive with reports loads without throwing, and keeps the subsections', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    const { unmount } = render(<Page />);
    await armAutosave();

    // A fresh document has them, and the reports sync fills the text.
    fireEvent.click(screen.getByRole('button', { name: 'Make Order With Report' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
    await waitFor(() =>
      expect(admin()?.reportsRequired.content).toBe('Annual Inventory (Report Control Symbol 1234)'));

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(saveState()).toBe('Saved'));

    // Dirty it so the load takes the guarded path a real user sees.
    fireEvent.click(screen.getByRole('button', { name: 'Edit Subject' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));

    fireEvent.click(screen.getByRole('button', { name: 'Load REPORTING ORDER' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/unsaved/i);
    fireEvent.click(screen.getByRole('button', { name: /load draft/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(formData().subj).toBe('REPORTING ORDER'));

    // The load rebuilds from the blank document. It carries the key, so
    // the sync merges into it instead of dereferencing undefined.
    expect(admin(), 'blank document carries adminSubsections').toBeDefined();
    expect(admin()!.recordsManagement).toBeDefined();
    expect(admin()!.privacyAct).toBeDefined();
    await waitFor(() =>
      expect(admin()!.reportsRequired.content).toBe('Annual Inventory (Report Control Symbol 1234)'));

    window.removeEventListener('error', onError);
    expect(errors, 'no uncaught error during the load').toEqual([]);
    unmount();
  }, 20000);

  it('a template carrying no adminSubsections loads without throwing', async () => {
    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error ?? e.message);
    window.addEventListener('error', onError);

    const { unmount } = render(<Page />);
    await armAutosave();

    // This is the reported crash. A draft round-trips the key in its own
    // JSON and hid the bug; a template file has never carried it, so the
    // blank document is the only source and it had none.
    fireEvent.click(screen.getByRole('button', { name: 'Load Template' }));
    await waitFor(() => expect(formData().subj).toBe('TEMPLATE ORDER'));

    expect(admin(), 'blank document carries adminSubsections').toBeDefined();
    expect(admin()!.recordsManagement).toBeDefined();
    expect(admin()!.privacyAct).toBeDefined();
    await waitFor(() =>
      expect(admin()!.reportsRequired.content).toBe('Quarterly Muster (Report Control Symbol 5678)'));

    window.removeEventListener('error', onError);
    expect(errors, 'no uncaught error during the template load').toEqual([]);
    unmount();
  }, 20000);
});
