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
 *
 * And now they are read by the card as well as by the GM: the damage field on
 * `CombatantCard` turns the number a player says into HP through the same
 * `severityFor` the player's own vitals use, so nobody at this table is doing
 * that comparison in their head twice. Nothing it works out is applied until
 * APPLY is pressed.
 */
import { useEffect, useState } from 'react';
import type { Adversary } from '../../../shared/types.ts';
import { countdownsIn } from '../../../shared/campaigns.ts';
import type { Countdown } from '../../engine/encounter.ts';
import { combatantHit, isVulnerableAt, SEVERITY_LABEL } from '../../engine/damage.ts';
import type { SceneCombatant } from '../../engine/encounter.ts';
import { useApp } from '../../store/state.ts';
import { Counter } from '../shared/Counter.tsx';
import { Fold } from '../shared/Fold.tsx';
import { damageLabel, EnvironmentBand, FeatureList, signed } from './StatBlock.tsx';
import { openCombatants, openEnvironment, useGm } from './gmStore.ts';

export function Scene({ phone }: { phone: boolean }): React.JSX.Element {
  /*
   * Everything this runner draws comes off the OPEN ROW, and there is no second
   * array behind any of it to disagree with. That is what campaign schema 5
   * bought.
   *
   * `openCombatants` and `openEnvironment` are the store's own selectors and
   * not four lines of `find` written out here, because each carries an
   * argument this file would otherwise have to restate: the first returns the
   * row's OWN array by reference and never a copy, and the second refuses to
   * fall back to `board.environmentRef`. That fallback is not a convenience -
   * the board is the encounter builder's workbench, and a runner that borrowed
   * its place would draw the fight in the PREVIOUS scene's terrain, which is
   * the defect the scene row absorbed the fight to close.
   *
   * ## What the by-reference return buys here, and what it does not
   *
   * It buys immunity to every commit that does not rebuild `session`. `useGm`
   * compares by identity, so a fresh `[]` out of that selector would repaint
   * this grid on every `+1` of Fear - `combatantsIn`'s docblock in
   * `shared/campaigns.ts` is where that argument is made, and this file
   * depends on it rather than restating it.
   *
   * It does NOT buy immunity to a combatant write. The line four below -
   * `const session = useGm((s) => s.session)`, which `sceneClocks` and the
   * open-row guard both need - subscribes to the whole array, and
   * `withSceneFight` rebuilds `session` for every mark on every row. So a mark
   * ANYWHERE repaints this component and, since neither `Scene` nor
   * `CombatantCard` is memoised, every card under it.
   *
   * Counted rather than reasoned, because a memo is a lie until you count
   * renders: a counter as the first statement of this function, two scene rows
   * each holding one combatant, `openScene: 'A'`. `nudgeFear(1)` and
   * `setRegion` give 0 renders each; `patchCombatant` gives 1 whether it lands
   * on 'A' or on 'B' (the very first session write of a run costs 2, the extra
   * one being `schedule()` flipping `dirty`); and `combatantsIn(session, 'A')`
   * keeps its identity across all of them.
   *
   * That cost is small and it is stated rather than hidden, but do not write it
   * up as an optimisation this component has. Nothing on the glass can mark a
   * row the runner is not showing today - `patchCombatant` has no caller
   * outside `CombatantCard`, which only ever passes the open row's id, and
   * `Gm.tsx` draws the plan `inert` underneath the runner - so the day a
   * control appears on some other row's fight, this is a real repaint and the
   * fix is to stop subscribing to `session` whole, not to add a memo.
   */
  const openScene = useGm((s) => s.openScene);
  const combatants = useGm(openCombatants);
  const environmentRef = useGm(openEnvironment);
  const session = useGm((s) => s.session);
  // Only this scene's. `countdownsOf` still means every clock in the campaign,
  // and the board and the long rest still read that one.
  const sceneClocks = countdownsIn(session, openScene);
  const clearScene = useGm((s) => s.clearScene);
  const openNewScene = useGm((s) => s.openNewScene);
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

  /*
   * A flip disarms it, and the reason is the same one the paragraph above
   * gives for arming unconditionally.
   *
   * This component does not unmount when the switcher points the runner at
   * another row, so without this a GM who arms END SCENE, flips to another
   * scene and taps again inside the four seconds destroys the fight they have
   * just ARRIVED at rather than the one they armed. The sentence beside the
   * button would have counted the old fight when the first tap landed and the
   * new one when the second did, and the second tap is the one that acts.
   *
   * It is not the tap count depending on unseen state - it is the arming
   * pointing at a table that is no longer there.
   */
  useEffect(() => {
    setArmed(false);
  }, [openScene]);

  /*
   * TWO EMPTY STATES, AND THEY ARE NOT THE SAME ABSENCE.
   *
   * This one is "the runner is pointed at nothing"; the one further down is
   * "the row it is pointed at holds no fight". They were one state until the
   * fight moved onto the row, because the board's combatant list was the only
   * thing there was to be empty and `Nothing in the scene` covered both. It
   * cannot now: a GM who has opened this tool before any scene exists is being
   * told what is missing (a scene) rather than what to put in it, and the two
   * answers are different gestures.
   *
   * Everything above this point in the render is a fact about the open row -
   * its place, its clocks, its count, and END SCENE, which takes the row's id
   * and has none to take. So this returns rather than hiding four blocks: a
   * band drawn from `null`, a clock list that `countdownsIn(session, null)`
   * would fill with the CAMPAIGN's clocks under a scene heading, and an END
   * SCENE with nothing to end.
   *
   * The guard is the pointer AND the row, not the pointer alone. `showScene`
   * refuses an id naming no scene row and `readCampaignRecord` nulls a
   * dangling one on load, so this second half should be unreachable - but the
   * cost of being wrong about that is a runner drawing an empty fight the plan
   * does not list, and the cost of the check is one `some` per render.
   *
   * The region padding below is written out again rather than hoisted into a
   * `pad` const shared by the two returns. `tests/ui/gmGeometryProse.test.ts`
   * reads `minHeight: 0, gap: 10, padding: phone ?` out of this file's SOURCE
   * to prove the tool's column is what every measured width in that suite was
   * measured inside, and a const makes that guard unfindable while changing
   * nothing on the glass. One duplicated ternary is the cheaper of the two.
   */
  if (openScene === null || !session.some((i) => i.kind === 'scene' && i.id === openScene)) {
    return (
      <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: phone ? '10px 12px 0' : '14px 20px 0' }}>
        <div className="panel stack" style={{ flex: 'none', padding: 18, gap: 12, alignItems: 'flex-start' }}>
          <div className="t-vital">No scene is open</div>
          <p className="t-body" style={{ margin: 0, maxWidth: 460 }}>
            A fight is kept on the scene row it is fought in, with every mark on it, so there is
            nothing to draw until one of those rows is open. Start one here, or open a scene from
            the plan.
          </p>
          {/*
            Its own row above the doors, and the only primary in this panel.
            The two below open tools that build a roster; this one makes the
            place the roster is going to land in, and it is the shorter path
            from here to a table with something on it.
          */}
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                openNewScene();
              }}
            >
              Start a new scene
            </button>
          </div>
          <BuilderDoors primary={false} />
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: phone ? '10px 12px 0' : '14px 20px 0' }}>
      {environment !== undefined && (
        <EnvironmentBand environment={environment} strongestHere={strongestHere} />
      )}

      {/*
        The clocks this scene owns, decision 18.

        Directly under the band, because they are the scene's own facts and
        belong with the place rather than with the fight: the grid below is
        adversaries and nothing else, and a clock among the cards would be a
        card that is not one.

        The five terms are the ones `PrimaryCountdown` already declares - name,
        `−` 44x44, a 62px readout, `+` 44x44 - so a GM's hands already know the
        shape. Cost: 54.00 of SCROLLABLE content per clock (44 plus the stack's
        10 gap), 0.00 of viewport, and 0.00 to the card grid, which is
        `flex: 'none'` with `gridAutoRows: 'max-content'` and is sized by its
        cards and by nothing else.

        NEVER `.t-dense`: the cost line below is the only `p.t-dense` in this
        whole tree, and two tests assert exactly one.

        NOTHING TICKS. Not on a park, not on a resume, not on END SCENE, not on
        archiving. "A countdown that ticks on its own is one you stop trusting.
        So: plus and minus, and nothing else." Scope changes reach and
        attention, never arithmetic - and this is the first optimisation
        somebody will propose, so it is refused here in writing.
      */}
      {sceneClocks.length > 0 && (
        <div className="stack" style={{ flex: 'none', gap: 10 }}>
          {sceneClocks.map((c) => (
            <SceneCountdown key={c.id} countdown={c} />
          ))}
        </div>
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
              clearScene(openScene);
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

        Every clause is read off `clearScene`. The combatants go, and with them
        every HP and Stress mark, which is the whole reason this module keeps
        them. The environment, the Fear pool and the session's countdowns are
        not in that commit and do not move. That is not an accident of
        implementation any more: `docs/handoff/DECISIONI-2026-08-23.md` §1
        closed the scene question and cited this very behaviour as the app
        having already answered it in the same direction. A decision that has
        been taken belongs on the glass rather than left to be inferred from
        what happens to survive.

        WHAT THAT COMMIT IS, NOW THAT THERE IS ONE PLACE TO EMPTY. END SCENE
        empties the open row and leaves you standing in it. There is no second
        write and no pointer let go of: `clearScene(sceneId)` is one call to
        the store's one writer of a row's combatants, and `openScene` is
        deliberately untouched, because the GM said "this fight is over" and
        not "take me away from this table".

        This paragraph used to describe a second write - the board's list, then
        the ROW the fight had been parked out of - and argued that without the
        second one, ending a fight and flipping back to its row would put every
        adversary back on their feet. That state cannot be built any more: the
        row IS the fight, so there is no copy left over to fall out of step,
        and the argument is retired here rather than restated somewhere it
        would go stale again.
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
            The sentence names the bestiary only while the bestiary is there,
            for the reason `BuilderDoors` below states about its own button.
          */}
          <p className="t-body" style={{ margin: 0, maxWidth: 460 }}>
            Build an encounter and send the roster here
            {bestiary ? ', or open the bestiary and drop a single adversary straight in' : ''}.
            Whatever you add keeps its HP, Stress and spotlight through a reload — this screen
            survives the browser closing mid-fight.
          </p>
          <BuilderDoors primary />
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
            /*
             * Keyed on the row as well as the combatant, because `c.id` alone
             * is not unique across a flip.
             *
             * A combatant id is ROW-LOCAL, and that is now the stated invariant
             * rather than a consequence of where the array happened to live:
             * `spawn` scans for a free index over the row it is spawning into
             * and says so in as many words, so the dungeon and the forest can
             * both hold `acid-burrower-0` and neither is wrong. With `c.id`
             * alone as the key React reuses the same card component across a
             * flip and its local state goes with it - the half-typed damage
             * number and the open fold cross from one fight into another.
             *
             * `openScene` is a string by the guard above, so the key has no
             * empty-pointer case left to spell.
             */
            <CombatantCard
              key={`${openScene}:${c.id}`}
              sceneId={openScene}
              combatant={c}
              adversary={byRef.get(c.adversaryRef)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The two doors out of an empty runner, drawn under both of its empty states.
 *
 * One component and not two copies, because the rule underneath them is one
 * rule and it is a rule about a preference: the button names the bestiary only
 * while the bestiary is there. It is switchable in Settings, and these two
 * empty states are the only place in the app outside SHOW that offers it - a
 * button here with the preference off would be a door to a room the screen
 * will not open, and the sentence above it naming a tool that is gone is the
 * same defect one step quieter. The encounter builder is not switchable, which
 * is what keeps either state from ever being buttonless.
 *
 * `primary` is which absence is being answered, not a style choice. On an open
 * row with nothing in it the encounter builder IS the next thing to do. With
 * no row open at all it is the second thing, behind starting one, and two
 * primary buttons in one panel is a panel that has not decided.
 */
function BuilderDoors({ primary = false }: { primary?: boolean }): React.JSX.Element {
  const setRegion = useGm((s) => s.setRegion);
  const bestiary = useApp((s) => s.prefs.gmBestiary);
  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        type="button"
        className={primary ? 'btn btn-primary' : 'btn'}
        onClick={() => setRegion('encounter')}
      >
        Build an encounter
      </button>
      {bestiary && (
        <button type="button" className="btn" onClick={() => setRegion('bestiary')}>
          Open the bestiary
        </button>
      )}
    </div>
  );
}

/**
 * ONE CARD WAS TALLER THAN THE WHOLE PANEL THAT HOLDS IT, SO THE CARD FOLDS.
 *
 * ## The measurement, and it is the only Chrome anything below stands on
 *
 * Taken on the deploy, viewport 393x852, insets 47 top and 34 bottom, pointer
 * coarse, a campaign with its roster on the board, inside OPEN THE FIGHT: the
 * scrollable panel is 498px and one `CombatantCard` measured "558.00" for the
 * Acid Burrower and "534.50" for the Bear. The damage field on the first
 * combatant landed at `top: 852.41` on an 852px window - below the glass,
 * unreachable without scrolling to it.
 *
 * THE DEFECT IS OLDER THAN THE DAMAGE FIELD, and that is worth being exact
 * about, because it decides whether the answer is a fold or a revert. In the
 * same box before the field existed the card measured "504.00", which was
 * already 6px past the panel. The field and the card's gap above it added 54
 * and took the overflow from 6 to 60. Nothing was broken by the row that made
 * it visible; the card had simply never fitted.
 *
 * `PROGETTO-GM §7` item 3 asked whether a card carrying a motives line AND a
 * damage field still leaves TWO cards readable on one screen, and stays under a
 * thumb's arc at about 330px. The measured answer is harder than the question:
 * it did not leave ONE.
 *
 * ## What is above the fold, and the criterion
 *
 * The criterion the owner set is what a GM LOOKS AT WHILE THE FIGHT IS RUNNING,
 * not what is interesting about the thing. Everything a round asks for stays on
 * the glass, in this order:
 *
 *   - the name, the tier and role, SPOTLIGHT and the remove ✕;
 *   - HP and Stress, because they are what damage lands on;
 *   - DIF and the two thresholds, which are the numbers said out loud several
 *     times a round. This file's head docblock argues that permanence and the
 *     fold does not reopen it - the damage field reading the same thresholds
 *     saves the GM the comparison, not the glance;
 *   - the damage field and APPLY, which is the row this whole fold exists to
 *     get back above the crease;
 *   - how many Minions are standing, where the group has any - in the band with
 *     DIF and the thresholds rather than in a row of its own, which is the
 *     owner's decision of 2026-08-25 and is argued where it is drawn;
 *   - the attack: the bonus that is rolled, the name that is narrated, the dice
 *     that are read out, the range. That is the adversary's turn, and a turn is
 *     not a detail.
 *
 * Under it go the two things that are read once and then remembered:
 *
 *   - MOTIVES & TACTICS, which decides what the thing does across a scene
 *     rather than inside the four seconds of one exchange;
 *   - the features, which were ALREADY one tap away behind the SHOW n / HIDE
 *     button this fold replaces. Their reach did not change. WHAT DID CHANGE,
 *     and it is the price: the row of feature-name chips that was drawn under
 *     that button whether it was open or shut is gone, and the fold's summary
 *     carries the COUNT where the chips carried the NAMES. At four features
 *     that row was 37px. It is paid knowingly, and it is the one thing a GM can
 *     no longer read without a tap that they could before.
 *
 * The owner's list also named experiences and notes. Neither is on this card:
 * `SceneCombatant` carries `notes` and nothing here draws it, and an
 * adversary's experiences are drawn by `ReferenceTables`. There was nothing to
 * fold.
 *
 * REJECTED, named so they are not re-proposed as fresh ideas: one damage bar
 * for the whole scene (it costs two gestures to hit a monster that is not in
 * the spotlight), declaring the card too tall and leaving it, and growing the
 * panel - which is decision §2 of 23 August, the one that keeps the Fear bar on
 * the glass.
 *
 * ## Ergonomics: what a card taller than its panel actually costs
 *
 * THE SHARP VERSION OF THE DEFECT IS NOT THAT THE CARD IS TALL. It is that
 * while the card is taller than the box that scrolls it, THERE IS NO SCROLL
 * POSITION AT WHICH A WHOLE CARD IS ON THE GLASS. The GM had to choose, every
 * single exchange, between seeing the thresholds and the HP counter and seeing
 * the field that writes to it - the two halves of one action, on one card, that
 * could not be looked at together. Under the panel that stops being a choice,
 * and that is what the 471.00 buys rather than tidiness.
 *
 * THUMB ARC, and it is an argument rather than a rect. `Gm.tsx` reasons off a
 * right thumb covering roughly y 560-820 at 393x852, and with a countdown
 * pinned this panel is y 259.00 to 757.00 (`GmSheet.tsx` states both). A card
 * that fits inside 498 can be scrolled so that its damage row sits anywhere in
 * the panel the GM likes, the lower half included, and the counters and the
 * band come with it. A card that does not fit can only be pushed: getting the
 * damage row down into the thumb band meant driving the vitals off the top
 * edge. Nobody has re-measured a thumb against this, and this paragraph does
 * not pretend anybody has.
 *
 * TARGET SIZE: nothing here got smaller and nothing was taken away. Every
 * control above the crease keeps the floor it declared - SPOTLIGHT and ✕ at
 * `var(--control)`, the counters' steppers at `Counter`'s own 44, the damage
 * field at `var(--control)` and APPLY at a flat `var(--tap)`. The fold ADDS a
 * target: a header the full width of the card at `var(--tap)`, which is larger
 * than the SHOW n / HIDE row it replaces because that row shared its line with
 * a label. The feature chips that went were `<span>`s and never targets at all.
 *
 * READ VS TOUCH is what the whole crease is drawn along. Above it is everything
 * that is touched during a round, plus the numbers a round is answered with;
 * below it is prose - a motives line and rules text - which is read
 * between rounds and never pressed. The one control that crossed the line is
 * the features button, and it crossed it into a bigger target.
 *
 * ## What the fold makes the card - DERIVED FIRST, THEN MEASURED
 *
 * This was written as a sum with "nothing since the fold has been in front of a
 * browser" over it, because that was true when it was written. It is not any
 * more: the rig built this branch, served it and measured it in Chrome on
 * 2026-08-25 on the same surface and the same insets as the retired heights
 * above -
 * **471.00 exactly, on all three cards it put on the board.** The Bear included,
 * which had differed by 23.50 before the fold.
 *
 * THE DERIVATION STAYS, and not out of sentiment. The measurement says what the
 * card is today; the nine terms say WHY, and they are what goes red when
 * somebody moves a padding or a token. A rect on its own would go stale in
 * silence. So the sum below is still stated as a sum, and the browser has
 * simply agreed with it.
 *
 * **The shut card is 471.00 by declaration**: 2 of `.panel` border + 22 of the
 * card's own `padding: 11` + 50 of its five `gap: 10` + 44 of header row + 188
 * of counters + 31 of threshold band + 44 of damage row + 46 of attack row + 44
 * of shut fold. 471.00 against the 498 the panel scrolls, which is the goal
 * this lane was given, with 27.00 left over.
 *
 * The composite terms, so a reader can check them rather than take them - and
 * written without a count, because the count of a list is not a thing this repo
 * writes from memory:
 *
 *   - 44 of header row is the SPOTLIGHT chip's and the ✕'s `minHeight:
 *     'var(--control)'`, which is `var(--tap)` under `(pointer: coarse)`. The
 *     name stack beside them is shorter - a 15px name, a 5px gap and a 10px
 *     meta line - so the floor is the row;
 *   - 188 of counters, and NOT 90: the grid is `repeat(auto-fit, minmax(170px,
 *     1fr))` with `gap: 8` in a 341px column, and two 170px tracks plus that
 *     gap want 348. So `auto-fit` drops to one column and the two counters
 *     stack: 90 + 8 + 90, at `--counter-cell`'s 90 from viewport 390 up. That
 *     is 98px and the largest term on the card. It is not this lane's to
 *     reclaim: the 170 is `Vitals.tsx`'s measured min-content for a `Counter`
 *     labelled STRESS (165.81), and the reasoning beside the grid below says
 *     what a 160px track would do to it;
 *   - 31 of threshold band is the read-only arm of its `padding: minions ===
 *     undefined ? '8px 10px' : '0 10px'` twice over around a `.t-num` at
 *     `fontSize: 15`, whose `line-height: 1` makes the line 15. The other arm
 *     is the Minion group's, and it is the one exception below;
 *   - 44 of damage row is APPLY's `minHeight: 'var(--tap)'`, the flat coarse
 *     floor it declares inline;
 *   - 46 of attack row is its `borderTop` of 1, its `paddingTop: 9`, the 17px
 *     attack bonus, its `gap: 9` taken as the wrap gap, and the 10px `.t-meta`
 *     range line that `width: '100%'` puts on a second line;
 *   - 44 of shut fold is `Fold`'s own header, `minHeight: 'var(--tap)'`, with
 *     `gap: 0` while it is shut.
 *
 * WHY THAT SUM WAS WORTH BELIEVING BEFORE ANYBODY CHECKED IT. Run over the card
 * as it stood, term for term, the same arithmetic returns "558.00" for the Acid
 * Burrower and "534.50" for the Bear - both of Chrome's figures, to the half
 * pixel. A model that reproduces two independent measurements is worth writing
 * a third number out of; one that did not would be worth deleting instead. The
 * third number then came back from Chrome unchanged, which is three for three.
 *
 * AND THE TWO CARDS ARE NOW THE SAME HEIGHT, which is the same fact from the
 * other end. Their "23.50" of difference was entirely the feature chips - the
 * Burrower's four wrap to two rows where the Bear's three fit one, and a row of
 * chips is `.chip`'s 9.5px line plus its `padding: 4px 6px`, 17.50, plus the
 * 6px row gap. Both adversaries' motives are two lines at 341px. Every term
 * that varied between the two is now inside the fold, so shut, every adversary
 * in the book draws the same 471.00 - with one exception.
 *
 * ## THE EXCEPTION, WHICH USED TO BE A SECOND DEFECT AND IS NOW A SECOND ARM
 *
 * A Minion group is the only combatant carrying a number no other card carries:
 * how many bodies are still standing. It had a row of its own - a `Stepper`
 * from the encounter builder, 60 tall, plus the card's 10px gap - and that put
 * the shut card at "541.00", 43 past the panel, on 16 of the book's 129
 * adversaries. That figure was written down here rather than fixed, because
 * choosing where the control went was a decision this lane had not been given.
 *
 * IT WAS GIVEN ON 2026-08-25: the count joins DIF and the thresholds instead of
 * taking a row. The reason is conceptual before it is geometric - how many are
 * left standing is a figure of the creature, like Difficulty, not a control in
 * its own right - and the band's JSX comment below carries the whole of it,
 * including the two things that gave way for it and the alternatives that were
 * refused.
 *
 * A Minion group's band is the other arm: `padding: '0 10px'` around the flat
 * 44 its `−` and `+` declare, where an ordinary card's is 8 + 15 + 8. So the
 * band grows by 13 and nothing else on the card moves: **a Minion group's shut
 * card is 484.00 by the same declarations, 14.00 inside the panel.**
 *
 * On 2026-08-26 Chrome said 484.00 as well, on all four cards of a seeded group of
 * Giant Rats, beside the 471.00 of the three that are not Minions. It was a sum
 * when this lane wrote it and it is a measurement now; the derivation stays,
 * because it is what tells the next person which term to look at when one of
 * these moves.
 *
 * The row that went was not free of prose: what stood beside the old stepper,
 * and what the band no longer prints on a Minion card, is listed in the band's
 * comment under `## What gave way for it`. Both were read rather than pressed,
 * and both are still on the card behind one tap.
 *
 * TWO CARDS ON ONE SCREEN IS STILL NO. `PROGETTO-GM §7` item 3 wanted two
 * readable at once; 2 x 471.00 plus the grid's 10px gap is 952.00 against 498.
 * What the fold bought is the answer moving from "not even one" to "one, with
 * 27px to spare". The gate's own question has not been answered yes, and this
 * paragraph is here so nobody reads the 471.00 as though it had been.
 */
function CombatantCard({
  sceneId,
  combatant,
  adversary,
}: {
  /**
   * The row this card's fight is on, passed down rather than read from the
   * store here.
   *
   * Every write below names it, because the store's writers take the row
   * first: there is no "current" fight for them to assume any more. Passing it
   * also means the card cannot mark a combatant on a row the grid above is not
   * drawing, which a second `useGm((s) => s.openScene)` in here could do for
   * one render after a flip.
   */
  sceneId: string;
  combatant: SceneCombatant;
  adversary: Adversary | undefined;
}): React.JSX.Element {
  const patch = useGm((s) => s.patchCombatant);
  const remove = useGm((s) => s.removeCombatant);
  /*
   * The optional rule is the table's, and it is the same switch on both sides.
   *
   * `prefs.massiveDamageRule` is off by default and Settings words it in the
   * second person - "twice **your** Severe threshold" - which is why it read
   * like a PC-only rule. The owner settled it on 2026-08-25: a table that
   * turned it on sees it applied to the monsters too. Hard-coding `false` here
   * would have been the worst version, because it would have been silent:
   * their own vitals would ladder to Massive and the card in front of the GM
   * would not, with nothing on either screen saying why.
   */
  const massiveDamageRule = useApp((s) => s.prefs.massiveDamageRule);
  const [incoming, setIncoming] = useState('');
  const c = combatant;
  const down = c.hp.marked >= c.hp.max;
  /*
   * Read into a const so the narrowing survives into the handlers.
   * `c.minionsRemaining !== undefined` narrows the property for the JSX around
   * it and not for the arrow function inside it, because a property of a
   * mutable object can be reassigned between the check and the call as far as
   * the checker is concerned. A `const` cannot, so this is what the band's
   * `−`/`+` close over.
   */
  const minions = c.minionsRemaining;
  // Derived, so it can never disagree with the track the GM is tapping - and
  // it is the same test the player's sheet reads. See the band below.
  const vulnerable = isVulnerableAt(c.stress.marked, c.stress.max);

  const amount = Number(incoming);
  const hit =
    incoming.trim() !== '' && Number.isFinite(amount) && amount > 0
      ? combatantHit(amount, c, { massiveDamageRule, minionGroup: adversary?.minionGroup })
      : null;

  const applyHit = (): void => {
    if (hit === null) return;
    patch(sceneId, c.id, {
      hp: { ...c.hp, marked: hit.marked },
      ...(hit.minionsRemaining === undefined ? {} : { minionsRemaining: hit.minionsRemaining }),
    });
    setIncoming('');
  };

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
          onClick={() => patch(sceneId, c.id, { spotlighted: !c.spotlighted })}
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
          onClick={() => remove(sceneId, c.id)}
          aria-label={`Remove ${c.name} from the scene`}
          className="t-meta"
          style={{ flex: 'none', width: 'var(--control)', minHeight: 'var(--control)', color: 'var(--dim)' }}
        >
          ✕
        </button>
      </div>

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
          onChange={(v) => patch(sceneId, c.id, { hp: { ...c.hp, marked: v } })}
        />
        <Counter
          kind="stress"
          label="STRESS"
          value={c.stress.marked}
          max={c.stress.max}
          onChange={(v) => patch(sceneId, c.id, { stress: { ...c.stress, marked: v } })}
        />
      </div>

      {/*
       * HOW MANY ARE STILL STANDING IS A NUMBER OF THE CREATURE, LIKE DIFFICULTY.
       *
       * It had a row of its own - a `Stepper` from the encounter builder, label
       * over control, with a sentence beside it - and that row is why a Minion
       * group's shut card was 43px past the panel while every other card fitted.
       * The owner settled it on 2026-08-25 and the reason is conceptual before
       * it is geometric: how many bodies are left is one of the figures a GM
       * reads off the thing, and it belongs in the strip that already holds the
       * other three rather than in a control of its own.
       *
       * Three alternatives were named and rejected: under the fold (it is
       * touched DURING the fight, which is the criterion the fold was filled
       * by), left where it was with the overflow written down, and measured
       * before deciding.
       *
       * ## What the band pays for it, and what it stops paying
       *
       * `padding: '8px 10px'` while the strip is only read; `'0 10px'` the
       * moment it carries the control. Not a saving dressed up as a principle:
       * 8px of decoration above and below a 44px target is 16px the GM cannot
       * press, on the one row of this card where the target IS the height. With
       * the vertical padding gone the strip is exactly its target - 44 - and
       * the two 15px numbers beside it are centred in that by `.row`'s own
       * `align-items: center`. A card with no Minion group never reaches this
       * arm and its band is still 8 + 15 + 8 = 31, which is what keeps the
       * ordinary card at the 471.00 that was measured in Chrome.
       *
       * FLAT 44 AND NOT `var(--control)`, which is `Stepper`'s own choice and
       * is deliberately not copied. END SCENE at the top of this file already
       * argues the same inline literal for the same two reasons - 44 clears the
       * coarse floor outright so it clears the 34px fine one too, and an inline
       * number is the only place a test can read a height from. The band's
       * height is that 44, so a token that moved under a pointer query would
       * move this card's geometry with it.
       *
       * ## What gave way for it, and it is two things
       *
       * NO THRESHOLDS · ANY DAMAGE DEFEATS IS NOT DRAWN ON A MINION CARD ANY
       * MORE. That sentence exists to explain an EMPTY slot - the reason MAJOR
       * and SEVERE are missing - and on a Minion group the slot is not empty:
       * the count is in it, and a group whose bodies are counted one by one is
       * the reason there is no ladder to print. The rule itself is still on the
       * card twice over: the damage field one row down prints ANY DAMAGE
       * DEFEATS the instant a number is typed into it, and the `Minion (N)`
       * feature under the fold carries the SRD's own sentence at length. A
       * combatant with no thresholds and no Minion group - which the shipped
       * book does not contain, all 16 null-threshold adversaries being Minions
       * - still gets the sentence, because there the slot IS empty.
       *
       * Keeping it as a second band line was costed rather than waved off: the
       * 34 characters are 224.4 at `.t-meta`'s ~6.6, which cannot share a
       * 321px line with DIF, the rule and a 186.2px control, so it is a wrap,
       * and the band becomes 44 + a row gap + 10. At the smallest gap anybody
       * would draw that is 60, and the shut Minion card is 500.00 - two pixels
       * past the panel. That is the whole of what this paragraph is buying.
       *
       * AND THE GLOSS IS GONE: "One group. Each defeated Minion is one fewer
       * body in the same space." stood beside the old stepper. It was there
       * because a control alone on a row looks like a feature that needs
       * explaining; one number among three does not, and DIF, MAJOR and SEVERE
       * have never carried one. The `Minion (N)` feature says more than it did.
       *
       * ## The shape a custom dataset can still make
       *
       * The label and the control are one `.row` rather than two children of
       * the band, so a wrap can never leave MINIONS on one line and its `−`
       * on the next. That matters for the one combination the book does not
       * ship: thresholds AND a Minion group, which a replaceable dataset can
       * make. There the band draws both, wraps, and is 15 + 10 + 44 = 69,
       * which puts that card at 509.00. It is correct and it is taller; no
       * adversary in this book can reach it.
       */}
      <div
        className="row"
        style={{
          gap: 10,
          flexWrap: 'wrap',
          padding: minions === undefined ? '8px 10px' : '0 10px',
          borderRadius: 'var(--r2)',
          background: 'var(--app)',
        }}
      >
        <span className="t-meta">DIF</span>
        <span className="t-num" style={{ fontSize: 15 }}>
          {c.difficulty}
        </span>
        {/*
          VULNERABLE SITS ON DIF, BECAUSE DIF IS THE NUMBER IT CHANGES.

          The condition reads "all rolls targeting them have advantage", so
          what it costs a GM is not a fact about the monster - it is a fact
          about the roll the player is making right now, against the number
          two spans to the left. Anywhere else on the card it would be a
          status; here it is an instruction.

          Derived and never stored. `isVulnerableAt` in `engine/damage.ts` is
          the same two-number test the player's own sheet reads through
          `isVulnerableFromStress`, so a full Stress track means the same thing
          on both sides of the screen - which is the whole of the owner's
          decision 17 of 2026-08-26, and a reading of p.71 rather than a
          quotation.

          IT COSTS NO ROW, AND THAT IS MEASURED RATHER THAN HOPED. The band is
          `flexWrap`, so a word ADDED to it is a word that can wrap - and the
          Minion arm below has already costed exactly that: a second band line
          puts the shut Minion card at 500.00 against a 498 panel. So the word
          could not be added. It takes the DIVIDER's place: on a card with
          thresholds that 1px rule reads as "figures end, ladder begins", and a
          condition is neither of those.

          Chrome, 393x852 with insets 47/34 and a coarse pointer, two Acid
          Burrowers one Stress apart: the card is **471.00** with the word and
          **471.00** without it, and the band is **31** in both - the
          `8 + 15 + 8` this file states for a card with no Minion group. The
          word itself is **66.00 x 10.00**, ten `.t-meta` characters, against
          the 11 the divider and its gap gave back, inside a 341px band. 471.00
          is the number the fold was measured at, so this changes no term of
          the nine-term derivation above.
        */}
        {vulnerable ? (
          <span className="t-meta" style={{ color: 'var(--damage)' }}>
            VULNERABLE
          </span>
        ) : (
          <span style={{ width: 1, height: 13, background: 'var(--line)' }} />
        )}
        {c.thresholds !== null ? (
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
        ) : (
          minions === undefined && (
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              NO THRESHOLDS · ANY DAMAGE DEFEATS
            </span>
          )
        )}
        {minions !== undefined && (
          <span className="row" style={{ flex: 'none', gap: 8 }}>
            <span className="t-meta">MINIONS</span>
            <span className="row" style={{ gap: 0 }}>
              <button
                type="button"
                aria-label="Decrease Minions standing"
                disabled={minions <= 0}
                onClick={() => patch(sceneId, c.id, { minionsRemaining: Math.max(0, minions - 1) })}
                style={{
                  width: 44,
                  minHeight: 44,
                  font: '700 17px/1 var(--sans)',
                  opacity: minions <= 0 ? 0.35 : 1,
                }}
              >
                −
              </button>
              <span
                aria-live="polite"
                style={{
                  minWidth: 44,
                  textAlign: 'center',
                  font: '800 17px/1 var(--sans)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {minions}
              </span>
              <button
                type="button"
                aria-label="Increase Minions standing"
                onClick={() => patch(sceneId, c.id, { minionsRemaining: minions + 1 })}
                style={{ width: 44, minHeight: 44, font: '700 17px/1 var(--sans)' }}
              >
                +
              </button>
            </span>
          </span>
        )}
      </div>

      {/*
       * THE NUMBER THE PLAYER SAYS OUT LOUD, TYPED WHERE IT IS READ.
       *
       * "26" arrives across the table and the GM has to turn it into HP. Until
       * now that meant reading MAJOR and SEVERE off the band above, doing the
       * comparison in their head, and pressing `+` on the HP counter the right
       * number of times - three separate places for one hit to go wrong, while
       * three other things are happening. `combatantHit` in `engine/damage.ts`
       * does all of it from one number, and it is the same `severityFor` the
       * player's own vitals ladder through, so the two sides of the table
       * cannot arrive at different answers.
       *
       * WHERE IT SITS, AND WHY IT IS EXACTLY HERE. Directly under the band: the
       * figure that is read and the figure that is typed are adjacent. ("And
       * directly above the Minion stepper [...] the one control the hit can
       * also move - Minions standing - is the next thing down" stood here, and
       * the row it named is gone.) The hit still moves that count, and the
       * count is now IN the band a line up rather than in a row below - so the
       * one control this field writes to besides HP is on the row the GM is
       * already reading off. The panel is `size="full"` inside `GmSheet` and a full tool
       * on a 393x852 phone gets a band rather than the window, so a row here is
       * expensive; this is one row, and it is the row that removes three
       * gestures.
       *
       * READ AT A GLANCE, TOUCHED ONCE. The field is `--control` because it is
       * read as much as it is pressed - the GM checks the number they typed
       * before they commit it - and 84px is `Vitals.tsx`'s own non-band width
       * for the same three digits at the same mono face. APPLY is a flat 44,
       * the coarse floor, declared inline because a floor set in a class is a
       * floor no test can read. Enter commits too, for the same reason it does
       * on the player's calculator: a GM typing with a keyboard should not have
       * to go and find a button.
       *
       * THE VERDICT IS DRAWN BEFORE IT IS APPLIED, never after. Nothing here
       * moves a track until APPLY - Architecture 3.2's *proposta, mai
       * automatismo*, the same rule the countdowns board states at the top of
       * its file. The preview also carries the Minion count, because the one
       * number does two things and a GM must see both before committing.
       *
       * THE DIVISOR COMES FROM `byRef` WHILE THE THRESHOLDS BESIDE IT COME
       * FROM THE COMBATANT, and that is the shape `sceneTruth.test.tsx` pins
       * *against* for Difficulty. It is not the same case. The disagreement
       * that test guards is two sources for ONE number: `makeCombatant` copies
       * `difficulty` onto the combatant at spawn (the `difficulty: a.difficulty`
       * line in `src/engine/encounter.ts` - named rather than numbered, because
       * that citation read `:231` when it was written and 82972a1 moved it to
       * 235 later in this same wave), so the
       * dataset and the scene row can drift apart and the card must print the
       * copy the GM can see. The combatant record carries no divisor at all -
       * `SceneCombatant` has `minionsRemaining` and nothing to divide by - so
       * there is nothing here for `byRef` to contradict. And when the lookup
       * misses, the arithmetic is simply absent: the card already says NOT IN
       * THIS DATASET, and a guessed divisor would be worse than none.
       */}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          type="number"
          inputMode="numeric"
          value={incoming}
          placeholder="damage"
          aria-label={`Damage to ${c.name}`}
          onChange={(e) => setIncoming(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyHit()}
          style={{
            flex: 'none',
            width: 84,
            minHeight: 'var(--control)',
            padding: '6px 8px',
            font: '600 15px/1 var(--mono)',
          }}
        />
        <button
          type="button"
          className="btn"
          disabled={hit === null}
          onClick={applyHit}
          style={{ flex: 'none', minHeight: 'var(--tap)', padding: '0 14px' }}
        >
          APPLY
        </button>
        {hit !== null && (
          <span className="t-meta" style={{ flex: 1, minWidth: 0, color: 'var(--text-2)' }}>
            {hit.severity === null
              ? 'ANY DAMAGE DEFEATS'
              : `${SEVERITY_LABEL[hit.severity].toUpperCase()} · ${hit.hp} HP`}
            {hit.minionsDefeated > 0
              ? ` · ${hit.minionsDefeated} MINION${hit.minionsDefeated === 1 ? '' : 'S'}`
              : ''}
          </span>
        )}
      </div>

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

      {/*
        THE CREASE. Everything above it is a round; everything in it is the
        thing. The head docblock argues which is which and what the fold makes
        the card - this note is only about the three decisions made here.

        `Fold` AND NOT A SECOND DISCLOSURE OF ITS OWN. Its file states the
        difference: `Disclosure` keys its open state on `<characterId>:<id>` and
        writes it into `prefs.playSections`, which is *the Play screen's
        per-character folds*, and a combatant is nobody's sheet. `Fold` opens
        shut every time, which is the right default for something you consult,
        act on and close - and it is what this fold's traffic is. It also gives
        the card a header the whole width of the column at `var(--tap)`, where
        the SHOW n / HIDE button it replaces had put its own `minHeight: 44` on
        the same job by hand.

        THE LABEL IS BUILT AND NOT WRITTEN, and as of database version 3 only
        one of its three arms is reachable. MARKED RATHER THAN COLLAPSED - see
        below for why it is still built.

        The argument used to be that the SRD alone did not fix what is in here:
        the book ships motives and features on all 129 adversaries, so
        `MOTIVES & FEATURES` is what a GM sees, but a Core Rulebook layer could
        add an adversary the SRD does not have, and that one might carry only
        the one field. Every step of that is now gone. Nothing can import a
        rulebook, no new layer can be made, and version 3 deletes the layers
        devices were still carrying, so `s.dataset.adversaries` is exactly the
        129 - verified, and none of the 129 has an empty `motives` or an empty
        `features`. Both single-word arms are dead, and so is the outer guard's
        false side.

        Kept because collapsing them would be a bet on the dataset, and there
        is a known change to it in flight: the SRD 2 work brings 311 statblocks
        against these 148, on parsers that do not exist yet. A branch that is
        unreachable because of what the data happens to hold is not the same as
        one that is unreachable by construction, and this is the first kind.
        Deleting it would have to be undone by whoever finds the first statblock
        that carries one field.

        A fold labelled for what is not inside it is worse than one word longer.
        The guard is the same shape: no motives and no features, no fold.

        THE SUMMARY COUNTS RATHER THAN NAMES. That is the one thing the fold
        takes away - the chip row of feature names that used to sit under the
        button, drawn open or shut - and the head docblock costs it at 37px and
        accepts it. A summary long enough to carry the names would put the
        header itself over one line: `Fold` draws it `flex: 'none'` in a `.row`
        that does not wrap, so the names would not wrap, they would overflow.
      */}
      {adversary !== undefined && (adversary.motives.length > 0 || adversary.features.length > 0) && (
        <Fold
          label={
            adversary.motives.length === 0
              ? 'Features'
              : adversary.features.length === 0
                ? 'Motives'
                : 'Motives & features'
          }
          summary={
            adversary.features.length === 0
              ? undefined
              : `${adversary.features.length} FEATURE${adversary.features.length === 1 ? '' : 'S'}`
          }
        >
          {/*
            What the thing wants, in the component that decides what it does.
            `AdversaryBlock` has printed MOTIVES & TACTICS on the bestiary card
            since the beginning; this is that line, not a second vocabulary for
            the same field, so a GM who has read one recognises the other.

            It is a full-width row of its own rather than a third line in the
            name stack, because that stack never gets the card's whole column.
            The header row is `gap: 8` over three children: the name stack
            (`flex: 1, minWidth: 0`, so basis 0 and it takes the remainder), the
            SPOTLIGHT chip (`flex: 'none'`, `padding: '0 10px'`) and the remove
            button (`flex: 'none', width: 'var(--control)'`). Neither control
            has a border to spend: `base.css` gives every button `border: 0` and
            `.chip` declares none. So off the 341 below go two 8px gaps, the ✕,
            and the chip's 20 of padding - **261px at the ceiling**, before the
            chip's label costs a pixel, and the label only takes more.

            The ✕ is 44 here and not 34, and that is this paragraph's own
            arithmetic changing under it. It was a literal `34` beside a
            `--control` height, so on a phone it was a destructive target 34px
            wide under a thumb, below the floor `tokens.css` sets and the floor
            `Countdowns.tsx` had already written down as condemning this very
            button. Width reads the same token the height reads now: 44 on any
            coarse pointer, still 34 on a wide window with a fine one. The
            ceiling was **271px** while it was 34, which is what it still is
            where `--control` is still 34 - this paragraph is about 393, so 261
            is its number. (Those three
            children were cited as `:327`, `:328`, `:345-356` and `:364-368`
            while this file was under edit, and the fold moved every one of
            them. They are named by their declarations now, which is this
            repo's own rule about a file still being written.)

            "Well under half the card's width" stood here and was false in the
            direction that matters: 261 is over three quarters of 341 before the
            label, and for the stack to fall under half the label would have to
            measure 90.5px - ten pixels a character across nine characters of a
            9.5px font. What SPOTLIGHT's `600 9.5px/1 var(--mono)` at 0.06em
            (`base.css`, `.chip`) actually measures is the one term here that is
            not a declaration, and it has not been in a browser; do not read a
            figure for the stack itself out of this paragraph, because there
            isn't one.

            The conclusion survives without it. The stack is short of the column
            by at least 80px of declared chrome plus the chip's widest label -
            nine characters, since pressed it reads SPOTLIT and gives two back -
            and the motives line runs to 92 characters (below) where the name
            above it is already `whiteSpace: 'nowrap'` with an ellipsis. A
            sentence that long wants the widest column on the card, which is the
            full 341 and not the remainder of a shared row. Inside the fold it
            still gets it: `Fold`'s children are the full width of a `.stack`
            that is itself the full width of this card.

            Full width the card's inner column is 341px at 393, and the
            subtraction starts at 391 rather than at 393. `Scene` is mounted in
            one place, the `<GmSheet … size="full">` block in `Gm.tsx` - named
            by its block and not by a line, because "`Gm.tsx:281`" stood here
            and the mount had already moved down the file. Inside a
            `size="full"` `GmSheet` whose overlay pads zero horizontally
            (`padding: full || phone ? 0 : 24`) and whose panel is `width:
            '100%'` with `border: 1px solid var(--line)`; at `base.css`'s
            `box-sizing: border-box` that makes the sheet's content box 391.00,
            which `GmSheet.tsx` states and `Reference.tsx` measured. 391 less
            the region's 24px of padding, less this card's four pixels of
            border, less its own 22 of padding, is 341.

            Four pixels of border and not two: `.panel` declares `border: 1px
            solid var(--line-soft)`, but this `<article>` overrides the left one
            to `3px solid` on the element itself, so three pixels come off one
            edge where one comes off the other. "343" stood here and "345"
            before it - the first spent the sheet's border nowhere, the second
            spent neither that nor the left edge's extra two. `Gm.tsx` retired
            its own "345" for the second of those and
            `tests/ui/gmGeometryProse.test.ts` keeps a guard over the files
            behind it.

            The label plus the motives measures 37 characters at its shortest,
            58 at the median and 92 at its longest over all 129 adversaries in
            the book, every one of which carries motives. `.t-meta` is 10px IBM
            Plex Mono at 0.06em, which is a 0.6 advance plus the tracking -
            ~6.6px a character, the figure `GearPicker.tsx` derives and
            `ReferenceTables.tsx` uses for this class - so 341 holds 51
            characters a line, which is exactly what 343 held: 51 characters
            want 336.6px and 52 want 343.2, and both columns fall in that gap.
            No conclusion moves with the width: 37 is one line, 58 and 92 are
            both two. Two lines at 1.5 is 30px.

            "Whether two cards still read on one screen after that is
            PROGETTO-GM §7 item 3, and it has not been in a browser" ended this
            paragraph. It has been in a browser since, the answer was no twice
            over, and it is the whole reason this line is inside a fold. The
            head docblock carries the measurement and what came of it; this
            sentence is kept only so the next reader can see that the question
            was asked here first and left open.

            The undefined arm needs nothing: a combatant whose adversary is not
            in this dataset has no motives to print, no features either, and so
            draws no fold at all - and the meta line in the header already says
            NOT IN THIS DATASET rather than leaving the absence unexplained.
          */}
          {adversary.motives.length > 0 && (
            <span className="t-meta" style={{ lineHeight: 1.5 }}>
              MOTIVES &amp; TACTICS · {adversary.motives.join(', ').toUpperCase()}
            </span>
          )}
          {adversary.features.length > 0 && <FeatureList features={adversary.features} />}
        </Fold>
      )}
    </article>
  );
}

/**
 * One clock this scene owns, on the glass while the scene is running.
 *
 * The same five terms as the top bar's pinned countdown, in the same order and
 * at the same sizes, because a GM's hands should not have to learn a second
 * shape for the same job. It is a different component and not a shared one on
 * purpose: that one is a row of a 159px-tall bar with its own width budget,
 * this one is a `flex: 'none'` child of a scroller, and folding them together
 * would tie the runner's layout to the top bar's.
 *
 * `−` advances toward zero, the same polarity as every other countdown control
 * in this app. A surface that ran the other way from the board it mirrors would
 * be the app disagreeing with itself about which direction time goes.
 */
function SceneCountdown({ countdown }: { countdown: Countdown }): React.JSX.Element {
  const advance = useGm((s) => s.advanceCountdown);
  const spent = countdown.value === 0;

  return (
    <div className="row" style={{ flex: 'none', gap: 8, minHeight: 44 }}>
      <span className="stack" style={{ flex: 1, minWidth: 0, gap: 1, alignItems: 'flex-start' }}>
        <span
          className="t-label"
          style={{
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {countdown.name}
        </span>
        <span className="t-meta" style={{ color: spent ? 'var(--damage)' : 'var(--dim)' }}>
          {spent ? 'SPENT — IT HAPPENS NOW' : `OF ${countdown.start}`}
        </span>
      </span>
      <button
        type="button"
        onClick={() => advance(countdown.id, -1)}
        aria-label={`Advance ${countdown.name} by one`}
        className="btn"
        style={{ flex: 'none', width: 44, minHeight: 44, font: '700 19px/1 var(--sans)' }}
      >
        −
      </button>
      <span
        style={{
          flex: 'none',
          minWidth: 62,
          textAlign: 'center',
          font: '800 24px/1 var(--sans)',
          fontVariantNumeric: 'tabular-nums',
          color: spent ? 'var(--damage)' : 'var(--text)',
        }}
      >
        {countdown.value}
      </span>
      <button
        type="button"
        onClick={() => advance(countdown.id, 1)}
        aria-label={`Move ${countdown.name} back by one`}
        className="btn"
        style={{ flex: 'none', width: 44, minHeight: 44, font: '700 19px/1 var(--sans)' }}
      >
        +
      </button>
    </div>
  );
}
