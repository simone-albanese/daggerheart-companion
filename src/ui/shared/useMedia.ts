import { useSyncExternalStore } from 'react';

/**
 * Media query as state. `useSyncExternalStore` rather than an effect so the
 * first paint already knows which layout it is in - the phone and desktop Play
 * screens are different component trees, and flashing one before the other is
 * exactly the kind of motion this app avoids.
 */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
