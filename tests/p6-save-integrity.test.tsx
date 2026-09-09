/**
 * P6-2 / P6-9 / P6-17 (remediation 2026-09) - save integrity in page.tsx.
 *
 * P6-2: Save Draft cleared the autosaved working copy and set the
 * "Saved" mark BEFORE the library write resolved. A failed write rolled
 * the list back but left the header reading "Saved" with the working
 * copy gone. The mark and the clear now wait for the write.
 *
 * P6-9: loading a draft over a dirty document replaced it with no
 * confirmation, and the merge carried stale keys (signatureFields among
 * them) into the new document.
 *
 * P6-17: library rename, duplicate and delete were optimistic with a
 * console.error only. They now toast and revert, as Save does.
 *
 * The page renders with its heavy shell, editor and preview replaced by
 * stubs that expose the handlers under test; everything else is real.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import React from 'react';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import type { SavedLetter, FormData } from '@/types';

const { libPutMock, libDeleteMock, toastMock } = vi.hoisted(() => ({
  libPutMock: vi.fn<(letter: SavedLetter) => Promise<void>>(),
  libDeleteMock: vi.fn<(id: string) => Promise<void>>(),
  toastMock: vi.fn(),
}));

vi.mock('@/lib/document-library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/document-library')>();
  return {
    ...actual,
    libPut: (letter: SavedLetter) => libPutMock(letter),
    libDelete: (id: string) => libDeleteMock(id),
    // The real implementations, reachable for the spies' default routing.
    realLibPut: actual.libPut,
    realLibDelete: actual.libDelete,
  };
});

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
    savedLetters: SavedLetter[]; onLoadDraft: (id: string) => void; onOpenLibrary?: () => void;
    children?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="save-state">
        {props.isDirty ? 'Unsaved changes' : props.lastSavedAt ? 'Saved' : 'Draft'}
      </div>
      <button onClick={props.onSave}>Save Draft</button>
      <button onClick={props.onOpenLibrary}>Open Library</button>
      <ul data-testid="draft-list">
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
        onClick={() => props.setFormData((prev) => ({ ...prev, documentType: 'basic', subj: 'DIRTY WORK' }))}
      >
        Type Subject
      </button>
      <button
        onClick={() => props.setFormData((prev) => ({
          ...prev,
          signatureFields: [{ page: 1, x: 10, y: 10 }],
        } as unknown as FormData))}
      >
        Place Signature
      </button>
      <pre data-testid="form-data">{JSON.stringify(props.formData)}</pre>
    </div>
  ),
}));

vi.mock('@/components/DocumentLibraryDialog', () => ({
  DocumentLibraryDialog: (props: {
    open: boolean; letters: SavedLetter[];
    onRename: (id: string, name: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
  }) => props.open ? (
    <div data-testid="library">
      {props.letters.map((l) => (
        <div key={l.id} data-testid="library-row">
          <span>{l.name}</span>
          <button onClick={() => props.onRename(l.id, 'RENAMED')}>Rename {l.name}</button>
          <button onClick={() => props.onDuplicate(l.id)}>Duplicate {l.name}</button>
          <button onClick={() => props.onDelete(l.id)}>Delete {l.name}</button>
        </div>
      ))}
    </div>
  ) : null,
}));

// Side-panel machinery the tests never touch.
vi.mock('@/components/gunnybot/GunnyBotPanel', () => ({ GunnyBotPanel: () => null }));
vi.mock('@/components/gunnybot/GunnyBotRuntime', () => ({ GunnyBotRuntime: () => null }));
vi.mock('@/components/ExportScanGate', () => ({ ExportScanGate: () => null }));
vi.mock('@/components/CommandPalette', () => ({
  CommandPalette: () => null,
  useCommandPalette: () => [false, vi.fn()],
}));

import Page from '@/app/page';
import { readWorkingCopy, getAutosaveSessionId, listWorkingCopies, writeWorkingCopy } from '@/lib/autosave';
import { filePut, fileLoadForDoc, workingCopyDocIdFor } from '@/lib/document-library';
import * as libModule from '@/lib/document-library';

const { realLibPut, realLibDelete } = libModule as unknown as {
  realLibPut: (letter: SavedLetter) => Promise<void>;
  realLibDelete: (id: string) => Promise<void>;
};

const formData = () => JSON.parse(screen.getByTestId('form-data').textContent || '{}') as Record<string, unknown>;
const saveState = () => screen.getByTestId('save-state').textContent;

/** Autosave and the change counter arm 2s after mount; wait them out. */
async function armAutosave() {
  await act(async () => { await new Promise((r) => setTimeout(r, 2100)); });
}

async function typeAndAutosave() {
  fireEvent.click(screen.getByRole('button', { name: 'Type Subject' }));
  await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
  // Debounced autosave (1.5s) lands the working copy.
  await waitFor(async () => {
    expect((await readWorkingCopy(getAutosaveSessionId()))?.formData.subj).toBe('DIRTY WORK');
  }, { timeout: 4000 });
}

beforeEach(() => {
  indexedDB = new IDBFactory();
  sessionStorage.clear();
  localStorage.clear();
  toastMock.mockReset();
  // The mocked module re-exports the real implementations under other
  // names; route the spies to them so the store behaves until a test
  // makes one fail.
  libPutMock.mockReset().mockImplementation((letter) => realLibPut(letter));
  libDeleteMock.mockReset().mockImplementation((id) => realLibDelete(id));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('P6-2: a failed Save Draft', () => {
  it('leaves the working copy present and the header not "Saved"', async () => {
    const { unmount } = render(<Page />);
    await armAutosave();
    await typeAndAutosave();

    libPutMock.mockRejectedValueOnce(new Error('QuotaExceededError'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Save Failed' })));
    expect(saveState()).not.toBe('Saved');
    expect(saveState()).toBe('Unsaved changes');
    expect((await readWorkingCopy(getAutosaveSessionId()))?.formData.subj).toBe('DIRTY WORK');
    expect(screen.getByTestId('draft-list').querySelectorAll('li')).toHaveLength(0);
    unmount();
  }, 15000);

  it('a successful Save Draft clears the working copy and reads Saved', async () => {
    const { unmount } = render(<Page />);
    await armAutosave();
    await typeAndAutosave();

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Draft Saved' })));
    await waitFor(() => expect(saveState()).toBe('Saved'));
    await waitFor(async () => expect(await readWorkingCopy(getAutosaveSessionId())).toBeNull());
    unmount();
  }, 15000);
});

describe('P6-9: loading a draft over a dirty document', () => {
  it('prompts first, and on confirm the new document carries no signatureFields from the old', async () => {
    const { unmount } = render(<Page />);
    await armAutosave();

    // Save one clean draft so there is something to load.
    fireEvent.click(screen.getByRole('button', { name: 'Type Subject' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(saveState()).toBe('Saved'));
    const savedId = (libPutMock.mock.calls[0][0] as SavedLetter).id;

    // Dirty the document again: a signature placement on the current letter.
    fireEvent.click(screen.getByRole('button', { name: 'Place Signature' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
    expect(formData().signatureFields).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Load DIRTY WORK' }));
    // Not loaded yet: the confirmation is up.
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/unsaved/i);

    fireEvent.click(screen.getByRole('button', { name: /load draft/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(formData().subj).toBe('DIRTY WORK'));
    expect(formData().signatureFields).toBeUndefined();
    expect(savedId).toBeTruthy();
    unmount();
  }, 15000);

  it('dismissing the prompt keeps the current document', async () => {
    const { unmount } = render(<Page />);
    await armAutosave();
    fireEvent.click(screen.getByRole('button', { name: 'Type Subject' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(saveState()).toBe('Saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Place Signature' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));

    fireEvent.click(screen.getByRole('button', { name: 'Load DIRTY WORK' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(formData().signatureFields).toBeDefined();
    unmount();
  }, 15000);
});

describe('P6-17: library operations', () => {
  async function renderWithSavedDraft() {
    const view = render(<Page />);
    await armAutosave();
    fireEvent.click(screen.getByRole('button', { name: 'Type Subject' }));
    await waitFor(() => expect(saveState()).toBe('Unsaved changes'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(saveState()).toBe('Saved'));
    fireEvent.click(screen.getByRole('button', { name: 'Open Library' }));
    await screen.findByTestId('library');
    toastMock.mockClear();
    return view;
  }

  it('a failed rename toasts and reverts the name', async () => {
    const { unmount } = await renderWithSavedDraft();
    libPutMock.mockRejectedValueOnce(new Error('quota'));
    fireEvent.click(screen.getByRole('button', { name: 'Rename DIRTY WORK' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getByRole('button', { name: 'Rename DIRTY WORK' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rename RENAMED' })).toBeNull();
    unmount();
  }, 15000);

  it('a failed duplicate toasts and drops the copy', async () => {
    const { unmount } = await renderWithSavedDraft();
    libPutMock.mockRejectedValueOnce(new Error('quota'));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate DIRTY WORK' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getAllByTestId('library-row')).toHaveLength(1);
    unmount();
  }, 15000);

  it('a failed delete toasts and restores the document', async () => {
    const { unmount } = await renderWithSavedDraft();
    libDeleteMock.mockRejectedValueOnce(new Error('locked'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete DIRTY WORK' }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(screen.getAllByTestId('library-row')).toHaveLength(1);
    unmount();
  }, 15000);
});

describe('P6-4: recovery is scoped to the copy on offer', () => {
  it('discarding another session\'s copy deletes that copy and its files only', async () => {
    // Two copies from other tabs, each with a write-through file.
    await writeWorkingCopy({
      formData: { documentType: 'basic', subj: 'TAB ONE' } as unknown as FormData,
      paragraphs: [{ id: 1, level: 1, content: 'one', acronymError: '' }],
      vias: [], references: [], enclosures: [], copyTos: [], distList: [],
    }, { sessionId: 'tab-one', lastWrittenAt: null });
    await new Promise((r) => setTimeout(r, 5));
    await writeWorkingCopy({
      formData: { documentType: 'basic', subj: 'TAB TWO' } as unknown as FormData,
      paragraphs: [{ id: 1, level: 1, content: 'two', acronymError: '' }],
      vias: [], references: [], enclosures: [], copyTos: [], distList: [],
    }, { sessionId: 'tab-two', lastWrittenAt: null });
    const pdf = (fileId: string, docId: string) => ({
      fileId, docId, fileName: `${fileId}.pdf`, title: fileId, mimeType: 'application/pdf' as const,
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer, byteLength: 4,
    });
    await filePut(pdf('file-one', workingCopyDocIdFor('tab-one')));
    await filePut(pdf('file-two', workingCopyDocIdFor('tab-two')));

    const { unmount } = render(<Page />);
    // Newest first: TAB TWO is on offer.
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('TAB TWO');
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }));
    fireEvent.click(screen.getByRole('button', { name: /yes, discard/i }));

    await waitFor(async () => expect((await listWorkingCopies()).map((c) => c.sessionId)).toEqual(['tab-one']));
    await waitFor(async () => expect(await fileLoadForDoc(workingCopyDocIdFor('tab-two'))).toHaveLength(0));
    expect((await fileLoadForDoc(workingCopyDocIdFor('tab-one'))).map((f) => f.fileId)).toEqual(['file-one']);

    // The next copy is offered; keeping it for later deletes nothing.
    await waitFor(() => expect(screen.getByRole('dialog').textContent).toContain('TAB ONE'));
    fireEvent.click(screen.getByRole('button', { name: /keep for later/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await listWorkingCopies()).map((c) => c.sessionId)).toEqual(['tab-one']);
    unmount();
  }, 15000);
});
