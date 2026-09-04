/**
 * The update offer.
 *
 * A new worker installs itself and then waits, because swapping the bundle
 * mid-combat is the wrong moment and the browser has no way of knowing that.
 * `registerServiceWorker` hands the app an `apply` and says nothing else; this
 * is where the app decides to ask.
 *
 * It is an offer and not a countdown. Someone three hours into a session should
 * be able to ignore this until they are done, and someone who dismisses it
 * still gets the new build on the next cold start - the worker stays waiting,
 * so nothing is lost by saying no.
 *
 * The box, the message slot, the two controls, the touch floor and the
 * dismissal are `ShellBanner`'s; read the geometry there. What is this file's
 * own is the sentence and how it wraps.
 *
 * ## This banner had never been drawn in a browser by anyone measuring it
 *
 * `apply` is null unless a worker is actually waiting, so no case in the 1660
 * measurements of the audit ever rendered it: `A new version is ready` appears
 * nowhere in the digest, and its height was carried in the notes as *derived
 * from the box* rather than measured. It has been measured now, by mounting the
 * real component into the running app's `<main>` at each width, and the
 * derivation was half right.
 *
 * ## The 18px dismiss, which is what the measurement found
 *
 * The dismiss was a `.chip` holding one glyph with `minHeight: var(--control)`
 * and no `minWidth`, so it measured **18.28×44** at 320, 344, 360, 375, 393 and
 * 430 - under half this project's floor and under WCAG 2.5.8's 24 - sitting
 * 6px from a RELOAD that swaps the running bundle. A thumb aiming at the narrow
 * one and missing hits the wide one, and the wide one is the destructive
 * direction of the two. It is 44×44 now on touch and 34×34 on the cockpit,
 * because `ShellBanner` declares that floor for every control in a banner.
 *
 * ## What the sentence costs, before and after that
 *
 * It is **432.78px** of natural width against a span that gets `viewport −
 * 171.6` (40 of margin, 18 of padding, 2 of border, 12 of gap, 49.63 of RELOAD,
 * 6 of the inner gap, 44 of the dismiss), so it wraps - two `.t-dense` lines were
 * 31.74px and fit inside the 44 the controls hold open, three were 47.61 and
 * four 63.48, which do not. (Measured before the readability ramp; the message
 * is `.t-hint` at 13px/1.4 now, an 18.2px line, and its natural width about
 * 13/11.5 of the figure above - which widths take three lines is not
 * re-measured.) Measured column cost, banner absent → present:
 *
 *   - **66** at 393×852 (738→672) and 430×932 (818→752) - two lines, 58px;
 *   - **70** at 375×667 (553→483), 360×800 (686→616) and 344×882 (768→698) -
 *     three lines, 61.58px;
 *   - **85** at 320×568 (454→369) - four lines, 77.44px;
 *   - **56** at 1180×820 with a mouse (729→673) - one line, 48px.
 *
 * Widening the dismiss to the touch floor is what moved two of those: 375 went
 * from 66 to 70 and 320 from 70 to 85, and 344, 360, 393, 430 and the cockpit
 * did not move at all. That is the price of the fix, paid on the two narrowest
 * phones, by a banner that is only up while a worker is waiting and that any
 * tap on either control takes away. An 18px target beside a RELOAD is not worth
 * 15px of a 320px screen.
 */
import { ShellBanner } from './ShellBanner.tsx';

export function UpdateBanner({ apply }: { apply: (() => void) | null }): React.JSX.Element | null {
  if (apply === null) return null;

  return (
    <ShellBanner
      urgent
      action={{ label: 'RELOAD', onClick: apply }}
      dismissLabel="Dismiss the update notice"
    >
      A new version is ready · it installs when you reload, and your characters are untouched
    </ShellBanner>
  );
}
