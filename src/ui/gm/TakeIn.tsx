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
 * **6 is an `add`, and that is what makes `aside` a non-issue.** `aside`
 * receives ids only from `patchCampaign` and from `hydrateGm`'s repair loop,
 * both for records already in `state.campaigns`; an id that `add` accepted was
 * demonstrably absent from the store, so it cannot be queued there. That
 * argument is a property of add-only, not of this component - see
 * `campaignImport.ts` for what breaks the day an overwrite verb exists.
 *
 * **7 is last, so a tab that dies mid-import can leave a whole campaign but
 * never a false claim.** One `add` in one transaction either commits or does
 * not; "half an import" is not a reachable state on the disk. What *is*
 * reachable is a sentence printed for a write that never committed, so the
 * sentence goes after the read-back: the worst outcome of a `pagehide` or a
 * service-worker reload at any instant is a whole campaign that turns up in the
 * list next launch without an announcement.
 *
 * **`switchCampaign` is called rather than hand-rolled, and it is safe here.**
 * Its early return on `id === activeCampaignId` can never fire under add-only:
 * the landed id was either absent from this device or freshly minted, so it is
 * never the id already open. Do not "simplify" this into a `set` that skips it,
 * and do not let a future verb write onto an id already on the device - under
 * one, this call becomes a no-op and the pre-import board is gathered straight
 * back over the record that just arrived. It is also why step 7 puts the record
 * into `campaigns` *first*: `switchCampaign` looks the target up in that list and
 * does nothing when it is not there.
 *
 * ## Ergonomics, 393x852
 *
 * A third block in `SaveSheet`'s 363px column, `gap: 9`, matching the two above
 * it. Reading above, touching below, in that order and in every state: the
 * paragraph that says what the verb does sits above the verb rather than under
 * it, because it is the sentence that decides whether the thumb should travel at
 * all. Every button is a full-width `.btn` at `minHeight: var(--tap)` = 44, so
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
 * The ten states of §2d, as six shapes.
 *
 * State 2 - a cancelled picker - is `idle` and not a shape of its own, because
 * cancelling is not an error and has nothing to say. That is `describeSave`'s
 * precedent one block up: the word for "nothing happened" is nothing.
 */
type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'refused'; message: string }
  | { kind: 'preview'; preview: CampaignImportPreview }
  | { kind: 'writing'; preview: CampaignImportPreview }
  | { kind: 'done'; preview: CampaignImportPreview; outcome: CampaignImportOutcome };

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
 * Three branches and no fourth, because there are three things that can be true
 * of a record that arrived: it is here, it is here beside one that was already
 * here, or it is here under a name it did not come in with.
 */
function landedSentence(
  landed: Extract<CampaignImportOutcome, { kind: 'landed' }>,
  p: CampaignImportPreview,
): string {
  const name = spokenName(landed.campaign.name, CAMPAIGN_NAMES);
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
      {lines.map((line) => (
        <p
          key={line}
          className="t-dense"
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
   */
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const settle = (next: Stage): void => {
    if (alive.current) setStage(next);
  };

  const blocked = !hydrated
    ? 'This device is still being read.'
    : writeRetry === 'read'
      ? 'This device’s storage could not be read, so nothing can be brought in yet. TRY AGAIN above reads it again.'
      : null;

  const open = (): void => {
    setStage({ kind: 'reading' });
    void (async () => {
      await hydrateGm();

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
      await flushGm();
      const outcome = await applyCampaignImport(preview, {
        add: addCampaign,
        read: getCampaign,
        newId: () => crypto.randomUUID(),
        now: () => new Date().toISOString(),
      });

      if (outcome.kind === 'landed') {
        useGm.setState({ campaigns: [outcome.campaign, ...useGm.getState().campaigns] });
        await useGm.getState().switchCampaign(outcome.campaign.id);
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
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
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
              <p className="t-dense" style={{ margin: 0, maxWidth: '62ch' }}>
                <strong>ARRIVING</strong> — &quot;
                {spokenName(preview.incoming.name, CAMPAIGN_NAMES)}&quot;, {when(preview.exportedAt)}{' '}
                · {tallied(preview.counts)}
              </p>
              <p className="t-dense" style={{ margin: 0, maxWidth: '62ch' }}>
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

      {blocked !== null && preview === null && (
        <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
          {blocked}
        </p>
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
