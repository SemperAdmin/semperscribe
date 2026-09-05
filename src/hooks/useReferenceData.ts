'use client';

import { useEffect, useState } from 'react';
import type { Unit } from '@/lib/units';
import type { Ssic } from '@/lib/ssic';
import type { DictionaryEntry } from '@/lib/military-dictionary';
import { loadUnits, loadSsics, loadMilitaryDictionary } from '@/lib/reference-data';

/**
 * A reference table, fetched through its cached loader. `enabled` false
 * defers the fetch (and reports loading) until the caller has a use for
 * the data; the loader itself caches, so a later true costs one import.
 */
function useLazyList<T>(load: () => Promise<T[]>, enabled: boolean): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    load().then(list => {
      if (!cancelled) {
        setData(list);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
    // load is a module-level cached loader with stable identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { data, loading };
}

export function useUnits(): { units: Unit[]; loading: boolean } {
  const { data, loading } = useLazyList(loadUnits, true);
  return { units: data, loading };
}

export function useSsics(): { ssics: Ssic[]; loading: boolean } {
  const { data, loading } = useLazyList(loadSsics, true);
  return { ssics: data, loading };
}

/**
 * The military dictionary. Pass `enabled` false to hold the fetch until
 * there is something to look up (page.tsx waits for body text).
 */
export function useMilitaryDictionary(enabled = true): { dictionary: DictionaryEntry[]; loading: boolean } {
  const { data, loading } = useLazyList(loadMilitaryDictionary, enabled);
  return { dictionary: data, loading };
}
