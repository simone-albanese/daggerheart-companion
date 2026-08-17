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
 * ## Nothing is written until the last button
 *
 * Answers are held in this component and go to `setPrefs` once, on the hand-off.
 * That is not tidiness, it is the contract `loadPrefs` states: a record with no
 * `onboarded` key is read as *already onboarded*, because every install that
 * predates the field is in that state. A flow that wrote each answer as it was
 * given would leave exactly such a record behind the moment somebody answered
 * one question and closed the tab - and the next launch would read that
 * half-finished run as a completed one and never ask again.
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
 * (`--tap`) - 20px of headroom - and every row is full width, the largest
 * target this column can make. That holds at 1180 with a mouse too, where
 * `--control` is 34: the rows do not shrink with the floor.
 *
 *   viewport        window   content   rows            fold
 *   393x852          730      730      185-397 / -471   783   no scroll
 *   393x852 inset    637      637      244-456          749   no scroll
 *   375x667          545      545      185-397          598   no scroll
 *   375x667 party    545      598      185-471          598   scrolls 53
 *   375x667 inset    467      524      229-441          564   scrolls 57
 *   320x568          446      551      185-408          499   scrolls 105
 *   320x568 party    446      635      206-492          499   scrolls 189
 *   744x1133        1011     1011      189-401         1064   no scroll
 *   1180x800         678      678      194-406          731   no scroll
 *   852x393          271      484      189-401          324   scrolls 213
 *   568x320          198      492      185-397          251   scrolls 294
 *
 * The reading of that table. On every portrait phone, at every safe-area
 * setting, **every answer is above the fold** - including the GM's fourth on the
 * smallest phone in the sweep, which lands at 492 against a fold at 499. Where
 * the screen scrolls, what is below the fold is the licence notice, which is
 * exactly where that notice is meant to be. Two things buy that fit and both are
 * named where they are set: the question runs at `t-vital`, which clamps to 21px
 * at these widths where the demo's 25px would have wrapped every headline to two
 * lines, and the gaps inside a question are 12 rather than 16.
 *
 * The arc, honestly. At 393x852 the rows occupy y185 to y471 and a one-handed
 * thumb is comfortable from about y300 down, so the first row is a stretch and
 * the rest are in the arc. That is the wrong way round if this were a control
 * strip and it is the right way round for what it is: four rows that are read
 * before any of them is touched, once, on a screen with nothing else on it. The
 * 286px of rows is a slide rather than a re-grip, and the two controls that ARE
 * reflexes - Back and Skip - are 48px tall in the pinned nav at y783-831, the
 * band the wizard's Back and Next already occupy and the same band `TabBar`
 * holds on every other screen.
 *
 * Landscape scrolls and is meant to: 271px of window at 852x393 and 198 at
 * 568x320 cannot hold a headline and three 64px rows however they are arranged,
 * and the nav stays put through it. The Play screen scrolls and so does this.
 */
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../store/state.ts';
import type { Prefs } from '../../store/prefs.ts';
import { useIsPhone } from '../shared/useLayout.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';

interface Answer {
  /** Two to four characters of mono in the leading square. */
  glyph: string;
  label: string;
  /** What the app does differently, in the words the app itself will use. */
  sub: string;
  set: Partial<Prefs>;
  /** Opens the third question and sends the hand-off to the GM screen. */
  branch?: 'gm';
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

export function Onboarding(): React.JSX.Element {
  const setPrefs = useApp((s) => s.setPrefs);
  const setScreen = useApp((s) => s.setScreen);
  const phone = useIsPhone();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [isGm, setIsGm] = useState(false);
  /** Every patch given so far, in the order they were given. */
  const [patch, setPatch] = useState<Partial<Prefs>>({});
  /** How many of the questions were actually answered, for the summary. */
  const [answered, setAnswered] = useState(0);

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
    setAnswered((n) => n + 1);

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
    setAnswered(0);
    setStep(0);
    setDone(true);
  };

  /*
   * The one write, and the hand-off.
   *
   * `setPrefs` first and `setScreen` second: `setScreen` writes `lastScreen`
   * through the same store action, so it spreads over a record that already
   * carries the answers rather than racing them.
   */
  const finish = (): void => {
    setPrefs({ ...patch, onboarded: true });
    setScreen(isGm ? 'gm' : 'build');
  };

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div
        ref={panel}
        className="scroll"
        style={{ flex: 1, minHeight: 0, padding: phone ? '14px 12px 20px' : '18px 20px 24px' }}
      >
        <div className="stack" style={{ gap: 16, maxWidth: 720, margin: '0 auto' }}>
          <Rail count={asked.length} at={done ? asked.length : step} />
          {done ? (
            <Summary isGm={isGm} patch={patch} answered={answered} onFinish={finish} />
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
          disabled={done}
          style={{ minHeight: 48, minWidth: 108 }}
        >
          Skip these
        </button>
      </nav>
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
          <Row key={option.label} option={option} onPick={() => onChoose(question, option)} />
        ))}
      </div>
    </div>
  );
}

/**
 * One answer: a glyph, a label, and the consequence under it.
 *
 * 64px against the app's 44px floor, and full width, because this is the whole
 * business of the screen it is on and there is nothing to share the column with.
 * The tap on the answer is also the tap that advances - there is no Next to find
 * at the bottom, which is what keeps a two-question flow at two taps.
 */
function Row({
  option,
  onPick,
}: {
  option: Answer;
  onPick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="row"
      onClick={onPick}
      style={{
        minHeight: 64,
        width: '100%',
        gap: 14,
        padding: '12px 14px',
        borderRadius: 'var(--r3)',
        background: 'var(--raised)',
        border: '1px solid var(--line)',
        textAlign: 'left',
      }}
    >
      <span
        aria-hidden="true"
        className="t-meta"
        style={{
          flex: 'none',
          width: 34,
          height: 34,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--r2)',
          background: 'var(--panel)',
          border: '1px solid var(--line)',
          color: 'var(--hope)',
          letterSpacing: '0.02em',
        }}
      >
        {option.glyph}
      </span>
      <span className="stack" style={{ gap: 3, minWidth: 0 }}>
        {/*
          `balance` because the longest label here wraps at 320px and left to
          itself put the single word "now" on a line of its own - measured, and
          the one thing the audit sweep flagged on this screen at any viewport.
          An orphan under a 218px line is the row looking like a mistake.
        */}
        <span style={{ font: '600 15px/1.2 var(--sans)', color: 'var(--text)', textWrap: 'balance' }}>
          {option.label}
        </span>
        <span className="t-meta" style={{ color: 'var(--dim)' }}>
          {option.sub}
        </span>
      </span>
    </button>
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
