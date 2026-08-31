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
import { DOMAINS_FOR_DISPLAY, type Character } from '../../../shared/types.ts';
import { SEVERITY_HP } from '../../engine/damage.ts';
import {
  backupStatus,
  checkBackupFolder,
  chooseBackupFolder,
  forgetBackupFolder,
  runBackup,
  savedFiles,
  type BackupStatus,
} from '../../store/backup.ts';
import { appBackupDeps } from '../../store/backupDeps.ts';
import { currentCampaigns } from '../../store/campaignSource.ts';
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
import { liveDoors } from '../gm/showDoors.ts';
import { DomainMark } from '../shared/DomainMark.tsx';
import { usePrintSheet } from '../print/usePrintSheet.tsx';
import { ImportConflicts, useImportFlow } from '../shared/ImportConflicts.tsx';
import { useIsPhone } from '../shared/useLayout.ts';
import { usePrefersReducedMotion } from '../shared/useMedia.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { About } from './About.tsx';
import { Action, Choice, Field, Note, Rows, Section, Switch } from './parts.tsx';
import { Transfer } from './Transfer.tsx';

const SECTIONS = [
  ['display', 'Display'],
  ['dice', 'Dice'],
  // Third, not last. The order is how often a decision is made, and this one is
  // made once - on the first evening, by a player deciding whether a quarter of
  // their tab bar is a screen they will ever open. Appending it after 'about'
  // would have put it below the section that is terminal by design, in both the
  // desktop nav and the phone chip strip; putting it before 'backup' keeps the
  // three sections that decide whether a character still exists next month
  // together and last.
  ['gm', 'GM tools'],
  ['backup', 'Characters'],
  ['transfer', 'Transfer'],
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
            <GmTools innerRef={bind('gm')} />
            <Backup innerRef={bind('backup')} phone={phone} />
            <Transfer innerRef={bind('transfer')} />
            <About innerRef={bind('about')} />
            {/*
              The notice, at the end of the last section rather than pinned
              above the tab bar. On this one screen it is the second copy - the
              About panel opens with the same 342 characters - and that is
              deliberate and unchanged: About's own docblock says the notice is
              "at the top of this screen and in the shell's footer,
              unconditionally". They are the same array, and About's copy is
              roughly two thousand pixels above this one, so nobody reads a
              paragraph twice in one glance.
            */}
            <LicenceFooter />
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
              {DOMAINS_FOR_DISPLAY.map((domain) => (
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

        {/*
         * THE COUNTERS ROW IS GONE, AND ITS HINT IS WHY IT COULD NOT SIMPLY BE
         * EDITED. It read "On a phone or a tablet, the Play screen's Hit
         * Points, Stress, Hope and Armor Slots can be a number with a stepper,
         * or the row of pips … The desktop layout, the party board and the
         * companion keep pips either way." The first half now has one answer
         * and the second half was never true of the desktop: that layout drew
         * four `<Track>` rows the switch could not reach, at 32px against this
         * project's own 44px floor. A hint that describes a branch nobody can
         * choose is the same defect as a feature nothing calls, so the row goes
         * rather than gets reworded. Pips survive on the party board, the live
         * scene and the companion, none of which has ever had a switch.
         */}
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
// GM tools
// ---------------------------------------------------------------------------

/**
 * Four switches, and the reason there are four rather than seven.
 *
 * The master switch is the one most people will touch: this app is used by
 * players far more often than by the one person running the table, and the GM
 * section is a whole tab of the four a phone navigates by. Off, the tab goes,
 * the desktop header's entry goes, and the app will not open on the screen
 * behind them - `allowedScreen` and `openingScreen` in `prefs.ts` are those two
 * rules, so nothing here can leave a door to a room the shell refuses to draw.
 *
 * The other three are the doors behind SHOW, and they are switchable precisely
 * because nothing else reaches them: the encounter builder and the scene runner
 * are the *content of a session row*, so a switch that hid either would make
 * rows the GM has already written unopenable, and Fear and the countdowns sit
 * behind the Fear readout, which is not optional at a Daggerheart table - a GM
 * cannot be given a pool they can spend and no board to set it on. `BACKLOG.md`
 * carries that reduction as a decision rather than as a silence. ("The two
 * halves SHOW forks into" stood here; the merchant made it three doors, and a
 * fork with three arms is not a fork.)
 *
 * Off, the three sub-switches are disabled rather than hidden. A live control
 * that decides nothing is the same defect as a sentence the code cannot honour;
 * a disabled one with the sentence beside it says what it is waiting for.
 *
 * Ergonomics. Every `Switch` is `minHeight: var(--tap)` = 44 and its pill is
 * 46x26 inside that box, so the target is the row's full-height button rather
 * than the graphic. On a 393px phone the settings column is 393 − 24 = 369 -
 * the 12px either side of this file's own scroller, whose phone padding is
 * `'12px 12px 28px'` - and the field's content box is that less the 1px either
 * side of `Rows`' `border: '1px solid var(--line-soft)'` and the 14px either
 * side of `Field`'s `padding: '13px 14px'`, = 339. The control block spends 88:
 * `Switch`'s own `padding: '0 2px 0 8px'` and `gap: 10` around its `width: 22`
 * ON/OFF span and its `width: 46` pill, with no border of its own - `base.css`
 * zeroes a button's border - so 8 + 22 + 10 + 46 + 2. The label and its
 * sentence take the remaining 237, across the `gap: 14` of the flex line
 * `Field` draws. It stays one line: the text block's `flex: '1 1 180px'` basis
 * plus 14 plus 88 is 282, inside 339. All four rows are read before they are
 * touched, which is why the sentence gets the width and the switch keeps a
 * fixed 88.
 *
 * (**88 and 237, not the 78 and 277 that stood here.** 369 was and is right -
 * it is the settings column - but the old sentence then spent it as though the
 * flex line were 369 too, skipping `Rows`' border and `Field`'s padding; the 78
 * also dropped the switch button's own 10px of horizontal padding. The
 * clause that followed them, "about 44 characters a line, inside the 62ch
 * maximum this screen reads at", is deleted rather than re-derived at 237: a
 * character count is a browser result and nothing here can measure one. What
 * this file can cite is the cap itself, `maxWidth: '62ch'` on the hint `Field`
 * draws, which is a declaration and not a claim about how much text reaches it,
 * and `gmGeometryProse.test.ts` holds the docblock to it and to every term of
 * the 339, the 88, the 237 and the 282.)
 *
 * Every one of those terms is named by its declaration. The first draft of this
 * paragraph cited seven of them as `parts.tsx:87`, `:121`, `:127`, `:138`,
 * `:228-244`, `base.css:46` and `Settings.tsx:213`: all seven resolved when
 * they were written, and none of them is in a file this docblock can keep in
 * step. A line number in a file under edit is a claim with a half-life of a
 * commit: three citations this same round added to `Conditions.tsx` were
 * pushed off their targets by that round's own insertion, and were wrong in
 * the commit that wrote them.
 */
function GmTools({ innerRef }: { innerRef: (el: HTMLElement | null) => void }): React.JSX.Element {
  const prefs = useApp((s) => s.prefs);
  const setPrefs = useApp((s) => s.setPrefs);
  const off = !prefs.gmSection;

  return (
    <Section
      id="gm"
      title="GM tools"
      lead="The screen for the person running the table. If that is not you, none of it has to be here."
      innerRef={innerRef}
    >
      <Rows>
        <Field
          label="The GM section"
          hint="The night's plan, the encounter builder, the live scene, Fear and the countdowns. Off, the GM tab leaves the bottom bar and the app never opens on it. Nothing is deleted — every campaign stays on this device and comes back the moment this goes back on."
        >
          <Switch
            label="The GM section"
            checked={prefs.gmSection}
            onChange={(gmSection) => setPrefs({ gmSection })}
          />
        </Field>

        <Field
          label="Bestiary"
          hint="Behind SHOW on the GM screen: every adversary and environment this dataset carries, to read without adding any of them to tonight. Off, SHOW stops offering it and so does an empty scene, so nothing on screen points at a tool that is not there."
        >
          <Switch
            label="Bestiary"
            checked={prefs.gmBestiary}
            disabled={off}
            onChange={(gmBestiary) => setPrefs({ gmBestiary })}
          />
        </Field>

        <Field
          label="The party board"
          hint="Also behind SHOW: the player sheets sent to this device, as they arrived, beside whatever you have marked on them since. Nothing on the board ever writes to their characters. Off, SHOW stops offering it. The sheets themselves are untouched — this decides what the screen shows, never what it keeps."
        >
          <Switch
            label="The party board"
            checked={prefs.gmPartyBoard}
            disabled={off}
            onChange={(gmPartyBoard) => setPrefs({ gmPartyBoard })}
          />
        </Field>

        <Field
          label="The merchant"
          hint="The third door behind SHOW: a stall to draw stock for, over the SRD’s own table of what things cost. Off, SHOW stops offering it. It never spends anybody’s gold — nothing in it writes to a character sheet, on or off."
        >
          <Switch
            label="The merchant"
            checked={prefs.gmMerchant}
            disabled={off}
            onChange={(gmMerchant) => setPrefs({ gmMerchant })}
          />
        </Field>

        {/*
          The same idiom as the two dice switches: the honest case where every
          one of a set is off is stated rather than quietly prevented. Here it is
          worth stating because the consequence is visible - the bar the GM
          presses all evening loses a third of itself and the other two verbs
          grow into the space.

          The condition asks `SHOW_DOORS` rather than naming the preferences,
          which is the same argument `GmBar` makes about the same question: a
          hand-written `!a && !b` is a copy of the door list, and the copy is
          what stops agreeing the day a door is added. This one would have gone
          quiet rather than red - the notice simply would not appear for a GM who
          had switched all three off - which is the kind of defect a test has to
          be written for on purpose.
        */}
        {(off || liveDoors(prefs).length === 0) && (
          <div
            className="t-dense"
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--r3)',
              background: 'var(--raised)',
              borderLeft: '3px solid var(--hope)',
              color: 'var(--text-2)',
            }}
          >
            {off
              ? 'The GM section is off, so these three decide nothing until it is back on. They are remembered in the meantime.'
              : 'With all three off SHOW has nothing left to open, so it leaves the GM screen’s bottom bar and ADD and SAVE take the width. The rules search lives on that sheet, so it goes with it; the reference behind MENU does not. Everything else on that screen is unchanged.'}
          </div>
        )}
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

/**
 * The one thing about this folder the user has to be told, rather than find.
 *
 * A campaign holds whole copies of the players' character sheets, on purpose -
 * that is what makes it restorable at all, and stripping them would leave a
 * backup that cannot give back the thing it exists to give back. But it means a
 * folder somebody picked once for their own characters quietly accumulates
 * other people's, once per play night, possibly into a synced Drive or iCloud
 * folder. That is a real change in what this app does with data that is not the
 * user's, and it belongs on the screen beside the picker rather than in a
 * release note nobody reads.
 */
const CAMPAIGNS_HOLD_SHEETS =
  ' A campaign file holds the players’ character sheets as this table saw them, so a folder that' +
  ' syncs somewhere is syncing other people’s characters too.';

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
  /**
   * How many campaigns this backup would carry.
   *
   * Through the same seam `runBackup` reads, not through `countCampaigns`: that
   * one counts records a newer build wrote, and those are exactly the ones the
   * backup cannot take. A number that told this screen there was something to
   * back up when there was not would be the failure this section is written
   * against, one indirection along.
   */
  const [campaignCount, setCampaignCount] = useState(0);
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
    void currentCampaigns()
      .then((snapshot) => setCampaignCount(snapshot.campaigns.length))
      // A campaign store that will not open is not this row's news to break.
      // Zero is what the button already assumes and the backup itself says so.
      .catch(() => setCampaignCount(0));
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

  /**
   * The hand-copy clock, in words. Null until there has been one.
   *
   * A separate sentence from the age above it, and never folded into it: the
   * age is a file this app opened again and counted, and this is a click on a
   * share sheet or a download that reported nothing back. Saying so is the
   * point - it is the only line that makes the folderless hint's "SAVE A COPY
   * in the GM section is the only way to get one out" answerable on screen.
   */
  const copySaid =
    health.copyDaysSince === null
      ? null
      : `A copy of a campaign was saved by hand ${
          health.copyDaysSince <= 0
            ? 'today'
            : health.copyDaysSince === 1
              ? 'yesterday'
              : `${health.copyDaysSince} days ago`
        }${
          health.copyRoute === 'share'
            ? ', through the share sheet'
            : health.copyRoute === 'download'
              ? ', as a download'
              : ''
        }. The app cannot check that it arrived, so it does not count as a backup.`;

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
        /*
         * The files, then this screen's own tail, then the notice.
         *
         * `savedFiles` is shared with the three crash-and-strip screens rather
         * than written out here, because the sentence it replaced was written
         * out four times and the campaign leg made all four of them wrong in
         * the same way. What stays here is the half that belongs to this
         * screen: the reminder that a copy on the same device is not a backup.
         */
        const said = [
          outcome.wrote
            ? `${savedFiles(outcome)} Keep it somewhere that is not this device.`
            : outcome.reason,
          outcome.notice,
        ].filter((line): line is string => line !== null);
        setStatus(said.length === 0 ? null : said.join(' '));
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
                  : campaignCount === 0
                    ? 'One file with every character in it. Readable JSON, no rules text, safe to keep anywhere.'
                    : `One file with every character in it, and one more for each of your ${campaignCount === 1 ? 'campaign' : `${campaignCount} campaigns`}. Readable JSON, no rules text, safe to keep anywhere.`)}
              {/*
                And the copies the GM made by hand, which is a different clock
                and says so. The age above it reads "Never" until a run this app
                can verify has happened, and on an iPhone - no folder picker, so
                no automatic backup at all - that can be for ever, while the GM
                exports every campaign every week from the GM section. Reading
                "Never" over a month of that trains them to ignore the whole
                panel. It is the last sentence rather than the first because
                `health.detail` is the only line that knows a write failed, and
                it says explicitly what the app cannot check, because a share
                sheet reports the click and not the file.
              */}
              {copySaid === null ? null : ` ${copySaid}`}
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
            /*
             * Both empty, not just the library. A GM who runs the table and
             * plays nobody is a normal user of this app, and this button was
             * greyed out for them while their campaigns had no copy anywhere.
             */
            disabled={busy || (characters.length === 0 && campaignCount === 0)}
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
              ? `A copy is written into "${health.targetName ?? 'the chosen folder'}" when you leave the app and when it closes, plus one file for each campaign that changed. The app cannot write while it is in the background, so the newest copy is from the last time you left. One file per day, so a bad write can only ever spoil today's, and nothing there is ever deleted.${CAMPAIGNS_HOLD_SHEETS}`
              : canChooseDirectory()
                ? `Choose a folder and the app writes a copy into it every time you leave, without asking — your characters in one file, and each campaign in one of its own.${CAMPAIGNS_HOLD_SHEETS}`
                : 'Only browsers with the File System Access API can write into a folder you choose, and iPhone and iPad have no folder picker at all — so here, the button above is the backup. A campaign needs a folder, so on this device SAVE A COPY in the GM section is the only way to get one out.'
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
