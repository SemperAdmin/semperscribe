import { useCallback, useMemo, useState } from 'react';
import { useHydrated } from './useHydrated';

const KEY = 'semperscribe.sidebarCollapsed';

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function write(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // Storage blocked or full: the setting just does not persist.
  }
}

/**
 * Desktop sidebar collapsed state, persisted in localStorage. The first
 * render is always expanded so the static export hydrates cleanly; the
 * stored value is applied right after hydration.
 */
export function useSidebarCollapsed() {
  const hydrated = useHydrated();
  // null until the user toggles; until then the stored value (read once,
  // after hydration) applies. Before hydration it is always expanded.
  const [override, setOverride] = useState<boolean | null>(null);
  const stored = useMemo(() => (hydrated ? read() : false), [hydrated]);
  const collapsed = hydrated ? (override ?? stored) : false;

  const setCollapsed = useCallback((value: boolean) => {
    setOverride(value);
    write(value);
  }, []);

  const toggle = useCallback(() => {
    setOverride(!collapsed);
    write(!collapsed);
  }, [collapsed]);

  return { collapsed, setCollapsed, toggle };
}
