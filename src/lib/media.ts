import { useCallback, useSyncExternalStore } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';

/**
 * Subscribes to a media query via useSyncExternalStore rather than
 * useState + useEffect. A matchMedia list is an external store, and reading
 * it that way avoids the synchronous setState-in-effect that re-syncing a
 * changed query would otherwise need.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof matchMedia !== 'function') return () => {};
      const list = matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => (typeof matchMedia === 'function' ? matchMedia(query).matches : false),
    [query]
  );

  // Server snapshot: no viewport to measure, so assume the wide layout.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
