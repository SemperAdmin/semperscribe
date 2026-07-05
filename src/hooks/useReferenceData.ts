'use client';

import { useEffect, useState } from 'react';
import type { Unit } from '@/lib/units';
import type { Ssic } from '@/lib/ssic';
import type { DictionaryEntry } from '@/lib/military-dictionary';
import { loadUnits, loadSsics, loadMilitaryDictionary } from '@/lib/reference-data';

function useLazyList<T>(load: () => Promise<T[]>): { data: T[]; loading: boolean } {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  return { data, loading };
}

export function useUnits(): { units: Unit[]; loading: boolean } {
  const { data, loading } = useLazyList(loadUnits);
  return { units: data, loading };
}

export function useSsics(): { ssics: Ssic[]; loading: boolean } {
  const { data, loading } = useLazyList(loadSsics);
  return { ssics: data, loading };
}

export function useMilitaryDictionary(): { dictionary: DictionaryEntry[]; loading: boolean } {
  const { data, loading } = useLazyList(loadMilitaryDictionary);
  return { dictionary: data, loading };
}
