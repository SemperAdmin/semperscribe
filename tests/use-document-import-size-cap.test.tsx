/**
 * P4-5 (remediation 2026-09): useDocumentImport had no size cap before
 * handing the buffer to mammoth or pdfjs. A file over 10 MB (the same
 * limit useNLDP applies) is refused with a toast naming the limit,
 * before the bytes are read.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, act, renderHook } from '@testing-library/react';
import { useDocumentImport, MAX_IMPORT_BYTES } from '@/hooks/useDocumentImport';

afterEach(cleanup);

function fileOfSize(size: number, name: string): File {
  const file = new File([new Uint8Array(0)], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  file.arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
  return file;
}

describe('P4-5 useDocumentImport size cap', () => {
  it('caps at 10 MB, matching useNLDP', () => {
    expect(MAX_IMPORT_BYTES).toBe(10 * 1024 * 1024);
  });

  it('refuses an oversized file with a toast naming the limit, before reading the buffer', async () => {
    const applyImport = vi.fn();
    const toast = vi.fn();
    const hook = renderHook(() => useDocumentImport({ applyImport, toast }));
    const big = fileOfSize(MAX_IMPORT_BYTES + 1, 'huge.pdf');

    await act(async () => {
      await hook.result.current.startImport(big);
    });

    expect(big.arrayBuffer).not.toHaveBeenCalled();
    expect(applyImport).not.toHaveBeenCalled();
    expect(hook.result.current.isOpen).toBe(false);
    expect(hook.result.current.isProcessing).toBe(false);
    const refusal = toast.mock.calls.find(([opts]) => opts.variant === 'destructive');
    expect(refusal).toBeDefined();
    expect(String(refusal![0].description)).toMatch(/10 MB/);
    expect(String(refusal![0].description)).toContain('huge.pdf');
  });

  it('reads a file at the limit', async () => {
    const toast = vi.fn();
    const hook = renderHook(() => useDocumentImport({ applyImport: vi.fn(), toast }));
    const ok = fileOfSize(MAX_IMPORT_BYTES, 'ok.pdf');

    await act(async () => {
      await hook.result.current.startImport(ok);
    });

    expect(ok.arrayBuffer).toHaveBeenCalled();
    const refusal = toast.mock.calls.find(([opts]) => /10 MB/.test(String(opts.description)));
    expect(refusal).toBeUndefined();
  });
});
