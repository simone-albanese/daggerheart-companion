/**
 * The GM store's failure, published where the shell can read it.
 *
 * `gmStore` sets `writeError` when a campaign will not reach the disk, and
 * until this file existed the GM screen and SAVE were the only two things that
 * drew it. Both are inside the GM section. A GM who taps MENU → PLAY to look at
 * a player's sheet - or whose phone is on Cards because someone asked what a
 * card does - takes the sentence off the screen with them, and the evening's
 * fight is in one tab with nothing anywhere saying so. Every other failure in
 * this app that costs work is a strip at the top of `<main>` on every screen:
 * `App.tsx::UnsavedWork` for the character store, the storage alert, the
 * quarantine alert. This is the one that was not.
 *
 * ## Why a module of its own, and not a field on `useApp`
 *
 * The shell must not import `gmStore`. That module starts reading IndexedDB on
 * the last line of the file - deliberately, so that the GM chunk arriving *is*
 * the hydration starting - and it is pulled in by `lazy()` exactly when the GM
 * screen is opened. A static import from `App.tsx` would put the whole GM
 * chunk, the bestiary index and a campaign read into the first paint of a
 * player who never opens GM at all.
 *
 * So the direction is inverted: the shell owns a slot, and the GM store fills
 * it. This file imports nothing but zustand, so `App.tsx` can read it for
 * free, and it is `gmStore` that knows the shell exists rather than the other
 * way round.
 *
 * ## What is in the slot
 *
 * The store's own sentence, never a paraphrase of it - that rule is `Gm.tsx`'s
 * and the reason is the same here: one of these failures is about a campaign
 * that is **not** the one on the board, and it names that campaign because its
 * subject is not on screen. A shell-level rewording would be the one place
 * guaranteed to get that wrong.
 *
 * `retry` is the store's `writeRetry`, carried through rather than reduced to a
 * boolean, because a shell that only knew "there is a retry" would be one
 * refactor away from calling `flushGm` on a failure a flush cannot touch. It is
 * kept beside `tryAgain`, which is `retryGm` itself: the dispatch on `'write'`
 * against `'read'` stays inside the store, where the failure is known, and the
 * shell decides only whether there is a button to draw at all.
 */
import { create } from 'zustand';

/**
 * What retrying would do about a campaign failure, and the absence of an answer.
 *
 * Declared here rather than in `gmStore`, which is where it belongs
 * conceptually, for the one reason this whole file exists: nothing in the shell
 * may import the GM chunk, and a second hand-written copy of the union in the
 * shell is exactly the pair that drifts. `gmStore` aliases its `WriteRetry` to
 * this, so there is one declaration and the store keeps its own name for it.
 */
export type CampaignRetry = 'write' | 'read' | null;

export interface CampaignAlert {
  /** The store's sentence, ready to render. Never rewritten here. */
  message: string;
  /** What a retry would actually do, and null when the answer is nothing. */
  retry: CampaignRetry;
  /**
   * Run that retry. Resolves true when the failure is gone.
   *
   * `gmStore` hands its own `retryGm` in, so the choice between a flush and a
   * second read is made by the only code that can make it correctly.
   */
  tryAgain: () => Promise<boolean>;
}

interface CampaignAlertState {
  /** Null while every campaign write is landing, which is almost always. */
  alert: CampaignAlert | null;
}

export const useCampaignAlert = create<CampaignAlertState>(() => ({ alert: null }));

/**
 * Put a failure in the slot, or take one out.
 *
 * The null-to-null case returns without a `setState` so that a store which has
 * never failed - the overwhelming majority of launches - never notifies a
 * subscriber and never re-renders the shell.
 */
export function publishCampaignAlert(alert: CampaignAlert | null): void {
  if (alert === null && useCampaignAlert.getState().alert === null) return;
  useCampaignAlert.setState({ alert });
}
