/**
 * P6-13 (remediation 2026-09): useLivePreview had no in-flight sequence
 * guard, so a slow earlier render landing after a newer one replaced
 * the newer preview with stale bytes; and a failed render kept the old
 * URL on screen with nothing said. Now every render takes a sequence
 * number, a superseded result is dropped (its blob URL never created),
 * and a failure surfaces as `previewError` for the pane.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, act, renderHook } from '@testing-library/react';
import type { FormData } from '@/types';

type Deferred = { resolve: (b: Blob) => void; reject: (e: Error) => void };
const pending: Deferred[] = [];

vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: vi.fn(
    () => new Promise<Blob>((resolve, reject) => { pending.push({ resolve, reject }); }),
  ),
}));

import { useLivePreview } from '@/hooks/useLivePreview';

const createdUrls: string[] = [];
const revokedUrls: string[] = [];

beforeEach(() => {
  pending.length = 0;
  createdUrls.length = 0;
  revokedUrls.length = 0;
  let n = 0;
  URL.createObjectURL = vi.fn(() => { const u = `blob:preview-${++n}`; createdUrls.push(u); return u; });
  URL.revokeObjectURL = vi.fn((u: string) => { revokedUrls.push(u); });
});
afterEach(cleanup);

function slices(subj: string) {
  return {
    formData: { documentType: 'basic', subj } as unknown as FormData,
    vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
  };
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

/** Kicks a render and lets it reach the (mocked) pipeline call. */
async function start(hook: { result: { current: { updatePreview: () => Promise<void> } } }) {
  act(() => { void hook.result.current.updatePreview(); });
  await flush();
}

describe('P6-13 useLivePreview render sequencing', () => {
  it('drops a superseded render that finishes after a newer one', async () => {
    const hook = renderHook(() => useLivePreview(slices('ONE')));

    // Two explicit renders in flight: the first is the slow one.
    await start(hook);
    await start(hook);
    expect(pending).toHaveLength(2);

    // The newer render finishes first.
    await act(async () => { pending[1].resolve(new Blob(['new'], { type: 'application/pdf' })); });
    await flush();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');

    // The stale render lands afterwards: ignored, no URL created for it.
    await act(async () => { pending[0].resolve(new Blob(['old'], { type: 'application/pdf' })); });
    await flush();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');
    expect(createdUrls).toEqual(['blob:preview-1']);
    expect(hook.result.current.isGeneratingPreview).toBe(false);
  });

  it('reports a failed render as previewError while keeping the last good URL, and clears it on success', async () => {
    const hook = renderHook(() => useLivePreview(slices('ONE')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await start(hook);
    await act(async () => { pending[0].resolve(new Blob(['ok'], { type: 'application/pdf' })); });
    await flush();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');
    expect(hook.result.current.previewError).toBeNull();

    await start(hook);
    await act(async () => { pending[1].reject(new Error('worker did not load')); });
    await flush();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');
    expect(hook.result.current.previewError).toContain('worker did not load');

    await start(hook);
    await act(async () => { pending[2].resolve(new Blob(['ok2'], { type: 'application/pdf' })); });
    await flush();
    expect(hook.result.current.previewError).toBeNull();
    expect(hook.result.current.previewUrl).toBe('blob:preview-2');
    consoleError.mockRestore();
  });

  it('a superseded render that fails does not raise previewError', async () => {
    const hook = renderHook(() => useLivePreview(slices('ONE')));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    await start(hook);
    await start(hook);
    await act(async () => { pending[1].resolve(new Blob(['new'], { type: 'application/pdf' })); });
    await flush();
    await act(async () => { pending[0].reject(new Error('stale failure')); });
    await flush();
    expect(hook.result.current.previewError).toBeNull();
    expect(hook.result.current.previewUrl).toBe('blob:preview-1');
    consoleError.mockRestore();
  });
});
