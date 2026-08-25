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
 * each side. A choice is its label alone now, so nothing in it comes near the
 * 56px floor: 20 of padding and a 10px line is **30**, and the floor is what
 * the row measures.
 *
 * **A door used to carry a sentence, and the figures that went with it are
 * records rather than claims.** Each choice measured "84.58" - 2 of border, 20
 * of padding, the 10px label, a 5px gap and its sentence on three lines - and
 * with every door on and the field empty the panel measured "402.73", y 449.27
 * to 852.00. Both belong to the sheet as it was before the sentences came off;
 * see the section on the moment chips for why they did and what the space was
 * spent on. The panel's new height is **not re-measured here** and is owed to
 * the next Chrome pass. ("308.2px" also stood here and is retired: it was true
 * of two doors, which is a state this sheet still has and is no longer the
 * state it is usually in.) The field is 363.00 x 44.00 at y 793.00. All of it
 * measured in Chrome at 393x852, device-scale-factor 1, safe area top 47 /
 * bottom 34.
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
 * switched off. Chrome then measured what that costs, and the answer changed
 * the doors rather than the chips.
 *
 * **The window, measured on this branch at 393x852 with insets 47/34.** The
 * scroller's reading window is **308.3**; it pays **14** of padding above its
 * first child, so **294.3** is what the column has. Three doors and the two
 * 10px gaps between them took **273.7** of it. That left **20.6px** above the
 * doors, and nothing this app draws is 20.6px tall: not a 2x3 grid of chips,
 * not a 3x2, not a single row of them, not a QUESTIONS band. The chips were
 * never the problem to solve - **three doors filled the reading window on their
 * own.**
 *
 * **So the sentence under each door goes, and the label stays** (the owner,
 * same pass). A door was **84.6** tall: 20 of padding, the 10px label, a 5px
 * gap, and **47.6** of description on three lines. Without the description it
 * is 20 + 10 = **30**, floored by its own `minHeight` to **56**, and three of
 * them with their gaps come to **188** - **85.7px** handed back, for **106.3**
 * above the doors.
 *
 * **What that costs is real and is not hidden.** A GM opening SHOW for the
 * first time no longer reads what THE MERCHANT does before pressing it, and
 * those three sentences were the ones that said what each tool is *not* - a
 * bestiary that adds nothing to tonight, a board that writes to no character, a
 * stall that spends nobody's gold. They are not lost: `Settings.tsx` carries
 * all three beside the switch that decides whether the door exists at all,
 * which is the one place a GM is already reading about a tool rather than
 * reaching for one. It carries them **in its own words rather than by drawing
 * `choice.body`**, because a hint beside a switch answers a different question
 * than a door does: what turning this off takes away, not what waits behind
 * it. `tests/ui/settingsHints.test.tsx` pins one clause of each to the switch
 * it describes. Two halves needed work rather than inheritance, and both were
 * done rather than assumed: the party board's *never
 * writes to their characters* was a promise about the board and Settings only
 * said it about the switch, so that clause was added to the hint; the
 * bestiary's *an adversary can still be sent straight to the live scene from
 * there* is dropped outright, because it is an affordance rather than a promise
 * and the button that does it is inside the bestiary where it can be seen.
 *
 * **`ShowDoor.body` is now read by nothing.** Dropping the sentence from the
 * door left the field on the type and on all three entries with no drawer
 * anywhere in `src`. It is left standing rather than deleted, because whether
 * those three sentences remain the app's canonical wording for what each tool
 * is not - with Settings paraphrasing them - is a decision about the words and
 * not about this layout. It is the next thing to settle here, and
 * `tests/ui/settingsHints.test.tsx` is what holds the promises in the meantime.
 *
 * **The grid is three columns and two rows, and every term of it is written
 * down.** Two rows at the 44px tap floor with one 8px gap is **96**; the
 * scroller's own 10px gap puts the first door at 106, inside the 106.3 the
 * doors gave back. The whole column comes to 96 + 10 + 188 = **294.0** in a
 * **294.3** window. That fits by **0.3px**, which is a coincidence and not a
 * margin: if the re-measurement moves any term the last door loses a hair to
 * the scroller, which is a thing the panel now has. The first place with give
 * in it is the door floor - 56 against a 44px tap floor is 12px a door, 36 in
 * the column - and it is spent there rather than on the chips, because the
 * doors are the destinations and the chips are an index of them.
 *
 * **Three columns needed 16.33px that were not there, and the constant that
 * was blocking it is not the one this docblock used to name.** Three columns
 * with 8px gaps give **115.67** each. The widest label is **BEFORE THE ROLL at
 * 114.00**, tied with **THE DICE LANDED**; `BETWEEN SCENES` is **106.41** and
 * third, and two sentences here named it as the binding one and were wrong. At
 * the chip's 18px of frame - 8px of padding and a 1px border a side - the
 * minimum was **132.00**, over by **16.33**.
 *
 * **Of the three levers, only tracking could pay it.** *Columns*: two of them
 * is three rows, 2x44 + 2x8 = **148**, which is 41.7 more than the doors gave
 * back - so the arrangement that fitted the old sheet cannot fit this one.
 * *Padding*: taking all 16px of it leaves 114.00 + 2 of border = **116.00**,
 * still 0.33 over, and padding is not the breathing room here anyway - the cell
 * is a fixed 115.67 and the label is centred in it, so what a reader sees at
 * either end is half of whatever the label does not use. *Tracking*: the label
 * is 10px mono at **1.6px** of letter-spacing, and `BEFORE THE ROLL` is fifteen
 * characters, so **24.00** of that 114.00 is spacing and **90.00** is glyphs -
 * more slack in the spacing than the whole deficit.
 *
 * So the chips are drawn at **0.08em**, half the label role's own. The same
 * fifteen characters then carry 12.00 and the text is **102.00**; with 4px of
 * padding and the border the chip's minimum is **112.00** against 115.67, with
 * **3.67** to spare. Every other label is inside it by construction: THE DICE
 * LANDED 102.00, BETWEEN SCENES 95.21, THIS PLACE 68.00, MY TURN 47.60, DAMAGE
 * 40.81. (Whether Chrome hangs the tracking off the trailing character too
 * moves each of those by 0.8px and changes none of the conclusions.)
 *
 * 0.08em is not a number invented for this box: `.t-meta` is the same 10px mono
 * face at 0.06em, so this sits inside the range the type scale already uses,
 * and this file already overrides `.t-label`'s tracking once - the door's own
 * label is drawn at 0.1em.
 *
 * **What the next Chrome pass still owes.** The height of a one-line door and
 * of the two-row grid, both of which are floors here rather than measurements;
 * the panel's new overall height, which retires "402.73"; and the one thing
 * arithmetic cannot answer at all - whether 102px of 10px mono at half its
 * usual tracking is still read at arm's length in a dim room, which is what
 * this lever was spent on.
 *
 * **The overflow is still not a way out.** H-9 is shut - no horizontal rail on
 * this screen - so six chips in one scrolling row is not an option that was
 * weighed and rejected here, it is one that is closed elsewhere.
 *
 * **What the doors pay, beyond their sentences.** They move down by the grid
 * and its gap, and `showDoors.ts` says in its own words why their order is
 * never touched: a GM who has been opening the bestiary from the top of this
 * sheet for a month keeps it at the top. That property is about the order of
 * the three and it survives; what does not survive is the *position*, and this
 * is the one place that says so out loud rather than letting a GM find it.
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
              decision of 2026-08-25 §6. Three columns and two rows: the
              docblock above carries every term of that, including the 16.33px
              the third column costs and the tracking that pays for it.

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
                gridTemplateColumns: 'repeat(3, 1fr)',
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
                    padding: '0 4px',
                    // Half the label role's 0.16em, and the whole of what buys
                    // a third column: fifteen characters at 1.6px is 24 of the
                    // widest label's 114.00, and 16.33 of it had to go.
                    letterSpacing: '0.08em',
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
              /*
                The label alone. `choice.body` is still in `showDoors.ts` and
                still says what each tool is not - it is drawn beside that
                tool's switch in Settings, which is where a GM reads about a
                door rather than reaching for one, and the docblock above says
                what that trade cost and what was moved to keep it honest.

                `justifyContent: center` because the row is one 10px line in a
                56px box now: left at the top of it, the label would sit under
                the ceiling with 26px of nothing beneath it.
              */
              <button
                key={choice.tool}
                type="button"
                onClick={() => onOpenTool(choice.tool)}
                className="panel stack"
                style={{
                  flex: 'none',
                  minHeight: 56,
                  padding: '10px 12px',
                  textAlign: 'left',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                }}
              >
                <span className="t-label" style={{ letterSpacing: '0.1em' }}>
                  {choice.label}
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
