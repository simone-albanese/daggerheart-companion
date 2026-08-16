/**
 * The shell: a header that never moves, one screen at a time, and on a phone a
 * tab bar in the thumb arc. Screens are switched, not routed - there is no URL
 * to share and nothing to deep-link to, and a router would only add a way for
 * the back button to lose someone's place mid-session.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  installBackupHooks,
  integrityCheck,
  runBackup,
  type IntegrityReport,
} from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';
import { useApp, useStats, type WriteFailure } from '../../store/state.ts';
import { CardReader } from '../shared/DomainCardView.tsx';
import { AppMark } from '../shared/DomainMark.tsx';
import { ATTRIBUTION, Attribution, CompatibleIcon } from '../shared/CompatibleMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { Play } from '../player/Play.tsx';
import { Cards } from '../player/Cards.tsx';
import { createWakeLock, registerServiceWorker, warmImporterCache } from '../../pwa/register.ts';
import { needsPasteboardBridge } from '../../transfer/pasteboard.ts';
import { BackupBanner } from './BackupBanner.tsx';
import { Header } from './Header.tsx';
import { Recovery } from './Recovery.tsx';
import { ScreenBoundary } from './ScreenBoundary.tsx';
import { TabBar } from './TabBar.tsx';
import { UpdateBanner } from './UpdateBanner.tsx';

// Play and Cards are what a session actually uses, so they ship in the shell.
// Build, GM and Settings are large, rarely open at the table, and each pulls in
// something heavy of its own (the wizard, the bestiary, pdf.js and the QR
// codec). Splitting them keeps first paint small and - just as usefully - means
// a failure inside one of them cannot take the sheet down with it.
const Build = lazy(async () => ({ default: (await import('../build/Build.tsx')).Build }));
const Gm = lazy(async () => ({ default: (await import('../gm/Gm.tsx')).Gm }));
const Settings = lazy(async () => ({ default: (await import('../settings/Settings.tsx')).Settings }));

function Loading(): React.JSX.Element {
  return (
    <div className="stack" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <AppMark size={22} />
    </div>
  );
}

export function App(): React.JSX.Element {
  const ready = useApp((s) => s.ready);
  const init = useApp((s) => s.init);
  const screen = useApp((s) => s.screen);
  const setScreen = useApp((s) => s.setScreen);
  const openCard = useApp((s) => s.openCard);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const prefs = useApp((s) => s.prefs);
  const characters = useApp((s) => s.characters);
  const storageError = useApp((s) => s.storageError);
  const writeError = useApp((s) => s.writeError);
  const quarantined = useApp((s) => s.quarantined);
  const stats = useStats();
  const phone = useIsPhone();
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const [integrity, setIntegrity] = useState<IntegrityReport | null>(null);

  useEffect(() => {
    void init();
  }, [init]);

  // The automatic backup. `installBackupHooks`, `backupAtSessionEnd`,
  // `noteSession` and `integrityCheck` had no caller anywhere in `src`, and
  // Rollup tree-shook the entire regime out of the bundle - the strings
  // `page-hide` and `knownCharacterIds` appeared in no file under
  // `dist/assets`. Meanwhile the settings screen told the user a copy was
  // being written into their folder at the end of every session. They picked
  // the folder, believed the sentence, stopped pressing the button, and the
  // folder stayed empty.
  //
  // The disposer is returned rather than dropped: a leaked `pagehide` listener
  // would run one backup per mount on the next event.
  useEffect(() => installBackupHooks(appBackupDeps), []);

  // After a week of silence, check that what the last session left behind is
  // still there. Deliberately on the *default* deps: this compares what is on
  // the disk against a list in localStorage, and that difference is its only
  // evidence. Sourcing it from the store would make "the character store could
  // not be opened" unreachable - `init` sets `ready` with an empty library when
  // the read failed - so the one launch where storage broke would be reported
  // as characters having vanished, and the record of what used to be here would
  // then be overwritten with nothing.
  useEffect(() => {
    if (!ready) return;
    let live = true;
    void integrityCheck()
      .then((report) => {
        if (live && !report.healthy) setIntegrity(report);
      })
      .catch(() => {
        // The check itself failing is not news anyone can act on.
      });
    return () => {
      live = false;
    };
  }, [ready]);

  // Register the worker. Everything offline depends on this one call: without
  // it `public/sw.js` is a file the browser never reads, the precache never
  // happens, and an app whose entire premise is working with the radio off
  // would quietly need the network for every load.
  //
  // The visibility check is how an update is noticed at all. A worker that
  // installed while the app sat in a background tab announces itself only when
  // asked, and coming back to the app is the one moment the user is present
  // and not yet mid-action.
  useEffect(() => {
    const handle = registerServiceWorker({
      // `setState` treats a bare function as an updater, so the callback has to
      // be wrapped to be stored rather than called.
      onUpdateReady: (apply) => setApplyUpdate(() => apply),
      onError: (error) => console.warn('[pwa] service worker', error),
    });
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void handle.check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      handle.dispose();
    };
  }, []);

  // Hold the screen awake while the preference is on. The setting is on by
  // default and says a sheet that dims every thirty seconds is unusable at a
  // table; this is the code that makes that true rather than a claim. The
  // handle re-takes the lock after every interruption on its own, so the only
  // thing owned here is the on/off.
  useEffect(() => {
    if (!prefs.wakeLock) return;
    const lock = createWakeLock();
    void lock.request();
    return () => {
      void lock.release();
      lock.dispose();
    };
  }, [prefs.wakeLock]);

  // The importer's pdf.js worker is not in the install-time precache; a device
  // that could actually run the importer asks for it here, once, so the
  // feature still works offline without charging every phone half a megabyte
  // for something it is not allowed to use. Loaded dynamically so the check
  // itself costs the shell nothing.
  useEffect(() => {
    void import('../../import/index.ts')
      .then(({ importCapability }) => {
        if (importCapability().supported) warmImporterCache();
      })
      .catch(() => {
        // The importer is optional; failing to pre-warm it is not an error.
      });
  }, []);

  useEffect(() => {
    document.documentElement.dataset['theme'] = prefs.theme;
    document.documentElement.dataset['reduceMotion'] = String(prefs.reduceMotion);
  }, [prefs.theme, prefs.reduceMotion]);

  if (!ready) {
    return (
      <div
        className="app"
        style={{ placeContent: 'center', justifyItems: 'center', gridTemplateRows: '1fr' }}
      >
        <AppMark size={28} />
      </div>
    );
  }

  const needsCharacter = characters.length === 0 || stats === null;
  // `EmptyState` carries its own copy of the notice, so the footer stands down
  // wherever it renders rather than printing the same 342 characters twice.
  const emptyState = needsCharacter && (screen === 'play' || screen === 'cards');
  const showLicence = screen !== 'play' && !emptyState;

  return (
    <div className="app">
      <Header />
      <main className="stack" style={{ minHeight: 0, overflow: 'hidden' }}>
        {writeError !== null && <UnsavedWork failure={writeError} />}
        {storageError !== null && (
          <div
            role="alert"
            className="spread"
            style={{
              flex: 'none',
              alignItems: 'center',
              gap: 12,
              margin: '8px 20px 0',
              padding: '8px 12px',
              borderRadius: 'var(--r2)',
              background: 'var(--fear-wash)',
              border: '1px solid var(--fear)',
            }}
          >
            <span className="t-dense" style={{ color: 'var(--text-2)' }}>
              {storageError}. Your characters are almost certainly still there — this is the
              browser refusing to open its own database, usually because another tab has it.
              Close the other tabs and reload
              {/*
                The rest of that sentence used to be "; nothing has been written in the
                meantime", which is an invitation to reload. It is only true while every
                write has succeeded, and the alert above says when they have not.
              */}
              {writeError === null ? '; nothing has been written in the meantime.' : '.'}
            </span>
            <button
              type="button"
              className="chip"
              onClick={() => location.reload()}
              style={{ flex: 'none', minHeight: 'var(--control)', color: 'var(--text)' }}
            >
              RELOAD
            </button>
          </div>
        )}
        {integrity !== null && (
          <div
            role="alert"
            className="stack"
            style={{
              flex: 'none',
              gap: 8,
              margin: '8px 20px 0',
              padding: '10px 12px',
              borderRadius: 'var(--r2)',
              background: 'var(--fear-wash)',
              border: '1px solid var(--fear)',
            }}
          >
            <span className="t-label" style={{ color: 'var(--text)' }}>
              {integrity.missingIds.length > 0 ? 'SOMETHING IS MISSING' : 'THE LIBRARY DID NOT OPEN'}
            </span>
            <span className="t-dense" style={{ color: 'var(--text-2)' }}>
              {integrity.message}
            </span>
            <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/*
                To the screen that already has the restore rather than a second
                copy of it here. Every import in this app goes through the
                store, so a newer local copy is never written over and the
                screen fills as the characters arrive; a restore wired straight
                into IndexedDB from the shell would be the one path that does
                neither. The offer is only made when there is something to
                restore from - `integrity.message` has already said so when
                there is not.
              */}
              {integrity.canRestore && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setScreen('settings')}
                  style={{
                    flex: 'none',
                    minHeight: 'var(--control)',
                    color: 'var(--text)',
                    background: 'var(--raised)',
                  }}
                >
                  RESTORE FROM A BACKUP
                </button>
              )}
              {/*
                Dismissable, unlike the unsaved-work alert above: this reports
                something that has already happened and cannot be undone from
                here, and the check rewrites its record at the end of every run,
                so it is said once. A permanent strip at the top of Play trains
                the eye to skip the top of the screen.
              */}
              <button
                type="button"
                className="t-meta"
                onClick={() => setIntegrity(null)}
                style={{ minHeight: 'var(--control)', minWidth: 'var(--control)' }}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </span>
          </div>
        )}
        {quarantined.length > 0 && (
          <div
            role="alert"
            className="stack"
            style={{
              flex: 'none',
              gap: 6,
              margin: '8px 20px 0',
              padding: '10px 12px',
              borderRadius: 'var(--r2)',
              background: 'var(--raised)',
              border: '1px solid var(--stress)',
            }}
          >
            <span className="t-label" style={{ color: 'var(--text)' }}>
              {quarantined.length === 1
                ? 'ONE CHARACTER IS NOT SHOWN'
                : `${quarantined.length} CHARACTERS ARE NOT SHOWN`}
            </span>
            {/*
              Named one by one rather than counted. "Some characters could not
              be read" is the sentence that makes a person open every sheet
              looking for the missing one; the name is the only thing that
              lets them know whether it is the one they care about.
            */}
            {quarantined.map((record) => (
              <span key={record.id} className="t-dense" style={{ color: 'var(--text-2)' }}>
                <strong>{record.name === null || record.name === '' ? 'Unnamed' : record.name}</strong>
                {' — '}
                {record.reason}
              </span>
            ))}
            <span className="t-meta" style={{ color: 'var(--muted)' }}>
              Nothing has been deleted. These are still on this device exactly as they were saved,
              and this version of the app has not written over them.
            </span>
          </div>
        )}
        <UpdateBanner apply={applyUpdate} />
        <BackupBanner />
        {screen === 'play' && (
          <ScreenBoundary name="Play">
            {needsCharacter ? <EmptyState /> : <Play stats={stats} />}
          </ScreenBoundary>
        )}
        {screen === 'cards' && (
          <ScreenBoundary name="Cards">
            {needsCharacter ? <EmptyState /> : <Cards stats={stats} />}
          </ScreenBoundary>
        )}
        {screen === 'build' && (
          <ScreenBoundary name="Build">
            <Suspense fallback={<Loading />}>
              <Build />
            </Suspense>
          </ScreenBoundary>
        )}
        {screen === 'gm' && (
          <ScreenBoundary name="GM tools">
            <Suspense fallback={<Loading />}>
              <Gm />
            </Suspense>
          </ScreenBoundary>
        )}
        {screen === 'settings' && (
          <ScreenBoundary name="Settings">
            <Suspense fallback={<Loading />}>
              <Settings />
            </Suspense>
          </ScreenBoundary>
        )}
        {showLicence && <LicenceFooter />}
        {phone && <TabBar />}
      </main>
      {openCard !== null && (
        <CardReader
          card={openCard}
          shapes={prefs.shapeCoding}
          onClose={() => setOpenCard(null)}
        />
      )}
    </div>
  );
}

/**
 * The licence notice, on screens a real user actually reaches.
 *
 * It used to live in `EmptyState` and nowhere else in the shell, which meant it
 * was on screen for exactly as long as somebody had no characters - so every
 * real user at every real table lost it permanently the moment they made one,
 * and the only remaining copy was at the bottom of Settings. Meanwhile
 * `Architecture.md` says twice that the attribution is *"sempre visibile nel
 * footer"* and there was no `<footer>` in the app at all. Nothing breaks at a
 * table over this; what it risks is the project, because the remedy for a
 * community-content licence that requires a notice to be *displayed* is a
 * takedown.
 *
 * **Where, and the arithmetic behind it.** This is a read-only strip: no
 * control, no target, nothing to hit, so the 44px floor does not apply to it
 * and the thumb arc is not the question. The question is only how much vertical
 * room it costs the screen above it, and the answer is set by the notice being
 * verbatim - 342 characters that cannot be trimmed.
 *
 *   On a 393px phone the text column is 393 - 40 of padding - 22 for the icon
 *   and its gap = 331px. Archivo at `.t-dense`, 11.5px/1.38, averages about
 *   5.4px per character, so 342 characters is ~1847px of text: six lines, 95px,
 *   plus 16px of padding = ~111px. On a 1024px tablet the column is 964px and
 *   the same text is two lines, ~48px. There is no typographic trick that beats
 *   this; 9px would fit it in 70px and this project's own type ramp says Archivo
 *   never runs at 400 below 11.5px.
 *
 * So it sits inside `<main>`, as the last thing before the tab bar rather than
 * after it - a strip below `TabBar` would push the four navigation targets up
 * out of the arc they were placed in, which is the one thing this must not do -
 * and it is **not rendered on Play**. Play is laid out to fit rather than to
 * flow on a desktop and has been fought over for two passes on a phone; 48px
 * there is 6% of the sheet and 111px is a loadout row. Cards, Build, GM and
 * Settings all scroll, so there the strip costs a scroll position rather than
 * content.
 *
 * What that leaves on Play is not nothing: `CompatibleIcon` is in the header on
 * every screen including this one, so the mark never leaves, and the words are
 * one tap away on any other tab. That is a deliberate trade and it is the one
 * thing in this file worth arguing with.
 */
function LicenceFooter(): React.JSX.Element {
  // On a phone `TabBar` is below this and already pays the home-indicator
  // inset; on a tablet or a desktop there is no tab bar and this strip is the
  // last thing in the window, so it pays it itself. Adding it in both places
  // would leave a phone with 34px of empty panel between the notice and the
  // tabs.
  const phone = useIsPhone();
  return (
    <footer
      className="row"
      style={{
        flex: 'none',
        gap: 10,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: phone ? '8px 20px' : '8px 20px calc(8px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line-soft)',
        background: 'var(--panel)',
      }}
    >
      <span style={{ flex: 'none', paddingTop: 1 }}>
        <CompatibleIcon size={14} />
      </span>
      <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: 760 }}>
        {ATTRIBUTION.join(' ')}
      </p>
    </footer>
  );
}

/**
 * The one thing the app must never do quietly: fail to save.
 *
 * Ergonomics. This sits at the very top of `<main>`, above the storage and
 * quarantine banners and furthest from the thumb, because it has to be *read* -
 * and because its one control is a decision rather than a reflex. The chip
 * carries `minHeight: var(--control)`, which is 34px on a precise pointer and
 * `var(--tap)` = 44px under `(max-width: 1179px), (pointer: coarse)`, so the
 * touch floor is met on every phone and tablet without inventing a number.
 *
 * It is not dismissible. A dismissed warning about work that is not saved is
 * exactly the false reassurance this app is not allowed to give, and unlike the
 * backup nag - a standing condition - this is an event with a remedy.
 *
 * It costs a block at the top of the phone's scroll window, and it appears only
 * while writes are actually failing.
 */
function UnsavedWork({ failure }: { failure: WriteFailure }): React.JSX.Element {
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /*
   * Straight to `runBackup` rather than sending the user to Settings: the
   * window in which this matters is the one before the tab closes. It takes
   * `appBackupDeps`, which is what makes the export contain the work that did
   * not reach the disk - the default reads IndexedDB, where by definition it is
   * not, and the unchanged fingerprint would have it report that nothing has
   * changed since the last backup.
   */
  const saveACopy = useCallback(() => {
    setSaving(true);
    setNote(null);
    void runBackup('manual', { interactive: true }, appBackupDeps)
      .then((outcome) => {
        setNote(
          outcome.wrote
            ? `Saved ${outcome.fileName ?? 'the copy'} — ${outcome.characters} character${outcome.characters === 1 ? '' : 's'}.`
            : outcome.reason,
        );
      })
      .catch((cause: unknown) => {
        setNote(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setSaving(false));
  }, []);

  return (
    <div
      role="alert"
      className="stack"
      style={{
        flex: 'none',
        gap: 8,
        margin: '8px 20px 0',
        padding: '10px 12px',
        borderRadius: 'var(--r2)',
        background: 'var(--fear-wash)',
        border: '1px solid var(--fear)',
      }}
    >
      <span className="t-label" style={{ color: 'var(--text)' }}>
        {failure.count === 1 ? 'ONE CHANGE IS NOT SAVED' : `${failure.count} CHANGES ARE NOT SAVED`}
      </span>
      <span className="t-dense" style={{ color: 'var(--text-2)' }}>
        {failure.message}
      </span>
      <span className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="chip"
          onClick={saveACopy}
          disabled={saving}
          style={{ flex: 'none', minHeight: 'var(--control)', color: 'var(--text)', background: 'var(--raised)' }}
        >
          {saving ? 'SAVING…' : 'SAVE A COPY NOW'}
        </button>
        {note !== null && (
          <span className="t-meta" style={{ color: 'var(--muted)' }}>
            {note}
          </span>
        )}
      </span>
    </div>
  );
}

function EmptyState(): React.JSX.Element {
  const setScreen = useApp((s) => s.setScreen);

  // An installed iOS app with an empty store is usually not a new user; it is
  // someone whose Safari data did not follow them across the platform's
  // storage boundary. Offer the bridge, not a blank slate.
  if (needsPasteboardBridge()) return <Recovery />;

  return (
    <div
      className="stack"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}
    >
      <AppMark size={26} />
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div className="t-vital">No character yet</div>
        <p className="t-body" style={{ marginTop: 10 }}>
          Every rule, card and adversary from the SRD is already here — 189 domain cards, 129
          adversaries, nine classes. Nothing to download.
        </p>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => setScreen('build')}>
        Create a character
      </button>
      <div style={{ marginTop: 8 }}>
        <Attribution compact />
      </div>
    </div>
  );
}
