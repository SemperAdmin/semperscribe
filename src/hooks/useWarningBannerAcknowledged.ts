import { useCallback, useMemo, useState } from 'react';
import { useHydrated } from './useHydrated';

const KEY = 'semperscribe.warningBannerAcknowledged';

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(value: boolean) {
  try {
    if (value) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the acknowledgment lasts until reload.
  }
}

/**
 * Whether the top warning banner was acknowledged in this browser
 * session. sessionStorage, not localStorage: a new browser session on a
 * shared workstation shows the full warning again. The first render is
 * always unacknowledged so the static export hydrates with the banner.
 */
export function useWarningBannerAcknowledged() {
  const hydrated = useHydrated();
  const [override, setOverride] = useState<boolean | null>(null);
  const stored = useMemo(() => (hydrated ? read() : false), [hydrated]);
  const acknowledged = hydrated ? (override ?? stored) : false;

  const acknowledge = useCallback(() => {
    setOverride(true);
    write(true);
  }, []);

  const restore = useCallback(() => {
    setOverride(false);
    write(false);
  }, []);

  return { acknowledged, acknowledge, restore };
}
