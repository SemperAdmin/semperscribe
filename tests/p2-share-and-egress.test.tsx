/**
 * Remediation 2026-09, share links and GunnyBot egress.
 *
 * P2-1  The signature request link is an encrypted `#es=` link built
 *       with a user-set password, never a plaintext share link. EDMS
 *       mode refuses a request link with no password. The sensitive-data
 *       export gate runs on the document before any link is built.
 * P2-6  buildSignReadyBlob runs the same gate before generating the PDF.
 * P2-2  A proxy base URL is loopback-only unless the caller passes an
 *       explicit allowRemote. In EDMS mode a stored remote proxy is
 *       refused at send time in client.ts, regardless of what settings
 *       persisted.
 * P3-2  ShareLinkDialog wants 12 characters and can generate a passphrase.
 * P2-11 decodeStateFromUrl refuses an oversized payload before parsing.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { FormData, SignaturePosition } from '@/types';

// The hook pulls the PDF pipeline for the placement modal; none of these
// cases open it, so the pipeline is a stub the test can also observe.
vi.mock('@/services/export/pdfPipelineService', () => ({
  generatePdfForDocType: vi.fn(async () => new Blob(['%PDF-stub'], { type: 'application/pdf' })),
}));
vi.mock('@/lib/pdf-signature-field', () => ({
  addSignatureField: vi.fn(async () => new Uint8Array([1, 2, 3])),
}));

import { useSignatureWorkflow } from '@/hooks/useSignatureWorkflow';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { registerExportAckHandler } from '@/lib/export-gate';
import { setEdmsContext, clearEdmsContext, resetEdmsCacheForTests } from '@/lib/edms-mode';
import { decryptSharedState, decodeStateFromUrl, encodeStateForUrl, type ShareableState } from '@/lib/url-state';
import { normalizeProxyUrl, setProxyUrl, clearAllProxyUrls, getProxyUrl } from '@/lib/gunnybot/proxy-config';
import { streamChat } from '@/lib/gunnybot/client';
import type { GunnyStreamEvent } from '@/lib/gunnybot/types';
import { ShareLinkDialog, generatePassphrase, MIN_SHARE_PASSWORD_LENGTH, type ShareLinkOptions } from '@/components/ShareLinkDialog';

const PASSWORD = 'correct horse battery staple';

function slices(overrides: Partial<FormData> = {}) {
  return {
    formData: {
      documentType: 'basic',
      subj: 'TEST SUBJECT',
      sig: 'J. A. SIGNER',
      signatureFields: [] as SignaturePosition[],
      ...overrides,
    } as unknown as FormData,
    vias: [] as string[],
    references: [] as string[],
    enclosures: [] as string[],
    copyTos: [] as string[],
    paragraphs: [{ id: 1, level: 1, content: 'Body text.' }],
    distList: [] as string[],
  };
}

const fields: SignaturePosition[] = [{ id: 'f1', page: 1, x: 72, y: 72, width: 200, height: 40, signerName: 'J. A. SIGNER' }];

function mountWorkflow(data = slices()) {
  const toast = vi.fn();
  const setFormData = vi.fn();
  const applySignatureFields = vi.fn(async (b: Blob) => b);
  const hook = renderHook(() => useSignatureWorkflow({ data, setFormData, applySignatureFields, toast }));
  return { ...hook, toast, setFormData };
}

let clipboard: string[] = [];

beforeEach(() => {
  clipboard = [];
  window.sessionStorage.clear();
  window.localStorage.clear();
  resetEdmsCacheForTests();
  clearAllProxyUrls();
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(async (t: string) => { clipboard.push(t); }) },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  clearEdmsContext();
  resetEdmsCacheForTests();
  clearAllProxyUrls();
  registerExportAckHandler(null);
  vi.unstubAllGlobals();
  vi.mocked(generatePdfForDocType).mockClear();
});

describe('P2-1 signature request link', () => {
  it('builds an encrypted #es= link, never a plaintext share link', async () => {
    const { result } = mountWorkflow();
    await act(async () => {
      await result.current.handleCopySignatureRequest(fields, { password: PASSWORD });
    });
    expect(clipboard).toHaveLength(1);
    const url = clipboard[0];
    expect(url).toContain('#es=');
    expect(url).not.toContain('?share=');
    expect(url).not.toContain('#s=');
    const payload = url.slice(url.indexOf('#es=') + 4);
    const loaded = await decryptSharedState(payload, PASSWORD);
    expect(loaded.status).toBe('ok');
    if (loaded.status === 'ok') {
      expect(loaded.state.routing?.requestedSigner).toBe('J. A. SIGNER');
      expect(loaded.state.formData.signatureFields).toEqual(fields);
    }
  });

  it('refuses a request link with no password', async () => {
    const { result, toast } = mountWorkflow();
    await act(async () => {
      await result.current.handleCopySignatureRequest(fields, {});
    });
    expect(clipboard).toHaveLength(0);
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });

  it('refuses a plain request link in EDMS mode and names the reason', async () => {
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    const { result, toast } = mountWorkflow();
    await act(async () => {
      await result.current.handleCopySignatureRequest(fields, {});
    });
    expect(clipboard).toHaveLength(0);
    const call = toast.mock.calls.at(-1)?.[0] as { title: string; description: string; variant?: string };
    expect(call.variant).toBe('destructive');
    expect(`${call.title} ${call.description}`).toMatch(/EDMS/);
  });

  it('runs the sensitive-data gate on the document before building the link', async () => {
    const ack = vi.fn(async (_findings: string[]) => false);
    registerExportAckHandler(ack);
    const { result } = mountWorkflow(slices({ subj: 'SSN 123-45-6789' }));
    await act(async () => {
      await result.current.handleCopySignatureRequest(fields, { password: PASSWORD });
    });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(ack.mock.calls[0][0]).toEqual(expect.arrayContaining([expect.stringMatching(/SSN/)]));
    expect(clipboard).toHaveLength(0);
  });

  it('builds the link when the user acknowledges the finding', async () => {
    registerExportAckHandler(async () => true);
    const { result } = mountWorkflow(slices({ subj: 'SSN 123-45-6789' }));
    await act(async () => {
      await result.current.handleCopySignatureRequest(fields, { password: PASSWORD });
    });
    expect(clipboard).toHaveLength(1);
    expect(clipboard[0]).toContain('#es=');
  });
});

describe('P2-6 sign-ready blob gate', () => {
  it('runs the gate before generating the PDF and aborts when refused', async () => {
    const ack = vi.fn(async () => false);
    registerExportAckHandler(ack);
    const { result, toast } = mountWorkflow(slices({ subj: 'SSN 123-45-6789' }));
    await expect(result.current.buildSignReadyBlob()).rejects.toMatchObject({ name: 'AbortError' });
    expect(ack).toHaveBeenCalledTimes(1);
    expect(generatePdfForDocType).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalled();
  });

  it('generates the PDF when the scan is clean', async () => {
    const ack = vi.fn(async () => false);
    registerExportAckHandler(ack);
    const { result } = mountWorkflow();
    const blob = await result.current.buildSignReadyBlob();
    expect(blob).toBeInstanceOf(Blob);
    expect(ack).not.toHaveBeenCalled();
  });
});

describe('P2-2 proxy destination', () => {
  it('accepts loopback hosts without an acknowledgement', () => {
    expect(normalizeProxyUrl('http://127.0.0.1:8443/')).toBe('http://127.0.0.1:8443');
    expect(normalizeProxyUrl('http://127.1.2.3:8443')).toBe('http://127.1.2.3:8443');
    expect(normalizeProxyUrl('http://localhost:8443')).toBe('http://localhost:8443');
    expect(normalizeProxyUrl('http://[::1]:8443')).toBe('http://[::1]:8443');
  });

  it('rejects a remote host without allowRemote and accepts it with', () => {
    expect(normalizeProxyUrl('https://example.org')).toBeNull();
    expect(normalizeProxyUrl('https://example.org', { allowRemote: true })).toBe('https://example.org');
    expect(setProxyUrl('genaimil', 'https://example.org')).toBeNull();
    expect(getProxyUrl('genaimil')).toBeNull();
    expect(setProxyUrl('genaimil', 'https://example.org', { allowRemote: true })).toBe('https://example.org');
  });

  it('refuses a stored remote proxy at send time in EDMS mode', async () => {
    setProxyUrl('genaimil', 'https://example.org/gw', { allowRemote: true });
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const events: GunnyStreamEvent[] = [];
    await streamChat(
      { provider: 'genaimil', model: 'gemini-2.5-flash', apiKey: 'STARK_TESTKEY0123456789', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 64 },
      { onEvent: e => events.push(e) },
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    const err = events[0] as { kind: string; message: string };
    expect(err.kind).toBe('error');
    expect(err.message).toMatch(/example\.org/);
    expect(err.message).toMatch(/EDMS/);
  });

  it('still sends to a loopback proxy in EDMS mode', async () => {
    setProxyUrl('genaimil', 'http://127.0.0.1:8443');
    setEdmsContext({ requestId: 'REQ-1', ruc: '12345', ssic: '1650', docType: 'basic' });
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => JSON.stringify({ choices: [{ message: { content: 'ready' }, finish_reason: 'stop' }] }),
    }));
    vi.stubGlobal('fetch', fetchSpy);
    await streamChat(
      { provider: 'genaimil', model: 'gemini-2.5-flash', apiKey: 'STARK_TESTKEY0123456789', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 64 },
      { onEvent: () => {} },
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe('P3-2 share link password policy', () => {
  it('rejects an 11-character password', async () => {
    const onCreate = vi.fn(async () => {});
    render(<ShareLinkDialog open onOpenChange={vi.fn()} onCreate={onCreate} />);
    fireEvent.change(screen.getByLabelText('Link password'), { target: { value: 'abcdefghijk' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'abcdefghijk' } });
    fireEvent.click(screen.getByRole('button', { name: /generate & copy/i }));
    await waitFor(() => expect(screen.getByText(/at least 12 characters/i)).toBeInTheDocument());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('accepts a generated passphrase and passes it to onCreate', async () => {
    const onCreate = vi.fn(async (_options: ShareLinkOptions) => {});
    render(<ShareLinkDialog open onOpenChange={vi.fn()} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /generate passphrase/i }));
    const shown = screen.getByTestId('generated-passphrase') as HTMLInputElement;
    expect(shown.value.length).toBeGreaterThanOrEqual(MIN_SHARE_PASSWORD_LENGTH);
    fireEvent.click(screen.getByRole('button', { name: /generate & copy/i }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0][0]).toMatchObject({ password: shown.value });
  });

  it('generatePassphrase yields four words from the built-in list', () => {
    const p = generatePassphrase();
    expect(p.split(' ')).toHaveLength(4);
    expect(p.length).toBeGreaterThanOrEqual(MIN_SHARE_PASSWORD_LENGTH);
    expect(generatePassphrase()).not.toBe(p);
  });
});

describe('P2-11 share payload size caps', () => {
  it('refuses a 20 000-character encoded payload before parsing', () => {
    // Incompressible body so the encoded form is genuinely long.
    let noise = '';
    let seed = 7;
    while (noise.length < 24_000) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise += String.fromCharCode(33 + (seed % 90));
    }
    const state: ShareableState = {
      formData: { documentType: 'basic', subj: 'BIG' } as unknown as FormData,
      paragraphs: [{ id: 1, level: 1, content: noise }],
      version: 2,
    };
    const encoded = encodeStateForUrl(state);
    expect(encoded.length).toBeGreaterThan(20_000);
    const parse = vi.spyOn(JSON, 'parse');
    expect(decodeStateFromUrl(encoded)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it('refuses a payload which decodes to more than 2 MB', () => {
    const state: ShareableState = {
      formData: { documentType: 'basic', subj: 'BIG' } as unknown as FormData,
      paragraphs: [{ id: 1, level: 1, content: 'a'.repeat(2_200_000) }],
      version: 2,
    };
    const encoded = encodeStateForUrl(state);
    expect(encoded.length).toBeLessThan(16_384);
    const parse = vi.spyOn(JSON, 'parse');
    expect(decodeStateFromUrl(encoded)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });

  it('still decodes an ordinary payload', () => {
    const state: ShareableState = {
      formData: { documentType: 'basic', subj: 'OK' } as unknown as FormData,
      version: 2,
    };
    expect(decodeStateFromUrl(encodeStateForUrl(state))?.formData.subj).toBe('OK');
  });
});
