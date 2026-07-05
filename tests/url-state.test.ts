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
  it('builds a ?share= URL that decodes back to the same state, stamped v2', () => {
    const state = makeState({ version: 1 }); // stale caller version is overwritten
    const { url, isLong, error } = generateShareableUrl(state, 'https://example.com/app');
    expect(url.startsWith('https://example.com/app?share=')).toBe(true);
    expect(isLong).toBe(false);
    expect(error).toBeUndefined();

    const encoded = new URL(url).searchParams.get('share')!;
    const decoded = decodeStateFromUrl(encoded);
    expect(decoded?.version).toBe(2);
    expect(decoded?.formData.subj).toBe('TEST SUBJECT LINE');
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
  it('reads the share param from window.location', () => {
    const state = makeState();
    const encoded = encodeStateForUrl(state);
    window.history.replaceState({}, '', `/?share=${encoded}`);
    try {
      expect(getStateFromUrl()).toEqual(state);
    } finally {
      window.history.replaceState({}, '', '/');
    }
  });

  it('returns null when no share param is present', () => {
    window.history.replaceState({}, '', '/');
    expect(getStateFromUrl()).toBeNull();
  });
});
