/**
 * SHOW: the two tools no row can open.
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
 * ## Ergonomics
 *
 * Two choices - one, when the other is switched off - full width of the sheet,
 * `minHeight: 56` rather than 44. This
 * is a sheet that opens under the thumb from a bar button and is answered
 * immediately, and 56 is what makes the second tap land without the eye moving
 * from where the first one was. On a 393px phone the sheet's inner column is
 * 393 - 28 of padding = 365px; the label and its sentence both fit on two
 * lines at that width, and the sentence is read rather than touched.
 */
import { useApp } from '../../store/state.ts';
import type { Prefs } from '../../store/prefs.ts';
import type { GmRegion } from './gmStore.ts';

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

  return (
    <div className="scroll stack" style={{ flex: 1, minHeight: 0, gap: 10, padding: 14 }}>
      {CHOICES.filter((choice) => prefs[choice.pref] === true).map((choice) => (
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
    </div>
  );
}
