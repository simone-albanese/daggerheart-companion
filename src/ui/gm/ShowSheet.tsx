/**
 * SHOW: the three tools no row opens and MENU does not carry, and the rules,
 * searched.
 *
 * Every other GM tool is either the content of a session row - a scene row
 * opens the scene runner, an encounter row opens the builder, a countdown row
 * opens the Fear board - or behind MENU, which is where the SRD reference and
 * the name generator are. Three are behind neither. Browsing the bestiary is
 * what a GM does when the plan has just been abandoned, the party board is
 * about the people at the table rather than about tonight, and a shop is a
 * thing the party walks into between two rows rather than a row of its own.
 * None of the three belongs to a row, so the first two were chips on loan in
 * `GmTopBar` until this sheet existed and left it rather than becoming a
 * second route nobody meant to keep; the merchant was born here and has never
 * had another door.
 *
 * ("The three tools no session row can open" stood here, and the same claim
 * stood in `GmBar.tsx`. It is not what separates these three: `SessionBody`
 * calls `onOpenTool` with `scene`, `encounter` and `countdowns` and nothing
 * else, so of the eight tools `GmRegion` names, **five** are not row content -
 * the SRD reference and the name generator are as rowless as these are, and
 * `MenuSheet.tsx` says so in its own words. The property that picks out these
 * three, and the one the switchability argument actually rests on, is that no
 * session row opens them and MENU does not carry them either. SHOW is their
 * door on the bar - not quite their only door, because an empty scene offers
 * the bestiary as well (`Scene.tsx`, the button gated on `prefs.gmBestiary`).
 * That gate is why the exception costs the argument nothing: the second way
 * in goes when the switch does, so nothing is stranded. MENU is not
 * switchable, so the other two keep a way in whatever a GM turns off.)
 *
 * The first two came from a fork the backlog had already drawn: *consulta* -
 * read the adversaries and environments without adding any of them - and
 * *gruppo*, the sheets the players sent. The words on the buttons are English
 * because the rest of this app is; what is preserved is the split, which is the
 * part that was decided. **"The fork" is retired as the name for this sheet's
 * shape**, because a fork has two arms and this has three doors: the owner's
 * decision to make the merchant switchable put it beside those two rather than
 * inside either.
 *
 * ## Why each choice says what it does *not* do
 *
 * The bestiary is a browser, and the encounter builder is where a roster is
 * assembled. A GM who taps BESTIARY expecting to drop an adversary into
 * tonight's fight and finds a read-only list has been misled by one word. So
 * each choice carries the sentence that separates them, and the bestiary's
 * says out loud that it can still send an adversary to the live scene - which
 * it can, through the one cross-link `Bestiary.tsx` has always had.
 *
 * THE MERCHANT is the same trap with the money in it. A character's gold is a
 * real, marked, spendable thing in this app - `GoldEditor` writes it from BUILD
 * and Play prints it into the carried summary - so a tool named for a
 * shopkeeper invites the reading that buying something here marks a slot on
 * somebody's sheet. It does not, it cannot, and it never touches a character
 * record at all, so its sentence says so before the GM taps it rather than
 * after.
 *
 * ## The rules search, and why it is a field rather than another choice
 *
 * `BACKLOG.md` records a decision that SEARCH is not one of the bar's verbs,
 * and that decision stands: what a GM hunts at the table was said there to be
 * already the Bestiary's filter. **That is true of adversaries and false of
 * rules**, which is why the owner asked for rules search here afterwards, and
 * why this is not a re-litigation of the bar. Nothing is added to `GmBar`.
 *
 * It is not a `SHOW_DOORS` row either - the doors themselves are in
 * `showDoors.ts`, as data, because `GmBar`, `Gm.tsx`, `MenuSheet.tsx` and
 * `Settings.tsx` all have to agree with this file about how many there are.
 * Those rows are doors: each hands the screen to a tool and this sheet closes
 * behind it. A search is answered where
 * it is asked - the GM reads the rule, shuts the sheet, and the table is where
 * they left it - so it is a field and a list, in the sheet, and it opens
 * nothing. `RuleSearch.tsx` holds both, and its docblock carries the
 * ergonomics of the field and of the list.
 *
 * **The search rides on SHOW; it does not summon it.** `GmBar` drops the SHOW
 * verb when every door is switched off, and this file is then never rendered,
 * so the search goes off the bar with the sheet that carries it. That is stated
 * rather than papered over: making the search a reason for SHOW to exist would
 * falsify the sentence Settings prints about its own bar - *"With all three off
 * SHOW has nothing left to open, so it leaves the GM screen's bottom bar"* -
 * and `MenuSheet`'s sentence about where the other tools are. The subjects
 * `Reference` curates are behind MENU either way, and MENU is not switchable.
 *
 * The sentence stays true because the search opens nothing - it is content on
 * SHOW's sheet, not a door leading off it - but on its own it no longer says
 * everything a GM turning every switch off is about to lose. So Settings names
 * the search in the same breath: *"The rules search lives on that sheet, so it
 * goes with it; the reference behind MENU does not."* `GmBar`'s own docblock
 * carries the other half, which is why the verb is dropped rather than kept
 * alive by the field.
 *
 * ## Seven live states, and the one the owner accepted rather than fixed
 *
 * Three switchable doors are 2³ − 1 = **seven** states this sheet can be drawn
 * in, because the eighth - every door off - is the state `GmBar` answers by not
 * drawing SHOW at all. **Three of the seven hold one door and the field**: a
 * whole bottom sheet, a dialog, a focus trap and a title row, to offer one
 * button and a search box.
 *
 * Two doors made two such states; three make three, and the reason that matters
 * is not the count. A third tool is a third thing a GM can decide they do not
 * run - the table that never shops switches off the merchant, the solo game
 * switches off the party board - so every door added makes "I use exactly one
 * of these" a likelier description of a real GM than it was. Be exact about
 * what moves the other way: the *share* of the enumeration falls, from two of
 * three to three of seven. Nobody's preferences are spread evenly over an
 * enumeration, so that share is not the quantity anybody is deciding about, and
 * it is written here so that a later reader who computes it does not think this
 * paragraph got it backwards.
 *
 * The owner was shown that and chose to leave it. It is written down here so
 * that the next reader does not mistake an accepted cost for an oversight and
 * spend a night undoing it. What was weighed: collapsing the one-door case into
 * "SHOW opens the tool directly" would make the same verb mean two different
 * things depending on a setting the GM last touched months ago, and it would
 * take the rules search - which is behind SHOW in all seven states and is the
 * reason several GMs open the sheet - out of reach in three of them. The sheet
 * that is one tap too many is the honest version; the shortcut that sometimes
 * skips a screen is not.
 *
 * ## Ergonomics, 393 x 852
 *
 * Up to three choices - two, or one, as the switches take them away - full
 * width of the sheet, `minHeight: 56` rather than 44. This
 * is a sheet that opens under the thumb from a bar button and is answered
 * immediately, and 56 is what makes the second tap land without the eye moving
 * from where the first one was.
 *
 * The rest of this paragraph used to be arithmetic and is now a measurement,
 * and the arithmetic was wrong. The inner column is **363px**, not the "365"
 * that `393 - 28 of padding` gives, because the panel also carries a 1px border on
 * each side. No choice comes near its 56px floor at that width: each draws
 * **84.58**, which is 2 of border, 20 of padding, the 10px label, a 5px gap
 * and its sentence on **three** lines rather than the two this said. The
 * sentence is read rather than touched either way.
 *
 * **The third door was measured, not assumed to match.** Its sentence is the
 * longest of the three and it still wraps to three lines, so all three choices
 * measure 84.58 exactly and the sheet grows by one choice and one 10px gap:
 * with every door on and the field empty the panel is **402.73** - y 449.27 to
 * 852.00, a little under half the window. ("308.2px" stood here and is retired:
 * it was true of two doors, which is a state this sheet still has and is no
 * longer the state it is usually in.) The field is 363.00 x 44.00 at y 793.00.
 * All of it measured in Chrome at 393x852, device-scale-factor 1, safe area
 * top 47 / bottom 34.
 *
 * The **field is the last element**, on the bottom edge of a bottom-anchored
 * sheet, where the thumb that pressed SHOW already is and where a keyboard will
 * rise to meet it. The scroller above it holds the empty-field state when the
 * field is empty and the hits when it is not - **not both**: a GM who is
 * typing has asked a question the doors do not answer, and on a phone with a
 * keyboard up the sheet has no room to keep offering them. That argument got
 * stronger with the third door rather than weaker, because the thing being
 * displaced is now taller. Emptying the field - one tap on the CLEAR beside it
 * - brings them straight back, so nothing is lost and nothing had to be
 * dismissed.
 *
 * ## The empty field holds both: the moment chips, then the doors
 *
 * That is the owner's decision of 2026-08-25 §6, taken over the two
 * alternatives - chips instead of the doors, or chips only when every door is
 * switched off - and it is a decision rather than a derivation, so it is
 * recorded as one. What this file owes it is the arithmetic underneath and an
 * honest account of what has not been measured.
 *
 * **Six chips, and they are a 2x3 grid rather than a row.** Six across the
 * column at an 8px gap is 53.8px each, which clears the 44px tap floor in
 * *width* and does not hold `BETWEEN SCENES`: the longest of the six labels is
 * fourteen characters of a 10px mono face at 0.16em of tracking, and 53.8px
 * does not take it without wrapping the label inside the chip or cutting it.
 * Two columns give each chip about 177px, which takes every one of the six on
 * one line with room to spare. That is arithmetic on a column this file already
 * measures and it is sound; what it does not give is the **height** of the
 * result.
 *
 * **The height of that grid has never been measured, by anyone, and it is not
 * derived here.** Three rows of a 44px floor plus two 8px gaps is 148px if
 * every chip sits exactly on the floor, and whether they do is precisely the
 * thing arithmetic cannot say - it is the same trap the "twenty shut hits at
 * the 44px floor is 880px" figure fell into next door, where Chrome measured
 * 1327.1 against an arithmetic 880. So no number is written down for it.
 * **This owes a Chrome pass at 393x852**, which also owes the answer to the
 * question the grid raises rather than settles: with three doors on, whether
 * the last door is still reachable without a scroll, and where the grid puts
 * the first door relative to the thumb.
 *
 * **The panel scrolls, so this is a cost and not a cliff.** It did not on the
 * day §6 was framed, and the argument against putting anything above the doors
 * was written against a panel that clipped. `GmSheet` gave its body a real
 * scroller on 2026-08-25, so a grid that turns out taller than the arithmetic
 * hopes pushes the last door under the fold rather than off the sheet. That is
 * the premise this paragraph rests on; the old one must not be quoted back at
 * it.
 *
 * **The overflow is not a way out.** H-9 is shut - no horizontal rail on this
 * screen - so six chips in one scrolling row is not an option that was weighed
 * and rejected here, it is one that is closed elsewhere.
 *
 * **What the doors pay.** They move down by the grid and its gap, and
 * `showDoors.ts` says in its own words why their order is never touched: a GM
 * who has been opening the bestiary from the top of this sheet for a month
 * keeps it at the top. That property is about the order of the three and it
 * survives; what does not survive is the *position*, and this is the one place
 * that says so out loud rather than letting a GM find it.
 *
 * **A chip fills the field.** It creates no new state, no second list and no
 * overlay: tapping `DAMAGE` types `damage` where the GM could have typed it,
 * so what happens next is the surface they already know, the CLEAR beside the
 * field undoes it, and the words in the field are the words on the chip they
 * pressed. The words are the moment's own label because `searchAsk` indexes
 * each question under its moment as well as under `ask` and `also`, so every
 * chip is guaranteed to find its own questions rather than only whatever
 * sections happen to carry the same words.
 */
import { useEffect, useState } from 'react';
import { useApp } from '../../store/state.ts';
import { loadAsk, MOMENTS } from './ask.ts';
import type { GmRegion } from './gmStore.ts';
import { RuleSearchField, RuleSearchResults } from './RuleSearch.tsx';
import { liveDoors } from './showDoors.ts';

export function ShowSheet({
  onOpenTool,
}: {
  onOpenTool: (tool: GmRegion) => void;
}): React.JSX.Element {
  const prefs = useApp((s) => s.prefs);
  const rules = useApp((s) => s.dataset.rules);
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';

  /*
   * Warm the catalogue's chunk when the sheet opens, and throw the result
   * away: what is wanted is the fetch, not the data, which `RuleSearchResults`
   * asks for itself when it needs it.
   *
   * This is ergonomics rather than optimisation. The questions are behind a
   * dynamic `import()` - `ask.ts` says why - so on a cold cache they can arrive
   * a beat after the first keystroke, and a band that appears late pushes the
   * first rule hit down the glass while the GM is reading it. Opening SHOW is a
   * deliberate tap with a sheet animation behind it and several seconds of
   * human before the first character lands, so the fetch costs nothing there
   * and nothing at all is put on the boot path: this component is inside `Gm`,
   * which is itself a `lazy()` chunk.
   */
  useEffect(() => {
    void loadAsk();
  }, []);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <div
        className="scroll stack"
        style={{ flex: 1, minHeight: 0, gap: 10, padding: '14px 14px 0' }}
      >
        {searching ? (
          <RuleSearchResults query={query} onQuery={setQuery} />
        ) : (
          <>
            {/*
              The moment chips, above the doors, in one scroll - the owner's
              decision of 2026-08-25 §6. Two columns because six across this
              column is 53.8px each and `BETWEEN SCENES` does not fit that; the
              grid's height is unmeasured and the docblock above says so rather
              than guessing at it.

              A chip is drawn the way CLEAR is - a `t-label` with its words as
              its own text and no `<span>` inside - and that is load bearing
              rather than tidy: `merchant.test.tsx` enumerates the doors of
              this sheet by reading the first `<span>` of every button in the
              dialog, so a chip built like a door would join the list of doors
              in seven assertions that are about which tools SHOW opens.
            */}
            <div
              role="group"
              aria-label="What just happened"
              style={{
                flex: 'none',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
              }}
            >
              {MOMENTS.map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  className="t-label"
                  onClick={() => {
                    setQuery(moment.label.toLowerCase());
                  }}
                  style={{
                    minHeight: 44,
                    padding: '0 8px',
                    color: 'var(--text-2)',
                    background: 'var(--panel)',
                    border: '1px solid var(--line)',
                    borderRadius: 'var(--r2)',
                  }}
                >
                  {moment.label}
                </button>
              ))}
            </div>
            {liveDoors(prefs).map((choice) => (
              <button
                key={choice.tool}
                type="button"
                onClick={() => onOpenTool(choice.tool)}
                className="panel stack"
                style={{
                  flex: 'none',
                  minHeight: 56,
                  gap: 5,
                  padding: '10px 12px',
                  textAlign: 'left',
                  alignItems: 'flex-start',
                }}
              >
                <span className="t-label" style={{ letterSpacing: '0.1em' }}>
                  {choice.label}
                </span>
                <span className="t-dense" style={{ color: 'var(--muted)', maxWidth: '62ch' }}>
                  {choice.body}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
      <div className="stack" style={{ flex: 'none', padding: '0 14px 14px' }}>
        <RuleSearchField value={query} onChange={setQuery} total={rules.length} />
      </div>
    </div>
  );
}
