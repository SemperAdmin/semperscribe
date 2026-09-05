/**
 * useShareLinkLoader: the inbound link is read once on the first client
 * render (Phase A.4), in priority order EDMS, encrypted, legacy share.
 * Consumption (EDMS latch, hash and param clearing) still happens.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShareLinkLoader } from '@/hooks/useShareLinkLoader';
import { encodeStateForUrl, type ShareableState } from '@/lib/url-state';
import { clearEdmsContext, isEdmsMode, resetEdmsCacheForTests } from '@/lib/edms-mode';
import type { FormData } from '@/types';

function makeState(): ShareableState {
  return {
    formData: { documentType: 'basic', subj: 'SHARED SUBJECT' } as unknown as FormData,
    paragraphs: [{ id: 1, level: 1, content: 'Body.' }],
    version: 2,
  };
}

function mount(args: Partial<Parameters<typeof useShareLinkLoader>[0]> = {}) {
  const handleImport = vi.fn();
  const toast = vi.fn();
  const onEdmsPrefill = vi.fn();
  const hook = renderHook(() => useShareLinkLoader({ handleImport, toast, onEdmsPrefill, ...args }));
  return { ...hook, handleImport, toast, onEdmsPrefill };
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.sessionStorage.clear();
  resetEdmsCacheForTests();
});
afterEach(() => {
  window.history.replaceState({}, '', '/');
  clearEdmsContext();
  resetEdmsCacheForTests();
});

describe('useShareLinkLoader', () => {
  it('reports nothing pending on a plain URL', () => {
    const { result } = mount();
    expect(result.current.sharedPending).toBeNull();
    expect(result.current.hasEncryptedPending).toBe(false);
    expect(result.current.routingRequest).toBeNull();
  });

  it('holds a legacy share link until confirmed, then imports and clears the param', () => {
    window.history.replaceState({}, '', `/?share=${encodeStateForUrl(makeState())}`);
    const { result, handleImport, toast } = mount();
    expect(result.current.sharedPending).toEqual({ subject: 'SHARED SUBJECT', requestsSignature: false });
    expect(handleImport).not.toHaveBeenCalled();

    act(() => result.current.confirmShared());
    expect(handleImport).toHaveBeenCalledTimes(1);
    expect(handleImport.mock.calls[0][0].formData.subj).toBe('SHARED SUBJECT');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Document Loaded' }));
    expect(result.current.sharedPending).toBeNull();
    expect(new URLSearchParams(window.location.search).has('share')).toBe(false);
  });

  it('dismisses a legacy share link without importing', () => {
    window.history.replaceState({}, '', `/?share=${encodeStateForUrl(makeState())}`);
    const { result, handleImport } = mount();
    act(() => result.current.dismissShared());
    expect(handleImport).not.toHaveBeenCalled();
    expect(result.current.sharedPending).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('holds an encrypted fragment for the unlock dialog and clears it on dismiss', () => {
    window.history.replaceState({}, '', '/#es=payload123');
    const { result } = mount();
    expect(result.current.hasEncryptedPending).toBe(true);
    act(() => result.current.dismissEncrypted());
    expect(result.current.hasEncryptedPending).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('seeds the form from an EDMS link, latches EDMS mode, and clears the hash', () => {
    window.history.replaceState({}, '', '/#edms=v=1&rid=482&ruc=12345&ssic=1650&doc=basic&sec=S-1');
    const { result, onEdmsPrefill, handleImport } = mount();
    expect(onEdmsPrefill).toHaveBeenCalledTimes(1);
    expect(onEdmsPrefill.mock.calls[0][0]).toMatchObject({ requestId: '482', ruc: '12345', ssic: '1650', docType: 'basic' });
    expect(isEdmsMode()).toBe(true);
    expect(window.location.hash).toBe('');
    expect(handleImport).not.toHaveBeenCalled();
    expect(result.current.sharedPending).toBeNull();
    expect(result.current.hasEncryptedPending).toBe(false);
  });

  it('runs the EDMS prefill once, not on every render', () => {
    window.history.replaceState({}, '', '/#edms=v=1&rid=1&ruc=12345&ssic=1650&doc=basic');
    const { rerender, onEdmsPrefill } = mount();
    rerender();
    rerender();
    expect(onEdmsPrefill).toHaveBeenCalledTimes(1);
  });
});
