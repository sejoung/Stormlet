import { useCallback, useLayoutEffect, useRef } from 'react';

/** A ref that always holds the latest `value`, for listeners registered only once. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * A function with a stable identity that always calls the latest `callback`. Use it for
 * handlers handed to memoized children or long-lived listeners, never during render.
 */
export function useStableCallback<A extends unknown[], R>(callback: (...args: A) => R) {
  const latest = useLatest(callback);
  return useCallback((...args: A) => latest.current(...args), [latest]);
}
