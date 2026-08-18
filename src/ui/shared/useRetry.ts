/**
 * TRY AGAIN, and the two things every copy of it kept getting wrong.
 *
 * Three surfaces in this app draw a retry over the same campaign failure: the
 * strip on the GM screen, the panel inside SAVE, and - since the failure
 * started being published to the shell - the block at the top of `<main>` on
 * every other screen. They look different on purpose. The GM strip is a chip
 * beside a sentence, SAVE's is a full-width primary button in a sheet whose
 * whole job is to say where the campaign is, and the shell block is a chip
 * under a heading that has to name the section it came from. What is identical
 * in all three is the *mechanics*, and those had been written out three times.
 *
 * **A retry that works unmounts its own surface.** Clearing `writeError` is
 * what takes the strip off the screen, and the store's `setState` runs inside
 * the write's success path - so the surface is gone before the promise
 * resolves, and the callback that wants to report the result is running against
 * a component that no longer exists. React answers that with a console warning
 * in every test that opens and closes one. So the guard has to outlive the
 * callback and has to be cleared by the unmount, which makes it a ref with an
 * effect rather than a local. The first draft of the GM strip declared
 * `let alive = true` inside the handler, where nothing could ever set it false,
 * and the comment beside it described a guard the code did not have.
 *
 * **A retry that fails has to say so.** On success the surface disappears,
 * which is visible; on failure it used to settle back into exactly the state it
 * was in, so a retry that failed and a button that was never wired looked the
 * same. `failedAgain` is what each surface prints its own sentence from.
 *
 * The `alive` ref is re-armed in the effect body rather than only at its
 * declaration. Under React's double-invoked effects the mount runs
 * effect → cleanup → effect, so a ref that is only ever set true at
 * declaration time is false for the entire life of the component and the retry
 * silently reports nothing.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Retry {
  /** True while an attempt is in flight. The button says TRYING… and is off. */
  retrying: boolean;
  /** True when the last attempt came back with the failure still there. */
  failedAgain: boolean;
  /** Start one. Safe to call on a surface that is about to be unmounted. */
  again: () => void;
}

/**
 * @param attempt what to run, resolving true when the failure is gone. A
 * rejection is a failure that did not land, which is what `.finally` plus a
 * re-read of the store amounted to in all three copies of this.
 */
export function useRetry(attempt: () => Promise<boolean>): Retry {
  const [retrying, setRetrying] = useState(false);
  const [failedAgain, setFailedAgain] = useState(false);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const again = useCallback(() => {
    setFailedAgain(false);
    setRetrying(true);
    const settle = (landed: boolean): void => {
      if (!alive.current) return;
      setRetrying(false);
      setFailedAgain(!landed);
    };
    void attempt().then(settle, () => settle(false));
  }, [attempt]);

  return { retrying, failedAgain, again };
}
