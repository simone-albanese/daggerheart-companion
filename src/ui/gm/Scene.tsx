/**
 * The live scene.
 *
 * Same counters as the player sheet, on purpose: a GM who plays this game has
 * already learned what a `-`, a number and a `+` do, and there is no reason for
 * their side of the screen to work differently. That sentence used to name
 * `Track` and the tap-and-hold pips, and it stayed true only until the player's
 * own vitals became numbers - see `CombatantCard` below for why an adversary
 * followed, and for the three things that went with the pips. Thresholds sit
 * under the counters permanently rather than behind a tap, because they are the
 * number you are asked for out loud, several times a round.
 */
import { useEffect, useState } from 'react';
import type { Adversary } from '../../../shared/types.ts';
import type { SceneCombatant } from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { Counter } from '../shared/Counter.tsx';
import { Stepper } from './Encounter.tsx';
import { damageLabel, EnvironmentBand, FeatureList, signed } from './StatBlock.tsx';
import { useGm } from './gmStore.ts';

export function Scene({ phone }: { phone: boolean }): React.JSX.Element {
  const combatants = useGm((s) => s.combatants);
  const environmentRef = useGm((s) => s.environmentRef);
  const setRegion = useGm((s) => s.setRegion);
  const clearScene = useGm((s) => s.clearScene);
  // `index.byRef` holds every kind of record under one key space, so reading an
  // adversary out of it is an unchecked assertion. The adversary list is the
  // only lookup that can actually promise the type.
  const adversaries = useApp((s) => s.dataset.adversaries);
  const environments = useApp((s) => s.dataset.environments);
  const bestiary = useApp((s) => s.prefs.gmBestiary);

  const byRef = new Map(adversaries.map((a) => [a.id, a]));
  const environment = environments.find((e) => e.id === environmentRef);
  const spotlit = combatants.filter((c) => c.spotlighted).length;
  /*
   * What Ambushed and Ambushers mean by `Difficulty: Special`, for the band.
   *
   * It reads the combatants' own `difficulty` rather than the adversaries' -
   * `makeCombatant` copies it at spawn and the card prints that copy, so this
   * is the number a GM can see under it. Deriving from `byRef` instead would
   * let the band and the card beneath it disagree.
   *
   * That copy is exactly why the decision was unguarded for a round: a
   * combatant built by `makeCombatant` has the two numbers agreeing, so no
   * test made from one can tell which was read, and the `byRef` version passed
   * the entire suite. `sceneTruth.test.tsx` now puts them in disagreement - a
   * board copy the dataset has moved under, and a combatant whose adversary is
   * not in this dataset at all - and asserts the band follows the board.
   *
   * `undefined` on an empty board, never 0: the band draws no substitute
   * without one, and 0 here would be the same lie the readout was suppressed
   * for in the first place.
   */
  const strongestHere =
    combatants.length === 0
      ? undefined
      : combatants.reduce((n, c) => Math.max(n, c.difficulty), 0);

  /*
   * Ending a scene throws away every HP and Stress mark in it, and this module
   * exists to keep those. One tap arms it; the next one does it.
   *
   * Unconditionally, and that is the whole decision. The narrower version -
   * arm only while `combatants.length > 0`, because an empty scene has nothing
   * to lose - was proposed and rejected: it makes END SCENE a control whose
   * number of taps depends on state the GM is not looking at, so the muscle
   * memory built at a full table misfires at an empty one and vice versa. The
   * price is one extra tap at an empty table. It is known and it is accepted;
   * do not re-add the condition as an optimisation.
   */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: phone ? '10px 12px 0' : '14px 20px 0' }}>
      {environment !== undefined && (
        <EnvironmentBand environment={environment} strongestHere={strongestHere} />
      )}

      <div className="spread" style={{ flex: 'none' }}>
        <span className="t-label">
          Scene — {combatants.length} adversar{combatants.length === 1 ? 'y' : 'ies'}
        </span>
        <span className="row" style={{ gap: 14, flex: 'none' }}>
          <span className="t-meta" style={{ color: spotlit > 0 ? 'var(--hope)' : 'var(--dim)' }}>
            {spotlit} SPOTLIT
          </span>
          <button
            type="button"
            className="t-meta"
            onClick={() => {
              if (!armed) {
                setArmed(true);
                return;
              }
              clearScene();
              setArmed(false);
            }}
            style={{
              letterSpacing: '0.1em',
              // 44 clears the coarse floor outright, so it clears the 34px fine
              // one too, and it is inline because that is the only place a test
              // can read a height from: a class or a stretch measures 0.
              minHeight: 44,
              padding: '0 var(--s3)',
              marginRight: -8,
              color: armed ? 'var(--damage)' : undefined,
              fontWeight: armed ? 600 : undefined,
            }}
          >
            {armed ? 'TAP AGAIN TO END' : 'END SCENE'}
          </button>
        </span>
      </div>

      {/*
        What END SCENE costs, on the glass at all times rather than only while
        it is armed.

        It says it here rather than in the label, because the label is the
        target the thumb is already aiming at and a label that grew into a
        sentence would move the box between the two taps of one gesture. That
        much was right. What was wrong was gating the line on `armed`.

        ## The jump this used to make

        `armed` is cleared by a 4-second timer, not by a tap (see the `armed`
        block above). So a GM who armed END SCENE and then did anything else -
        which is every abandoned confirmation - had the sentence taken away
        from under a hand that had not moved, and everything below it came up
        with it: the whole card grid, every HP and Stress track, every
        SPOTLIGHT chip, every remove ✕.

        The size of that jump is the sentence's own height plus this stack's
        10px gap. `.t-dense` is `400 11.5px/1.38 var(--sans)`
        (`tokens.css:540`), so one line box is 15.87px: with the gap, the jump
        is 25.87px at one line, 41.74 at two and 57.61 at three.

        "Both are at or over the 44px coarse floor the END SCENE button
        declares in the row immediately above" stood here, and 41.74 is not at
        or over 44. The floor is real - `minHeight: 44`, written on that button
        a few lines up this file - but only the three-line jump clears it, and
        three lines is not reachable at the wording that ships: the string runs
        57 characters at its shortest and 118 at its longest over the whole
        book (the budget is worked out below), which is one line or two. So
        what the gate actually moved the grid by was up to 41.74px - 95% of a
        whole touch target, not more than one.

        That is still the defect, and the height was never the whole of it. It
        moved on a timer, for no gesture at all, and it moved into the hand: at
        393 x 852 a right thumb covers roughly y 560-820 (the band `Gm.tsx`
        reasons off), and the grid below is `flex: 1` down to the bottom edge,
        so that band is card grid all the way through.

        ## Why permanence, and not a reserved gap

        Reserving the space and filling it only when armed costs exactly the
        same pixels and gives nothing back for them. Keeping the line always
        costs those pixels and buys the GM the consequence *before* the first
        tap instead of after it, which is what a confirmation step is for.

        Nothing about the string depends on `armed`, so nothing about the box
        does: arming changes `color` and only `color`, and colour moves no
        geometry. There is therefore no reflow on arming either, by
        construction rather than by measurement. Weight is deliberately left
        out of it - 600 widens every glyph and could take the wrap with it,
        which is the same jump one step quieter.

        The remaining motion is a real state change the GM made: adding or
        removing an adversary rewrites the count, and can move the wrap. The
        grid changes under that tap anyway.

        ## The price, and the wording that bounds it

        At 393 the content width is 367, and "393 - 24 of region padding =
        369" stood here because it began one border too far out. `Scene` has
        exactly one mount point - `Gm.tsx`, inside `<GmSheet
        label={TOOL_LABEL[tool]} size="full">` - and that overlay declares
        `padding: full || phone ? 0 : 24`, which is zero on both sides, around
        a panel at `width: '100%'` with `border: '1px solid var(--line)'`.
        Under `base.css`'s `box-sizing: border-box` the sheet's content box at
        393 is 391.00, so this region's 24px of padding leaves 367.00. Not
        derived here for the first time: `GmSheet.tsx`'s own docblock states
        the 391.00, and `Reference.tsx` - the other `full` tool padding 12 a
        side - states the identical 367.00 and says it was measured in Chrome.
        (The overlay paid `calc(env(safe-area-inset-top) + 8px) 0 0` when that
        was measured, and is `position: absolute` inside the stage now. Both
        spend zero horizontally, which is the only axis this paragraph is
        about; the vertical price is in `GmSheet.tsx`.)

        11.5px Archivo at 400 averages about 5.6px a character -
        `RuleTableView.tsx:72` puts `.t-read`, 13px of the same face at 400, at
        about 6.3, and 6.3/13 of 11.5 is 5.57 - so a line holds about 65
        characters, and 63 even at a pessimistic 5.75 (367/5.75 = 63.8; it read
        64 while the column read 369). The longest string this can build over
        the shipped book is 118: a three-digit count and `Burning Heart of the
        Woods`, the longest of the 19 environment names. 118 is inside both
        2 x 65 and 2 x 63, so it is still two lines at either figure, the
        permanent cost is still 31.74px and 41.74 with the gap, and it still
        never becomes three. The two pixels moved the character budget and left
        every conclusion drawn from it standing.

        Two lines is what the wording buys. The old sentence gave the
        environment its own clause - "X stays the environment. Fear and the
        countdowns stay as they are." - which over the same worst case (a
        three-digit count and the same environment name) is 152 characters,
        past 2 x 65 and past 2 x 63 alike, so three lines at either figure.
        ("151" stood here and was one character short.) Naming it inside the
        list of what stays says the same thing in 118. The band directly above
        is labelled Environment and carries that name, so the list needs no
        second label for it.

        Read-vs-touch: this is read and never touched. It carries no target and
        takes none away - the button keeps its 44px inline floor above it, the
        grid keeps every pixel below it - and it sits at the top of the screen,
        directly under the row it explains and far out of the 560-820 band,
        which is where this app puts what is read rather than answered.

        Every clause is read off `clearScene`, which is `commit({ combatants:
        [] })` and nothing else. The combatants go, and with them every HP and
        Stress mark, which is the whole reason this module keeps them. The
        environment, the Fear pool and the session's countdowns are not in that
        commit and do not move. That is not an accident of implementation any
        more: `docs/handoff/DECISIONI-2026-08-23.md` §1 closed the scene
        question and cited this very behaviour as the app having already
        answered it in the same direction. A decision that has been taken
        belongs on the glass rather than left to be inferred from what happens
        to survive.
      */}
      <p
        className="t-dense"
        style={{
          flex: 'none',
          margin: 0,
          // The only property arming is allowed to touch here, because it is
          // the only one that cannot resize the box.
          color: armed ? 'var(--text-2)' : 'var(--muted)',
        }}
      >
        {combatants.length === 0
          ? 'Nothing to clear. '
          : `Clears ${combatants.length} adversar${combatants.length === 1 ? 'y' : 'ies'} and every HP and Stress mark on them. `}
        {environment === undefined
          ? 'No environment is set; Fear and the countdowns stay.'
          : `${environment.name}, Fear and the countdowns stay.`}
      </p>

      {combatants.length === 0 ? (
        <div className="panel stack" style={{ flex: 'none', padding: 18, gap: 12, alignItems: 'flex-start' }}>
          <div className="t-vital">Nothing in the scene</div>
          {/*
            The sentence names the bestiary only while the bestiary is there.
            It is switchable in Settings, and this empty state is the one place
            in the app outside SHOW that offers it - a button here with the
            preference off would be a door to a room the screen will not open,
            and a sentence naming a tool that is gone is the same defect one
            step quieter. The encounter builder is not switchable, which is what
            keeps this state from ever being buttonless.
          */}
          <p className="t-body" style={{ margin: 0, maxWidth: 460 }}>
            Build an encounter and send the roster here
            {bestiary ? ', or open the bestiary and drop a single adversary straight in' : ''}.
            Whatever you add keeps its HP, Stress and spotlight through a reload — this screen
            survives the browser closing mid-fight.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={() => setRegion('encounter')}>
              Build an encounter
            </button>
            {bestiary && (
              <button type="button" className="btn" onClick={() => setRegion('bestiary')}>
                Open the bestiary
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          /*
            NOT A SCROLLER OF ITS OWN ANY MORE, AND THAT IS THE FIX.
            
            This was `className="scroll"` with `flex: 1; minHeight: 0`, which
            made the cards the only thing on this screen that could be scrolled.
            The environment band above is `flex: 'none'`, so opening it with SHOW
            grew it past the panel edge - unreachable, because nothing above the
            cards scrolled - and, once `GmSheet` was given a scroller, would have
            done the opposite harm instead: a `flex: 1` grid beside a taller
            `flex: 'none'` sibling in a fixed-height box collapses to nothing, so
            the fix for the band would have taken the cards away.
            
            One scroller, in `GmSheet`'s panel body, and everything here is a
            block inside it: the band, the count, END SCENE and the cards all
            move together. The GM scrolls back to the top to end the scene, which
            is the same gesture that reaches the environment they just read, and
            the panel's own ESC and ✕ never move at all.
          */
          style={{
            flex: 'none',
            display: 'grid',
            gridTemplateColumns: phone ? '1fr' : 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: 10,
            // Rows must be sized by their cards, not by the scroll viewport:
            // a Solo with seven features cannot be squeezed to the height of
            // the Minion group beside it.
            gridAutoRows: 'max-content',
            alignItems: 'start',
            alignContent: 'start',
            paddingBottom: 14,
          }}
        >
          {combatants.map((c) => (
            <CombatantCard key={c.id} combatant={c} adversary={byRef.get(c.adversaryRef)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CombatantCard({
  combatant,
  adversary,
}: {
  combatant: SceneCombatant;
  adversary: Adversary | undefined;
}): React.JSX.Element {
  const patch = useGm((s) => s.patchCombatant);
  const remove = useGm((s) => s.removeCombatant);
  const [openFeatures, setOpenFeatures] = useState(false);
  const c = combatant;
  const down = c.hp.marked >= c.hp.max;

  return (
    <article
      className="panel stack"
      style={{
        gap: 10,
        padding: 11,
        borderLeft: `3px solid ${c.spotlighted ? 'var(--hope)' : down ? 'var(--damage)' : 'transparent'}`,
        opacity: down ? 0.72 : 1,
      }}
    >
      <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
        <span className="stack" style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <span
            style={{
              font: '700 15px/1.15 var(--sans)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {c.name}
          </span>
          <span className="t-meta" style={{ letterSpacing: '0.08em' }}>
            {adversary === undefined
              ? 'NOT IN THIS DATASET'
              : `T${adversary.tier} · ${adversary.role.toUpperCase()}`}
            {down ? ' · DEFEATED' : ''}
          </span>
        </span>
        <button
          type="button"
          className="chip"
          aria-pressed={c.spotlighted}
          onClick={() => patch(c.id, { spotlighted: !c.spotlighted })}
          style={{
            flex: 'none',
            minHeight: 'var(--control)',
            padding: '0 10px',
            background: c.spotlighted ? 'var(--hope)' : 'var(--raised)',
            color: c.spotlighted ? 'var(--app)' : 'var(--muted)',
            fontWeight: c.spotlighted ? 700 : 600,
          }}
        >
          {c.spotlighted ? 'SPOTLIT' : 'SPOTLIGHT'}
        </button>
        <button
          type="button"
          onClick={() => remove(c.id)}
          aria-label={`Remove ${c.name} from the scene`}
          className="t-meta"
          style={{ flex: 'none', width: 34, minHeight: 'var(--control)', color: 'var(--dim)' }}
        >
          ✕
        </button>
      </div>

      {/*
        What the thing wants, in the component that decides what it does.
        `AdversaryBlock` has printed MOTIVES & TACTICS on the bestiary card
        since the beginning; this is that line, not a second vocabulary for the
        same field, so a GM who has read one recognises the other.

        It is a full-width row of its own rather than a third line in the name
        stack, because that stack never gets the card's whole column. Its row
        at `:327` is `gap: 8` over three children: this stack (`:328`, `flex:
        1, minWidth: 0`, so basis 0 and it takes the remainder), the SPOTLIGHT
        chip (`:345-356`, `flex: 'none'`, `padding: '0 10px'`) and the remove
        button (`:364-368`, `flex: 'none', width: 34`). Neither control has a
        border to spend: `base.css:46` gives every button `border: 0` and
        `.chip` declares none. So off the 341 below go two 8px gaps, the 34,
        and the chip's 20 of padding - **271px at the ceiling**, before the
        chip's label costs a pixel, and the label only takes more.

        "Well under half the card's width" stood here and was false in the
        direction that matters: 271 is four fifths of 341 before the label, and
        for the stack to fall under half the label would have to measure 100.5px
        - eleven pixels a character across nine characters of a 9.5px font.
        What SPOTLIGHT's `600 9.5px/1 var(--mono)` at 0.06em
        (`base.css:356-364`) actually measures is the one term here that is not
        a declaration, and it has not been in a browser; do not read a figure
        for the stack itself out of this paragraph, because there isn't one.

        The conclusion survives without it. The stack is short of the column by
        at least 70px of declared chrome plus the chip's widest label - nine
        characters, since pressed it reads SPOTLIT and gives two back - and the
        motives line runs to 92 characters (below) where the name above it is
        already `whiteSpace: 'nowrap'` with an ellipsis. A sentence that long
        wants the widest column on the card, which is the full 341 and not the
        remainder of a shared row.

        Full width the card's inner column is 341px at 393, and the
        subtraction starts at 391 rather than at 393. `Scene` is mounted only
        at `Gm.tsx:281`, inside a `size="full"` `GmSheet` whose overlay pads
        zero horizontally and whose panel is `width: '100%'` with `border: 1px
        solid var(--line)` (`GmSheet.tsx:95-104`); at `base.css:13`'s
        `box-sizing: border-box` that makes the sheet's content box 391.00,
        which `GmSheet.tsx` states and `Reference.tsx:37-39` measured. 391 less
        the region's 24px of padding, less this card's four pixels of border,
        less its own 22 of padding, is 341.

        Four pixels of border and not two: `.panel` declares `border: 1px solid
        var(--line-soft)` (`base.css:235`), but this `<article>` overrides the
        left one to `3px solid` on the element itself, so three pixels come off
        one edge where one comes off the other. "343" stood here and "345"
        before it - the first spent the sheet's border nowhere, the second
        spent neither that nor the left edge's extra two. `Gm.tsx` retired its
        own "345" for the second of those and `tests/ui/gmGeometryProse.test.ts`
        keeps a guard over the files behind it.

        The label plus the motives measures 37 characters at its shortest, 58
        at the median and 92 at its longest over all 129 adversaries in the
        book, every one of which carries motives. `.t-meta` is 10px IBM Plex
        Mono at 0.06em, which is a 0.6 advance plus the tracking - ~6.6px a
        character, the figure `GearPicker.tsx:716-720` derives and
        `ReferenceTables.tsx` uses for this class - so 341 holds 51 characters
        a line, which is exactly what 343 held: 51 characters want 336.6px and
        52 want 343.2, and both columns fall in that gap. No conclusion moves
        with the width: 37 is one line, 58 and 92 are both two. Two lines at
        1.5 is 30px, and this stack's gap is 10, so HP and everything under it
        drops about 40px. Whether two cards still read on one screen after that
        is PROGETTO-GM §7 item 3, and it has not been in a browser.

        The undefined arm needs nothing: a combatant whose adversary is not in
        this dataset has no motives to print, and the meta line above already
        says NOT IN THIS DATASET rather than leaving the absence unexplained.
      */}
      {adversary !== undefined && adversary.motives.length > 0 && (
        <span className="t-meta" style={{ lineHeight: 1.5 }}>
          MOTIVES &amp; TACTICS · {adversary.motives.join(', ').toUpperCase()}
        </span>
      )}

      {/*
       * NUMBERS, NOT PIPS - THE SAME TRADE THE PLAY COCKPIT MADE.
       *
       * These two were `<Track>` rows: a silhouette of pips a GM had to count.
       * An adversary's HP is read across a table, mid-fight, while three other
       * things are happening, and counting eleven shapes is not reading. Decision
       * 7 already made this call for the player's own vitals - `Vitals.tsx` says
       * why at length - and an adversary is the surface where it matters more,
       * because the GM is holding six of them at once and the player is holding
       * one.
       *
       * WHAT GOES WITH THE PIPS, AND IT IS NOT NOTHING. `Vitals.tsx` enumerates
       * the three and they are the same three here: a pip row sets any value in
       * one click where a number is one `+` per point; the press-and-hold that
       * cleared a track has no `Counter` equivalent; and MARKED survives only
       * inside `Counter`'s accessible name rather than being printed. The GM
       * keeps the one that matters most in their hands - marking one HP at a
       * time is what actually happens when damage lands - and the reset that
       * clears a whole scene is still one control away, on END SCENE.
       *
       * TOUCH IS NOT REDUCED. `Counter` declares its steppers at its own 44px
       * floor and does not follow `--control` down, so nothing here got smaller
       * than the pip row it replaces.
       *
       * `auto-fit` and not two fixed columns: a card in this grid is as narrow
       * as 330px minus its padding, and two counters do not always fit in that.
       * `auto-fit` drops to one column when they do not, rather than pushing the
       * card's own width out and breaking the grid it sits in.
       *
       * 170 AND NOT 160, AND THE NUMBER IS BORROWED RATHER THAN GUESSED.
       * `Vitals.tsx` measured a `Counter`'s min-content in Chrome while sizing
       * the cockpit - 44 and 44 of steppers, 2 of border and the value button's
       * own label line, which for `STRESS` came to 165.81. A 160px column would
       * be under that floor and the counter would spill its own cell by six
       * pixels; 170 clears it with the widest of the two labels used here. If a
       * longer label ever arrives, this number moves with it.
       */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 8,
        }}
      >
        <Counter
          kind="hp"
          label="HP"
          value={c.hp.marked}
          max={c.hp.max}
          onChange={(v) => patch(c.id, { hp: { ...c.hp, marked: v } })}
        />
        <Counter
          kind="stress"
          label="STRESS"
          value={c.stress.marked}
          max={c.stress.max}
          onChange={(v) => patch(c.id, { stress: { ...c.stress, marked: v } })}
        />
      </div>

      <div
        className="row"
        style={{
          gap: 10,
          flexWrap: 'wrap',
          padding: '8px 10px',
          borderRadius: 'var(--r2)',
          background: 'var(--app)',
        }}
      >
        <span className="t-meta">DIF</span>
        <span className="t-num" style={{ fontSize: 15 }}>
          {c.difficulty}
        </span>
        <span style={{ width: 1, height: 13, background: 'var(--line)' }} />
        {c.thresholds === null ? (
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            NO THRESHOLDS · ANY DAMAGE DEFEATS
          </span>
        ) : (
          <>
            <span className="t-meta">MAJOR</span>
            <span className="t-num" style={{ fontSize: 15 }}>
              {c.thresholds[0]}
            </span>
            <span className="t-meta">SEVERE</span>
            <span className="t-num" style={{ fontSize: 15 }}>
              {c.thresholds[1]}
            </span>
          </>
        )}
      </div>

      {c.minionsRemaining !== undefined && (
        <div className="row" style={{ gap: 10 }}>
          <Stepper
            label="Minions standing"
            value={c.minionsRemaining}
            onChange={(n) => patch(c.id, { minionsRemaining: n })}
          />
          <span className="t-dense" style={{ color: 'var(--muted)', flex: 1, minWidth: 0 }}>
            One group. Each defeated Minion is one fewer body in the same space.
          </span>
        </div>
      )}

      {adversary !== undefined && (
        <div
          className="row"
          style={{ gap: 9, flexWrap: 'wrap', borderTop: '1px solid var(--line-soft)', paddingTop: 9 }}
        >
          <span style={{ font: '800 17px/1 var(--sans)', fontVariantNumeric: 'tabular-nums' }}>
            {signed(adversary.attackBonus)}
          </span>
          <span style={{ font: '600 13px/1.15 var(--sans)', color: 'var(--text-2)' }}>
            {adversary.attack.name}
          </span>
          <span className="t-num" style={{ marginLeft: 'auto', color: 'var(--damage)' }}>
            {adversary.attack.damage}
          </span>
          <span className="t-meta" style={{ width: '100%', letterSpacing: '0.07em' }}>
            {adversary.attack.range.toUpperCase()} · {damageLabel(adversary.attack.damageType)}
          </span>
        </div>
      )}

      {adversary !== undefined && adversary.features.length > 0 && (
        <>
          <button
            type="button"
            className="row"
            aria-expanded={openFeatures}
            onClick={() => setOpenFeatures((o) => !o)}
            style={{ gap: 8, minHeight: 44, justifyContent: 'space-between' }}
          >
            <span className="t-label">Features</span>
            <span className="chip" style={{ color: 'var(--text-2)' }}>
              {openFeatures ? 'HIDE' : `SHOW ${adversary.features.length}`}
            </span>
          </button>
          {openFeatures ? (
            <FeatureList features={adversary.features} />
          ) : (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: -4 }}>
              {adversary.features.map((f, i) => (
                <span key={`${f.name}-${i}`} className="chip" style={{ color: 'var(--text-3)' }}>
                  {f.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </article>
  );
}
