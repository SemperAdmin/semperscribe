/**
 * Characterization tests for the share-link state codec, written ahead
 * of the page.tsx decomposition (audit step 6) so the extracted share
 * logic keeps today's behavior: lz-string round-trip, version
 * stamping/migration, routing slips, long-URL flag, and share-param
 * extraction.
 */
import { describe, it, expect } from 'vitest';
import {
  encodeStateForUrl,
  decodeStateFromUrl,
  generateShareableUrl,
  getStateFromUrl,
  clearShareParam,
  ShareableState,
} from '@/lib/url-state';
import type { FormData, ParagraphData } from '@/types';

function makeState(overrides: Partial<ShareableState> = {}): ShareableState {
  return {
    formData: {
      documentType: 'basic',
      subj: 'TEST SUBJECT LINE',
      from: 'Commanding Officer',
      to: 'Distribution List',
    } as unknown as FormData,
    paragraphs: [{ id: 1, level: 1, content: 'First paragraph.' }],
    references: ['(a) SECNAV M-5216.5'],
    enclosures: [],
    vias: [],
    copyTos: [],
    version: 2,
    ...overrides,
  };
}

describe('encode/decode round-trip', () => {
  it('round-trips a full document state losslessly', () => {
    const state = makeState();
    const decoded = decodeStateFromUrl(encodeStateForUrl(state));
    expect(decoded).toEqual(state);
  });

  it('round-trips a signature-request routing slip (v2 links)', () => {
    const state = makeState({
      routing: {
        requestedSigner: 'J. A. SIGNER',
        dueDate: '2026-07-10',
        returnEmail: 'drafter@example.com',
        note: 'Please sign by Friday.',
      },
    });
    const decoded = decodeStateFromUrl(encodeStateForUrl(state));
    expect(decoded?.routing).toEqual(state.routing);
  });

  it('stamps version 1 on legacy payloads missing a version', () => {
    const legacy = makeState();
    // simulate a pre-versioning link
    delete (legacy as Partial<ShareableState>).version;
    const decoded = decodeStateFromUrl(encodeStateForUrl(legacy));
    expect(decoded?.version).toBe(1);
  });

  it('returns null for garbage input instead of throwing', () => {
    expect(decodeStateFromUrl('definitely-not-lz-string!!!')).toBeNull();
    expect(decodeStateFromUrl('')).toBeNull();
  });
});

describe('generateShareableUrl', () => {
  /**
   * MOVED OUT OF THE QUERY STRING, 26 August 2026. This test asserted the URL
   * began "?share=", which is the defect: a query string is sent to the
   * server on every request and lands in server logs, proxy logs, and the
   * Referer header. This app is served by GitHub Pages, so "the server" is a
   * third party. The link carries a whole document, and for a NAVMC 10132
   * that is the accused's name, DoD ID, offenses and punishment.
   *
   * The ENCRYPTED variant has used the fragment since it was written, so the
   * format that leaked was the unprotected one.
   */
  it('builds a #s= URL that decodes back to the same state, stamped v2', () => {
    const state = makeState({ version: 1 }); // stale caller version is overwritten
    const { url, isLong, error } = generateShareableUrl(state, 'https://example.com/app');
    expect(url.startsWith('https://example.com/app#s=')).toBe(true);
    expect(isLong).toBe(false);
    expect(error).toBeUndefined();

    // Nothing before the hash carries the payload.
    expect(url.split('#')[0]).toBe('https://example.com/app');
    expect(url).not.toContain('?share=');

    const encoded = url.slice(url.indexOf('#s=') + 3);
    const decoded = decodeStateFromUrl(encoded);
    expect(decoded?.version).toBe(2);
    expect(decoded?.formData.subj).toBe('TEST SUBJECT LINE');
  });

  it('puts nothing in the query string at all', () => {
    const { url } = generateShareableUrl(makeState(), 'https://example.com/app');
    expect(new URL(url).search).toBe('');
  });

  it('flags URLs beyond the 8000-char soft cap without failing', () => {
    const state = makeState({
      // lz-string compresses repetition well, so use varied content
      paragraphs: Array.from({ length: 220 }, (_, i): ParagraphData => ({
        id: i + 1,
        level: 1,
        content: `Paragraph ${i} :: ${Math.sin(i)} ${Math.cos(i * 7)} ${(i * 2654435761 % 4294967296).toString(36)}`,
      })),
    });
    const { url, isLong, error } = generateShareableUrl(state, 'https://example.com/app');
    expect(url.length).toBeGreaterThan(8000);
    expect(isLong).toBe(true);
    expect(typeof error).toBe('string');
  });
});

describe('getStateFromUrl', () => {
  it('reads the payload from the fragment', () => {
    const state = makeState();
    const encoded = encodeStateForUrl(state);
    window.history.replaceState({}, '', `/#s=${encoded}`);
    try {
      expect(getStateFromUrl()).toEqual(state);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  // LINKS ALREADY IN CIRCULATION. Someone was sent one before the move, and
  // opening an app with an empty document is a worse answer than reading it.
  // The consent gate in useShareLinkLoader is unchanged: both formats are
  // unprotected and both are held until the user agrees.
  it('still reads a legacy ?share= link', () => {
    const state = makeState();
    const encoded = encodeStateForUrl(state);
    window.history.replaceState({}, '', `/?share=${encoded}`);
    try {
      expect(getStateFromUrl()).toEqual(state);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('returns null when neither is present', () => {
    window.history.replaceState({}, '', '/');
    expect(getStateFromUrl()).toBeNull();
  });
});

describe('clearShareParam', () => {
  // The payload left in the address bar reaches the next screenshot, the
  // next copied URL, and the browser history, so both forms are cleared.
  it('clears a fragment payload', () => {
    window.history.replaceState({}, '', `/#s=${encodeStateForUrl(makeState())}`);
    clearShareParam();
    expect(window.location.hash).toBe('');
    expect(getStateFromUrl()).toBeNull();
  });

  it('clears a legacy query payload', () => {
    window.history.replaceState({}, '', `/?share=${encodeStateForUrl(makeState())}`);
    clearShareParam();
    expect(window.location.search).toBe('');
    expect(getStateFromUrl()).toBeNull();
  });

  it('leaves an unrelated fragment alone', () => {
    window.history.replaceState({}, '', '/#section-4');
    clearShareParam();
    expect(window.location.hash).toBe('#section-4');
    window.history.replaceState({}, '', '/');
  });
});
