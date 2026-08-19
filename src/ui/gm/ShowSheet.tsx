/**
 * SHOW: the three tools only it can open, and the rules, searched.
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
 * three, and the one the switchability argument actually rests on, is that
 * SHOW is their *only* door. MENU is not switchable, so the other two keep a
 * way in whatever a GM turns off.)
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
 * rise to meet it. The scroller above it holds whichever doors are live when
 * the field is empty and the hits when it is not - **not both**: a GM who is
 * typing has asked a question the doors do not answer, and on a phone with a
 * keyboard up the sheet has no room to keep offering them. That argument got
 * stronger with the third door rather than weaker, because the thing being
 * displaced is now taller. Emptying the field - one tap on the CLEAR beside it
 * - brings them straight back, so nothing is lost and nothing had to be
 * dismissed.
 */
import { useState } from 'react';
import { useApp } from '../../store/state.ts';
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

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 10 }}>
      <div
        className="scroll stack"
        style={{ flex: 1, minHeight: 0, gap: 10, padding: '14px 14px 0' }}
      >
        {searching ? (
          <RuleSearchResults query={query} />
        ) : (
          liveDoors(prefs).map((choice) => (
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
          ))
        )}
      </div>
      <div className="stack" style={{ flex: 'none', padding: '0 14px 14px' }}>
        <RuleSearchField value={query} onChange={setQuery} total={rules.length} />
      </div>
    </div>
  );
}
