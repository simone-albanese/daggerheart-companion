/**
 * SHOW: the two tools no row can open, and the rules, searched.
 *
 * Every other GM tool is the content of a session row - a scene row opens the
 * scene runner, an encounter row opens the builder, a countdown row opens the
 * Fear board. Two are not. Browsing the bestiary is what a GM does when the
 * plan has just been abandoned, and the party board is about the people at the
 * table rather than about tonight. Neither belongs to a row, so both were
 * chips on loan in `GmTopBar` until this sheet existed, and they leave it with
 * this commit rather than becoming a second route nobody meant to keep.
 *
 * The fork is the backlog's own: *consulta* - read the adversaries and
 * environments without adding any of them - and *gruppo*, the sheets the
 * players sent. The words on the buttons are English because the rest of this
 * app is; what is preserved is the split, which is the part that was decided.
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
 * ## The rules search, and why it is a field rather than a third choice
 *
 * `BACKLOG.md` records a decision that SEARCH is not one of the bar's verbs,
 * and that decision stands: what a GM hunts at the table was said there to be
 * already the Bestiary's filter. **That is true of adversaries and false of
 * rules**, which is why the owner asked for rules search here afterwards, and
 * why this is not a re-litigation of the bar. Nothing is added to `GmBar`.
 *
 * It is not a third `CHOICES` row either. The two rows are doors: each hands
 * the screen to a tool and this sheet closes behind it. A search is answered
 * where it is asked - the GM reads the rule, shuts the sheet, and the table is
 * where they left it - so it is a field and a list, in the sheet, and it opens
 * nothing. `RuleSearch.tsx` holds both, and its header carries the ergonomics.
 *
 * **The search rides on SHOW; it does not summon it.** `GmBar` drops the SHOW
 * verb when `gmBestiary` and `gmPartyBoard` are both off, and this file is then
 * never rendered, so the search goes off the bar with the sheet that carries
 * it. That is stated rather than papered over: making the search a third reason
 * for SHOW to exist would falsify the sentence Settings prints about its own
 * bar - *"With both off SHOW has nothing left to open, so it leaves the GM
 * screen's bottom bar"* - and `MenuSheet`'s sentence about where the other
 * tools are, in two files this change does not own. The rules the reference
 * screen curates are behind MENU either way, and MENU is not switchable.
 *
 * ## Ergonomics, 393 x 852
 *
 * Two choices - one, when the other is switched off - full width of the sheet,
 * `minHeight: 56` rather than 44. This
 * is a sheet that opens under the thumb from a bar button and is answered
 * immediately, and 56 is what makes the second tap land without the eye moving
 * from where the first one was.
 *
 * The rest of this paragraph used to be arithmetic and is now a measurement,
 * and the arithmetic was wrong. The inner column is **363px**, not the 365 that
 * `393 - 28 of padding` gives, because the panel also carries a 1px border on
 * each side. Neither choice comes near its 56px floor at that width: each draws
 * **84.6px**, which is 2 of border, 20 of padding, the 10px label, a 5px gap
 * and its sentence on **three** lines rather than the two this said. The
 * sentence is read rather than touched either way. With both switched on and
 * the field empty the whole sheet is 308.2px.
 *
 * The **field is the last element**, on the bottom edge of a bottom-anchored
 * sheet, where the thumb that pressed SHOW already is and where a keyboard will
 * rise to meet it. The scroller above it holds the two choices when the field
 * is empty and the hits when it is not - **not both**: a GM who is typing has
 * asked a question the two doors do not answer, and on a phone with a keyboard
 * up the sheet has no room to keep offering them. Emptying the field - one tap
 * on the CLEAR beside it - brings them straight back, so nothing is lost and
 * nothing had to be dismissed.
 */
import { useState } from 'react';
import { useApp } from '../../store/state.ts';
import type { Prefs } from '../../store/prefs.ts';
import type { GmRegion } from './gmStore.ts';
import { RuleSearchField, RuleSearchResults } from './RuleSearch.tsx';

/**
 * Each fork, and the preference that decides whether it is offered.
 *
 * Both are switchable in Settings, and a fork switched off is *absent* here
 * rather than present and disabled: this sheet exists to be answered in one
 * tap, and a greyed choice makes the GM read a row that was never going to
 * open. With both off nothing reaches this file at all - `GmBar` drops SHOW
 * entirely - so the empty case is a state the screen cannot be in rather than
 * one this component has to draw.
 */
const CHOICES: Array<{ tool: GmRegion; label: string; body: string; pref: keyof Prefs }> = [
  {
    tool: 'bestiary',
    pref: 'gmBestiary',
    label: 'BESTIARY',
    body: 'Read the adversaries and environments this dataset carries, without adding any of them to tonight. An adversary can still be sent straight to the live scene from there.',
  },
  {
    tool: 'party',
    pref: 'gmPartyBoard',
    label: 'THE PARTY BOARD',
    body: 'The sheets the players sent you, as they arrived, beside whatever you have marked on them since. Nothing here ever writes to their characters.',
  },
];

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
          CHOICES.filter((choice) => prefs[choice.pref] === true).map((choice) => (
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
