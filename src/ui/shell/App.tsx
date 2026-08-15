/**
 * The shell: a header that never moves, one screen at a time, and on a phone a
 * tab bar in the thumb arc. Screens are switched, not routed - there is no URL
 * to share and nothing to deep-link to, and a router would only add a way for
 * the back button to lose someone's place mid-session.
 */
import { lazy, Suspense, useEffect } from 'react';
import { useApp, useStats } from '../../store/state.ts';
import { CardReader } from '../shared/DomainCardView.tsx';
import { AppMark } from '../shared/DomainMark.tsx';
import { Attribution } from '../shared/CompatibleMark.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { Play } from '../player/Play.tsx';
import { Cards } from '../player/Cards.tsx';
import { warmImporterCache } from '../../pwa/register.ts';
import { needsPasteboardBridge } from '../../transfer/pasteboard.ts';
import { BackupBanner } from './BackupBanner.tsx';
import { Header } from './Header.tsx';
import { Recovery } from './Recovery.tsx';
import { ScreenBoundary } from './ScreenBoundary.tsx';
import { TabBar } from './TabBar.tsx';

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
  const openCard = useApp((s) => s.openCard);
  const setOpenCard = useApp((s) => s.setOpenCard);
  const prefs = useApp((s) => s.prefs);
  const characters = useApp((s) => s.characters);
  const storageError = useApp((s) => s.storageError);
  const stats = useStats();
  const phone = useIsPhone();

  useEffect(() => {
    void init();
  }, [init]);

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

  return (
    <div className="app">
      <Header />
      <main className="stack" style={{ minHeight: 0, overflow: 'hidden' }}>
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
              Close the other tabs and reload; nothing has been written in the meantime.
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
