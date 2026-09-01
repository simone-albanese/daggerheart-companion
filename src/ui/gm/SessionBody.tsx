/**
 * What is inside a session row when the GM opens it.
 *
 * One arm per kind of row, and `unreadable` is the reason this file is
 * written the way it is. `readSessionItem` keeps an item it cannot read rather
 * than dropping it from a list whose length the GM knows by heart, and keeps a
 * link whose target this build has no screen for. That decision only pays off
 * if both of them can be *drawn*, so both are drawn here: the unreadable row
 * shows its own bytes, and a link this dataset cannot resolve says so and shows
 * the ref, instead of rendering nothing and looking like a bug.
 *
 * ## Two arms live in their own files, and both of them draw
 *
 * `url` and `note` arrived with campaign schema 2 as a *storage* layer - a
 * type, a reader, a writer and an export - and for one commit their arms were
 * placeholders that said so on screen. `UrlArm.tsx` and `NoteArm.tsx` exist
 * because the union is exhaustive and a row that rendered nothing would look
 * exactly like the bug this file was written to prevent.
 *
 * **Both screens have since landed, and this section described the
 * placeholders for longer than they existed.** `UrlArm` draws the punycode
 * address as text and an `<a className="btn">` OPEN IN A NEW TAB built out of
 * `externalLinkAttrs`, carrying a `minHeight: 44` of its own - a control,
 * which is why the Targets paragraph below counts it and why the whole-screen
 * sweep had to be taught to see an anchor. It still says the one thing that is
 * a limitation rather than a gap: it is the only control on the row that
 * leaves the app, and it needs a tap. `NoteArm` walks the block format -
 * headings, paragraphs and bullets, spans drawn as `<strong>`/`<em>` - and
 * builds no markup out of any string, which is the property the format was
 * chosen for.
 *
 * **Those two arms are files and the other five are not, and that is about the
 * schedule rather than about the code.** They were the pair a *separate* lane
 * each replaced wholesale; in here they were one region with no section rule
 * between them, so those two lanes would have been rewriting adjacent halves of
 * one region of one file with nothing else in common. A file each was a merge.
 * The scene, encounter, link, countdown and unreadable arms were not being
 * replaced by anybody, so moving them too would have been churn dressed up as
 * symmetry - and they are the arms the rest of this header is about, which is
 * the second reason they stayed. What is left here is the dispatch: the switch
 * below still answers every kind, and the two `case` lines name imports.
 *
 * ## The plan is not the workbench, and the fight is on the row
 *
 * A campaign has one board, and since schema 5 it is the encounter builder's
 * workbench and nothing else: one roster, one set of adjustments, one active
 * environment (`GmBoard`). It holds no combatant list at all. A session row
 * carries its *own* roster, adjustments and environment ref - and a scene row
 * carries its own fight, every combatant and every mark on it - and nothing in
 * the store copies one into the other. So opening the encounter builder from
 * row 3 shows the same workbench as row 5, and that is not a bug to hide
 * behind a sentence: the workbench and a plan are two different things with
 * the same shape.
 *
 * The rows therefore carry the crossing explicitly, in both directions, built
 * only out of actions the store already has: PUT THIS <thing> ON THE BOARD and
 * KEEP THE BOARD'S <thing> HERE, for the two things a row and the workbench
 * both hold - an environment and a roster. Every one of those verbs names the
 * noun it moves, because four buttons about "the board" on one strip are four
 * buttons a GM has to open one at a time to tell apart, and one of them
 * overwrites a plan.
 *
 * A fight has no crossing verb because it has nowhere to cross to. It is on
 * the scene row it is fought in, always; `withSceneFight` in `gmStore` is the
 * only writer of one, and `CLEAR THIS FIGHT` on this arm is the only control
 * that empties it. This paragraph used to argue the reverse - that a row's
 * stored combatants could not be put back with their marks, so the row said so
 * as a fact with no control - and that was an argument about a fight kept
 * somewhere else and copied here. There is no somewhere else now, and no
 * "back": the marks a GM makes are already on the row, at the moment they make
 * them.
 *
 * ## OPEN THE FIGHT is a third direction, and it crosses nothing
 *
 * An encounter row could be planned and never fought. The only route from a
 * configured row to the table was PUT THIS ROSTER ON THE BOARD, then OPEN THE
 * BUILDER, then SEND n TO THE SCENE - three taps through a screen the GM had
 * already finished with, which is why the playtest GM's note about it reads
 * "otherwise you effectively cannot use it".
 *
 * OPEN THE FIGHT is that route in one tap, and it is deliberately *not* built
 * on top of PUT THIS ROSTER ON THE BOARD. It spawns the row's own entries into
 * the open scene, or into a scene it mints when none is open, and says which
 * in its own label; the workbench's roster and adjustments are left exactly as
 * they were. Folding the board write into it would have meant one button
 * quietly overwriting a roster the GM was in the middle of building, which is
 * the same defect as a button that silently drops a saved fight - and the row
 * says out loud that it does not do it.
 *
 * ## A card is drawn here, not in the reader - and so is a stat block
 *
 * A link row to a domain card renders `DomainCardView` in the row. The obvious
 * alternative - a button calling `setOpenCard`, which is how every other screen
 * reads a card - would put `CardReader` on top of the `GmSheet` this row can be
 * inside, and `useDialog` registers one unconditional window keydown listener
 * per dialog with no topmost check: one Escape would close both, and every Tab
 * would be fought over by two traps. The card is content here rather than an
 * overlay, so the question does not arise.
 *
 * The same argument decides the encounter row's roster preview. Each resolved
 * entry is a disclosure that draws `AdversaryBlock` under itself, rather than a
 * button that opens the bestiary or a second dialog over this one. It is
 * `AdversaryBlock` with no `action`, which renders no button, no input and no
 * select at all: reading a sheet from the plan cannot change the plan, and that
 * is a property of the component rather than a promise this file makes.
 *
 * ## A rule is drawn by the reference screen's own renderer
 *
 * **This moved the prose from 14.5px to 13px and that was not announced.** The
 * old arm drew the body at `t-body` (`400 14.5px/1.5`); `BlockView` draws it at
 * `t-read` (`var(--read-size)`, 13px/1.45), and the contrast rises with it. It
 * is kept, for one reason: this is the same SRD text the reference region
 * draws, and two surfaces showing the same paragraph at two sizes is a worse
 * defect than either size. But the reflow spent a commit *raising* the smallest
 * type on the sheet, so this is a step the other way on one surface and it
 * belongs on the list of things to look at on glass rather than in a diff.
 *
 * A link row to a rules section goes through `ruleSection` and `BlockView`, the
 * pipeline `Reference.tsx` reads the GM chapter with. This arm used to walk the
 * body itself with `paragraphs()`, which is the one shape the dataset is not
 * in: the sections the ADD sheet offers that carry a bullet list or a pipe
 * table printed a literal `- ` down the left of every list and every table as
 * raw pipes. The renderer is shared rather than copied, and the
 * `SRD 1.0 · P.n` stamp comes with it - the licence rule in `ReferenceTables`
 * is that the stamp sits on the text it belongs to, and the SRD's tables are
 * now drawn here too.
 *
 * ## Targets
 *
 * Every control this file draws itself declares 44 or `var(--tap)` inline, and
 * so does every control it draws by mounting a component from another file.
 * There are four of those, and enumerating them is the point of the sentence:
 * `UrlArm`'s OPEN IN A NEW TAB anchor, `EnvironmentBlock`'s SET ACTIVE toggle
 * in `StatBlock.tsx`, `Fold`'s header on the countdown arm, and the pressable
 * cells of `CountdownChart` folded under that header. The rest of what this
 * file mounts draws no control at all: `Fact`, `NoteArm`, `BlockView` and
 * `AdversaryBlock` are print, and `DomainCardView`'s overlay button exists
 * only where it is handed an `onOpen`, which the `card` link arm here
 * deliberately does not. Said out loud rather than left implied, because that
 * sentence used to be checkable by reading this file and is not any more.
 *
 * The sweep is not automatically safe from a borrowed control, and two of the
 * four above proved it - and then a control this file draws itself proved the
 * same thing again. `tests/gm/sessionList.test.tsx` reads the declared floor
 * off whichever element it finds, whichever file wrote it, but it only ever
 * saw a subset of them: the elements matching `<button>` that were in the DOM
 * at the moment it counted. One half hid one control, and the other half hid
 * two.
 *
 * *In the DOM.* The chart's cells are behind a `Fold` that starts shut, so a
 * sweep that runs "with every row open" still could not see them, until it was
 * taught to click the folds open before counting.
 *
 * *A `<button>`.* Two of the controls on this screen are not one, and the
 * sentence that stood here counted one. `UrlArm`'s OPEN IN A NEW TAB is an
 * anchor - `UrlArm.tsx` draws `<a className="btn">` with a `minHeight: 44` of
 * its own - so it declared its floor into a sweep whose selector could not
 * read it, and the fixture drew no `url` row to put it on the screen in the
 * first place. The other is `SceneArm`'s environment `<select>` a little way
 * below this header, which declares `var(--tap)` and has been on the swept
 * screen since the first fixture: the sweep was widened to `button, a` on the
 * strength of a sentence calling the anchor the only non-button here, and the
 * select went on hiding behind that comma. The selector names every tag that
 * can carry a control now, and a shrunk control shows why either way - at
 * `minHeight: 30` the narrower selector stays green over it and the wider one
 * names it.
 *
 * **And the set is no longer enumerated by hand - as far as the mechanism
 * reaches.** `floorsOutsideTheSweep`, in `tests/gm/sessionList.test.tsx`,
 * walks the rendered screen for elements whose *inline* `style.minHeight` is a
 * length its `px` helper resolves - a plain number, or one of the three tokens
 * that helper knows: `--tap`, `--control`, `--pip-h` - and asserts, as an
 * exact list, which of those its own selector cannot reach: one element,
 * `DomainCardView`'s card body, which is print and declares a floor so a row
 * of cards ends level. That is a mechanism rather than a promise, and the
 * three things it does not see are worth saying rather than rounding off.
 *
 * A floor declared in a stylesheet is invisible to it: `.btn` and the
 * `input, textarea, select` rule, both in `base.css`, carry a `min-height`
 * that no `style` attribute has to repeat, and the two borrowed controls above
 * are readable only because they do repeat it - `UrlArm`'s anchor is
 * `<a className="btn">` with a `minHeight: 44`, and `SceneArm`'s select
 * declares `var(--tap)` in its own `style`. A floor declared through any other
 * custom property reads as zero. And nothing the fixture does not render
 * counts at all, which is why `openEverything` clicks the chart's fold open
 * and seeds the `url` row, then asserts after each that the control arrived.
 *
 * So the set is read off the screen rather than off a sentence, and the screen
 * is still the fixture's. That is the general form of both failures above: a
 * whole-screen sweep is only as wide as its selector and its fixture, and
 * neither is a thing this file can be read to check.
 *
 * The widest thing any arm draws is full-width; the one piece of foreign text
 * on the screen - the unreadable row's raw JSON, one unbroken line as
 * `JSON.stringify` produced it - is wrapped and given its own horizontal
 * scroller, because a `<pre>` of it at 393px is the one element that could make
 * the whole page scroll sideways. The SRD tables that arrive with a rule link
 * are the other candidate and are not one: `RuleTableView` declares no width at
 * all, and its two shapes hold across every candidate width for this row - see
 * `RuleTableView`, which says why the "365" that used to stand here was wrong and
 * why this row is the one route to that view whose width nobody has measured in
 * a browser yet.
 */
import { useEffect, useState } from 'react';
import type { Adversary, EncounterAdjustments, Ref, RosterEntry } from '../../../shared/types.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';
import type { GmRegion } from './gmStore.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { Fold } from '../shared/Fold.tsx';
import { damageBumpRule } from '../shared/ruleText.ts';
import { ruleSection } from '../shared/srdReference.ts';
import { Fact } from './Fact.tsx';
import { NoteArm } from './NoteArm.tsx';
import { BlockView } from '../shared/BlockView.tsx';
import { CountdownChart } from './ReferenceTables.tsx';
import { AdversaryBlock, EnvironmentBlock } from './StatBlock.tsx';
import { UrlArm } from './UrlArm.tsx';
import { openCombatants, useGm } from './gmStore.ts';
import { COUNTDOWN_KIND_COLOR, LINK_KIND_LABEL, sessionName } from './session.ts';
import { SRD_LABEL, srdStamp } from '../../store/dataset.ts';

/**
 * The name of each switch a GM flips, shortened - and no dice.
 *
 * Two of these are the engine's own words for a choice. The third used to be
 * `+1D4 (OR +2) TO ALL ADVERSARY DAMAGE`, which is not the name of a switch: it
 * is a rule, transcribed by hand, in a file that is not allowed to hold one.
 * The chip names the switch now and the rule is quoted underneath from whatever
 * rules layer is loaded - see `damageBumpRule` - so the dice are said once, in
 * the book's words, and a layer that changes them changes what this row says.
 */
const ADJUSTMENT_LABEL: Record<keyof EncounterAdjustments, string> = {
  easier: 'EASIER OR SHORTER FIGHT',
  damageBump: 'ADVERSARY DAMAGE BUMP',
  harder: 'HARDER OR LONGER FIGHT',
};

const ADJUSTMENT_KEYS: Array<keyof EncounterAdjustments> = ['easier', 'damageBump', 'harder'];

const NOT_HERE = 'NOT IN THIS DATASET';

/**
 * One verb, at the size a thumb finds without looking, named after its row.
 *
 * `row` is not decoration. `SessionRow` already argues this for DELETE, MOVE UP
 * and the drag handle - "a list of identical DELETE buttons is a list a screen
 * reader cannot tell apart" - and the arms make the same list one level down: a
 * planned night with three scenes in it draws OPEN THIS SCENE three times, and a
 * VoiceOver user pulling up the rotor's button list hears the same three words
 * with nothing to choose between them, on the one screen whose whole point is
 * an ordered list of similar rows. THIS rather than THE is the fix one level
 * up and it is not this one: it tells the GM the verb is about the row it sits
 * on, and still tells three rows apart by nothing.
 *
 * The label comes first and the row's name after it, so the accessible name
 * still begins with the visible words (WCAG 2.5.3) - and `label` is a string
 * rather than children precisely so the two cannot drift apart.
 */
function Verb({
  onClick,
  label,
  row,
  primary = false,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  row: string;
  primary?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={primary ? 'btn btn-primary' : 'btn'}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${label} — ${row}`}
      style={{ flex: 'none', minHeight: 'var(--tap)' }}
    >
      {label}
    </button>
  );
}

export function SessionBody({
  item,
  phone,
  onOpenTool,
}: {
  item: SessionItem;
  phone: boolean;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  switch (item.kind) {
    case 'scene':
      return <SceneArm item={item} onOpenTool={onOpenTool} />;
    case 'encounter':
      return <EncounterArm item={item} onOpenTool={onOpenTool} />;
    case 'link':
      return <LinkArm item={item} phone={phone} />;
    case 'countdown':
      return <CountdownArm item={item} onOpenTool={onOpenTool} />;
    case 'url':
      return <UrlArm item={item} />;
    case 'note':
      return <NoteArm item={item} />;
    case 'unreadable':
      return <UnreadableArm item={item} />;
  }
}

// ---------------------------------------------------------------------------

function SceneArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'scene' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const environments = useApp((s) => s.dataset.environments);
  const adversaries = useApp((s) => s.dataset.adversaries);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const patch = useGm((s) => s.patchSessionItem);
  const live = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);
  const boardRoster = useGm((s) => s.roster);
  const boardAdjustments = useGm((s) => s.adjustments);
  const rosterToBoard = useRosterToBoard();
  const showScene = useGm((s) => s.showScene);
  const clearScene = useGm((s) => s.clearScene);
  const spawn = useGm((s) => s.spawn);

  // The same index `EncounterArm` builds, for the same one lookup.
  const byId = new Map(adversaries.map((a) => [a.id, a]));

  const known = environments.some((e) => e.id === item.environmentRef);
  const onBoard = item.environmentRef !== null && item.environmentRef === live;
  const row = sessionName(item);

  /*
   * THIS ARM DOES NOT READ `openScene`, AND THAT IS THE DESIGN RATHER THAN AN
   * OVERSIGHT.
   *
   * Every verb, every sentence and every count below is about `item`. There is
   * no branch for "the runner is already showing this row" and no branch for
   * "it is showing a different one", so there is no state in which a control
   * on this row can be about another row - which is what the old `isLive`,
   * `orphan` and `claimable` flags each were, one state each. The chain is
   * idempotent on the row already open: pressing OPEN THIS FIGHT on the scene
   * you are looking at points the runner at the scene you are looking at.
   *
   * It also means a flip of the switcher repaints nothing here. A subscription
   * to `openScene` on this arm would repaint every open row of the plan on
   * every flip, to change nothing on any of them but one - and that is
   * measured rather than reasoned: with a counter on `sessionName`, the one
   * call this function makes once per render, two scene arms rendered directly
   * take 0 renders on a write of `openScene` and 0 on `fear`. Nothing here
   * reads `session` either, so a fight written into another row arrives only as
   * a new `item`, which is the memoised row's business rather than this one's.
   *
   * WHAT DOES WAKE IT IS THE BOARD, and the sentence that stood here denied it.
   * `environmentRef`, `roster` and `adjustments` are subscribed at the top of
   * this function, and `useRosterToBoard` reads `adjustments` a fourth time, so
   * a GM who adds one adversary in the encounter builder repaints every open
   * scene arm on the plan - 2 of 2, in the same measurement, on a real
   * `addToRoster`. Two of the three are the crossing pair's own price: `live`
   * decides `onBoard` and both environment verbs' `disabled`, and `boardRoster`
   * decides KEEP THE BOARD'S ROSTER HERE's. The third is not. `boardAdjustments`
   * is read nowhere but inside that same verb's `onClick`, where a `getState`
   * read would do, so it is the one wake on this arm that buys nothing.
   *
   * The three `useApp` reads above are the dataset and one pref, which move on
   * a load and on a settings change rather than during play.
   */
  const inTheFight = item.combatants.length;
  /*
   * The same filter `EncounterArm` applies, for the same reason: a roster
   * entry whose ref this dataset does not carry cannot be turned into a
   * combatant, so a roster of nothing but unresolved refs starts nothing.
   */
  const spawnable = item.roster.filter((entry) => byId.has(entry.ref));

  /*
   * One tap, and no arming, and that is a decision rather than an omission.
   *
   * «Conferma sempre» (`DECISIONI-2026-08-18` §A point 2) was decided about a
   * button that threw marks away. This one appends to an empty fight and takes
   * nothing from anywhere - `spawn` writes into THIS row and touches no other,
   * and no fight is moved, parked or swapped by any verb on this arm any more -
   * and a confirmation would double the cost of the one gesture this feature
   * was built for, on every beat. It is the ratified reading "arm what
   * replaces, not what appends".
   *
   * `showScene` first, then the spawns, then the tool. `showScene` writes the
   * pointer and nothing else - it does not open the runner and it does not set
   * `region` - so the third line is not decoration: without it the GM stays on
   * the plan while a fight starts somewhere they cannot see.
   */
  const startFight = (): void => {
    showScene(item.id);
    for (const entry of spawnable) spawn(item.id, byId.get(entry.ref)!, partySize, entry.count);
    onOpenTool('scene');
  };

  /** Clearing a fight IS destruction - these marks exist nowhere else - so this one arms. */
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <div className="stack" style={{ gap: 10 }}>
      <label className="stack" style={{ gap: 5 }}>
        <span className="t-meta">ENVIRONMENT</span>
        <select
          value={item.environmentRef ?? ''}
          onChange={(e) => patch(item.id, { environmentRef: e.target.value || null })}
          // The visible label is one word for every scene row on the screen,
          // and a `<select>` has no text of its own to tell them apart either.
          aria-label={`ENVIRONMENT — ${row}`}
          style={{ minHeight: 'var(--tap)', font: '600 13px/1 var(--sans)' }}
        >
          <option value="">No environment</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
          {/*
            A ref this dataset does not carry is still the plan. Offering it as
            an option is what stops the select from silently reading as "No
            environment" and writing that back on the first change.
          */}
          {item.environmentRef !== null && !known && (
            <option value={item.environmentRef}>{item.environmentRef} — {NOT_HERE}</option>
          )}
        </select>
      </label>

      {/*
        THIS SENTENCE HAS NOW BEEN REWRITTEN TWICE, AND THE SECOND TIME DELETED
        THE MECHANISM THE FIRST ONE WAS CORRECTING.

        It first said the runner shows "whatever environment is on the board
        right now, which is one per campaign", which decision 18 falsified. The
        replacement said "Running this scene puts its environment on the board;
        parking it leaves whatever is there" - true of a fight that lived on
        the board and was parked into a row on the way out. There is no such
        trip now: `openEnvironment` reads the open ROW's ref, `showScene`
        writes a pointer and nothing else, and no verb on this arm writes an
        environment except the two the GM presses by name. Both older sentences
        were pinned by no test, which is why each had to be rewritten by hand
        rather than left to rot; that is still true of this one.
      */}
      <Fact>
        This is the plan and the table. This scene keeps its own place and its
        own fight, with every mark on it, until you clear them — opening
        another scene moves nothing.
      </Fact>

      {inTheFight > 0 && (
        /*
          "Parked" survives here only in the negative, and that is deliberate.

          The word must not survive the mechanism it named, so it is gone from
          every guard, every verb and every other sentence on the glass. The
          comments in this file that still use it are recording what it used to
          name, so that nobody rebuilds it - no count of them is given here
          because a count is a thing that goes stale on the next edit. This is
          the only place a GM can read the word.

          It is kept here because the GM upgrading a campaign HAS seen a fight
          taken off a row and put back, and the sentence they need is that it
          does not happen any more - said in the word they learned it in. A new
          campaign's GM reads it as "nothing is put away", which is also what
          it means.

          The guard is `inTheFight > 0` and nothing else, so this draws on the
          row the runner is showing as well. That is correct rather than
          sloppy: the fight IS on this row while it is being fought, and the
          sentence is about where the marks live rather than about which screen
          is in front of the GM.
        */
        <Fact>
          In this scene: {inTheFight} adversar{inTheFight === 1 ? 'y' : 'ies'},
          with their marks. OPEN THIS FIGHT goes to them exactly as they stand;
          nothing is parked and nothing is swapped.
        </Fact>
      )}

      {/*
        ONE PRIMARY, LAST IN THE STRIP, FIRST MATCH WINS, AND ALL THREE ARE
        ABOUT THIS ROW.

        The paragraph that stood here argued the opposite way round and was
        right at the time. `OPEN THE SCENE` was not primary on a row that was
        neither live nor holding a fight, because there it opened a runner
        showing a DIFFERENT scene, and as the row's headline verb it lied about
        which row it belonged to. The answer then was to demote it rather than
        delete it - the row stopped shouting a verb it could not honour, and
        the room kept its door.

        A verb here cannot be about another row any more, so there is nothing
        left to demote. `showScene(item.id)` points the runner at this row
        whatever it was pointed at before, and the three branches below differ
        only in what they do to this row's own fight on the way: open it, start
        it, or neither. All three are primary because all three are the one
        thing to do next on the row the GM is looking at.

        The constraint the demotion was protecting still holds and is now held
        by the third branch rather than by a plain button: `OPEN THIS SCENE`
        opens the runner on a row with nothing in it, and `Scene.tsx` draws
        `BuilderDoors` in both of its empty states - so the encounter builder,
        and the bestiary when the preference is on, stay reachable from here on
        a campaign that has not started a fight yet. That mattered because the
        top bar's `SCENE · n` chip appears only once the open scene has
        something in it.

        ERGONOMICS, MEASURED, AND NEITHER HALF IS ONE NUMBER. The strip kept
        the two heights it always had and changed which rows draw which. The
        prose moved in both directions, somewhere between -15.86 and +63.44,
        and which way depends on the STATE and the size and not on whether the
        row holds a fight. The eight-cell table below is the finding; no single
        figure lifted out of it is, and every earlier attempt to name one has
        had to be withdrawn.

        Chrome, `pointer: coarse`, insets 47/34, `0370586` against `ab66cf2`,
        the same schema-4 campaign seeded into both so each build reads its own
        version of one table - one scene row holding a fight, a second scene
        row, one countdown row. From the audit harness, with the two trees on
        ports of their own and never on 5199:

          AUDIT_ORIGIN=http://localhost:5207 AUDIT_PORT=9520 node run.mjs \
            cases-c1.json          # ids arm-parked-393x852, arm-parked-375x667

        Those two ran before the reorder argued further down, so what follows
        is the WAVE B delta on its own; this tree's own totals close the
        paragraph.

        THE STRIP LOST NO ELEMENT. The primary is one ternary slot, so
        retiring three labels retired three branches and nothing that draws,
        and the four crossing verbs measure what they always did - 289.06 /
        293.89 / 246.41 / 251.23, at both sizes. So the strip still has the
        same two heights it had before, 304.00 with `CLEAR THIS FIGHT`'s line
        on a row holding a fight and 252.00 without it on a row that is not,
        at both sizes.

        WHAT WAVE B CHANGED IS WHICH ROWS ARE IN WHICH OF THOSE TWO STATES. A
        fight lives on its row now instead of on the board, so a row the
        runner is showing draws the taller strip here where it drew the
        shorter one before. Reading that difference as a cost of the strip is
        reading a state change as a layout change - which is exactly what
        quoting one of these two heights as THE strip figure does, and why
        neither of them is quoted alone.

        THE PROSE WENT THE OTHER WAY, and three `<Fact>`s left this arm rather
        than four - the fourth deletion was `EncounterArm`'s. The three are the
        arms of a state machine no row can satisfy twice: `isLive`, `!isLive &&
        parked === 0 && liveScene !== null`, and `orphan` (which needs
        `liveScene === null`) exclude one another, so at most ONE of them ever
        drew on a row. Measured on `ab66cf2` in the states that draw them, they
        are 31.72 / 31.72 / 47.58 at 393x852 and 47.58 / 47.58 / 63.44 at
        375x667, each in a 10px gap. So the most any row could lose is one
        paragraph, and in the state above it loses none, because none of them
        was drawing in it.

        What arrived is unconditional. The opening sentence went from 2 lines
        to 3 - 31.72 to 47.58 - and `To change this plan` from 4 to 6 - 63.44
        to 95.16 - at both sizes; `Parked here` to `In this scene` is 47.58
        either way.

        SO THE NET IS +47.58 ONLY WHERE NOTHING WAS DRAWING, AND THE FOUR
        STATES DISAGREE. The gain is unconditional; the loss is whichever of
        the three deleted paragraphs that state drew, plus its 10px gap. Both
        halves were measured in all four seeded states at both sizes, and this
        is the whole of it. Prose is the sum of the arm's `<Fact>` heights, and
        the two figures in a cell are the two scene rows the seed carries - the
        one the state is ABOUT first, the other one second:

          state    what is on the board            393x852          375x667
          parked   nothing, the fight is here    +47.58  +47.58   +47.58  +47.58
          live     the fight, this row named     +63.44  +15.86   +47.58    0.00
          orphan   the fight, no row named         0.00    0.00   -15.86  -15.86
          enc      as `live`, plus an enc row    +63.44  +15.86   +47.58    0.00

        The two negatives are not typos: in the orphan state at 375x667 this
        tree draws LESS prose than `ab66cf2` did. The arm totals swing further
        still, because on a `live` row the strip also gains `CLEAR THIS
        FIGHT`'s line - +115.43 / +5.85 at 393x852 and +99.58 / -10.00 at
        375x667. In the `orphan` state neither tree draws that line on either
        of the two rows, so nothing is added to the prose delta and both rows
        come out shorter than they were, by the same amount as each other at
        each size.

        `orphan` has no counterpart here by construction: `shared/campaigns.ts`'s
        `from: 4` converter lands a board fight on a scene row, so the state
        that drew that paragraph cannot be reached on this tree, and what the
        row loses is the paragraph and its gap - the one place Wave B did
        remove measurable height, which is the question the brief asked.

        The headline the seeded three-row list is about is the `parked` one,
        and there it is exact at both sizes: the arm is 667.73 -> 715.31
        holding a fight and 510.16 -> 557.73 planned, and the list is
        1802.39 -> 1897.54, +95.15px.

        AND THE REORDER BELOW TAKES NOTHING BACK. Its first arrangement did -
        it pulled the strip 304 -> 252 on the row holding a fight, and this
        paragraph used to end on a 1845.54 list and +43.15px - but that saving
        was the primary sharing a line with `CLEAR THIS FIGHT`, and the armed
        state condemned it. The arrangement that shipped instead keeps the
        strip at 304.00: measured on this tree at 393x852, 375x667 AND 360x800,
        the arm is 715.31 and the list is 841.31 + 683.73 + 372.50, resting
        and armed alike. Both list totals here are each row height rounded
        once and then added, which is how the baseline above was taken; a
        probe that rounds the sum instead lands a hundredth higher, and that
        hundredth is a rounding and not a disagreement. So Wave B and C1 together cost the +95.15px
        above and the reorder buys reach only, which is what it was for. The
        104px below is the ROSTER pair's own cost when it landed, and is still
        not this.
      */}
      {/*
        The plan this row carries, on the row that carries it.
        `CARRY THE n INTO THIS SCENE` has written a roster here since the scene
        form grew that button, and the shut row has read `n PLANNED` off it -
        but this arm never drew one name of it. A GM could see how many were
        coming and not what.
      */}
      <RosterList roster={item.roster} byId={byId} partySize={partySize} row={row} />
      <AdjustmentNotes adjustments={item.adjustments} />

      {/*
        The loop that makes the plan editable, and it did not exist.
        A scene row took a roster once, at creation, and no control anywhere
        could add to it or take from it again - so a row planned before the
        session could not receive the adversary a GM thought of afterwards, and
        nothing on the row said so. The encounter row has had both halves all
        along; this is the same two verbs on the row that was missed.
      */}
      <Fact>
        To change this plan: put its ROSTER on the board, edit it in the builder, then bring it
        back with KEEP THE BOARD’S ROSTER HERE. The board is the campaign’s one workbench for
        building an encounter — this row is a copy, and neither writes to the other until you tap
        one of these. The fight itself is never on the board: it is on this row.
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {inTheFight > 0 && (
          /*
           * The only pruning gesture in the app, and it arms.
           *
           * Holding a fight is the resting state of a played scene now rather
           * than the result of a deliberate park, so the switcher's strip
           * grows by default and this is the one control that shrinks it. It
           * arms because it destroys the only copy of those marks - there is
           * no board holding a second one and no undo.
           *
           * It is deliberately NOT hidden on the row the runner is already
           * showing, even though END SCENE in the runner clears the same
           * fight. Hiding it there would make a control appear and disappear
           * according to which screen the GM was last on, which is the tap
           * count depending on unseen state that `Scene.tsx` rejects in its
           * own arming paragraph - the one that keeps END SCENE arming at an
           * empty table. Two armed destructions reachable from two screens,
           * both arming, both naming the same fight, is not a defect.
           *
           * `clearScene(item.id)`, not a row patch: `patchSessionItem` refuses
           * to write `combatants` at all, so this row's fight has exactly one
           * writer and it is the store's.
           *
           * IT IS FIRST IN THE STRIP, IT OWNS ITS LINE, AND THE SECOND HALF
           * OF THAT IS THE WRAPPER RATHER THAN A HOPE. Because it arms, its
           * label changes width under the thumb, so wherever it SHARES a line
           * it reflows that line between the two taps of the one gesture in
           * this app that destroys without an undo. Until this wrapper it
           * shared no line only because at phone widths nothing else fitted
           * beside it - an emergent property of the column, not a rule - and
           * it stopped holding at every column wide enough to take a second
           * verb, which includes these same phones turned landscape. There the
           * crossing verb next to it slid sideways as `CLEAR` armed, and the
           * strip of glass it vacated became `TAP AGAIN TO CLEAR`: a thumb
           * going for the verb it could see destroyed the fight instead.
           *
           * `flex: 0 0 100%` takes the whole flex line at every column, so
           * there is no width at which a second verb can join it. The button
           * keeps its own width inside the wrapper - the LINE is what is
           * reserved, not the target, so the destructive verb does not grow
           * into a full-width one. Do not pair it with anything: the wrapper
           * is what turns that from a request into a fact, and the test that
           * pins the declaration is the half of it jsdom can hold.
           *
           * THE ARRANGEMENT'S COST IS PAID AFTER THE GESTURE RATHER THAN
           * DURING IT, and that is the trade, not an oversight. When the
           * second tap succeeds this line unmounts - and so does the sentence
           * above the strip that counts the fight - so everything below moves
           * up under a thumb that has just tapped twice in one place. A third,
           * momentum tap lands on whichever crossing verb arrives there. All
           * four of them are reversible and none of them destroys, which is
           * why this is a cost and not a second defect; reserving the line
           * against the case would leave dead space on every row that is not
           * holding a fight, which is most of them.
           */
          <div className="row" style={{ flex: '0 0 100%' }}>
            <Verb
              onClick={() => {
                if (!armed) {
                  setArmed(true);
                  return;
                }
                clearScene(item.id);
                setArmed(false);
              }}
              label={armed ? 'TAP AGAIN TO CLEAR' : 'CLEAR THIS FIGHT'}
              row={row}
            />
          </div>
        )}

        {/*
          Every verb here names the noun it moves, and that is what adding the
          roster pair cost. `PUT THIS ON THE BOARD` and `KEEP WHAT IS ON THE
          BOARD` were unambiguous while an environment was the only thing this
          row could send anywhere. Beside two roster verbs they stop being: a
          strip with four buttons about "the board" on it is four buttons a GM
          has to open one at a time to tell apart.

          Measured in Chrome at 393x852 and 375x667, `pointer: coarse`: each of
          the four is 44px tall and takes a line of its own - 246.41 and 251.23
          wide for the roster pair, 289.06 and 293.89 for the longer
          environment words. The four widths are re-measured and exact; the
          COLUMN they were set against is not 363. It is **349.00** at 393x852
          and **331.00** at 375x667 - 393 less the list's 12px page padding
          either side, less the panel's stripe, border and padding, less the
          open block's own - and neither viewport gives 363 for anything on
          this row. Two to a line needs both labels AND the 8px gap between
          them inside one column, so the test is (column - 8) / 2 taken in the
          narrower of the two - and the old 177 is that same formula run on a
          column this row never has, (363 - 8) / 2. It was the number that was
          wrong, not the argument: the narrowest of the four verbs is 246.41,
          neither 349.00 nor 331.00 is twice that, and 246.41 is not a length
          these verbs can be written in and stay unambiguous either. So each
          takes a line of its own here, the fix costs this arm two more lines,
          104px, and that is what a GM pays to be able to change a plan at
          all. `docOverflowX` is 0.00 at both sizes and nothing is under the
          tap floor.

          NONE OF THAT IS A STATEMENT ABOUT EVERY WIDTH. The column follows
          the window up to the list's own cap, and past some width these verbs
          DO pair - they pair on these same phones turned landscape. That is
          why `CLEAR THIS FIGHT` above is wrapped in a line of its own rather
          than left to a column that happens to be narrow, and why no
          threshold derived here is carried anywhere near that argument.
        */}
        <Verb
          onClick={() => setEnvironment(item.environmentRef)}
          disabled={onBoard || item.environmentRef === null}
          label="PUT THIS ENVIRONMENT ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { environmentRef: live })}
          disabled={item.environmentRef === live}
          label="KEEP THE BOARD’S ENVIRONMENT HERE"
          row={row}
        />
        <Verb
          onClick={() => rosterToBoard(item.roster, item.adjustments)}
          disabled={item.roster.length === 0}
          label="PUT THIS ROSTER ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { roster: boardRoster, adjustments: boardAdjustments })}
          disabled={boardRoster.length === 0}
          label="KEEP THE BOARD’S ROSTER HERE"
          row={row}
        />

        {/*
          THE PRIMARY IS LAST AND `CLEAR THIS FIGHT` IS FIRST, AND THAT IS THE
          C1 REORDER PLUS THE REPAIR PASS THAT MEASURED ITS ARMED STATE.

          The primary was FIRST, before C1 and through all of Wave B, while the
          plan's ergonomics paragraph claimed it was last and rested a
          thumb-reach argument on the claim. B6 caught the claim and handed the
          reorder here, because a reach is a browser measurement and not a
          reading. Measured, in Chrome, `pointer: coarse`, insets 47/34, all
          three arrangements built in the live DOM of the same page so one
          layout engine drew them all. Distances are the control's centre above
          the FOOT OF THE STRIP, which is where a thumb rests:

            primary first (Wave B)      strip 304.00, 6 lines
                                        primary 282.00   CLEAR  22.00
            primary last, CLEAR before  strip 252.00, 5 lines
                                        primary  22.00   CLEAR  22.00
            CLEAR first, primary last   strip 304.00, 6 lines
                                        primary  22.00   CLEAR 282.00

          260.00px of reach at both sizes, and the second and third arrangements
          buy all of it. C1 took the second, for the 52.00px of row that comes
          with it. This is the third, and the 52.00 is given back, because the
          second one was measured in only one of its two states.

          THE ARMED STATE IS WHY. `CLEAR` arms, so its label changes under the
          thumb: `TAP AGAIN TO CLEAR` is 165.72 where `CLEAR THIS FIGHT` is
          148.63. In the second arrangement those two share a line, so arming a
          destructive control REFLOWED THE STRIP. The pair is `CLEAR` + 8 + the
          primary: 148.63 + 8 + 156.20 resting, 165.72 + 8 + 156.20 armed,
          17.09 wider. Measured by tapping it - the seed above, `pointer:
          coarse`, at three widths, as what the column has LEFT OVER:

                     column   slack resting   slack armed   what arming did
            393x852  349.00       36.17          19.08      primary slides +17.09
            375x667  331.00       18.17           1.08      the same, on 1.08 left
            360x800  316.00        3.17          WRAPS      strip 252.00 -> 304.00

          So at 375x667 the armed pair left **1.08px** of the column - a margin
          no one had written down, which any label edit or font-metric change
          would spend - and at 360px, a width this repo's own harness already
          sweeps, the strip grew a line BETWEEN THE TWO TAPS of the one gesture
          in this app that destroys without an undo.

          And the affordability argument was backwards. It said a mis-tap only
          changes a label, because the second tap is the one that destroys -
          but once `CLEAR` is armed the second tap IS the mis-tap's tap, the
          neighbour 8px away is the row's most-used verb, and arming had just
          moved that verb 17.09px right. The 9.09px band from x=179.63 to
          x=188.72 was `OPEN THIS FIGHT` before the tap and `TAP AGAIN TO
          CLEAR` after it, for the four seconds until the disarm above fires.
          A control that moves according to state the GM did not choose is the
          objection `Scene.tsx` raises about tap counts, and it applies here.

          `CLEAR` first answers all of it and gives up only the 52.00. The
          primary keeps its 22.00; nothing on the strip moves when `CLEAR`
          arms, at any of the three widths, because `CLEAR` has a line to grow
          into - 148.63 and then 165.72 in a 316.00 column with 150.28 to
          spare. And the objection to this arrangement, that it puts the one
          destructive verb at the TOP of the strip where a thumb coming down
          the row meets it first, is about reading order and is answered by the
          same measurement: CLEAR goes from 22.00px above the strip's foot to
          282.00, which is 260.00px FURTHER from the resting thumb. Both of the
          other arrangements leave it on the thumb's own line. The most-used
          verb takes that line instead.
        */}
        {inTheFight > 0 ? (
          /*
           * The fight is already here, so this only goes to it. No spawn: a
           * second tap must not double the pile, and a row a GM left mid-beat
           * has to come back with exactly what it had.
           */
          <Verb
            onClick={() => {
              showScene(item.id);
              onOpenTool('scene');
            }}
            primary
            label="OPEN THIS FIGHT"
            row={row}
          />
        ) : spawnable.length > 0 ? (
          /*
           * The bootstrap none of the three designs had. A row planned and
           * never fought holds no combatants, so it is on the switcher's strip
           * only while the runner is showing it: `liveScenes` keeps a row that
           * holds a fight OR the row the pointer names, and a planned one is
           * the second kind at best. Without this verb, starting the second
           * fight of a split party still costs the five gestures it costs
           * today. With it, that is five gestures once per split and one tap
           * per beat after.
           *
           * It cannot be reached twice on one fight: the first tap fills
           * `item.combatants`, and the branch above takes the row from then
           * on. That is the ordering doing the work a guard would otherwise
           * have to, and it is why the chain tests `combatants` before
           * `roster` rather than the other way round.
           */
          <Verb onClick={startFight} primary label="START THIS FIGHT" row={row} />
        ) : (
          /*
           * Nothing in the fight and nothing spawnable to put in it: a row
           * with an empty roster, or one whose every ref this dataset has
           * lost. The verb still opens the runner on THIS row, which is what
           * makes the builder and the bestiary reachable from a campaign that
           * has not started a fight yet - see the paragraph above the strip.
           *
           * `OPEN THIS SCENE`, not `OPEN THE SCENE`. "The" meant the one
           * board's scene, and that is the word that lied.
           */
          <Verb
            onClick={() => {
              showScene(item.id);
              onOpenTool('scene');
            }}
            primary
            label="OPEN THIS SCENE"
            row={row}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * What a row was built with, on the row that was built with it.
 *
 * `EncounterAdjustments` is written by the builder and copied onto a row at
 * creation, and until now only an **encounter** row read it back. A scene row
 * carries the same three flags out of the same builder - `AddSheet` writes
 * `{ roster, adjustments }` together, in one call - and drew none of them, so a
 * scene planned with the damage bump on said so nowhere and a GM found out by
 * not finding out. That is the second half of the same omission the roster
 * above is the first half of.
 *
 * The dice are said here rather than only inside the builder because nothing in
 * the scene applies the bump: a combatant carries HP, Stress and thresholds,
 * never a damage expression, so the GM adds it by hand and the row is where
 * they have to learn that.
 */
function AdjustmentNotes({ adjustments }: { adjustments: EncounterAdjustments }): React.JSX.Element {
  const rules = useApp((s) => s.dataset.rules);
  const bump = damageBumpRule(rules);
  const chosen = ADJUSTMENT_KEYS.filter((key) => adjustments[key]);
  return (
    <>
      {chosen.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {chosen.map((key) => (
            <span key={key} className="chip">
              {ADJUSTMENT_LABEL[key]}
            </span>
          ))}
        </div>
      )}
      {adjustments.damageBump && (
        <Fact>
          {bump === null
            ? 'This row was built with the damage bump on, and no rules layer this device has loaded carries the line that says what it adds. Nothing in the scene rolls it for you either way.'
            : `This row was built with “${bump}”. Nothing in the scene rolls that for you — it is added at the table, on every adversary attack.`}
        </Fact>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

/**
 * A row's roster onto the campaign's one board, and the adjustments with it.
 *
 * Built out of the four actions that already exist, in the order they have to
 * run: `setRosterCount` only ever *updates* an entry, so a ref that is not on
 * the board yet has to be added before its count means anything. Every call is
 * a separate commit and the store's 400 ms debounce collapses the lot into one
 * write.
 *
 * A hook rather than a function because it needs five subscriptions, and both
 * arms that own a roster need it: this is the outbound half of the loop that
 * lets a planned row be edited at all - put it on the board, change it in the
 * builder, take it back with KEEP THE BOARD'S ROSTER HERE.
 */
function useRosterToBoard(): (
  roster: readonly RosterEntry[],
  adjustments: EncounterAdjustments,
) => void {
  const boardAdjustments = useGm((s) => s.adjustments);
  const addToRoster = useGm((s) => s.addToRoster);
  const setRosterCount = useGm((s) => s.setRosterCount);
  const clearRoster = useGm((s) => s.clearRoster);
  const toggleAdjustment = useGm((s) => s.toggleAdjustment);
  return (roster, adjustments) => {
    clearRoster();
    for (const entry of roster) {
      addToRoster(entry.ref);
      setRosterCount(entry.ref, entry.count);
    }
    for (const key of ADJUSTMENT_KEYS) {
      if (adjustments[key] !== boardAdjustments[key]) toggleAdjustment(key);
    }
  };
}

// ---------------------------------------------------------------------------

/**
 * A row's roster, drawn the same way on both arms that own one.
 *
 * It was `EncounterArm`'s and only `EncounterArm`'s, and that is the whole of
 * the defect this fixes. A **scene** row carries a roster too - `AddSheet`'s
 * `CARRY THE n INTO THIS SCENE` writes one at creation, and the shut row has
 * read `n PLANNED` off it ever since - but `SceneArm` read `item.roster` only
 * to decide whether START THIS FIGHT appeared and what it spawned. The GM could
 * see a count on the closed row and not one name on the open one.
 *
 * So it is lifted rather than copied. Two drawings of a roster is how one of
 * them comes to say `×3` about twelve rats while the other says `3 GROUPS OF
 * 4`, which is the exact defect `minionGroups.test.tsx` was written after.
 *
 * The open-preview state belongs here rather than to the arm: only one entry's
 * stat block is open at a time, and that is a property of this list, not of the
 * row it sits in.
 */
function RosterList({
  roster,
  byId,
  partySize,
  row,
}: {
  roster: readonly RosterEntry[];
  byId: Map<Ref, Adversary>;
  partySize: number;
  /** The row's name, for the rotor: a night with three of these draws many. */
  row: string;
}): React.JSX.Element {
  /** The ref whose stat block is open under it, or none. */
  const [preview, setPreview] = useState<Ref | null>(null);
  return (
    <>
    <span className="t-meta">ROSTER</span>
    {roster.length === 0 ? (
      <Fact>Nothing planned yet.</Fact>
    ) : (
      <ul className="stack" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
        {roster.map((entry) => {
          const adversary = byId.get(entry.ref);
          /*
           * A Minion's count is groups, each the size of the party -
           * `EncounterEntry.count` says so and `ROLE_COST` prices it that
           * way. `×3` beside a Minion therefore read as three rats where the
           * budget had been spent on twelve, and the builder had said
           * "3 GROUPS OF 4" about the same number all along. Same words here,
           * so the plan and the builder cannot disagree about what is coming.
           */
          const count =
            adversary === undefined
              ? NOT_HERE
              : adversary.role === 'Minion'
                ? `${String(entry.count)} GROUP${entry.count === 1 ? '' : 'S'} OF ${String(partySize)}`
                : `×${String(entry.count)}`;
          const open = preview === entry.ref;

          return (
            <li key={entry.ref} className="stack" style={{ gap: 6 }}>
              {adversary === undefined ? (
                <span className="spread" style={{ gap: 10 }}>
                  <span className="t-dense" style={{ color: 'var(--dim)' }}>
                    {entry.ref}
                  </span>
                  <span className="t-meta" style={{ flex: 'none' }}>
                    {count}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  className="spread"
                  aria-expanded={open}
                  // The visible words first, then the row, for the same
                  // reason `Verb` does it: a night with three encounter rows
                  // in it draws this button many times over, and the rotor's
                  // button list is where they have to be told apart.
                  aria-label={`${adversary.name} — ${count} — ${row}`}
                  onClick={() => setPreview(open ? null : entry.ref)}
                  style={{ gap: 10, width: '100%', minHeight: 'var(--tap)', textAlign: 'left' }}
                >
                  <span className="t-dense" style={{ color: 'var(--text-2)' }}>
                    {adversary.name}
                  </span>
                  <span className="t-meta" style={{ flex: 'none' }}>
                    {count}
                  </span>
                </button>
              )}
              {open && adversary !== undefined && (
                <div
                  className="panel"
                  style={{ padding: 12, borderLeft: '3px solid var(--line)' }}
                >
                  <AdversaryBlock adversary={adversary} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    )}
    </>
  );
}

// ---------------------------------------------------------------------------

function EncounterArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'encounter' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const adversaries = useApp((s) => s.dataset.adversaries);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const patch = useGm((s) => s.patchSessionItem);
  const boardRoster = useGm((s) => s.roster);
  const boardAdjustments = useGm((s) => s.adjustments);
  const rosterToBoard = useRosterToBoard();
  const spawn = useGm((s) => s.spawn);
  const openScene = useGm((s) => s.openScene);
  const openNewScene = useGm((s) => s.openNewScene);
  const inTheScene = useGm(openCombatants).length;
  /*
   * The open scene's NAME, and the selector returns a string so that reading
   * it costs this arm nothing.
   *
   * Two sentences and one label below name the room the fight is going to,
   * because "the scene" is the word this whole change exists to stop using: it
   * meant the one board's scene, and there is no such thing now. A row that
   * says which scene it will pour a roster into is a row a GM can disagree
   * with before pressing it.
   *
   * `useGm` compares with `Object.is` and memoizes no selector, so returning
   * the row itself would repaint every encounter row on the plan on every mark
   * made anywhere. A string is equal to itself.
   */
  const openName = useGm((s) => {
    const open = s.session.find((i) => i.kind === 'scene' && i.id === s.openScene);
    return open === undefined ? null : sessionName(open);
  });

  const byId = new Map(adversaries.map((a) => [a.id, a]));
  const row = sessionName(item);

  /*
   * What the verb says it will do, in the two rooms it can do it in.
   *
   * `OPEN THE FIGHT` with nothing open would have opened a fight in a scene
   * the GM never asked for and cannot see the name of - so the label says the
   * scene is being made, and every sentence about the verb below uses this
   * same string rather than a second copy that could drift from it.
   */
  const openLabel = openScene === null ? 'OPEN THE FIGHT IN A NEW SCENE' : 'OPEN THE FIGHT';

  /*
   * What OPEN THE FIGHT can actually put in the scene. A ref this dataset
   * cannot resolve has no stat block, so `spawn` has nothing to make a
   * combatant out of and the row already says so on its own line. A roster of
   * nothing but unresolved refs therefore opens nothing, and the verb is
   * disabled rather than opening an empty scene and looking like it worked.
   */
  const spawnable = item.roster.filter((entry) => byId.has(entry.ref));

  /*
   * The row straight to the table, without going through the builder - and
   * without going through the board either. `spawn` is the same call the
   * builder's SEND makes, with the same arguments, so a Minion entry becomes
   * `count` groups of `partySize` here exactly as it does there.
   * `putOnBoard` is deliberately not called: see the docblock.
   *
   * `openNewScene` is called INSIDE this function rather than beside it, the
   * same way `Encounter.tsx`'s SEND does it: it mints a row and commits, so
   * calling it while rendering would make a scene every time this arm drew.
   * Read once into `sceneId` so every spawn of one press names the same row.
   */
  const openFight = (): void => {
    const sceneId = openScene ?? openNewScene();
    for (const entry of spawnable) spawn(sceneId, byId.get(entry.ref)!, partySize, entry.count);
    onOpenTool('scene');
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <RosterList roster={item.roster} byId={byId} partySize={partySize} row={row} />

      <AdjustmentNotes adjustments={item.adjustments} />

      {/*
        A fact, with no control beside it, because nothing writes an encounter
        row's combatants. `patchSessionItem` refuses the field on every arm,
        and `withSceneFight` - the store's one writer of a fight - rebuilds
        `kind: 'scene'` rows only. Saying "3 adversaries mid-fight" beside a
        button that dropped them silently is the failure this app is written
        not to have.

        This is the arm nothing can mint any more, so the only rows that reach
        it are older than the ban and older than schema 5. Their stored fight
        is the one fight in the app with no home of its own: a scene row's is
        drawn in the runner and cleared by a labelled verb, and this one can
        only be read here.
      */}
      {item.combatants.length > 0 && (
        <Fact>
          This row was saved with {item.combatants.length} adversar
          {item.combatants.length === 1 ? 'y' : 'ies'} already in the fight, with their marks. No
          control here brings those marks back — {openLabel} starts the plan again from full
          HP — so they are kept on the row and nothing here touches them.
        </Fact>
      )}

      {/*
        Two conditions, not three. `openName !== null` stood here as a third and
        could never be false beside the second: `combatantsIn` returns the
        shared `NO_COMBATANTS` when `openScene` is null and when it names no
        scene row, so `inTheScene > 0` already carries "the open row exists and
        is a scene", which is what the name selector tests. It was
        not narrowing either: taking it out changes nothing `tsc --noEmit`
        says, here or anywhere else. So it was an assertion about a state that
        cannot occur, in the one arm this change has just emptied of exactly
        those.
      */}
      {spawnable.length > 0 && inTheScene > 0 && (
        <Fact>
          {openName} already holds {inTheScene} adversar{inTheScene === 1 ? 'y' : 'ies'}. Opening
          the fight from here adds this roster to them rather than replacing them; END SCENE, in
          that scene, is what empties it.
        </Fact>
      )}

      <Fact>
        The encounter builder works on the campaign’s one board, not on this row. {openLabel}{' '}
        {openName === null
          ? 'makes a scene of its own for this row’s roster and leaves the board’s roster alone.'
          : `goes straight to ${openName} with this row’s roster and leaves the board’s roster alone.`}
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb
          onClick={() => rosterToBoard(item.roster, item.adjustments)}
          disabled={item.roster.length === 0}
          label="PUT THIS ROSTER ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { roster: boardRoster, adjustments: boardAdjustments })}
          disabled={boardRoster.length === 0}
          label="KEEP THE BOARD’S ROSTER HERE"
          row={row}
        />
        <Verb onClick={() => onOpenTool('encounter')} label="OPEN THE BUILDER" row={row} />
        {/*
          Last and primary. The verb that leaves the row sits at the end of this
          wrapped strip, and there is only one of them, because two primaries in
          one row is none. The builder loses its fill to it - a GM who has
          finished planning wants the fight, and the builder is now the second
          choice on a configured row.

          "The way the scene arm's own chain is" stood here, was false when it
          was written, and is true again - which is why the history is kept
          rather than the sentence restored. `SceneArm` drew its one primary
          FIRST, before Wave B and after it, while this comment and the plan
          both said otherwise. The Chrome pass measured three arrangements and
          moved `SceneArm`'s ternary to the end of its own strip: 260.00px of
          reach at 393x852 and at 375x667. It bought 52.00px of row with it at
          first, by pairing the primary with `CLEAR THIS FIGHT`; the repair
          pass measured the armed state, found the pair reflowing mid-gesture,
          and gave the 52.00 back by sending `CLEAR` to the front instead. The
          argument and the numbers are in `SceneArm`'s strip, above its
          ternary; this arm has not moved.

          `EncounterArm` is not exposed to any of that, because it has no
          `CLEAR` and nothing on its strip arms.
        */}
        <Verb
          onClick={openFight}
          /*
           * ONE GUARD LEFT, AND THE SECOND ONE WENT WITH THE STATE IT WATCHED.
           *
           * This verb appends: it spawns this row's entries into the open
           * scene without clearing it. Decision 18 guarded it a second time,
           * on the schema-4 pointer naming some OTHER row, because the board
           * was the one fight and pressing this while another scene was
           * running poured this row's adversaries into that scene - and the
           * flip would then park the merged pile into the wrong row. There is
           * no flip, no park and no wrong row to be poured into: the fight is
           * on the scene it is fought in, the destination is named on the
           * button, and the sentence above says what is already in it. So the
           * guard is gone rather than rewritten, and with it the Fact that
           * explained why the button was dead.
           *
           * What is left is the honest one. An unresolvable roster makes no
           * combatant, so pressing this would open an empty scene and look
           * like it had worked.
           */
          disabled={spawnable.length === 0}
          primary
          label={openLabel}
          row={row}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function LinkArm({
  item,
  phone,
}: {
  item: Extract<SessionItem, { kind: 'link' }>;
  phone: boolean;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const index = useApp((s) => s.index);
  const shapes = useApp((s) => s.prefs.shapeCoding);
  const live = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);
  const target = item.target;

  if (target.kind === 'unknown') {
    return (
      <div className="stack" style={{ gap: 8 }}>
        <Fact>
          This row points at {target.named.trim() === '' ? 'something' : `a “${target.named}”`}, which
          is not a kind of thing this version of the app knows how to show. It has been kept exactly
          as it was saved; a later version may recognise it.
        </Fact>
        <RawRef refId={target.ref} />
      </div>
    );
  }

  if (target.kind === 'rule') {
    const section = ruleSection(dataset.rules, target.ref);
    if (section === null) return <Unresolved kind={target.kind} refId={target.ref} />;
    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="spread">
          <span style={{ flex: 1, minWidth: 0, font: '700 16px/1.2 var(--sans)' }}>
            {section.title}
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            {srdStamp(section.page)}
          </span>
        </div>
        {section.blocks.map((block, i) => (
          <BlockView key={`${block.heading ?? ''}-${String(i)}`} block={block} />
        ))}
      </div>
    );
  }

  if (target.kind === 'adversary') {
    // Out of the adversary list rather than out of `byRef`, which holds every
    // kind of record under one key space: reading an adversary out of it is an
    // unchecked assertion, and `Scene.tsx` says so in the same words.
    const adversary = dataset.adversaries.find((a) => a.id === target.ref);
    if (adversary === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
    return <AdversaryBlock adversary={adversary} />;
  }

  if (target.kind === 'environment') {
    const environment = dataset.environments.find((e) => e.id === target.ref);
    if (environment === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
    const active = live === environment.id;
    return (
      <EnvironmentBlock
        environment={environment}
        active={active}
        onToggle={() => setEnvironment(active ? null : environment.id)}
      />
    );
  }

  const card = index.cards.get(target.ref);
  if (card === undefined) return <Unresolved kind={target.kind} refId={target.ref} />;
  return (
    <div style={{ maxWidth: phone ? undefined : 420 }}>
      <DomainCardView card={card} shapes={shapes} variant="reading" height={200} />
    </div>
  );
}

/** A ref this build cannot follow, printed rather than hidden. */
function Unresolved({
  kind,
  refId,
}: {
  kind: Exclude<LinkTarget['kind'], 'unknown'>;
  refId: Ref;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Fact>
        This {LINK_KIND_LABEL[kind].toLowerCase()} is not in the dataset this device has loaded, so
        there is nothing to show. The link is kept: load the layer it came from and it resolves
        again.
      </Fact>
      <RawRef refId={refId} />
    </div>
  );
}

const RawRef = ({ refId }: { refId: Ref }): React.JSX.Element => (
  <code
    className="t-meta"
    style={{
      display: 'block',
      padding: '6px 8px',
      borderRadius: 'var(--r2)',
      background: 'var(--app)',
      color: 'var(--dim)',
      overflowX: 'auto',
      overflowWrap: 'anywhere',
    }}
  >
    {refId === '' ? '(no ref)' : refId}
  </code>
);

// ---------------------------------------------------------------------------

function CountdownArm({
  item,
  onOpenTool,
}: {
  item: Extract<SessionItem, { kind: 'countdown' }>;
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const advance = useGm((s) => s.advanceCountdown);
  const reset = useGm((s) => s.resetCountdown);
  const setPrimary = useGm((s) => s.setPrimaryCountdown);
  const setScene = useGm((s) => s.setCountdownScene);
  const session = useGm((s) => s.session);
  const c = item.countdown;
  const spent = c.value === 0;
  const row = sessionName(item);

  const scenes = session.filter((i) => i.kind === 'scene');
  const owner = scenes.find((i) => i.id === item.sceneId);
  const ownerName = owner === undefined ? '' : sessionName(owner).toUpperCase();

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="chip" style={{ color: COUNTDOWN_KIND_COLOR[c.kind] }}>
          {c.kind.toUpperCase()}
        </span>
        <span className="t-meta">STARTED AT {c.start}</span>
        {spent && (
          <span className="t-meta" style={{ color: 'var(--damage)', fontWeight: 600 }}>
            SPENT — IT HAPPENS NOW
          </span>
        )}
      </div>

      {/*
        The same polarity as the countdowns board, and the same two names for
        it: `−` advances the countdown toward zero. A row that ran the other
        way from the board it mirrors would be the app disagreeing with itself
        about which direction time goes.
      */}
      <div className="row" style={{ gap: 10 }}>
        <button
          type="button"
          onClick={() => advance(c.id, -1)}
          aria-label={`Advance ${c.name} by one`}
          className="btn"
          style={{ flex: 'none', width: 52, minHeight: 44, font: '700 21px/1 var(--sans)' }}
        >
          −
        </button>
        <span
          style={{
            flex: 'none',
            minWidth: 62,
            textAlign: 'center',
            font: '800 30px/1 var(--sans)',
            fontVariantNumeric: 'tabular-nums',
            color: spent ? 'var(--damage)' : 'var(--text)',
          }}
        >
          {c.value}
        </span>
        <button
          type="button"
          onClick={() => advance(c.id, 1)}
          aria-label={`Move ${c.name} back by one`}
          className="btn"
          style={{ flex: 'none', width: 52, minHeight: 44, font: '700 21px/1 var(--sans)' }}
        >
          +
        </button>
        <button
          type="button"
          onClick={() => reset(c.id)}
          aria-label={`RESET — ${row}`}
          className="t-meta"
          style={{ flex: 'none', minHeight: 44, padding: '0 10px', letterSpacing: '0.1em' }}
        >
          RESET
        </button>
      </div>

      {/*
        The chart, on the surface a GM opens because they are thinking about
        this clock - and it is `Countdowns.tsx`'s chart, not a second one.
        `CountdownChart` is given the countdown and calls the same
        `advanceCountdown` the − above calls, with the same sign, so a cell
        pressed here moves this clock toward zero and moves nothing else. Two
        drawings of one table is how one of them goes wrong; two *sources* for
        which cells are pressable is how the four cells the SRD gives no number
        for quietly become buttons on one screen and not the other.

        Dynamic and nothing else, which is the board's answer and has to be.
        `Countdowns.tsx` gives a standard, loop or long-term row no fold at all
        - the chart is the rule for dynamic countdowns, and offering it
        anywhere else would be the row claiming a rule that is not about it.
        The kinds are the same records on both screens; the two surfaces
        disagreeing about which of them the rule covers would be worse than
        either answer on its own.

        Under the −/value/+ row and above the two verbs, for the reason the
        board gives for the same placement: the gesture of the scene keeps its
        position and its floor. The price is paid by PIN IT TO THE TOP BAR and
        OPEN FEAR AND COUNTDOWNS, which sit one shut fold lower on a dynamic
        row - they are the controls that leave this row rather than the ones
        aimed at while somebody is still talking, and the chart belongs with
        the number it changes. How far down that puts them, and whether the
        open chart is reachable one-handed once it is inside a session row, is
        a browser measurement this lane did not make and `PROGETTO-GM` §7 lists
        as owed. The column is a different one either way: `CountdownChart`'s
        own ergonomics paragraph costs its two shipped columns inside a
        `CountdownRow` article, and this is the open block of a `SessionRow`
        panel, whose stripe, border and padding `SessionRow.tsx` costs and this
        file deliberately does not restate.

        The row's name is on the fold's header for a screen reader and not on
        the glass. `Fold` names its button with the words it draws, so a night
        with two dynamic clocks open would put two identical ADVANCE BY A ROLL
        disclosures in the rotor - the defect `Verb` and the roster disclosure
        above each spend an `aria-label` on. `summary` takes a node, so the
        name goes in `sr-only` beside the stamp rather than into a label the
        board would then have to draw too.
      */}
      {c.kind === 'dynamic' && (
        <Fold
          label="ADVANCE BY A ROLL"
          summary={
            <>
              {SRD_LABEL}<span className="sr-only"> — {row}</span>
            </>
          }
        >
          <CountdownChart countdown={c} />
        </Fold>
      )}

      {/*
        Whose clock this is, decision 18.

        A `<select>` and not a set of chips, because the choice is "one of the
        scenes, or the campaign" and that is exactly what a select is for - and
        because it is the same control, with the same `aria-label` idiom, that
        the scene arm already spends on choosing an environment. The visible
        label is two words on every countdown row on the screen, and a select
        has no text of its own to tell them apart.

        Not offered at all when there is no scene to belong to, rather than
        offered and disabled: "a button that can be pressed and does nothing is
        the worse of the two lies", and a select with one option is the same
        lie with a chevron on it.
      */}
      {scenes.length === 0 ? (
        <Fact>There are no scenes to belong to yet.</Fact>
      ) : (
        <label className="stack" style={{ gap: 5 }}>
          <span className="t-meta">BELONGS TO</span>
          <select
            value={item.sceneId ?? ''}
            onChange={(e) => setScene(item.id, e.target.value || null)}
            aria-label={`BELONGS TO — ${row}`}
            style={{ minHeight: 'var(--tap)', font: '600 13px/1 var(--sans)' }}
          >
            <option value="">The campaign</option>
            {scenes.map((scene) => (
              <option key={scene.id} value={scene.id}>
                {sessionName(scene)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {/*
          The pin and the scope are the same statement said twice, so only one
          of them is ever on the glass. A clock a scene owns is not on the top
          bar - the top bar is the campaign's - and the control that would say
          otherwise is not drawn rather than drawn and refused.
        */}
        {item.sceneId === null ? (
          <button
            type="button"
            aria-pressed={item.primary}
            onClick={() => setPrimary(item.primary ? null : item.id)}
            aria-label={`${item.primary ? 'PINNED TO THE TOP BAR' : 'PIN IT TO THE TOP BAR'} — ${row}`}
            className="btn"
            style={{
              flex: 'none',
              minHeight: 'var(--tap)',
              background: item.primary ? 'var(--hope)' : 'var(--raised)',
              color: item.primary ? 'var(--app)' : 'var(--text)',
              borderColor: item.primary ? 'transparent' : 'var(--line)',
            }}
          >
            {item.primary ? 'PINNED TO THE TOP BAR' : 'PIN IT TO THE TOP BAR'}
          </button>
        ) : null}
        <Verb
          onClick={() => onOpenTool('countdowns')}
          label="OPEN FEAR AND COUNTDOWNS"
          row={row}
        />
      </div>

      {item.sceneId !== null && (
        <Fact>
          This clock belongs to {ownerName}. It is on the glass while the runner
          is showing that scene, and it is not on the top bar — the top bar is
          the campaign’s.
        </Fact>
      )}

      {item.sceneId !== null && c.kind === 'long-term' && (
        <Fact>
          A long rest can still advance it. Resting is the campaign’s, not a
          scene’s, so this clock is on the rest’s list wherever the party is.
        </Fact>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function UnreadableArm({
  item,
}: {
  item: Extract<SessionItem, { kind: 'unreadable' }>;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Fact>
        This row was saved by a version of the app that knew something this one does not:{' '}
        {item.why === '' ? 'it does not say what kind of item it is' : item.why}. It has not been
        changed and it has not been deleted — it is shown here exactly as it was stored, so nothing
        is lost by opening this campaign in this build.
      </Fact>
      <span className="t-meta" style={{ color: 'var(--dim)' }}>
        WHAT IS ON THE DISK, FOR {sessionName(item).toUpperCase()}
      </span>
      {/*
        `raw` is `JSON.stringify(v)`: one unbroken line, and the only text on
        this screen that nothing in this app chose the width of. Wrapped and
        given its own scroller so it cannot make the page itself scroll
        sideways on a 393px phone.
      */}
      <pre
        className="t-meta"
        style={{
          margin: 0,
          padding: '8px 10px',
          borderRadius: 'var(--r2)',
          background: 'var(--app)',
          color: 'var(--muted)',
          maxHeight: 200,
          overflowX: 'auto',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {item.raw}
      </pre>
    </div>
  );
}
