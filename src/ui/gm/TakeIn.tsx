/**
 * A campaign file, back into this device. The door, and only the door.
 *
 * `campaignFile.ts` reads the bytes, `campaignImport.ts` decides what becomes of
 * the record, and this file does the three things neither of those can: it picks
 * the file, it orders the steps against the store, and it says every sentence.
 * It adds nothing to `gmStore.ts` - it reaches the store through `useGm`,
 * `useGm.setState`, `flushGm`, `hydrateGm` and the `switchCampaign` action, all
 * of which were already public.
 *
 * ## The order of operations, and the race each step kills
 *
 *   1  `await hydrateGm()`   2  `pickFile`   3  `parseCampaignFile`
 *   4  `previewCampaignImport`   -- the GM reads, then presses BRING IT IN --
 *   5  `await flushGm()`   6  `applyCampaignImport`   7  `setState` + `switchCampaign`
 *
 * **1 is first** because hydration's own `setState({ campaigns, … })` would
 * otherwise land *after* step 7 and drop the import out of the list, and because
 * its `if (dirty)` branch would push `REPLACED_ON_LOAD` - a sentence about a tap
 * nobody made - over an import nobody asked it about. It is memoized, so a
 * second caller joins the first and this costs nothing on the ordinary path.
 *
 * **5 is before 6** because a debounced write still holding the *old* board must
 * land before anything else runs. It cannot touch the arriving record:
 * `writeActive` gathers `activeCampaignId` only, and `writeAside` writes only
 * queued ids.
 *
 * **6 is an `add` decided against `state.campaigns` as well as against the
 * disk, and that is what makes `aside` a non-issue.** `aside` receives ids only
 * from `patchCampaign` and from `hydrateGm`'s repair loop, both for records
 * already in `state.campaigns`; `applyCampaignImport` refuses to offer an id
 * that is in that list, so a landed id cannot be queued there. That argument is
 * a property of add-only *plus* the memory gate - see `campaignImport.ts` for
 * both, and for what breaks the day an overwrite verb exists.
 *
 * **7 is last, so a tab that dies mid-import can leave a whole campaign but
 * never a false claim.** One `add` in one transaction either commits or does
 * not; "half an import" is not a reachable state on the disk. What *is*
 * reachable is a sentence printed for a write that never committed, so the
 * sentence goes after the read-back: the worst outcome of a `pagehide` or a
 * service-worker reload at any instant is a whole campaign that turns up in the
 * list next launch without an announcement.
 *
 * **`switchCampaign` is called rather than hand-rolled, and what makes that
 * safe lives in `campaignImport.ts`, not here.** Its early return on `id ===
 * activeCampaignId` would be fatal on this path - the board would never move,
 * the green sentence would claim it had, and the next flush would gather the
 * pre-import board straight over the record that just arrived. It cannot fire
 * only because the landed id is never an id in `state.campaigns`, which is a
 * decision `applyCampaignImport` makes and could stop making. So step 7 does
 * not rest on it: the prepend below drops any row carrying the landed id before
 * putting the arriving record at the front, so the list cannot hold the same id
 * twice whatever happens upstream. Do not "simplify" the prepend back into a
 * blind one, and do not let a future verb write onto an id already on the
 * device. The record goes into `campaigns` *first* because `switchCampaign`
 * looks the target up in that list and does nothing when it is not there.
 *
 * ## WHAT STEP 7 STILL COSTS, AND WHY IT IS NOT PAID HERE
 *
 * "Never a false claim" above is about the *arriving* campaign. It is not a
 * promise about the one being left. `switchCampaign` calls `flushGm` and then
 * `spread`s the target over every live field, and `writeActive` updates
 * `state.campaigns` only inside its `try` *after* `putCampaign` resolves - so on
 * an evening when writes are failing (a full disk; an older build refusing a
 * record a newer one wrote, which is `StaleBuildError` from `putCampaign` on an
 * id `addCampaign` would have accepted) the flush at step 5 does not land, the
 * live board is the only copy of it, and step 7 replaces it. Nothing on the
 * glass says so; the import's own sentence is green.
 *
 * That discard is `switchCampaign`'s, not this door's: MENU's campaign row
 * drives the same line on `main` today, a bare `switchCampaign` with no import
 * at all loses the same board, and `createCampaign` loses it too. It is written
 * up where it lives - the KNOWN DEFECT docblock on `switchCampaign` in
 * `gmStore.ts`, which names both functions - and it is owed a fix there, where
 * MENU and NEW CAMPAIGN are covered too, not here, where fixing it would leave
 * the other entrances open. What this door adds meanwhile is one more entrance,
 * so do not read the green sentence as evidence the board that was on screen a
 * moment ago reached the disk.
 *
 * ## Ergonomics, 393x852
 *
 * A third block in `SaveSheet`'s 363px column, `gap: 9`, matching the two above
 * it. Reading above, touching below: everything that decides whether the thumb
 * should travel at all sits above the verb - what the door does, why it is shut
 * when it is shut, and what is in the file - and only what happened *after* a
 * press sits under it. Every button is a full-width `.btn` at `minHeight: var(--tap)` = 44, so
 * nothing here makes the thumb aim. The sheet's root is already
 * `className="scroll stack"`, so the preview can grow - a state-5 preview of two
 * records with one warning per dropped party row can run past a screen, and
 * wrapping rather than shrinking is the answer. The verb then sits below a
 * scroll the thumb has travelled, which is the cost of naming things before
 * writing them and is owed a measured pass in Chrome.
 */
import { useEffect, useRef, useState } from 'react';
import { CAMPAIGN_SCHEMA_VERSION } from '../../../shared/campaigns.ts';
import { CAMPAIGN_EXTENSION, parseCampaignFile } from '../../transfer/campaignFile.ts';
import { ImportError, pickFile } from '../../transfer/fileIo.ts';
import { addCampaign, getCampaign } from '../../store/campaigns.ts';
import {
  applyCampaignImport,
  previewCampaignImport,
  type CampaignImportOutcome,
  type CampaignImportPreview,
} from '../../store/campaignImport.ts';
import { CAMPAIGN_NAMES, spokenName } from '../../store/names.ts';
import { describeAge } from './party.ts';
import { flushGm, hydrateGm, useGm } from './gmStore.ts';

/**
 * Every state of §2d, as seven shapes.
 *
 * Fewer shapes than states because two of the states are not shapes. State 2 -
 * a cancelled picker - is `idle`, because cancelling is not an error and has
 * nothing to say: that is `describeSave`'s precedent one block up, where the
 * word for "nothing happened" is nothing. And State 0-blocked is not a stage at
 * all but a reading of the store, except for the one case below that no reading
 * of the store can see.
 */
type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  /*
   * The store refused to open, underneath a press.
   *
   * `hydrateGm` can reject - `migrateLegacyGmState` is awaited outside its own
   * `try`, and `retryGm`'s docblock says in as many words that the rejected path
   * is a real one. It is hard to reach from this button today, because the
   * button is already shut while `hydrated` is false; what makes it worth a
   * shape of its own is that the alternative is an `await` with no `catch` on
   * the only verb in the block, which strands it reading READING THE FILE… with
   * nothing in the component able to take it out of that state again. That is
   * the stuck spinner over an unknown outcome that `campaignImport.ts` refuses
   * to allow on its own side of the call, arriving one module along instead.
   *
   * State 0-blocked's fact rather than a new one - the storage did not answer -
   * carried by the one of the two sentences that names a control certainly on
   * the screen. The door stays open: a read that failed once is retried by
   * pressing it again.
   */
  | { kind: 'unreadable' }
  | { kind: 'refused'; message: string }
  | { kind: 'preview'; preview: CampaignImportPreview }
  | { kind: 'writing'; preview: CampaignImportPreview }
  | { kind: 'done'; preview: CampaignImportPreview; outcome: CampaignImportOutcome };

const STILL_READING = 'This device is still being read.';
const UNREADABLE =
  'This device’s storage could not be read, so nothing can be brought in yet. TRY AGAIN above ' +
  'reads it again.';
/*
 * The same fact, pointing at a different control, and that is the whole reason
 * there are two of them. The sentence above is printed while the store is
 * *known* to be unreadable, which is the state TRY AGAIN exists for and is
 * showing in. The one below is printed when the read refused underneath a press,
 * where nothing has necessarily set that flag and TRY AGAIN may not be on the
 * sheet at all - so it names the control that is certainly there, which is the
 * door itself. State 8's precedent: the door is the retry.
 */
const UNREADABLE_NOW =
  'This device’s storage could not be read, so nothing can be brought in yet. OPEN A CAMPAIGN ' +
  'FILE tries again.';

const RESTING =
  'A campaign file from this app, on any device. It arrives as a campaign of its own and never ' +
  'writes over one that is already here — if this table is already on this device you get both, ' +
  'and REMOVE in MENU takes either one away. The players’ sheets come back exactly as this table ' +
  'saw them; your own characters are a separate backup and this does not touch them.';

/**
 * The parser's sentence, verbatim, plus at most one of ours.
 *
 * Every refusal on this screen is printed exactly as `parseCampaignFile` or
 * `pickFile` composed it. Composing a softer one here would be a second
 * vocabulary for the format's refusals, which is the thing `campaignFile.ts`
 * caught them for in the first place - and it is the too-new-file sentence,
 * carrying its own remedy, that this must not paraphrase.
 *
 * The one appended sentence is for the one wrong file a GM will actually pick.
 * A `.dhchar` or `.dhbackup` in this picker is not a mistake about the app, it
 * is a mistake about which door, and the parser cannot know there is another
 * one.
 */
function refusal(cause: unknown): string {
  const said = cause instanceof ImportError || cause instanceof Error ? cause.message : String(cause);
  return /^That is a "(?:dhchar|dhbackup)" file/.test(said)
    ? `${said} Characters come in through Settings.`
    : said;
}

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** What a campaign is made of, in the words the GM's own screens use. */
function counted(p: CampaignImportPreview): string {
  const c = p.counts;
  const four = `${plural(c.session, 'row in the plan', 'rows in the plan')} · ${plural(
    c.archive,
    'closed sitting',
    'closed sittings',
  )} · ${plural(c.register, 'entry in the record', 'entries in the record')} · ${String(
    c.party,
  )} in the party`;
  /*
   * The oldest handover is named rather than resolved, and that is the whole of
   * §1b on the screen. An imported campaign cannot reach the `characters` store,
   * so a stale party row is not refreshed from the local library and never will
   * be; what the GM gets instead is the date, and the repair verb the party
   * board already prints beside the row.
   */
  return p.oldestPartyImportedAt === null
    ? `${four}.`
    : `${four}, the oldest sheet handed over ${describeAge(p.oldestPartyImportedAt)}.`;
}

/** The same four numbers, tight enough to sit beside a second set of them. */
const tallied = (c: CampaignImportPreview['counts']): string =>
  `${String(c.session)} rows · ${String(c.archive)} sittings · ${String(
    c.register,
  )} entries · ${String(c.party)} in the party`;

/**
 * When the file left the device that wrote it.
 *
 * `describeAge` and not a second date format. The GM sheet's own docblock makes
 * the argument for it: the two screens that say how long ago something happened
 * say it the same way, and a bespoke "12 Mar 21:40" here would be a third
 * vocabulary on the same panel as `ALREADY ON THIS DEVICE`'s stamp.
 */
const when = (at: string | null): string =>
  at === null ? 'saved at a time the file does not record' : `saved ${describeAge(at)}`;

/** The file, in one line: what it calls itself, when it left, and at what schema. */
function arrival(p: CampaignImportPreview): string {
  const name = spokenName(p.incoming.name, CAMPAIGN_NAMES);
  const by = p.app === null ? '' : ` by version ${p.app}`;
  const converted = p.converted
    ? ` This app reads ${String(CAMPAIGN_SCHEMA_VERSION)}, so it was converted on the way in.`
    : '';
  return `"${name}" — ${when(p.exportedAt)}${by}, at campaign schema ${String(
    p.schemaVersion,
  )}.${converted}`;
}

/**
 * What landed, in the words State 7 owes.
 *
 * Four branches, because there are four things that can be true of a record
 * that arrived: it is here, it is here beside one that was already here, it is
 * here beside one this build must not touch, or it is here under a name it did
 * not come in with.
 *
 * **The third of those is new, and it is here because the second makes a
 * promise that is false in exactly that case.** `addCampaign` answers `'taken'`
 * for a record a newer build wrote - `add` sees raw keys and does not care
 * whether this build could read what is there - so `asCopy` is
 * true on a collision with a quarantined record too. But the rows in MENU come
 * from `useGm.campaigns`, which cannot see a quarantined record, and MENU draws
 * it as text in the LEFT UNTOUCHED panel with no REMOVE beside it. Even with a
 * row, `deleteCampaign` throws `StaleBuildError` on such a record. So "REMOVE
 * in MENU takes either one away" would point at a control that is not on that
 * sheet, over a record this build has just promised not to touch, two taps
 * after the preview said so in as many words. `p.quarantinedSameId` is the fact
 * that tells the two apart, and the preview already carries it.
 *
 * `asCopy` with neither collision keeps the generic sentence: that is the race
 * - another tab landing the id between the preview and the press - where what
 * holds the key is an ordinary readable campaign that MENU will draw a REMOVE
 * for, and "either one" is true.
 */
function landedSentence(
  landed: Extract<CampaignImportOutcome, { kind: 'landed' }>,
  p: CampaignImportPreview,
): string {
  const name = spokenName(landed.campaign.name, CAMPAIGN_NAMES);
  if (landed.asCopy && p.quarantinedSameId) {
    return (
      `That id is held by a campaign a newer version of this app wrote. It has been left exactly ` +
      `as it is and is not in the list, so the copy from the file has been added as "${name}" and ` +
      `opened — REMOVE in MENU takes the copy away.`
    );
  }
  if (landed.asCopy) {
    return (
      `That campaign is already on this device, so the copy from the file has been added beside ` +
      `it as "${name}" and opened. Nothing that was already here has been changed, and REMOVE in ` +
      `MENU takes either one away.`
    );
  }

  const source =
    p.app === null && p.exportedAt === null
      ? ''
      : ` It came from a file exported${p.app === null ? '' : ` by app ${p.app}`}${
          p.exportedAt === null ? '' : `, ${describeAge(p.exportedAt)}`
        }.`;
  const renamed =
    landed.renamedFrom === null
      ? ''
      : ` Another campaign was already called "${landed.renamedFrom}", so the one that arrived ` +
        `is now "${name}".`;
  return `"${name}" is on this device and open.${source}${renamed}`;
}

/**
 * `readCampaignRecord`'s repairs, one per line and never a count.
 *
 * These are the loudest thing on the screen on purpose: among them is the
 * dropped-party-row sentence, which names a player whose sheet will not be on
 * the board. "3 warnings" is the counting-instead-of-naming failure the
 * campaigns store was written against, so there is deliberately no number here
 * and no "show more".
 */
function warnings(lines: readonly string[]): React.JSX.Element | null {
  if (lines.length === 0) return null;
  return (
    <div className="stack" style={{ flex: 'none', gap: 4 }}>
      {lines.map((line, at) => (
        <p
          /*
           * Keyed by position as well as by text: two party rows belonging to
           * players with the same name produce the same sentence twice, and the
           * reader is right to say it twice - it is two sheets that will not be
           * on the board. A key that collided there would be a console error
           * printed at the GM instead.
           */
          key={`${String(at)} ${line}`}
          className="t-hint"
          style={{ margin: 0, color: 'var(--stress)', maxWidth: '62ch' }}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

export function TakeIn(): React.JSX.Element {
  const hydrated = useGm((s) => s.hydrated);
  const writeRetry = useGm((s) => s.writeRetry);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  /*
   * This sheet is unmounted the moment it is closed, and both legs below are
   * `await`s a GM can outrun by tapping away - a picker they leave open, a write
   * on a slow disk. `alive` is the same guard `SaveSheet`'s flush effect keeps,
   * in a ref rather than a closure because these start from an event and not
   * from the effect.
   *
   * **THE RE-ARM IS THE PRICE OF THE REF, AND IT IS NOT OPTIONAL.** Every
   * closure-scoped version of this guard in `src/` gets a fresh binding on each
   * effect setup, so StrictMode's mount-unmount-remount costs it nothing. A ref
   * outlives all three: without the assignment below, the first cleanup sets it
   * false for the life of the component, `settle` stops doing anything, and the
   * door is stranded on READING THE FILE… - disabled, with every exit from
   * `reading` routed through `settle` and nothing able to take it out again.
   * `main.tsx` really does wrap the tree in StrictMode, so that is `npm run dev`
   * as shipped, which is the only surface the 393x852 measurement pass this file
   * still owes can happen on. `useRetry.ts` reached the same shape first; its
   * docblock says jsdom does not reproduce the double mount, and the test beside
   * this one measures that it does.
   */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const settle = (next: Stage): void => {
    if (alive.current) setStage(next);
  };

  const blocked = !hydrated ? STILL_READING : writeRetry === 'read' ? UNREADABLE : null;

  const open = (): void => {
    setStage({ kind: 'reading' });
    void (async () => {
      try {
        await hydrateGm();
      } catch {
        settle({ kind: 'unreadable' });
        return;
      }

      let picked;
      try {
        picked = await pickFile({
          extensions: [CAMPAIGN_EXTENSION],
          description: 'Daggerheart campaign',
        });
      } catch (error) {
        settle({ kind: 'refused', message: refusal(error) });
        return;
      }
      // State 2. A closed picker is not a failure and not an import; it is
      // nothing having happened, and nothing having happened has no sentence.
      if (picked === null) {
        settle({ kind: 'idle' });
        return;
      }

      try {
        settle({
          kind: 'preview',
          preview: previewCampaignImport(parseCampaignFile(picked.text), useGm.getState()),
        });
      } catch (error) {
        settle({ kind: 'refused', message: refusal(error) });
      }
    })();
  };

  const bringIn = (preview: CampaignImportPreview): void => {
    setStage({ kind: 'writing', preview });
    void (async () => {
      /*
       * The catch the `unreadable` shape above argues for, applied to the other
       * verb in this block. `applyCampaignImport` promises an outcome in every
       * branch and keeps it; this is here because an `await` with no `catch` on
       * the only verb the GM can press is a spinner that never stops over an
       * unknown outcome - the exact thing that module refuses to allow on its
       * own side of the call - and because a promise is a contract another
       * module can break without this one being edited.
       *
       * It deliberately does NOT cover the post-landing leg. The record is on
       * the disk by then, and printing "could not be written" over a campaign
       * that is on this device is the one sentence worse than saying nothing.
       */
      let outcome: CampaignImportOutcome;
      try {
        await flushGm();
        outcome = await applyCampaignImport(preview, {
          add: addCampaign,
          read: getCampaign,
          newId: () => crypto.randomUUID(),
          now: () => new Date().toISOString(),
        });
      } catch (error) {
        settle({
          kind: 'done',
          preview,
          outcome: { kind: 'write-failed', message: refusal(error) },
        });
        return;
      }

      if (outcome.kind === 'landed') {
        const record = outcome.campaign;
        /*
         * Filtered, not blindly prepended. `applyCampaignImport` will not
         * offer an id that is already in this list, so nothing should be
         * dropped here - but a blind prepend is what turns a broken upstream
         * decision into two rows under one id, one of which `switchCampaign`
         * cannot open and `writeActive` writes over. See §7 above.
         */
        useGm.setState({
          campaigns: [record, ...useGm.getState().campaigns.filter((c) => c.id !== record.id)],
        });
        try {
          await useGm.getState().switchCampaign(record.id);
        } catch {
          // It landed, and the read-back proved it. Say so. The board not
          // having moved is a worse sentence than the campaign not existing
          // would be, but it is not a lost campaign and must not be printed
          // as one.
        }
      }
      settle({ kind: 'done', preview, outcome });
    })();
  };

  const preview =
    stage.kind === 'preview' || stage.kind === 'writing' ? stage.preview : null;
  const writing = stage.kind === 'writing';
  /*
   * Pulled out as a const so the same-id branch below is reading one value the
   * whole way down. `updatedAt` decides this sentence and nothing else - it is a
   * wall clock on whichever device wrote it, and "the file is newer" does not
   * mean the copy here is a subset of it. Both records survive either way.
   */
  const local = preview === null ? null : preview.localSameId;
  const lastWritten =
    preview === null || local === null
      ? ''
      : preview.incoming.updatedAt.localeCompare(local.updatedAt) > 0
        ? 'The one in the file was written last.'
        : preview.incoming.updatedAt.localeCompare(local.updatedAt) < 0
          ? 'The one already here was written last.'
          : 'Both carry the same time.';

  return (
    <div className="stack" style={{ flex: 'none', gap: 9 }}>
      <span className="t-label">A COPY, BACK IN</span>

      {preview === null && (
        <p className="t-hint" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          {RESTING}
        </p>
      )}

      {preview !== null && (
        <div className="stack" style={{ flex: 'none', gap: 9 }}>
          <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
            {arrival(preview)}
          </p>

          {preview.quarantinedSameId ? (
            <>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                {counted(preview)}
              </p>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                A campaign written by a newer version of this app is on this device under that id.
                It is left exactly as it is — this build must not touch it — and the file arrives as
                a second campaign beside it.
              </p>
            </>
          ) : local !== null ? (
            <>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                That file and a campaign already on this device carry the same id. It may be the
                same table, or an unrelated one that started life on an upgraded device — only you
                can tell.
              </p>
              <p className="t-hint" style={{ margin: 0, maxWidth: '62ch' }}>
                <strong>ARRIVING</strong> — &quot;
                {spokenName(preview.incoming.name, CAMPAIGN_NAMES)}&quot;, {when(preview.exportedAt)}{' '}
                · {tallied(preview.counts)}
              </p>
              <p className="t-hint" style={{ margin: 0, maxWidth: '62ch' }}>
                <strong>ALREADY HERE</strong> — &quot;{spokenName(local.name, CAMPAIGN_NAMES)}&quot;,
                last written {describeAge(local.updatedAt)} ·{' '}
                {tallied({
                  session: local.session.length,
                  archive: local.archive.length,
                  register: local.register.length,
                  party: local.party.length,
                })}
              </p>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                {lastWritten} Nothing here will be written over either way: the file arrives as a
                second campaign, under a new name, and REMOVE in MENU takes either one away.
              </p>
            </>
          ) : (
            <>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                {counted(preview)}
              </p>
              <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
                Nothing on this device has that campaign, so nothing here will be written over.
              </p>
            </>
          )}

          {preview.mintedName !== null && (
            <p className="t-body" style={{ margin: 0, maxWidth: '62ch' }}>
              Another campaign is already called &quot;
              {spokenName(preview.incoming.name, CAMPAIGN_NAMES)}&quot;, so this one will be called
              &quot;{preview.mintedName}&quot;.
            </p>
          )}

          {warnings(preview.warnings)}
        </div>
      )}

      {blocked !== null && preview === null && (
        <p className="t-hint" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          {blocked}
        </p>
      )}

      {preview !== null ? (
        <>
          <button
            type="button"
            className="btn btn-primary"
            disabled={writing}
            onClick={() => {
              bringIn(preview);
            }}
            style={{ minHeight: 'var(--tap)' }}
          >
            {writing ? 'BRINGING IT IN…' : 'BRING IT IN'}
          </button>
          <button
            type="button"
            className="btn"
            disabled={writing}
            onClick={() => {
              setStage({ kind: 'idle' });
            }}
            style={{ minHeight: 'var(--tap)' }}
          >
            NOT NOW
          </button>
        </>
      ) : (
        <button
          type="button"
          className="btn"
          disabled={blocked !== null || stage.kind === 'reading'}
          onClick={open}
          style={{ minHeight: 'var(--tap)' }}
        >
          {stage.kind === 'reading' ? 'READING THE FILE…' : 'OPEN A CAMPAIGN FILE'}
        </button>
      )}

      {stage.kind === 'refused' && (
        <p
          role="alert"
          className="t-body"
          style={{ margin: 0, color: 'var(--stress)', maxWidth: '62ch' }}
        >
          {stage.message}
        </p>
      )}

      {stage.kind === 'unreadable' && (
        <p
          role="alert"
          className="t-body"
          style={{ margin: 0, color: 'var(--stress)', maxWidth: '62ch' }}
        >
          {UNREADABLE_NOW}
        </p>
      )}

      {stage.kind === 'done' && stage.outcome.kind === 'landed' && (
        <>
          <p
            role="status"
            className="t-body"
            style={{ margin: 0, color: 'var(--sage)', maxWidth: '62ch' }}
          >
            {landedSentence(stage.outcome, stage.preview)}
          </p>
          {/*
            Repeated under the result rather than left behind with the preview:
            they were facts about a file the GM was considering, and they are now
            facts about a campaign the GM is holding.
          */}
          {warnings(stage.outcome.warnings)}
        </>
      )}

      {stage.kind === 'done' && stage.outcome.kind === 'write-failed' && (
        <p
          role="alert"
          className="t-body"
          style={{ margin: 0, color: 'var(--damage)', maxWidth: '62ch' }}
        >
          &quot;{spokenName(stage.preview.incoming.name, CAMPAIGN_NAMES)}&quot; could not be written
          to this device’s storage ({stage.outcome.message}). Nothing has been changed: the file on
          your disk is untouched, and OPEN A CAMPAIGN FILE tries again.
        </p>
      )}

      {stage.kind === 'done' && stage.outcome.kind === 'not-verified' && (
        <p
          role="alert"
          className="t-body"
          style={{ margin: 0, color: 'var(--damage)', maxWidth: '62ch' }}
        >
          &quot;{spokenName(stage.outcome.campaign.name, CAMPAIGN_NAMES)}&quot; was written to this
          device but {stage.outcome.message}, so it has not been opened and nothing else has
          changed. It is still on this device under that name; nothing has been deleted.
        </p>
      )}
    </div>
  );
}
