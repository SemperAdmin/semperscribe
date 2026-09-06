import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/**
 * False during server rendering and the hydration render, true from the
 * first client render after hydration onward.
 *
 * Replaces the pattern
 *
 *   const [mounted, setMounted] = useState(false);
 *   useEffect(() => setMounted(true), []);
 *
 * with the same two-phase output and no post-commit setState. React
 * reads the server snapshot while hydrating so the markup matches the
 * static export, then re-renders with the client snapshot. Use it to gate
 * anything whose value only exists in the browser: theme, matchMedia,
 * localStorage, the install prompt.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
