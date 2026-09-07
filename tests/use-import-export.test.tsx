/**
 * P6-9 / P6-10 (remediation 2026-09) - useImportExport.
 *
 * P6-9: `handleImport` spread the incoming document over the previous
 * one, so stale keys (signatureFields, samePageHost, the NAVMC 10132
 * base id and load report, stage) survived into the new document. The
 * hook now rebuilds from the app's blank default before spreading.
 *
 * P6-10: the AMHS copy toasted "Copied" on an unawaited clipboard
 * write. It now awaits the copy and reports the failure.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useImportExport } from '@/hooks/useImportExport';
import type { FormData, ParagraphData, ValidationState } from '@/types';

const copyToClipboard = vi.fn<(text: string) => Promise<boolean>>();
vi.mock('@/lib/url-state', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/url-state')>();
  return { ...actual, copyToClipboard: (text: string) => copyToClipboard(text) };
});

vi.mock('@/services/amhs/amhsFormatter', () => ({
  validateAMHSMessage: () => ({ isValid: true, errors: [] }),
  generateFullMessage: () => 'MSG BODY',
}));

afterEach(() => {
  vi.clearAllMocks();
});

function blank(documentType: string): FormData {
  return {
    documentType,
    line1: 'PROFILE UNIT', line2: '', line3: '',
    ssic: '', subj: '', from: '', to: '', date: '', sig: '',
  } as unknown as FormData;
}

function useHarness(initial: FormData, opts: { withBlank: boolean }) {
  const [formData, setFormData] = useState<FormData>(initial);
  const [paragraphs, setParagraphs] = useState<ParagraphData[]>([{ id: 1, level: 1, content: '', acronymError: '' }]);
  const [vias, setVias] = useState<string[]>(['']);
  const [references, setReferences] = useState<string[]>(['']);
  const [enclosures, setEnclosures] = useState<string[]>(['']);
  const [copyTos, setCopyTos] = useState<string[]>(['']);
  const [distList, setDistList] = useState<string[]>(['']);
  const [, setFormKey] = useState(0);
  const [, setValidation] = useState<ValidationState>({
    ssic: { isValid: false, message: '' }, subj: { isValid: false, message: '' },
    from: { isValid: false, message: '' }, to: { isValid: false, message: '' },
  });
  const [toast] = useState(() => vi.fn());
  const api = useImportExport({
    formData, setFormData, paragraphs, setParagraphs, vias, setVias,
    references, setReferences, enclosures, setEnclosures, copyTos, setCopyTos,
    distList, setDistList, setFormKey, setValidation,
    savedLetters: [
      { id: 'draft-1', name: 'Draft One', savedAt: 'x', documentType: 'basic', subj: 'NEW SUBJECT',
        vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [{ id: 1, level: 1, content: 'new body', acronymError: '' }] },
    ] as never[],
    toast,
    blankFormData: opts.withBlank ? (prev: FormData) => blank(prev.documentType) : undefined,
  });
  return { formData, api, toast };
}

const dirtyDoc = {
  documentType: 'basic',
  subj: 'OLD SUBJECT',
  line1: 'TYPED UNIT',
  signatureFields: [{ page: 1, x: 1, y: 1 }],
  samePageHost: { kind: 'draft', letterId: 'host', title: 'Host' },
  navmc10132BaseFileId: 'navmc10132-base:abc',
  navmc10132LoadReport: { read: 1 },
  stage: 3,
} as unknown as FormData;

describe('handleImport (P6-9)', () => {
  it('rebuilds from the blank default: no signatureFields, host, base id, report or stage survive', () => {
    const { result } = renderHook(() => useHarness(dirtyDoc, { withBlank: true }));
    act(() => result.current.api.handleLoadDraft('draft-1'));
    const fd = result.current.formData as unknown as Record<string, unknown>;
    expect(fd.subj).toBe('NEW SUBJECT');
    expect(fd.signatureFields).toBeUndefined();
    expect(fd.samePageHost).toBeUndefined();
    expect(fd.navmc10132BaseFileId).toBeUndefined();
    expect(fd.navmc10132LoadReport).toBeUndefined();
    expect(fd.stage).toBeUndefined();
  });

  it('the blank default is built from the previous document, so a template keeps the letterhead', () => {
    const { result } = renderHook(() => useHarness(dirtyDoc, { withBlank: true }));
    act(() => result.current.api.handleImport({ formData: { documentType: 'basic', subj: 'FROM TEMPLATE' }, paragraphs: [] }));
    const fd = result.current.formData as unknown as Record<string, unknown>;
    expect(fd.subj).toBe('FROM TEMPLATE');
    expect(fd.line1).toBe('PROFILE UNIT');
    expect(fd.signatureFields).toBeUndefined();
  });

  it('without a blank builder the legacy merge is unchanged', () => {
    const { result } = renderHook(() => useHarness(dirtyDoc, { withBlank: false }));
    act(() => result.current.api.handleLoadDraft('draft-1'));
    const fd = result.current.formData as unknown as Record<string, unknown>;
    expect(fd.subj).toBe('NEW SUBJECT');
    expect(fd.signatureFields).toBeDefined();
  });
});

describe('handleCopyAMHS (P6-10)', () => {
  it('toasts a failure, not "Copied", when the clipboard write fails', async () => {
    copyToClipboard.mockResolvedValue(false);
    const { result } = renderHook(() => useHarness({ documentType: 'amhs' } as unknown as FormData, { withBlank: false }));
    await act(async () => { await result.current.api.handleCopyAMHS(); });
    expect(copyToClipboard).toHaveBeenCalledWith('MSG BODY');
    expect(result.current.toast).toHaveBeenCalledTimes(1);
    const call = result.current.toast.mock.calls[0][0] as { title: string; variant?: string };
    expect(call.variant).toBe('destructive');
    expect(call.title).not.toMatch(/copied/i);
  });

  it('toasts success only after the clipboard write resolves true', async () => {
    let resolveCopy: (v: boolean) => void = () => {};
    copyToClipboard.mockImplementation(() => new Promise<boolean>((r) => { resolveCopy = r; }));
    const { result } = renderHook(() => useHarness({ documentType: 'amhs' } as unknown as FormData, { withBlank: false }));
    let done: Promise<void> = Promise.resolve();
    act(() => { done = result.current.api.handleCopyAMHS(); });
    expect(result.current.toast).not.toHaveBeenCalled();
    await act(async () => { resolveCopy(true); await done; });
    expect(result.current.toast).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringMatching(/copied/i) }));
  });
});
