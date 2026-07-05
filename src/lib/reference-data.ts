import type { Unit } from './units';
import type { Ssic } from './ssic';
import type { DictionaryEntry } from './military-dictionary';

// The reference tables (units ~690 KB, SSIC ~190 KB, dictionary ~148 KB,
// wordset ~100 KB) are loaded on demand so they stay out of the
// first-load bundle. Each loader caches its promise; the synchronous
// snapshots are empty until the corresponding loader resolves.

let unitsPromise: Promise<Unit[]> | null = null;
let unitsSnapshot: Unit[] = [];

export function loadUnits(): Promise<Unit[]> {
  unitsPromise ??= import('./units').then(m => {
    unitsSnapshot = m.UNITS;
    return m.UNITS;
  });
  return unitsPromise;
}

/**
 * Synchronous view of the unit table; empty until loadUnits() resolves.
 * Callers that need a guaranteed-populated table must await loadUnits()
 * first (useUserProfile does this before reporting loaded).
 */
export function getLoadedUnits(): Unit[] {
  return unitsSnapshot;
}

let ssicsPromise: Promise<Ssic[]> | null = null;

export function loadSsics(): Promise<Ssic[]> {
  ssicsPromise ??= import('./ssic').then(m => m.SSICS);
  return ssicsPromise;
}

let dictionaryPromise: Promise<DictionaryEntry[]> | null = null;

export function loadMilitaryDictionary(): Promise<DictionaryEntry[]> {
  dictionaryPromise ??= import('./military-dictionary').then(m => m.militaryDictionary);
  return dictionaryPromise;
}

let wordSetPromise: Promise<Set<string>> | null = null;

export function loadMilitaryWordSet(): Promise<Set<string>> {
  wordSetPromise ??= import('./military-wordset').then(m => m.getMilitaryWordSet());
  return wordSetPromise;
}
