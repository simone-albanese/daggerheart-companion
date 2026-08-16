/**
 * Settings: everything that is not play.
 *
 * The one screen in the app that is honestly a document, so it scrolls - inside
 * its own region, never the page. It is ordered by how often a decision is
 * actually made: what the screen looks like, what the dice do, and then the
 * three things that decide whether someone's character still exists next month.
 *
 * Nothing here reports anything anywhere. There is no account, no telemetry and
 * no feedback form, which is why the backup section has to be this insistent:
 * if this device loses the data, there is no copy of it in the world.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DOMAINS, type Character } from '../../../shared/types.ts';
import { SEVERITY_HP } from '../../engine/damage.ts';
import {
  backupStatus,
  checkBackupFolder,
  chooseBackupFolder,
  forgetBackupFolder,
  runBackup,
  type BackupStatus,
} from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';
import { requestPersistence } from '../../store/db.ts';
import { useApp } from '../../store/state.ts';
import {
  canChooseDirectory,
  exportCharacter,
  importFromPicker,
  ImportError,
} from '../../transfer/fileIo.ts';
import {
  readOfflineStatus,
  watchInstallPrompt,
  type InstallPromptHandle,
  type OfflineStatus,
} from '../../pwa/register.ts';
import { copyLibrary, isStandalone, pasteLibrary } from '../../transfer/pasteboard.ts';
import { DomainMark } from '../shared/DomainMark.tsx';
import { usePrintSheet } from '../print/usePrintSheet.tsx';
import { ImportConflicts, useImportFlow } from '../shared/ImportConflicts.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { usePrefersReducedMotion } from '../shared/useMedia.ts';
import { About } from './About.tsx';
import { Action, Choice, Field, Note, Rows, Section, Switch } from './parts.tsx';
import { Rulebook } from './Rulebook.tsx';
import { Transfer } from './Transfer.tsx';

const SECTIONS = [
  ['display', 'Display'],
  ['dice', 'Dice'],
  ['backup', 'Characters'],
  ['transfer', 'Transfer'],
  ['rulebook', 'Rulebook'],
  ['about', 'About'],
] as const;

type SectionId = (typeof SECTIONS)[number][0];

export function Settings(): React.JSX.Element {
  const phone = useIsPhone();
  // Two sources, either of which is a yes, exactly as `base.css` treats them:
  // the switch below zeroes `--motion` through `[data-reduce-motion]`, and the
  // OS zeroes it through `@media (prefers-reduced-motion: reduce)`. This scroll
  // is the one piece of motion in the app that CSS does not own, so it has to
  // read both by hand or the second of them stops applying here alone.
  const setting = useApp((s) => s.prefs.reduceMotion);
  const system = usePrefersReducedMotion();
  const reduceMotion = setting || system;
  const anchors = useRef(new Map<SectionId, HTMLElement>());
  const scroller = useRef<HTMLDivElement | null>(null);
  const [here, setHere] = useState<SectionId>('display');

  const jump = useCallback(
    (id: SectionId) => {
      anchors.current.get(id)?.scrollIntoView({
        block: 'start',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    },
    [reduceMotion],
  );

  const bind = useCallback(
    (id: SectionId) => (el: HTMLElement | null) => {
      if (el === null) anchors.current.delete(id);
      else anchors.current.set(id, el);
    },
    [],
  );

  // Which section the reader is in. Measured rather than observed: six
  // elements is cheaper to check on scroll than six IntersectionObservers, and
  // "the last one whose top has passed" is the answer a reader expects.
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    const read = (): void => {
      let current: SectionId = 'display';
      for (const [id] of SECTIONS) {
        const node = anchors.current.get(id);
        if (node !== undefined && node.offsetTop - el.scrollTop <= 28) current = id;
      }
      setHere(current);
    };
    read();
    el.addEventListener('scroll', read, { passive: true });
    return () => el.removeEventListener('scroll', read);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        // minmax(0, 1fr) rather than 1fr: a grid track's automatic minimum is
        // its content's min-content width, and one long unbreakable hint would
        // otherwise widen the whole screen past a 390px phone.
        gridTemplateColumns: phone ? 'minmax(0, 1fr)' : '176px minmax(0, 1fr)',
      }}
    >
      {!phone && (
        <nav
          aria-label="Settings sections"
          className="stack"
          style={{ gap: 2, padding: '18px 10px 18px 20px', borderRight: '1px solid var(--line-soft)' }}
        >
          {SECTIONS.map(([id, label]) => {
            const active = here === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => jump(id)}
                aria-current={active ? 'true' : undefined}
                className="row"
                style={{
                  minHeight: 'var(--control)',
                  padding: '0 10px',
                  gap: 9,
                  borderRadius: 'var(--r2)',
                  background: active ? 'var(--raised)' : 'transparent',
                  font: `${active ? 700 : 600} 12px/1 var(--sans)`,
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: active ? 'var(--text)' : 'var(--dim)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 3,
                    height: 14,
                    borderRadius: 2,
                    background: active ? 'var(--hope)' : 'transparent',
                  }}
                />
                {label}
              </button>
            );
          })}
        </nav>
      )}

      <div className="stack" style={{ minHeight: 'var(--control)', minWidth: 0 }}>
        {phone && (
          <div
            className="row"
            style={{
              flex: 'none',
              minWidth: 0,
              gap: 6,
              padding: '8px 12px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              borderBottom: '1px solid var(--line-soft)',
            }}
          >
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => jump(id)}
                className="chip"
                style={{ minHeight: 'var(--control)', flex: 'none', padding: '0 11px' }}
              >
                {label.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div
          ref={scroller}
          className="scroll"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            position: 'relative',
            padding: phone ? '12px 12px 28px' : '18px 26px 44px',
          }}
        >
          <div
            className="stack"
            style={{ gap: 28, width: '100%', maxWidth: 820, marginRight: 'auto' }}
          >
            <Display innerRef={bind('display')} />
            <Dice innerRef={bind('dice')} />
            <Backup innerRef={bind('backup')} phone={phone} />
            <Transfer innerRef={bind('transfer')} />
            <Rulebook innerRef={bind('rulebook')} phone={phone} />
            <About innerRef={bind('about')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function Display({ innerRef }: { innerRef: (el: HTMLElement | null) => void }): React.JSX.Element {
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  // Local, and deliberately not a preference: the shapes stay on. This only
  // shows what the marks would be without them.
  const [demoShapes, setDemoShapes] = useState(true);
  const systemReduceMotion = usePrefersReducedMotion();
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  return (
    <Section
      id="display"
      title="Display"
      lead="Dark by default, because this game gets played in dim rooms."
      innerRef={innerRef}
    >
      <Rows>
        <Field
          label="Theme"
          hint="System follows whatever the device is doing, including a schedule."
        >
          <Choice
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => setPrefs({ theme })}
            options={[
              ['dark', 'Dark'],
              ['light', 'Light'],
              ['system', 'System'],
            ]}
          />
        </Field>

        <Field
          label="Reduce motion"
          hint={
            systemReduceMotion
              ? // The switch reads OFF while nothing is animating, which without
                // this sentence looks like a broken control. It is not off: the
                // device has already answered the question, and the app obeys
                // the device whatever this says. Leaving it live rather than
                // disabling it keeps the choice recorded for a device that
                // stops asking.
                'This device is already set to reduce motion, so motion is off here whatever this switch says. Turning it on keeps it off on devices that are not.'
              : 'Nothing in this app animates for longer than a glance anyway. This removes what is left, except the transfer codes, which have to move to work.'
          }
        >
          <Switch
            label="Reduce motion"
            checked={prefs.reduceMotion}
            onChange={(reduceMotion) => setPrefs({ reduceMotion })}
          />
        </Field>

        <Field
          label="Shape coding"
          hint="Each domain has a silhouette as well as a colour, so the shape alone tells you which one it is. Shapes stay on — this switch only shows the difference."
          footer={
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {DOMAINS.map((domain) => (
                <span key={domain} className="row" style={{ gap: 6 }}>
                  <DomainMark domain={domain} size={16} shapes={demoShapes} />
                  <span className="t-meta" style={{ color: 'var(--muted)' }}>
                    {domain.toUpperCase()}
                  </span>
                </span>
              ))}
            </div>
          }
        >
          <Switch label="Show the shapes" checked={demoShapes} onChange={setDemoShapes} />
        </Field>

        <Field
          label="Counters"
          hint="On a phone or a tablet, the Play screen's Hit Points, Stress, Hope and Armor Slots can be a number with a stepper, or the row of pips. Numbers also let you tap the value and type it, which pips cannot. The desktop layout, the party board and the companion keep pips either way."
        >
          <Choice
            label="Counters"
            value={prefs.counterStyle}
            onChange={(counterStyle) => setPrefs({ counterStyle })}
            options={[
              ['numbers', 'Numbers'],
              ['pips', 'Pips'],
            ]}
          />
        </Field>

        <Field
          label="Keep the screen awake"
          hint={
            wakeLockSupported
              ? 'A sheet that dims every thirty seconds is unusable at a table. The lock is dropped whenever the app is not on screen and taken again when it comes back.'
              : 'This browser has no wake lock, so the screen will dim on its own schedule.'
          }
        >
          <Switch
            label="Keep the screen awake"
            checked={prefs.wakeLock}
            onChange={(wakeLock) => setPrefs({ wakeLock })}
            disabled={!wakeLockSupported}
          />
        </Field>
      </Rows>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------

function Dice({ innerRef }: { innerRef: (el: HTMLElement | null) => void }): React.JSX.Element {
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);

  return (
    <Section id="dice" title="Dice" innerRef={innerRef}>
      <Rows>
        {/*
          These two used to be one switch, and the hint on it described a
          behaviour it did not control: turning digital dice off was said to
          turn the Hope and Fear faces into inputs, when in truth the faces
          were always inputs and the switch only greyed out ROLL. Two switches,
          each saying what it actually does - and because they are independent,
          the honest case where both are off is stated below rather than
          quietly prevented.
        */}
        <Field
          label="Digital dice"
          hint="On, the app rolls 2d12 for you and works out the outcome, the critical, and what it does to your Hope and Stress. Off for tables that only roll physical dice."
        >
          <Switch
            label="Digital dice"
            checked={prefs.digitalDice}
            onChange={(digitalDice) => setPrefs({ digitalDice })}
          />
        </Field>

        <Field
          label="Type your own dice"
          hint="Tap either die on the Play screen and enter what your physical dice showed. The app works out the outcome the same way. Off by default: the faces then only report, so a roll you have already made cannot be changed by a stray tap."
        >
          <Switch
            label="Type your own dice"
            checked={prefs.manualDice}
            onChange={(manualDice) => setPrefs({ manualDice })}
          />
        </Field>

        {!prefs.digitalDice && !prefs.manualDice && (
          <div
            className="t-dense"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--r3)',
              background: 'var(--raised)',
              borderLeft: '3px solid var(--fear)',
              color: 'var(--text-2)',
            }}
          >
            With both off there is no way to resolve a roll on the Play screen — no dice to
            press and no faces to type into. Turn one of them back on.
          </div>
        )}

        <Field
          label="Massive Damage"
          // The two numbers come from the damage engine, which is the only thing
          // that gets to say what a hit costs.
          hint={`Optional rule. Damage at twice your Severe threshold marks ${SEVERITY_HP.massive} HP instead of ${SEVERITY_HP.severe}. Off unless your table has agreed to it.`}
        >
          <Switch
            label="Massive Damage rule"
            checked={prefs.massiveDamageRule}
            onChange={(massiveDamageRule) => setPrefs({ massiveDamageRule })}
          />
        </Field>
      </Rows>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Characters and backup
// ---------------------------------------------------------------------------

/**
 * What the offline row says, in words, for each answer the probe can give.
 *
 * The README's headline claim is *offline*, and until this row nothing in
 * `src/ui` mentioned a service worker at all: a failed registration became one
 * `console.warn` and the app went on looking installed. Someone walks into a
 * basement believing the sheet will open and it does not.
 *
 * So each state names what is true and what to do about it, and the two
 * failures are kept apart because their remedies are different - one needs a
 * worker, the other needs one load with a connection. The word carries the
 * meaning; the colour only agrees with it.
 */
function offlineWords(status: OfflineStatus | null): {
  chip: string;
  color: string;
  hint: string;
} {
  if (status === null) {
    return {
      chip: 'CHECKING',
      color: 'var(--muted)',
      hint: 'Asking the browser what it has stored.',
    };
  }
  const files = status.files ?? 0;
  const count = `${files} file${files === 1 ? '' : 's'}`;
  switch (status.state) {
    case 'ready':
      return {
        chip: 'READY',
        color: 'var(--ok)',
        hint:
          `The app is cached on this device — ${count} — so it opens with no connection at all, ` +
          'on the bundle stored here rather than on whatever is newest.' +
          (status.controlled
            ? ''
            : ' This page itself was loaded past the worker, which a hard reload does; the next' +
              ' ordinary load goes through it.'),
      };
    case 'empty':
      return {
        chip: 'NOT CACHED',
        color: 'var(--hope)',
        hint:
          'A worker is installed and the app’s files are not in its cache. Browsers reclaim ' +
          'storage from a site nobody has opened in a while, and clearing site data takes the ' +
          'caches and leaves the worker behind. Opened offline right now, this would be a blank ' +
          'screen. Open it once with a connection and the cache fills as it goes.',
      };
    case 'none':
      return {
        chip: 'NO WORKER',
        color: 'var(--damage)',
        hint:
          'Nothing is serving this page offline, so every load needs the network. Reload once ' +
          'with a connection and the browser installs the worker; a private window, or a page ' +
          'served without HTTPS, never will.' +
          (files > 0 ? ` ${count} are still cached here, with nothing left to serve them.` : ''),
      };
    case 'unknown':
      return {
        chip: 'UNKNOWN',
        color: 'var(--muted)',
        hint:
          'The browser did not answer, which is not the same as a no — it may well be ready. ' +
          'Cache storage can take a while to reply while the worker is writing to it, and some ' +
          'private windows refuse the question outright. Check again.',
      };
  }
}

function Backup({
  innerRef,
  phone,
}: {
  innerRef: (el: HTMLElement | null) => void;
  phone: boolean;
}): React.JSX.Element {
  const characters = useApp((s) => s.characters);
  const index = useApp((s) => s.index);
  const { conflicts, run: runImport, choose: chooseImport } = useImportFlow();
  // Paper is the one backup that survives a dead phone, so it belongs here
  // rather than on a screen you use mid-scene.
  const printer = usePrintSheet();
  /** Ids for the two things that explain the "Back up everything" button. */
  const panel = useId();

  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<BackupStatus>(() => backupStatus(appBackupDeps));
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [installable, setInstallable] = useState(false);
  const install = useRef<InstallPromptHandle | null>(null);
  /** null while the probe is in flight; every settled answer is a state. */
  const [offline, setOffline] = useState<OfflineStatus | null>(null);
  const [recheck, setRecheck] = useState(0);

  const standalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true);

  useEffect(() => {
    void navigator.storage
      ?.persisted?.()
      .then(setPersisted)
      .catch(() => setPersisted(null));
  }, []);

  useEffect(() => {
    const handle = watchInstallPrompt(setInstallable);
    install.current = handle;
    return () => handle.dispose();
  }, []);

  /*
   * Offline readiness, read once on arrival and again whenever it can have
   * changed underneath the screen.
   *
   * `controllerchange` is not a nicety: on a first visit the worker activates
   * and claims the page a moment after it loads, so a single read at mount
   * would leave "NO WORKER" on screen - a false one - for the rest of the
   * session. `recheck` is the same read on demand, for the person who has just
   * gone and found a connection because this row told them to.
   */
  useEffect(() => {
    let live = true;
    setOffline(null);
    void readOfflineStatus()
      .then((status) => {
        if (live) setOffline(status);
      })
      .catch(() => {
        // readOfflineStatus does not reject, and a row stuck on "checking"
        // because it one day did would be exactly the silence this replaces.
        if (live) setOffline({ state: 'unknown', controlled: false, files: null });
      });
    const worker = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
    const again = (): void => setRecheck((n) => n + 1);
    worker?.addEventListener('controllerchange', again);
    return () => {
      live = false;
      worker?.removeEventListener('controllerchange', again);
    };
  }, [recheck]);

  // backupStatus is synchronous and reports the permission it last saw, so the
  // screen that has to be certain asks the folder first.
  useEffect(() => {
    void checkBackupFolder()
      .then(() => setHealth(backupStatus(appBackupDeps)))
      .catch(() => setHealth(backupStatus(appBackupDeps)));
  }, []);

  const urgent = health.level !== 'fresh';
  const offlineSays = offlineWords(offline);

  // Every action in this section is a browser saying yes or no to a picker, a
  // permission or a quota, and any of them can reject. An unhandled rejection
  // here would leave a button that looks broken and a user who believes nothing
  // happened - which, on the backup screen, is the one place that must never be
  // guessed at. So every chain ends in a sentence.
  const failed = useCallback((cause: unknown) => {
    setStatus(cause instanceof Error ? cause.message : String(cause));
  }, []);

  /**
   * A whole-library export is what resets the clock, and `runBackup` is what
   * owns that: it writes to the chosen folder when there is one, falls back to
   * the share sheet or a download, and refuses to record a backup that did not
   * actually happen. A single `.dhchar` below is usually a hand-off to another
   * player, so it deliberately does not touch the clock.
   */
  const backupAll = useCallback(() => {
    setBusy(true);
    void runBackup('manual', {}, appBackupDeps)
      .then((outcome) => {
        setStatus(
          outcome.wrote
            ? `Saved ${outcome.fileName ?? 'the backup'} — ${outcome.characters} character${outcome.characters === 1 ? '' : 's'}. Keep it somewhere that is not this device.`
            : outcome.reason,
        );
        setHealth(backupStatus(appBackupDeps));
      })
      .catch(failed)
      .finally(() => setBusy(false));
  }, [failed]);

  const pickFolder = useCallback(() => {
    setBusy(true);
    void chooseBackupFolder(appBackupDeps)
      .then((choice) => {
        setStatus(
          choice.ok
            ? `Backups go to "${choice.name ?? 'that folder'}" from now on.${choice.reason === null ? '' : ` ${choice.reason}`}`
            : choice.cancelled
              ? null
              : choice.reason,
        );
        setHealth(backupStatus(appBackupDeps));
      })
      .catch(failed)
      .finally(() => setBusy(false));
  }, [failed]);

  const dropFolder = useCallback(() => {
    setBusy(true);
    void forgetBackupFolder(appBackupDeps)
      .then(() => {
        setStatus('Forgotten. Nothing is exported automatically until you choose one again.');
        setHealth(backupStatus(appBackupDeps));
      })
      .catch(failed)
      .finally(() => setBusy(false));
  }, [failed]);

  const exportOne = useCallback((character: Character) => {
    setBusy(true);
    void exportCharacter(character)
      .then((result) => {
        setStatus(
          result.ok
            ? `Saved ${result.fileName}.`
            : result.cancelled
              ? null
              : (result.reason ?? 'That character was not saved.'),
        );
      })
      .catch(failed)
      .finally(() => setBusy(false));
  }, [failed]);

  const importFile = useCallback(() => {
    setBusy(true);
    setStatus(null);
    void (async () => {
      try {
        const file = await importFromPicker();
        if (file === null) return;
        setStatus(await runImport(file.characters, file.warnings));
      } catch (cause) {
        setStatus(
          cause instanceof ImportError || cause instanceof Error
            ? cause.message
            : String(cause),
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [runImport]);

  const askForPersistence = useCallback(() => {
    setBusy(true);
    void requestPersistence()
      .then((storage) => {
        setPersisted(storage.persisted);
        setStatus(
          storage.persisted
            ? 'Granted. This browser will not reclaim the app’s data on its own.'
            : 'The browser said no. It often changes its mind once the app is installed to the home screen — and the export is the answer either way.',
        );
      })
      .catch(failed)
      .finally(() => setBusy(false));
  }, [failed]);

  return (
    <Section
      id="backup"
      title="Characters and backup"
      lead="Everything lives on this device and nowhere else. That is the point, and it is also the risk."
      innerRef={innerRef}
    >
      <div
        className="panel"
        style={{
          padding: 14,
          borderLeft: `3px solid ${urgent ? 'var(--hope)' : 'var(--line)'}`,
          background: urgent ? 'var(--hope-wash)' : 'var(--panel)',
        }}
      >
        <div className="spread" style={{ alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            {/* A plain wrapper, purely so the reading has one id to point at.
                Block inside block, no flex or grid between them, so nothing
                moves. */}
            <div id={`${panel}-age`}>
              <div className="t-label">Last backup</div>
              <div
                style={{
                  marginTop: 7,
                  font: '800 24px/1 var(--sans)',
                  letterSpacing: '-0.02em',
                  color: urgent ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                {health.daysSince === null
                  ? 'Never'
                  : health.daysSince === 0
                    ? 'Today'
                    : `${health.daysSince} day${health.daysSince === 1 ? '' : 's'} ago`}
              </div>
            </div>
            <p id={`${panel}-why`} className="t-dense" style={{ margin: '9px 0 0', maxWidth: '58ch' }}>
              {/* backupStatus's own line first: it is the only one that knows a
                  write failed or a folder permission lapsed. */}
              {health.detail ??
                (urgent
                  ? 'A browser can clear local data on its own after about a week without a visit. A character is months of work, and the export is the only copy that survives that.'
                  : 'One file with every character in it. Readable JSON, no rules text, safe to keep anywhere.')}
            </p>
          </div>
          {/*
            Not an `Action`: this button is above the rows, in the health panel,
            so there is no `Field` to take a description from. It gets the two
            ids by hand instead - the age and the sentence beside it - because
            "Back up everything, button" on its own tells a screen reader
            neither that the last copy is forty days old nor that the last write
            failed, which is the entire content of this panel.
          */}
          <button
            type="button"
            className="btn btn-primary"
            aria-describedby={`${panel}-age ${panel}-why`}
            onClick={backupAll}
            disabled={busy || characters.length === 0}
          >
            Back up everything
          </button>
        </div>
      </div>

      <Rows>
        <Field
          label="Automatic backup"
          hint={
            /*
             * Both halves of this sentence used to be a claim nothing in the
             * app made true: `installBackupHooks` had no caller anywhere in
             * `src`, so a user who picked a folder, read this and stopped
             * pressing the button ended up with an empty folder and no idea.
             * It now describes what the two hooks actually do, including the
             * thing they cannot do - a page in the background is not running,
             * so the newest copy is from the last time the app was left.
             */
            health.automatic
              ? `A copy is written into "${health.targetName ?? 'the chosen folder'}" when you leave the app and when it closes. The app cannot write while it is in the background, so the newest copy is from the last time you left. One file per day, so a bad write can only ever spoil today's.`
              : canChooseDirectory()
                ? 'Choose a folder and the app writes a copy into it every time you leave, without asking.'
                : 'Only browsers with the File System Access API can write into a folder you choose, and iPhone and iPad have no folder picker at all — so here, the button above is the backup.'
          }
        >
          {health.automatic ? (
            <>
              <span className="chip" style={{ color: 'var(--ok)' }}>
                {(health.targetName ?? 'FOLDER').toUpperCase()}
              </span>
              <Action onClick={dropFolder} disabled={busy}>
                Forget it
              </Action>
            </>
          ) : (
            <Action onClick={pickFolder} disabled={busy || !canChooseDirectory()}>
              {canChooseDirectory() ? 'Choose a folder' : 'Not available here'}
            </Action>
          )}
        </Field>

        <Field
          label="Import a file"
          hint={
            'A .dhchar or a .dhbackup, from this app on any device. A character already here is ' +
            'updated in place rather than duplicated, so restoring your own backup gives you your ' +
            'library back and not two of everyone — unless this device has the newer edit, in ' +
            'which case nothing is written over and you are asked.'
          }
          footer={
            <ImportConflicts
              conflicts={conflicts}
              busy={busy}
              onChoose={(conflict, choice) => void chooseImport(conflict, choice)}
            />
          }
        >
          <Action onClick={importFile} disabled={busy}>
            Choose a file
          </Action>
        </Field>

        {characters.map((character) => (
          <Field
            key={character.id}
            label={character.name || 'Unnamed'}
            hint={`${index.classes.get(character.classRef)?.name ?? 'No class'} · level ${character.level} · edited ${new Date(character.updatedAt).toLocaleDateString()}`}
          >
            <Action
              label={`Export ${character.name || 'Unnamed'}`}
              onClick={() => exportOne(character)}
              disabled={busy}
            >
              Export
            </Action>
            <Action
              label={`Print character sheet for ${character.name || 'Unnamed'}`}
              onClick={() => printer.print(character)}
              disabled={busy || printer.printing}
            >
              Print sheet
            </Action>
          </Field>
        ))}

        {characters.length === 0 && (
          <Field label="No characters yet" hint="Make one in Build and this list fills in." />
        )}
      </Rows>

      {printer.sheet}

      <Rows>
        <Field
          label="Persistent storage"
          hint={
            persisted === true
              ? 'Granted. The browser has agreed not to reclaim this app’s data on its own. Keep exporting anyway — a granted permission does not survive someone clearing site data.'
              : 'Browsers reclaim storage from sites you have not opened in a while; Safari does it after about seven days of inactivity, which is less than the gap between a lot of sessions. Asking costs nothing, and the browser is far more likely to say yes once the app is installed to the home screen.'
          }
        >
          <span className="chip" style={{ color: persisted === true ? 'var(--ok)' : 'var(--muted)' }}>
            {persisted === true ? 'GRANTED' : persisted === false ? 'NOT GRANTED' : 'UNKNOWN'}
          </span>
          {persisted !== true && (
            <Action onClick={askForPersistence} disabled={busy}>
              Ask the browser
            </Action>
          )}
        </Field>

        {/*
          Beside persistence on purpose: the two rows answer the same question
          from opposite ends - whether the characters will still be here, and
          whether there is an app left to open them with.
        */}
        <Field label="Offline" hint={offlineSays.hint}>
          <span className="chip" style={{ color: offlineSays.color }}>
            {offlineSays.chip}
          </span>
          {/* No `label`: the row's hint is what describes this button, the way
              it describes "Ask the browser" above. An aria-label that did not
              contain the visible words would break voice control instead. */}
          <Action onClick={() => setRecheck((n) => n + 1)} disabled={busy || offline === null}>
            Check again
          </Action>
        </Field>

        {phone && !standalone && characters.length > 0 && (
          <Note>
            <strong style={{ color: 'var(--text)' }}>Before you add this to your Home Screen:</strong>{' '}
            copy your characters. iOS gives an installed web app its own storage, separate from
            Safari&rsquo;s, so the installed app opens empty and there is no way back except the
            clipboard or a file.
          </Note>
        )}

        <Field
          label="Paste characters from Safari"
          hint={
            standalone
              ? 'For anything you made in Safari before installing. Its storage is separate from ' +
                "this app's, so it did not come across on its own. Copy there first, then paste here."
              : 'Available in the installed app. Copying from here is the first half of that trip.'
          }
        >
          <Action
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void pasteLibrary()
                .then(async (r) => {
                  setStatus(r.ok ? await runImport(r.characters) : r.reason);
                })
                .catch((cause: unknown) => {
                  // Without this the whole backup section stayed greyed out
                  // until a tab switch, with no word about why.
                  setStatus(cause instanceof Error ? cause.message : String(cause));
                })
                .finally(() => setBusy(false));
            }}
          >
            Paste from clipboard
          </Action>
        </Field>

        <Field
          label="Copy all characters"
          hint={
            'Puts every character on the clipboard. On iPhone and iPad this is the only way ' +
            'across: an app added to the Home Screen gets its own storage, separate from ' +
            "Safari's, so anything made in the browser does not follow it. Copy here, then " +
            'tap Paste in the installed app.'
          }
        >
          <Action
            disabled={busy || characters.length === 0}
            onClick={() => {
              setBusy(true);
              void copyLibrary(characters).then((r) => {
                setStatus(
                  r.ok
                    ? `Copied ${r.characters} character${r.characters === 1 ? '' : 's'} (${r.bytes} characters of text). Now open the installed app and tap Paste.`
                    : r.reason,
                );
                setBusy(false);
              });
            }}
          >
            Copy to clipboard
          </Action>
        </Field>

        <Field
          label="Install this app"
          hint={
            standalone
              ? 'Installed. That is the copy whose data the browser is least likely to reclaim.'
              : installable
                ? 'Adds it to the home screen or the dock. It runs the same, offline, and its data is treated as more permanent.'
                : phone
                  ? 'On iPhone and iPad: Share, then Add to Home Screen. No website is allowed to show a button for this, and it is the single biggest thing you can do to stop the browser clearing your characters. Copy your characters first — the installed app gets its own storage and will open empty.'
                  : 'This browser has not offered an install. It usually does after a few visits; on Safari, use Share and Add to Dock.'
          }
        >
          {installable && (
            <Action primary onClick={() => void install.current?.show()}>
              Install
            </Action>
          )}
        </Field>
      </Rows>

      {status !== null && <Note role="status">{status}</Note>}
    </Section>
  );
}
