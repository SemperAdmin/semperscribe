import { useEffect, useRef, type MutableRefObject } from 'react';

/**
 * A ref which always holds the latest value passed in, updated after
 * every commit.
 *
 * For effects which are meant to run on a fixed schedule (once at mount,
 * or when one specific input changes) but need to call the current
 * version of a callback prop or read the current value of another prop.
 * Listing those in the dependency array would change the schedule;
 * omitting them is the exhaustive-deps warning. Reading them through this
 * ref keeps the schedule and the freshness both. React 18 has no stable
 * useEffectEvent, so this is the documented substitute.
 *
 * The ref is written in an effect, not during render, so a render which
 * React discards (StrictMode, a render-phase update) never leaks into it.
 * Declare it before the effect which reads it: effects run in order, so
 * the update lands first in every commit.
 */
export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
