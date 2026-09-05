import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Local state which the component (or user) may set directly, and which
 * re-derives from a source value whenever that source changes identity.
 *
 * Replaces the pattern
 *
 *   const [flag, setFlag] = useState(false);
 *   useEffect(() => { setFlag(derive(source)); }, [source]);
 *
 * with the same observable behaviour minus the post-commit re-render and
 * the first-paint flash: the re-derivation happens during the render in
 * which the source changed, and the initial value is derived immediately
 * rather than one commit later. This is React's documented "storing
 * information from previous renders" technique.
 *
 * `reconcile(source, prev)` receives the new source and the current state
 * (undefined on the first render) and returns the next state. A pure
 * mirror takes only `source`; a monotonic value such as "rows visible"
 * also reads `prev`. Source comes first so TypeScript infers the state
 * type from the callback's return even when `prev` is omitted.
 *
 * Identity, not deep equality, is what triggers reconciliation, matching
 * the dependency semantics of the effect it replaces.
 */
export function useSyncedState<T, S>(
  source: T,
  reconcile: (source: T, prev: S | undefined) => S,
): [S, Dispatch<SetStateAction<S>>] {
  const [state, setState] = useState<S>(() => reconcile(source, undefined));
  const [prevSource, setPrevSource] = useState<T>(source);
  if (source !== prevSource) {
    setPrevSource(source);
    setState(prev => reconcile(source, prev));
  }
  return [state, setState];
}

/** The common "any entry has text" derivation shared by the list sections. */
export function anyNonBlank(items: readonly string[]): boolean {
  return items.some(item => item.trim() !== '');
}

/**
 * Runs `apply(source, prev)` during the render in which `source` changes
 * identity, and once on the first render with `prev` undefined.
 *
 * Replaces the pattern
 *
 *   useEffect(() => { if (loaded) setOther(derive()); }, [loaded]);
 *
 * where the state being written belongs to the same component but is
 * not the state `useSyncedState` would own (several setters, or a shared
 * form object). `apply` may only call this component's own state
 * setters and pure reads: React re-runs the component immediately after
 * a render-phase update, so nothing else is safe there. Side effects
 * which touch the outside world (storage, the URL, timers) stay in a
 * `useEffect`.
 */
export function useSyncedUpdate<T>(source: T, apply: (source: T, prev: T | undefined) => void): void {
  const [prev, setPrev] = useState<{ value: T } | null>(null);
  if (prev === null || prev.value !== source) {
    setPrev({ value: source });
    apply(source, prev === null ? undefined : prev.value);
  }
}
