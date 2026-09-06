/**
 * SAVE, which is the one button on this screen that must not lie.
 *
 * The wireframe puts SAVE in the bottom bar, and the obvious reading of it -
 * "press this or lose your evening" - is false in this app and has been since
 * campaigns moved into IndexedDB. `gmStore` writes the active campaign 400 ms
 * after the last change, again on `pagehide`, and again when the tab is
 * hidden. A sheet that implied the GM had to press anything would be teaching
 * them to distrust the thing that is actually keeping their table.
 *
 * So this sheet does three things, in this order, and each one is a fact it
 * can vouch for.
 *
 * **It makes the stamp true before it prints it.** `flushGm()` on mount, and
 * nothing is stated until it resolves. Without that the sheet would read the
 * `updatedAt` of the write *before* the change the GM just made - up to 400 ms
 * of debounce behind them - and stamp it as though it were current.
 *
 * **It says when the campaign last reached the disk**, through
 * `activeCampaign.updatedAt`. That field is not "when the record changed": it
 * is written by `gather()` and put into `campaigns` **only inside
 * `putCampaign`'s success path**, so it is precisely the moment a write
 * landed. `describeAge` is the party board's own phrasing, so the two screens
 * that say how long ago something happened say it the same way.
 *
 * **It surfaces `writeError` instead of the stamp, never beside it.** The
 * store sets that field whenever a write throws, and since this commit it also
 * sets it when the very first campaign of a device could not be written - the
 * one path that used to fail in silence, and the one where this sheet would
 * otherwise have printed "already on this device, just now" over a write that
 * threw.
 *
 * **And the retry says what it did.** TRY AGAIN here was a bare
 * `void flushGm()` with no busy state and no result: on a failure that a flush
 * cannot fix - a delete that threw, a disk that could not be read - pressing it
 * produced no visible response of any kind, which is the same button as one
 * that is not wired at all. It goes through `retryGm` now, which does the right
 * thing per failure; it is drawn only when `writeRetry` says there is something
 * a retry can do, because otherwise the store's sentence already names what
 * does help; and it reports a retry that failed rather than settling back into
 * the same panel.
 *
 * ## The copy, and the way back in
 *
 * `.dhcampaign` is a real backup of the whole table - the plan, Fear, every
 * countdown and the party sheets as they arrived - and this build reads one back
 * in. That is the third block, `TakeIn`, and it is on this sheet rather than in
 * MENU or in Settings because SAVE is where the format is named at all: the
 * thing that writes a file and the thing that reads one belong within a thumb's
 * travel of each other, and the paragraph that used to sit here saying no such
 * verb existed was the sentence a GM would otherwise discover on the day they
 * needed it.
 *
 * The two questions that paragraph deferred are answered as rules, and neither
 * of them is answered on this screen. **An id already on this device** is not
 * compared and not judged by a clock: `addCampaign` hands the key to IndexedDB,
 * a taken key lands the arrival beside the record that holds it under a fresh
 * UUID and a minted name, and there is no overwrite verb on the path at all -
 * so the worst a mistake costs is two campaigns in MENU and one armed REMOVE.
 * **Party sheets meeting newer copies of the same people** is a prohibition
 * rather than a policy: an imported campaign cannot reach the `characters`
 * store, so a row is never refreshed from the local library and never written
 * into it. `campaignImport.ts` argues both at length; this sheet only prints
 * them.
 *
 * ## Ergonomics, 393x852
 *
 * A bottom sheet: it opens from a bar button at y 758-818 and every control in
 * it stays inside the same thumb arc. The inner column is **363px**, not the
 * "365" that `393 - 28 of padding` gives: this sheet draws inside `GmSheet`'s
 * panel - `Gm.tsx` mounts all four sheets there - which is border-box with a
 * 1px border (`GmSheet.tsx`). 363 is measured in Chrome at 393x852 and
 * recorded in `ShowSheet.tsx`, the sibling sheet in the same panel at the same
 * `padding: 14`. The two sentences run about 60 characters a line at `.t-body`,
 * inside this repo's 62ch reading maximum. Every button here - TRY AGAIN, SAVE
 * A COPY, and the third block's - is `minHeight: var(--tap)` = 44 and full width
 * of that column, because a sheet whose verbs are all the same size and all in
 * the same place never makes the thumb aim. Everything else - the stamp, the
 * file name, the paragraphs, the preview - is read and not touched.
 *
 * Three blocks now rather than two, and the sheet root is `scroll stack` so the
 * third one may grow: a preview of two same-id records with one warning per
 * dropped party row can run past a screen. Wrapping rather than shrinking is the
 * answer, and the cost - a verb below a scroll the thumb has travelled - is what
 * naming things before writing them is worth. That growth is owed a measured
 * pass in Chrome at 393x852 before this is called finished.
 */
import { useEffect, useState } from 'react';
import type { SaveResult, SaveRoute } from '../../transfer/fileIo.ts';
import { campaignFileName } from '../../transfer/campaignFile.ts';
import { useRetry } from '../shared/useRetry.ts';
import { describeAge } from './party.ts';
import { TakeIn } from './TakeIn.tsx';
import { flushGm, retryGm, useGm } from './gmStore.ts';

/** Where the file went, in the words of the route that took it. */
const WHERE: Record<SaveRoute, string> = {
  'file-system': 'where you pointed the picker',
  share: 'wherever the share sheet sent it',
  download: 'with your downloads',
};

/**
 * What to say about an export that has finished.
 *
 * The word "Saved" appears on exactly one branch. `SaveResult.ok` is the only
 * thing that means a file exists, and a cancelled picker is not a failure and
 * not a save either - it is nothing having happened, which is its own sentence.
 */
function describeSave(result: SaveResult): { failed: boolean; text: string } {
  if (result.ok) {
    return {
      failed: false,
      text:
        result.route === null
          ? `Saved as ${result.fileName}.`
          : `Saved as ${result.fileName}, ${WHERE[result.route]}.`,
    };
  }
  if (result.cancelled) {
    return { failed: true, text: 'You closed the file picker, so no copy was made. Nothing else changed.' };
  }
  return {
    failed: true,
    text: result.reason ?? 'The copy could not be written, and the browser did not say why.',
  };
}

export function SaveSheet(): React.JSX.Element {
  const campaigns = useGm((s) => s.campaigns);
  const activeId = useGm((s) => s.activeCampaignId);
  const writeError = useGm((s) => s.writeError);
  const writeRetry = useGm((s) => s.writeRetry);
  const exportActive = useGm((s) => s.exportActiveCampaign);
  const [settled, setSettled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  /*
   * The retry's busy state, its unmount guard and whether the last one landed.
   * All three used to be written out here; they are `useRetry`'s now, because
   * this sheet, the GM strip and the shell's block each had a copy and the
   * guard is the one of the three that is easy to write wrongly.
   */
  const { retrying, failedAgain, again } = useRetry(retryGm);

  /*
   * Flush first, then speak. `alive` is not ceremony: this sheet is unmounted
   * the moment it is closed, and a `setState` after that is a warning in the
   * console of every test that opens and closes it.
   */
  useEffect(() => {
    let alive = true;
    void flushGm().then(() => {
      if (alive) setSettled(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const active = campaigns.find((c) => c.id === activeId) ?? null;
  const saved = result === null ? null : describeSave(result);

  const copy = (): void => {
    setBusy(true);
    void exportActive().then(
      (outcome) => {
        setResult(outcome);
        setBusy(false);
      },
      (error: unknown) => {
        // `exportActiveCampaign` promises never to throw. If that promise is
        // ever broken, the sheet says so rather than leaving SAVE A COPY
        // spinning on a rejection nobody catches.
        setResult({
          ok: false,
          route: null,
          fileName: '',
          cancelled: false,
          reason: `The copy could not be written (${error instanceof Error ? error.message : String(error)}).`,
        });
        setBusy(false);
      },
    );
  };

  return (
    <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 14, padding: 14 }}>
      {writeError !== null ? (
        <div
          role="alert"
          className="panel stack"
          style={{ flex: 'none', gap: 9, padding: 12, borderColor: 'var(--damage)' }}
        >
          <span className="t-label" style={{ color: 'var(--damage)' }}>
            NOT ON THIS DEVICE
          </span>
          <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
            {writeError}
          </p>
          {writeRetry !== null && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={again}
              disabled={retrying}
              style={{ minHeight: 'var(--tap)' }}
            >
              {retrying ? 'TRYING…' : 'TRY AGAIN'}
            </button>
          )}
          {failedAgain && (
            <p className="t-hint" style={{ margin: 0, color: 'var(--damage)', maxWidth: '62ch' }}>
              That try did not land either. Nothing above has changed.
            </p>
          )}
        </div>
      ) : active === null ? (
        <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
          There is no campaign open yet. This device is still being read; nothing has been
          written and nothing has been lost.
        </p>
      ) : (
        <div className="panel stack" style={{ flex: 'none', gap: 9, padding: 12 }}>
          <span className="t-label" style={{ color: 'var(--sage)' }}>
            ALREADY ON THIS DEVICE
          </span>
          {settled ? (
            <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
              Everything on this screen is on this device. The last change reached the disk{' '}
              {describeAge(active.updatedAt)}.
            </p>
          ) : (
            <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
              Making sure your last change has reached this device…
            </p>
          )}
          <p className="t-hint" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
            You never have to press anything for that to be true. The campaign is written 400 ms
            after you stop changing it, and again the moment this tab goes away. SAVE is here to
            tell you where it is, and to hand you a copy.
          </p>
        </div>
      )}

      <div className="stack" style={{ flex: 'none', gap: 9 }}>
        <span className="t-label">A COPY TO KEEP</span>
        <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
          {active === null
            ? 'A campaign file holds the whole table: the night’s plan, Fear, every countdown, and the party sheets as they arrived.'
            : `${campaignFileName(active)} holds the whole table: the night’s plan, Fear, every countdown, and the party sheets as they arrived.`}
        </p>
        <button
          type="button"
          className="btn"
          disabled={busy || active === null}
          onClick={copy}
          style={{ minHeight: 'var(--tap)' }}
        >
          {busy ? 'WRITING THE COPY…' : 'SAVE A COPY'}
        </button>
        {saved !== null && (
          <p
            role="status"
            className="t-body"
            style={{ margin: 0, maxWidth: '62ch', color: saved.failed ? 'var(--stress)' : 'var(--sage)' }}
          >
            {saved.text}
          </p>
        )}
      </div>

      <TakeIn />
    </div>
  );
}
