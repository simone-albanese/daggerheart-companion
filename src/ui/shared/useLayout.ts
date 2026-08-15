/**
 * One definition of "how wide are we", for the whole app.
 *
 * This exists because the alternative was tried and broke: each screen called
 * `useMedia` with its own literal, some said 719px and some said 860px, and in
 * the 140px band between them the app disagreed with itself - the shell drew
 * desktop chrome while Build, GM and Settings drew their phone layouts. An iPad
 * mini in portrait is 744px, right in the middle of it.
 *
 * The bands are chosen from what the content needs, not from device names:
 *
 *   phone    below 720   one column, a tab bar in the thumb arc, the loadout
 *                        as rows because a card at this width is a header and
 *                        a footer with the rules text squeezed to nothing
 *   tablet   720-1179    two columns; still no room for the three-column
 *                        cockpit, but enough for the sheet beside the cards
 *   desktop  1180+       the full three-column Play layout
 */
import { useMedia } from './useMedia.ts';

export type Layout = 'phone' | 'tablet' | 'desktop';

export const PHONE_MAX = 719;
export const TABLET_MAX = 1179;

export const PHONE_QUERY = `(max-width: ${PHONE_MAX}px)`;
export const TABLET_QUERY = `(max-width: ${TABLET_MAX}px)`;

export function useLayout(): Layout {
  const phone = useMedia(PHONE_QUERY);
  const narrow = useMedia(TABLET_QUERY);
  if (phone) return 'phone';
  return narrow ? 'tablet' : 'desktop';
}

/**
 * True when the viewport is a phone.
 *
 * Most screens only need this much. Prefer it over a bare `useMedia` with a
 * literal: a screen that invents its own breakpoint is how the bands drifted
 * apart in the first place.
 */
export const useIsPhone = (): boolean => useMedia(PHONE_QUERY);

/** True for phone *and* tablet - anything that is not the full cockpit. */
export const useIsNarrow = (): boolean => useMedia(TABLET_QUERY);
