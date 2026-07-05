/**
 * Storage module characterization: versioned envelope round-trip,
 * legacy (pre-envelope) payload compatibility, malformed-payload
 * rejection, the 10-draft cap, and the disclaimer flag.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  STORAGE_KEYS,
  readStorage,
  writeStorage,
  removeStorage,
  loadSavedLetters,
  saveLetterToStorage,
  clearSavedLetters,
  hasSeenDisclaimer,
  markDisclaimerSeen,
  resetDisclaimer,
} from '@/lib/storage-utils';
import type { SavedLetter } from '@/types';

function makeLetter(id: string): SavedLetter {
  return {
    id,
    savedAt: '2026-07-05T00:00:00.000Z',
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
    paragraphs: [],
    documentType: 'basic',
    subj: `LETTER ${id}`,
  } as unknown as SavedLetter;
}

beforeEach(() => {
  localStorage.clear();
});

describe('readStorage / writeStorage', () => {
  const schema = z.object({ a: z.string() });

  it('round-trips a value through the versioned envelope', () => {
    writeStorage('k', { a: 'hello' });
    expect(JSON.parse(localStorage.getItem('k')!)).toEqual({ v: 1, data: { a: 'hello' } });
    expect(readStorage('k', schema)).toEqual({ a: 'hello' });
  });

  it('reads a legacy pre-envelope payload transparently', () => {
    localStorage.setItem('k', JSON.stringify({ a: 'legacy' }));
    expect(readStorage('k', schema)).toEqual({ a: 'legacy' });
  });

  it('returns null for a missing key', () => {
    expect(readStorage('nope', schema)).toBeNull();
  });

  it('discards unparseable JSON instead of throwing', () => {
    localStorage.setItem('k', '{not json');
    expect(readStorage('k', schema)).toBeNull();
  });

  it('discards a payload that fails schema validation', () => {
    localStorage.setItem('k', JSON.stringify({ a: 42 }));
    expect(readStorage('k', schema)).toBeNull();
  });

  it('removeStorage deletes the key', () => {
    writeStorage('k', { a: 'x' });
    removeStorage('k');
    expect(localStorage.getItem('k')).toBeNull();
  });
});

describe('saved letters', () => {
  it('saves and reloads letters', () => {
    const updated = saveLetterToStorage(makeLetter('1'), []);
    expect(updated).toHaveLength(1);
    const loaded = loadSavedLetters();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('1');
    expect((loaded[0] as { subj?: string }).subj).toBe('LETTER 1');
  });

  it('reads a legacy raw-array payload written by older builds', () => {
    localStorage.setItem(STORAGE_KEYS.savedLetters, JSON.stringify([makeLetter('legacy')]));
    const loaded = loadSavedLetters();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('legacy');
  });

  it('caps the list at 10, newest first', () => {
    let letters: SavedLetter[] = [];
    for (let i = 1; i <= 12; i++) {
      letters = saveLetterToStorage(makeLetter(String(i)), letters);
    }
    expect(letters).toHaveLength(10);
    expect(letters[0].id).toBe('12');
    expect(loadSavedLetters()).toHaveLength(10);
  });

  it('returns [] for a corrupted letters payload', () => {
    localStorage.setItem(STORAGE_KEYS.savedLetters, JSON.stringify([{ id: 123 }]));
    expect(loadSavedLetters()).toEqual([]);
  });

  it('clearSavedLetters empties storage', () => {
    saveLetterToStorage(makeLetter('1'), []);
    clearSavedLetters();
    expect(loadSavedLetters()).toEqual([]);
  });
});

describe('disclaimer flag', () => {
  it('is unseen by default, seen after mark, unseen after reset', () => {
    expect(hasSeenDisclaimer()).toBe(false);
    markDisclaimerSeen();
    expect(hasSeenDisclaimer()).toBe(true);
    // stored as the raw legacy string, not an envelope
    expect(localStorage.getItem(STORAGE_KEYS.disclaimerSeen)).toBe('true');
    resetDisclaimer();
    expect(hasSeenDisclaimer()).toBe(false);
  });

  it('honors the legacy raw flag written by older builds', () => {
    localStorage.setItem(STORAGE_KEYS.disclaimerSeen, 'true');
    expect(hasSeenDisclaimer()).toBe(true);
  });
});
