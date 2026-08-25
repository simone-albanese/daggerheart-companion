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
 * ## The plan is not the table, and the row says so
 *
 * A campaign has one live board: one roster, one combatant list, one active
 * environment (`GmBoard`). A session row carries its *own* roster, adjustments,
 * combatants and environment ref, and nothing in the store copies one into the
 * other. So opening the encounter builder from row 3 shows the same board as
 * row 5, and that is not a bug to hide behind a sentence - it is two different
 * things with the same shape.
 *
 * The rows therefore carry the crossing explicitly, in both directions, built
 * only out of actions the store already has: PUT THIS ON THE BOARD and KEEP
 * WHAT IS ON THE BOARD. What has no verb is stated as a fact with no control:
 * a row's stored `combatants` cannot be put back with their marks, because no
 * action in `gmStore` sets the combatant list wholesale, and inventing a button
 * that silently dropped them would be exactly the kind of quiet wrongness the
 * founding rule is about.
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
 * on top of PUT THIS ROSTER ON THE BOARD. It calls `spawn` for the row's own
 * entries and opens the scene; the board's roster and the board's adjustments
 * are left exactly as they were. Folding the board write into it would have
 * meant one button quietly overwriting a roster the GM was in the middle of
 * building, which is the same defect as a button that silently drops a saved
 * fight - and the row says out loud that it does not do it.
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
 * in: 42 of the 80 sections the ADD sheet offers carry a bullet list or a pipe
 * table, so 42 of them printed a literal `- ` down the left of every list and
 * every table as raw pipes. The renderer is shared rather than copied, and the
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
import { useState } from 'react';
import type { EncounterAdjustments, Ref } from '../../../shared/types.ts';
import type { LinkTarget, SessionItem } from '../../../shared/campaigns.ts';
import type { GmRegion } from './gmStore.ts';
import { useApp } from '../../store/state.ts';
import { DomainCardView } from '../shared/DomainCardView.tsx';
import { Fold } from '../shared/Fold.tsx';
import { damageBumpRule } from '../shared/ruleText.ts';
import { ruleSection } from '../shared/srdReference.ts';
import { Fact } from './Fact.tsx';
import { NoteArm } from './NoteArm.tsx';
import { BlockView, CountdownChart } from './ReferenceTables.tsx';
import { AdversaryBlock, EnvironmentBlock } from './StatBlock.tsx';
import { UrlArm } from './UrlArm.tsx';
import { useGm } from './gmStore.ts';
import { COUNTDOWN_KIND_COLOR, LINK_KIND_LABEL, sessionName } from './session.ts';

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
 * planned night with three scenes in it draws OPEN THE SCENE three times, and a
 * VoiceOver user pulling up the rotor's button list hears the same three words
 * with nothing to choose between them, on the one screen whose whole point is
 * an ordered list of similar rows.
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
  const patch = useGm((s) => s.patchSessionItem);
  const live = useGm((s) => s.environmentRef);
  const setEnvironment = useGm((s) => s.setEnvironment);

  const known = environments.some((e) => e.id === item.environmentRef);
  const onBoard = item.environmentRef !== null && item.environmentRef === live;
  const row = sessionName(item);

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

      <Fact>
        This is the plan. The scene runner shows whatever environment is on the
        board right now, which is one per campaign — {onBoard ? 'and it is this one.' : 'and it is not this one.'}
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb
          onClick={() => setEnvironment(item.environmentRef)}
          disabled={onBoard || item.environmentRef === null}
          label="PUT THIS ON THE BOARD"
          row={row}
        />
        <Verb
          onClick={() => patch(item.id, { environmentRef: live })}
          disabled={item.environmentRef === live}
          label="KEEP WHAT IS ON THE BOARD"
          row={row}
        />
        <Verb onClick={() => onOpenTool('scene')} primary label="OPEN THE SCENE" row={row} />
      </div>
    </div>
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
  const rules = useApp((s) => s.dataset.rules);
  const partySize = useApp((s) => s.prefs.gmPartySize);
  const patch = useGm((s) => s.patchSessionItem);
  const boardRoster = useGm((s) => s.roster);
  const boardAdjustments = useGm((s) => s.adjustments);
  const inTheScene = useGm((s) => s.combatants.length);
  const addToRoster = useGm((s) => s.addToRoster);
  const setRosterCount = useGm((s) => s.setRosterCount);
  const clearRoster = useGm((s) => s.clearRoster);
  const toggleAdjustment = useGm((s) => s.toggleAdjustment);
  const spawn = useGm((s) => s.spawn);

  /** The ref whose stat block is open under it, or none. */
  const [preview, setPreview] = useState<Ref | null>(null);

  const byId = new Map(adversaries.map((a) => [a.id, a]));
  const chosen = ADJUSTMENT_KEYS.filter((key) => item.adjustments[key]);
  const row = sessionName(item);
  const bump = damageBumpRule(rules);

  /*
   * What OPEN THE FIGHT can actually put in the scene. A ref this dataset
   * cannot resolve has no stat block, so `spawn` has nothing to make a
   * combatant out of and the row already says so on its own line. A roster of
   * nothing but unresolved refs therefore opens nothing, and the verb is
   * disabled rather than opening an empty scene and looking like it worked.
   */
  const spawnable = item.roster.filter((entry) => byId.has(entry.ref));

  /*
   * Built out of the four actions that already exist, in the order they have
   * to run: `setRosterCount` only ever *updates* an entry, so a ref that is
   * not on the board yet has to be added before its count means anything.
   * Every call is a separate commit and the store's 400 ms debounce collapses
   * the lot into one write.
   */
  const putOnBoard = (): void => {
    clearRoster();
    for (const entry of item.roster) {
      addToRoster(entry.ref);
      setRosterCount(entry.ref, entry.count);
    }
    for (const key of ADJUSTMENT_KEYS) {
      if (item.adjustments[key] !== boardAdjustments[key]) toggleAdjustment(key);
    }
  };

  /*
   * The row straight to the table, without going through the builder - and
   * without going through the board either. `spawn` is the same call the
   * builder's SEND makes, with the same two arguments, so a Minion entry
   * becomes `count` groups of `partySize` here exactly as it does there.
   * `putOnBoard` is deliberately not called: see the docblock.
   */
  const openFight = (): void => {
    for (const entry of spawnable) spawn(byId.get(entry.ref)!, partySize, entry.count);
    onOpenTool('scene');
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      <span className="t-meta">ROSTER</span>
      {item.roster.length === 0 ? (
        <Fact>Nothing planned yet.</Fact>
      ) : (
        <ul className="stack" style={{ gap: 4, margin: 0, padding: 0, listStyle: 'none' }}>
          {item.roster.map((entry) => {
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

      {chosen.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {chosen.map((key) => (
            <span key={key} className="chip">
              {ADJUSTMENT_LABEL[key]}
            </span>
          ))}
        </div>
      )}

      {/*
        The dice the chip above used to name, said where the roster is read
        rather than only inside the builder. Nothing in the scene applies the
        bump - a combatant carries HP, Stress and thresholds, never a damage
        expression - so the GM adds it by hand, and the row is where they find
        out that they have to.
      */}
      {item.adjustments.damageBump && (
        <Fact>
          {bump === null
            ? 'This row was built with the damage bump on, and no rules layer this device has loaded carries the line that says what it adds. Nothing in the scene rolls it for you either way.'
            : `This row was built with “${bump}”. Nothing in the scene rolls that for you — it is added at the table, on every adversary attack.`}
        </Fact>
      )}

      {/*
        A fact, with no control beside it, because there is no action in the
        store that puts a combatant list back. Saying "3 adversaries mid-fight"
        beside a button that dropped them silently is the failure this app is
        written not to have.
      */}
      {item.combatants.length > 0 && (
        <Fact>
          This row was saved with {item.combatants.length} adversar
          {item.combatants.length === 1 ? 'y' : 'ies'} already in the fight, with their marks. No
          control here brings those marks back — OPEN THE FIGHT starts the plan again from full HP
          — so they are kept on the row and nothing here touches them.
        </Fact>
      )}

      {spawnable.length > 0 && inTheScene > 0 && (
        <Fact>
          The scene already holds {inTheScene} adversar{inTheScene === 1 ? 'y' : 'ies'}. Opening
          the fight from here adds this roster to them rather than replacing them; END SCENE, in
          the scene, is what empties it.
        </Fact>
      )}

      <Fact>
        The encounter builder works on the campaign’s one board, not on this row. OPEN THE FIGHT
        goes straight to the scene with this row’s roster and leaves the board’s roster alone.
      </Fact>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Verb
          onClick={putOnBoard}
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
          Last and primary, the way OPEN THE SCENE is on a scene row: the verb
          that leaves the row sits at the end of the wrapped strip, and there is
          only one of them, because two primaries in one row is none. The
          builder loses its fill to it - a GM who has finished planning wants the
          fight, and the builder is now the second choice on a configured row.
        */}
        <Verb
          onClick={openFight}
          disabled={spawnable.length === 0}
          primary
          label="OPEN THE FIGHT"
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
            SRD 1.0{section.page === null ? '' : ` · P.${String(section.page)}`}
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
  const c = item.countdown;
  const spent = c.value === 0;
  const row = sessionName(item);

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
              SRD 1.0<span className="sr-only"> — {row}</span>
            </>
          }
        >
          <CountdownChart countdown={c} />
        </Fold>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
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
        <Verb
          onClick={() => onOpenTool('countdowns')}
          label="OPEN FEAR AND COUNTDOWNS"
          row={row}
        />
      </div>
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
