/**
 * The questions the app asks before it asks for a class.
 *
 * A brand-new device used to open on `Build`, and `Build` with an empty library
 * is the creation wizard, whose first step is the nine classes. So the very
 * first thing this app ever showed anybody was nine cards asking which one they
 * wanted to be - before it knew whether they were making a character at all.
 * A GM got the same nine, and so did somebody whose character was already
 * finished and sitting on another phone.
 *
 * Two questions for a player, three for a GM, and one for somebody importing.
 * That is the whole shape and it is the owner's decision rather than a
 * derivation. What this file is responsible for is not asking anything it does
 * not have to.
 *
 * The third of those is the shortest and the least obvious. One of the four
 * answers to the first question - "my character is on another device" - is not
 * an answer at all, it is a door: somebody whose sheet already exists has
 * nothing to tell this app about how they play, because the sheet says it. So
 * that answer ends the flow where it stands and opens `ImportDoors` in place of
 * the summary, behind a `lazy()` boundary that keeps the QR codec out of the
 * chunk drawing this very frame.
 *
 * ## The six questions that are not here
 *
 * Every preference in `prefs.ts` was a candidate and six were dropped, each for
 * a reason rather than for brevity. Shapes on the domain marks and the massive
 * damage rule arrive correct by default; reduced motion is declared by the
 * operating system and read from there, so asking would be the app requesting
 * information it already has; the screen stays awake, which is right for a
 * table; the theme is dark, because this is played in dim rooms; and both GM
 * browse tools are on. What is left is the set the app genuinely cannot answer
 * for itself: who you are, how your table rolls, and - only for a GM - how many
 * of you there are, because that number is arithmetic rather than taste.
 *
 * The dice question offers three of the four reachable combinations of
 * `digitalDice` and `manualDice`, and the three it offers are exactly the three
 * branches of `rollAffordance` in `DualityRoll.tsx` - so each row is labelled
 * with the words the Play screen will actually put on the roll bar rather than
 * a paraphrase of them. The fourth combination, both switched on, is ROLL *and*
 * typable faces: a table that rolls physically and digitally in the same
 * session, which is a real thing and a rare one. It is left to Settings
 * deliberately. A first-run question with four answers where three of them are
 * distinct behaviours and the fourth is "both of two of those" is a question
 * that costs everybody a moment to serve a few.
 *
 * ## Nothing is written until the hand-off
 *
 * Answers are held in this component and go to `setPrefs` once, at the end of
 * whichever route was taken.
 *
 * The reason used to be given as a contract with `loadPrefs`: a record with no
 * `onboarded` key is read as already onboarded, so a flow writing each answer
 * as it was given would leave such a record behind and the next launch would
 * read a half-finished run as a completed one. That is not reachable. `setPrefs`
 * spreads its patch over the whole record and `savePrefs` serialises all of it,
 * so a mid-flow write persists `onboarded: false` rather than omitting the key,
 * and `loadPrefs` honours a stored `false`.
 *
 * The real reason is the same shape turned round, and it is the sharper one.
 * Every partial write persists `onboarded: false` *durably*, and that stored
 * `false` is what re-asks these questions of somebody who has been playing for
 * months, the first time their library is empty. So a run that has not ended
 * must leave nothing behind at all - which is why the answers live in component
 * state until then - and a run that ends any way whatever, answered or skipped
 * or a character arriving, must write `onboarded: true` in the same call as its
 * answers. There is one `setPrefs` per route in this file and no other write
 * anywhere in it.
 *
 * ## Skippable, and what a skip actually does
 *
 * There is a Skip in the pinned nav at every step. An onboarding that cannot be
 * escaped is a wall in front of the app, and this one is in front of an app that
 * works perfectly well with every default it ships with - so refusing to let
 * somebody past would be the app insisting on being told things it can manage
 * without.
 *
 * It does not skip to the app, though: it skips to the same summary card every
 * other route ends on, with the defaults on it and "none" beside the count of
 * questions answered. Two reasons. Escaping by accident is how a feature becomes
 * one nobody has ever seen, and a 44px ghost button in the corner of the nav is
 * easier to brush than four 64px rows in the middle of the screen. And the card
 * is where the app says which preferences it is about to write and where each
 * one is changed afterwards - which is the sentence that makes skipping safe
 * rather than final.
 *
 * A skip drops every answer given before it. Someone who tapped "The GM" and
 * then Skip gets the shipped defaults, not a half-applied GM setup, and the card
 * says so by counting no questions.
 *
 * It stays live in front of the import doors and goes dead on the summary, which
 * is the only asymmetry here. On the summary there is nothing left to skip - it
 * is the end of every route. In front of three doors there is: somebody who
 * tapped "my character is on another device", found the other phone was in
 * another room, and would now like to be let into the app.
 *
 * ## Nothing above this, and nothing beside it
 *
 * `App` draws this instead of the five screens, and suppresses `TabBar`;
 * `Header` draws no nav and no door to Settings while it is up. That last one
 * reverses a rule `Header.tsx` states in its own docblock - that the GM filter
 * may never take the Settings button away, because Settings is where the
 * section is switched back on - and the reversal is safe for a reason that rule
 * does not have: this is at most three taps long and always has a Skip, so the
 * door is not gone, it is a few seconds away. The alternative was worse. A
 * Settings button that works during onboarding lands somebody on a screen with
 * no tab bar, no header nav and no way back, which is the exact failure the rule
 * in `Header.tsx` exists to prevent.
 *
 * The alert banners are still above this - a write that did not land, a library
 * that vanished between sessions, a character this build will not read. A device
 * whose characters have gone missing must be told so, and must not instead be
 * quietly asked who it belongs to.
 *
 * ## Ergonomics, measured in Chrome rather than estimated
 *
 * Every number below was read off the layout engine through the audit harness,
 * 30 cases across seven viewports and two safe-area configurations. Across all
 * of them: no target under the floor, no overlap, nothing clipped, no horizontal
 * overflow, no console error.
 *
 * The fixed bands. Header 53 (52 of content plus its rule). The pinned nav is
 * 10 + a 48px button + 10 + a rule = 69, and 103 on an installed iPhone where
 * the `padding-bottom` resolves to 44. Gutter 12px each side, the same as the
 * wizard this hands off to, so a row is 369 wide at 393.
 *
 * Every answer row is `minHeight: 64` against this app's own 44px floor
 * (`--tap`) - 20px of headroom - and every row is full width, the largest target
 * this column can make. `minHeight` gives way to content rather than clipping
 * it: the longest label, "A player - my character is on another device", wraps
 * to two lines in a 293px text column and the row is 75. And 64 holds at 1180
 * with a mouse, where `--control` is 34: these rows do not follow the floor down.
 *
 * The first question, which is the four-row one and therefore the tall one:
 *
 *   viewport           window content  rows       fold
 *   393x852             730    730     185-482     783   no scroll
 *   393x852 installed   637    637     244-541     749   no scroll
 *   375x667             545    609     185-482     598   scrolls 64
 *   375x667 installed   467    609     229-526     564   scrolls 142
 *   320x568             446    636     185-493     499   scrolls 190
 *   744x1133           1011   1011     189-475    1064   no scroll
 *   1180x800            678    678     194-480     731   no scroll
 *   852x393             271    558     189-475     324   scrolls 287
 *   568x320             198    566     185-471     251   scrolls 368
 *
 * The GM's party question is the other four-row screen and is 11px shorter
 * (206-492 at 320x568, against the same 499). The three import doors are 185-400
 * at 320 and 185-397 everywhere else; with the camera open at 393x852 the
 * content goes to 984 against a 730 window, which is the one state this screen
 * is *designed* to scroll in.
 *
 * The reading of that table. On every portrait phone, at every safe-area
 * setting, **every answer is above the fold** - including the fourth on the
 * smallest phone in the sweep, at 493 against 499. Where the screen scrolls,
 * what is below the fold is the licence notice, which is where that notice is
 * meant to be. Two measurements bought that fit and both are recorded where they
 * are set: the question runs at `t-vital`, which clamps to 21px at these widths
 * where the demo's 25px wrapped every headline to two lines, and the gaps inside
 * a question are 12 rather than 16.
 *
 * The arc, honestly. At 393x852 the rows occupy y185 to y482 and a one-handed
 * thumb is comfortable from about y300 down, so the first row is a stretch and
 * the rest are in the arc. That is the wrong way round for a control strip and
 * the right way round for what this is: four rows that are read before any of
 * them is touched, once, on a screen with nothing else on it. 297px of rows is a
 * slide rather than a re-grip, and the two controls that ARE reflexes - Back and
 * Skip - are 48px in the pinned nav at y783-831, the band the wizard's Back and
 * Next occupy and the same band `TabBar` holds on every other screen.
 *
 * Landscape scrolls and is meant to: 271px of window at 852x393 and 198 at
 * 568x320 cannot hold a headline and four 64px rows however they are arranged,
 * and the nav stays put through it. The Play screen scrolls and so does this.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/state.ts';
import type { Prefs } from '../../store/prefs.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';
import { AnswerRow } from './parts.tsx';

/*
 * The three doors, and the reason they are a chunk of their own.
 *
 * `ImportDoors` reaches `Transfer.tsx`, which pulls `src/transfer/qr.ts` and
 * `src/transfer/fileIo.ts`. `App.tsx` splits Settings out of the shell to keep
 * exactly that off first paint and says so in its own comment; a static import
 * here would put the QR codec back into the chunk that draws the first frame on
 * every device, and no test in this suite could see it. The questions above
 * stay in the shell - a spinner on the first screen anybody ever sees is not
 * acceptable - and this loads behind a tap, which is what a tap looks like.
 */
const ImportDoors = lazy(async () => ({
  default: (await import('./ImportDoors.tsx')).ImportDoors,
}));

interface Answer {
  /** Two to four characters of mono in the leading square. */
  glyph: string;
  label: string;
  /** What the app does differently, in the words the app itself will use. */
  sub: string;
  set: Partial<Prefs>;
  /** Opens the third question and sends the hand-off to the GM screen. */
  branch?: 'gm';
  /**
   * Ends the flow here and opens the three import doors instead of a summary.
   *
   * Not a fourth question. Somebody whose character is already made has nothing
   * to tell this app about how they play - it is about to arrive on the sheet
   * they made - so this is the one answer that is also a destination.
   */
  route?: 'import';
}

interface Question {
  id: 'who' | 'dice' | 'party';
  /** Asked only of somebody who has said they run the game. */
  gm: boolean;
  title: string;
  /** Why this is being asked at all, in one line, above the answers. */
  why: string;
  options: Answer[];
}

/**
 * The questions, and the exact preference patch behind each answer.
 *
 * `(3 × partySize) + 2` is `Encounter.tsx`'s own arithmetic for a fight's battle
 * points, printed on the party rows because it is the reason the question is
 * asked: a party size is not a preference about how the app looks, it is a term
 * in a formula, and a wrong default is a wrong fight rather than a wrong colour.
 */
const QUESTIONS: Question[] = [
  {
    id: 'who',
    gm: false,
    title: 'Who are you at this table?',
    why: 'This decides which quarter of the app you get, and whether you need the character wizard at all.',
    options: [
      {
        glyph: 'PC',
        label: "A player — I'll make a character now",
        sub: 'NEXT: THE NINE CLASSES',
        set: { gmSection: false },
      },
      {
        glyph: 'HAVE',
        label: 'A player — my character is on another device',
        sub: 'FILE · CAMERA · PASTE, RIGHT NOW',
        set: { gmSection: false },
        route: 'import',
      },
      {
        glyph: 'GM',
        label: 'The GM',
        sub: 'SESSION PLAN · FEAR · ADVERSARIES',
        set: { gmSection: true },
        branch: 'gm',
      },
      {
        glyph: 'BOTH',
        label: 'Both, depending on the night',
        sub: 'EVERYTHING ON',
        set: { gmSection: true },
        branch: 'gm',
      },
    ],
  },
  {
    id: 'dice',
    gm: false,
    title: 'How does your table roll?',
    why: 'Real dice means the roll controls come off the sheet — not greyed out, gone.',
    options: [
      {
        glyph: 'ROLL',
        label: 'The app rolls for me',
        sub: 'ROLL STAYS ON THE SHEET',
        set: { digitalDice: true, manualDice: false },
      },
      {
        glyph: 'TYPE',
        label: 'Real dice — I type what they said',
        sub: 'ROLL BECOMES ENTER YOUR DICE',
        set: { digitalDice: false, manualDice: true },
      },
      {
        glyph: 'OFF',
        label: 'Real dice, and the app stays out of it',
        sub: 'NO ROLL CONTROLS AT ALL',
        set: { digitalDice: false, manualDice: false },
      },
    ],
  },
  {
    id: 'party',
    gm: true,
    title: 'How many players at your table?',
    why: 'Battle points and adversary counts are computed from this number, so a wrong default is a wrong fight.',
    options: [3, 4, 5, 6].map((n) => ({
      glyph: n === 6 ? '6+' : String(n),
      label: (['Three', 'Four', 'Five', 'Six or more'] as const)[n - 3]!,
      sub: `(3 × ${String(n)}) + 2 = ${String(3 * n + 2)} BATTLE POINTS`,
      set: { gmPartySize: n },
    })),
  },
];

/** The one question every route asks, which is the whole of the import route. */
const WHO = QUESTIONS.filter((q) => q.id === 'who');

export function Onboarding(): React.JSX.Element {
  const setPrefs = useApp((s) => s.setPrefs);
  const setScreen = useApp((s) => s.setScreen);
  const phone = useIsPhone();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [isGm, setIsGm] = useState(false);
  /** Every patch given so far, in the order they were given. */
  const [patch, setPatch] = useState<Partial<Prefs>>({});
  /**
   * True when the summary was reached by Skip rather than by answering.
   *
   * A flag rather than a tally, and the tally is what it replaces. Counting taps
   * looked right and was not: Back onto a question and answer it again and the
   * count went up, so the card could say three questions were answered in a flow
   * that is two long - the app claiming something that did not happen, in the
   * one place it exists to say what did. The summary is only reachable by
   * answering every question on the list or by skipping, so the honest number is
   * derivable and is derived below.
   */
  const [skipped, setSkipped] = useState(false);
  /** Set by the one answer that is a door rather than a question. */
  const [route, setRoute] = useState<'import' | null>(null);

  /*
   * Which questions this run asks, from one expression with two callers.
   *
   * Two callers because the branch is decided *by* an answer, so the length of
   * the flow changes inside the same handler that reads it - and the two reads
   * disagree by one render if they are two expressions. They were two, briefly,
   * and the duplicate was worse than a bug: it was unkillable. `asked` bounds
   * what is drawn and the counter, so a copy that lost the filter changed
   * nothing anybody could see and nothing any test could fail on.
   */
  const visible = (gm: boolean): Question[] => QUESTIONS.filter((q) => !q.gm || gm);
  const asked = visible(isGm);
  // Clamped rather than guarded. `choose` sets `done` on the last question of
  // whichever list it has just produced, so `step` cannot outrun `asked` - and
  // a fallback that quietly drew the summary from an impossible state would be
  // this screen agreeing that the flow had finished when it had not.
  const current = asked[Math.min(step, asked.length - 1)]!;

  // A new question starts at its own top. Only the doors and the licence notice
  // ever put this screen past one window, but a question read halfway down the
  // last one's answers is the same defect the wizard fixed here first.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [step, done]);

  const choose = (question: Question, option: Answer): void => {
    const next = { ...patch, ...option.set };
    setPatch(next);
    setSkipped(false);

    /*
     * The route is written by every answer to the first question, not only by
     * the one that sets it.
     *
     * It was set in the branch below and cleared in `back`, and that pairing had
     * a hole with no symptom until two moves later: take the import door, press
     * Back, answer "The GM" instead, and a stale `'import'` put the three doors
     * where the GM's summary belongs. Setting it here makes the route a property
     * of the current answer rather than a flag two handlers have to agree about.
     */
    if (question.id === 'who') setRoute(option.route ?? null);

    // The door. One question was asked and it has been answered, so the flow is
    // over whatever else is on the list - which is the "exactly one" half of the
    // decision, and the reason it is checked before the branch below.
    if (option.route === 'import') {
      setDone(true);
      return;
    }

    // The branch is decided by this answer, so the length of the flow changes
    // underneath the step counter. Ask `visible` for the new list rather than
    // reading `asked`, which still describes the question just answered.
    const gm = question.id === 'who' ? option.branch === 'gm' : isGm;
    if (question.id === 'who') setIsGm(gm);
    const remaining = visible(gm);
    if (step >= remaining.length - 1) setDone(true);
    else setStep(step + 1);
  };

  /*
   * Back out of the summary onto the last question, or back one question.
   *
   * The answers are left standing rather than unwound. Every question here is a
   * single choice and re-answering it overwrites its own keys, so an answer
   * nobody changes on the way past is an answer they are keeping - and dropping
   * the patch on the way back would make Back a destructive control that looks
   * like a navigational one.
   */
  const back = (): void => {
    if (done) {
      // The doors are an answer, so backing out of them puts the question they
      // answered back on screen with its other three rows on it - which is the
      // way out for somebody who took the import route by mistake. The route
      // itself is left alone: `choose` owns it, and it is unread while `done`
      // is false.
      setDone(false);
      return;
    }
    setStep(Math.max(0, step - 1));
  };

  /*
   * Skip: to the summary, with nothing kept.
   *
   * Not straight into the app. The summary is where the app says what it is
   * about to write and where each of those lives afterwards, and a skip is the
   * route that needs that sentence most - it is the one taken by somebody who
   * has decided not to read any of this.
   */
  const skip = (): void => {
    setPatch({});
    setIsGm(false);
    setRoute(null);
    setSkipped(true);
    setStep(0);
    setDone(true);
  };

  /*
   * What this run is allowed to write, from the questions it actually asked.
   *
   * `back` leaves answers standing rather than unwinding them, and that is
   * right: re-answering a question overwrites its own keys, so an answer nobody
   * changes on the way past is an answer they are keeping. What it also left
   * standing was the answers to questions the run no longer asks. Answer "The
   * GM", the dice and "Six or more", press Back three times and pick "my
   * character is on another device", and the flow wrote a party size of six
   * under a card reading ONE QUESTION, ANSWERED. The same three Backs onto "a
   * player" ended on a summary with no PLAYERS row - `isGm` is false - while
   * `finish` wrote `gmPartySize` anyway, so the one card in the app that says
   * what a first run writes was short by one. That is the same defect the
   * `skipped` flag was added to fix: the card stating something the run did not
   * do.
   *
   * Derived from `QUESTIONS` rather than listed, because a list here is a
   * second copy of the table that nothing could see going stale. The summary is
   * given the same filtered patch, so the card and the write are one value.
   */
  const written = (questions: Question[]): Partial<Prefs> => {
    const owned = new Set(questions.flatMap((q) => q.options.flatMap((o) => Object.keys(o.set))));
    return Object.fromEntries(
      Object.entries(patch).filter(([key]) => owned.has(key)),
    ) as Partial<Prefs>;
  };
  const answers = written(route === 'import' ? WHO : asked);

  /*
   * The one write, and the hand-off.
   *
   * `setPrefs` first and `setScreen` second: `setScreen` writes `lastScreen`
   * through the same store action, so it spreads over a record that already
   * carries the answers rather than racing them.
   */
  const finish = (): void => {
    setPrefs({ ...answers, onboarded: true });
    setScreen(isGm ? 'gm' : 'build');
  };

  /*
   * The same one write, taken by the import route instead of by a button.
   *
   * A character arriving *is* the hand-off on this branch - there is nothing
   * left to confirm and a "Continue" under a sheet that is already on the device
   * would be a step that does nothing. Play rather than Build, because the thing
   * that just arrived is a character to play.
   */
  const arrive = (): void => {
    setPrefs({ ...answers, onboarded: true });
    setScreen('play');
  };

  /*
   * And the arrival is watched for here rather than reported by each door.
   *
   * It was a callback the doors called, and the camera door did not call it.
   * `ImportDoors` mounted `<Receiver/>` with no props and `Receiver` completes
   * its own import, so a character that arrived by QR was written to the store
   * and nothing else happened: `onboarded` was never written, the one answer
   * this route gives was dropped, and the person was thrown out of the flow
   * mid-scan onto the nine class cards - because `needsOnboarding` flipped on
   * the character count rather than because the run had finished. Worse, the
   * `onboarded: false` left behind is durable, so the first time that library
   * was next empty the app would ask an established user who they are.
   *
   * A callback passed to `Receiver` too would have fixed that door. This fixes
   * the shape: the flow ends when a character is on the device, so the flow
   * watches for a character being on the device. There is nothing left for a
   * fourth door to forget to call, and the two doors that did call it no longer
   * can - the conflict rows count too now, so choosing "replace" on the last
   * blocked arrival hands off exactly as a clean import does.
   *
   * A store subscription rather than an effect on `characters.length`, and that
   * is not a style choice: the count going above zero is what unmounts this
   * component, so an effect watching it would be scheduled on a tree that no
   * longer exists. The subscription is notified inside `set`, before React is
   * asked to render anything.
   */
  useEffect(() => {
    if (!done || route !== 'import') return;
    return useApp.subscribe((state, previous) => {
      if (previous.characters.length === 0 && state.characters.length > 0) arrive();
    });
  }, [done, route, arrive]);

  /** How many questions this run actually asked, for the card to state. */
  const answered = skipped ? 0 : route === 'import' ? 1 : asked.length;

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div
        ref={panel}
        className="scroll"
        style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 20px' : '18px 20px 24px' }}
      >
        <div className="stack" style={{ gap: 16, maxWidth: 720, margin: '0 auto' }}>
          <Rail
            count={route === 'import' ? 1 : asked.length}
            at={done ? (route === 'import' ? 1 : asked.length) : step}
          />
          {done ? (
            route === 'import' ? (
              <Doors />
            ) : (
              <Summary isGm={isGm} patch={answers} answered={answered} onFinish={finish} />
            )
          ) : (
            <Ask question={current} step={step} of={asked.length} onChoose={choose} />
          )}
          {/*
            The licence notice, last in this screen's own scroll. The nav below
            is pinned at every width, so it is what is last in the window and it
            pays the home-indicator inset rather than this.
          */}
          <LicenceFooter pinnedBelow />
        </div>
      </div>

      <nav
        className="row"
        aria-label="Onboarding"
        style={{
          flex: 'none',
          gap: 10,
          justifyContent: 'space-between',
          paddingTop: 10,
          paddingInline: phone ? 12 : 20,
          /*
           * The home-indicator inset, at every width, which no other pinned nav
           * in this app does. The wizard's and the level-up's pay it only above
           * 720px because `TabBar` is underneath them on a phone and pays there.
           * Onboarding suppresses `TabBar`, so this row is the last thing in the
           * window at every width, and copying the wizard's `phone ? 10 : …`
           * would leave a phone paying nothing and put Back and Skip under the
           * indicator.
           *
           * `calc(0px + …)` so jsdom keeps the declaration and the sweep in
           * `attribution.test.tsx` can count it - see `TabBar.tsx`.
           */
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--line-soft)',
          background: 'var(--panel)',
        }}
      >
        <button
          type="button"
          className="btn"
          onClick={back}
          disabled={step === 0 && !done}
          style={{ minHeight: 48, minWidth: 108 }}
        >
          Back
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={skip}
          /*
           * Live on the doors, dead on the summary. On the summary there is
           * nothing left to skip - it is the end of every route - but somebody
           * standing in front of three import doors having second thoughts is
           * exactly who needs a way straight into the app.
           */
          disabled={done && route === null}
          style={{ minHeight: 48, minWidth: 108 }}
        >
          Skip these
        </button>
      </nav>
    </div>
  );
}

/**
 * The end of the one-question route: a heading, a line, and three doors.
 *
 * It stands where the summary stands on the other two routes and it deliberately
 * does not summarise. There is nothing to summarise: this route wrote one key,
 * and the person is here because their character is on another device and they
 * want it on this one. A card listing preferences would be the app talking about
 * itself at the one moment somebody is trying to do something.
 *
 * The doors are a `lazy()` chunk - see the import at the top of this file for
 * why that is not optional - so the heading and the line render at once and only
 * the three rows wait. The fallback is a sentence rather than a spinner, because
 * a spinner under a promise of "three ways in" is the promise loading.
 */
function Doors(): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <span className="t-label">ONE QUESTION, ANSWERED</span>
      <h2 className="t-vital" style={{ margin: 0, color: 'var(--text)' }}>
        Bring it across
      </h2>
      <p className="t-dense" style={{ margin: 0, maxWidth: '46ch' }}>
        Nothing else to ask — the character you already made answers the rest. Pick a way in.
      </p>
      <Suspense
        fallback={
          <p className="t-dense" style={{ margin: 0 }}>
            Opening the three ways in…
          </p>
        }
      >
        <ImportDoors />
      </Suspense>
    </div>
  );
}

/**
 * How long this is, in one 3px line.
 *
 * Two segments for a player and three for a GM, so the length of the flow is on
 * screen from the first frame - which is the single most useful thing a first
 * run can say about itself. `aria-hidden`, because the step line underneath it
 * says the same thing in words and a screen reader does not need it twice.
 */
function Rail({ count, at }: { count: number; at: number }): React.JSX.Element {
  return (
    <div className="row" aria-hidden="true" style={{ flex: 'none', gap: 4 }}>
      {Array.from({ length: count }, (_unused, i) => (
        <span
          key={i}
          style={{
            height: 3,
            flex: 1,
            borderRadius: 2,
            background: i < at ? 'var(--hope)' : i === at ? 'var(--text)' : 'var(--empty)',
          }}
        />
      ))}
    </div>
  );
}

function Ask({
  question,
  step,
  of,
  onChoose,
}: {
  question: Question;
  step: number;
  of: number;
  onChoose: (question: Question, option: Answer) => void;
}): React.JSX.Element {
  const heading = `onboarding-${question.id}`;
  return (
    /*
     * 12 between the four blocks of a question, not the 16 the column outside
     * uses, and it is bought rather than chosen. At 320x568 - the smallest phone
     * in the audit sweep - the GM's fourth answer ended 5px under the pinned
     * nav, because "How many players at your table?" is the one headline that
     * wraps to two lines at 296px of column. Four gaps at 16 are 64px of a 446px
     * window; at 12 they are 48, and the last row lands at 492 against a fold at
     * 499. Nothing else on any viewport needed it, and nothing else pays for it.
     */
    <div className="stack" style={{ gap: 12 }}>
      <div className="spread" style={{ alignItems: 'baseline' }}>
        <span className="t-label">
          QUESTION {step + 1} OF {of}
        </span>
        {question.gm && (
          <span className="t-label" style={{ color: 'var(--fear)' }}>
            GM BRANCH
          </span>
        )}
      </div>
      <h2 id={heading} className="t-vital" style={{ margin: 0, color: 'var(--text)' }}>
        {question.title}
      </h2>
      <p className="t-dense" style={{ margin: 0, maxWidth: '46ch' }}>
        {question.why}
      </p>
      <div className="stack" role="group" aria-labelledby={heading} style={{ gap: 10 }}>
        {question.options.map((option) => (
          <AnswerRow
            key={option.label}
            glyph={option.glyph}
            label={option.label}
            sub={option.sub}
            onPick={() => onChoose(question, option)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * What is about to be written, and where each of it lives afterwards.
 *
 * This card is the reason a skip is safe. Every route ends here - answered,
 * half-answered or skipped outright - and it is the only place the app says out
 * loud that a first run writes four preferences and nothing else. The last line
 * names the screen each one is changed on, because the failure this flow can
 * cause is not a wrong answer, it is somebody who cannot find where they said it.
 */
function Summary({
  isGm,
  patch,
  answered,
  onFinish,
}: {
  isGm: boolean;
  patch: Partial<Prefs>;
  answered: number;
  onFinish: () => void;
}): React.JSX.Element {
  // The words the roll bar will actually carry, from the same three branches
  // `rollAffordance` picks between.
  const digital = patch.digitalDice ?? true;
  const manual = patch.manualDice ?? false;
  const dice = digital ? 'ROLL' : manual ? 'ENTER YOUR DICE' : 'NO DICE TURNED ON';

  const rows: Array<[string, string]> = [
    ['AT THE TABLE', isGm ? 'GM' : 'Player'],
    ['THE ROLL BAR SAYS', dice],
    ['GM TOOLS', (patch.gmSection ?? true) ? 'On' : 'Off'],
  ];
  if (isGm) rows.push(['PLAYERS', String(patch.gmPartySize ?? 4)]);
  rows.push(['QUESTIONS ANSWERED', answered === 0 ? 'None — skipped' : String(answered)]);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <span className="t-label">{answered === 0 ? 'NOTHING ANSWERED' : 'THAT IS EVERYTHING'}</span>
      <h2 className="t-vital" style={{ margin: 0, color: 'var(--text)' }}>
        {isGm ? 'Your table is ready' : 'Ready when you are'}
      </h2>
      <p className="t-dense" style={{ margin: 0, maxWidth: '46ch' }}>
        {isGm
          ? 'Next: name your first session. Nothing here left this device.'
          : 'Next: the nine classes, each one readable in full. Nothing here left this device.'}
      </p>

      <div className="stack" role="group" aria-label="What this writes" style={{ gap: 6 }}>
        {rows.map(([key, value]) => (
          <div
            key={key}
            className="spread"
            style={{ gap: 10, paddingBottom: 5, borderBottom: '1px dashed var(--line-soft)' }}
          >
            <span className="t-label">{key}</span>
            <span className="t-meta" style={{ color: 'var(--hope)', textAlign: 'right' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <p className="t-dense" style={{ margin: 0, maxWidth: '52ch' }}>
        Every one of these is changed later: the dice and the GM tools in Settings, the number of
        players on the PCs stepper in the encounter builder. Nothing here is asked again.
      </p>

      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onFinish}
          style={{ minHeight: 48, minWidth: 168 }}
        >
          {isGm ? 'Open the table' : 'Create a character'}
        </button>
      </div>
    </div>
  );
}
