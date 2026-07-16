/**
 * LocalStorage Persistence Utilities
 *
 * The single owner of every localStorage key the app writes. All reads
 * and writes go through this module: values are wrapped in a versioned
 * envelope ({ v, data }) and validated with zod on the way out, so a
 * shape change in a persisted type surfaces as a clean reset instead of
 * a crash or silently stale fields. Pre-envelope payloads (written by
 * older builds) are read transparently.
 */

import { z } from 'zod';
import { SavedLetter } from '@/types';

export const STORAGE_KEYS = {
  savedLetters: 'navalLetters',
  userProfile: 'semperscribe-user-profile',
  disclaimerSeen: 'hasSeenDisclaimer',
  /** P3.5: user-saved clause library */
  customClauses: 'semperscribe-custom-clauses',
} as const;

const CURRENT_VERSION = 1;
const MAX_SAVED_LETTERS = 10;

/**
 * Read and validate a JSON payload. Returns null when the key is
 * absent, unparseable, or fails schema validation (the malformed
 * payload is logged and treated as missing).
 */
export function readStorage<T>(key: string, schema: z.ZodType<T>): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const payload =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'v' in parsed && 'data' in parsed
        ? (parsed as { data: unknown }).data
        : parsed; // legacy pre-envelope payload
    const result = schema.safeParse(payload);
    if (!result.success) {
      console.error(`Discarding malformed localStorage payload for "${key}"`, result.error);
      return null;
    }
    return result.data;
  } catch (error) {
    console.error(`Failed to read localStorage key "${key}"`, error);
    return null;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: CURRENT_VERSION, data: value }));
  } catch (error) {
    console.error(`Failed to write localStorage key "${key}"`, error);
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to remove localStorage key "${key}"`, error);
  }
}

// ---------------------------------------------------------------------------
// Saved letters
// ---------------------------------------------------------------------------

// Structural validation only: SavedLetter carries the whole FormData
// surface, which changes too often to pin field-by-field. The envelope
// fields that the draft list and load path depend on are enforced;
// everything else passes through.
const savedLetterSchema = z.looseObject({
  id: z.string(),
  savedAt: z.string(),
  vias: z.array(z.string()),
  references: z.array(z.string()),
  enclosures: z.array(z.string()),
  copyTos: z.array(z.string()),
  paragraphs: z.array(z.looseObject({})),
});

const savedLettersSchema = z.array(savedLetterSchema);

/**
 * Loads all saved letters from localStorage
 * Returns empty array if no saved letters found or on error
 */
export function loadSavedLetters(): SavedLetter[] {
  const letters = readStorage(STORAGE_KEYS.savedLetters, savedLettersSchema);
  return (letters ?? []) as unknown as SavedLetter[];
}

/**
 * Saves a new letter to localStorage
 * Keeps only the most recent MAX_SAVED_LETTERS (10) letters
 * Returns the updated list of all saved letters
 */
export function saveLetterToStorage(newLetter: SavedLetter, existingSavedLetters: SavedLetter[]): SavedLetter[] {
  const updatedLetters = [newLetter, ...existingSavedLetters].slice(0, MAX_SAVED_LETTERS);
  writeStorage(STORAGE_KEYS.savedLetters, updatedLetters);
  return updatedLetters;
}

export function clearSavedLetters(): void {
  removeStorage(STORAGE_KEYS.savedLetters);
}

/**
 * Finds a saved letter by ID
 * Returns undefined if not found
 */
export function findLetterById(letterId: string, savedLetters: SavedLetter[]): SavedLetter | undefined {
  return savedLetters.find(l => l.id === letterId);
}

// ---------------------------------------------------------------------------
// Disclaimer flag
// ---------------------------------------------------------------------------

// Stored as the raw string 'true' (not JSON) for compatibility with
// the flag older builds wrote.

export function hasSeenDisclaimer(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.disclaimerSeen) === 'true';
  } catch {
    return false;
  }
}

export function markDisclaimerSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.disclaimerSeen, 'true');
  } catch (error) {
    console.error('Failed to persist disclaimer flag', error);
  }
}

export function resetDisclaimer(): void {
  removeStorage(STORAGE_KEYS.disclaimerSeen);
}
