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

/**
 * "Less motion, please", as the operating system asks it.
 *
 * The string is here and not at the call site for the same reason `useLayout`
 * owns the width bands: this app has already had one media query written out by
 * hand in several places and drift apart. `base.css` states the identical query
 * to zero `--motion`, and the two have to keep saying the same thing - a
 * stylesheet that stops animating while JavaScript keeps scrolling smoothly is
 * exactly the split this constant exists to prevent.
 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * True when the device has been told to reduce motion.
 *
 * Deliberately separate from `prefs.reduceMotion`: the switch in Settings is
 * the app's own answer, this is the OS's, and either one is a yes. Anything
 * that moves has to consult both, because the stylesheet already does.
 */
export const usePrefersReducedMotion = (): boolean => useMedia(REDUCED_MOTION_QUERY);
