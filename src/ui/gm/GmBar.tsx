/**
 * The GM's own bottom bar: three verbs, in the band a thumb reaches without
 * looking down.
 *
 * ## Verbs, not destinations
 *
 * `TabBar` below this in the shell is four *places*, and its buttons say which
 * one you are in with `aria-current="page"`. These three are not places. ADD,
 * SHOW and SAVE each open something over the list and hand the screen back
 * when it closes, so they carry `aria-haspopup="dialog"` and `aria-expanded`
 * and deliberately no `aria-current`: a bar that reported "you are in ADD"
 * would be describing a dialog as a destination, which is exactly the
 * five-menus reading of this screen that the session list exists to end.
 *
 * They also carry no glyph, where every tab does. A shape is what makes a
 * destination findable in a dim room without reading; a verb is read. Three
 * words at `.t-label` are 4-5 characters each and legible at arm's length, and
 * a mark beside them would be a picture of a place.
 *
 * ## Where SEARCH went
 *
 * The wireframe draws four: ADD, SHOW, SEARCH, SAVE. SEARCH is **absent** here
 * rather than present and disabled, and it stayed absent after the thing it
 * was for arrived.
 *
 * Full-text rule search is no longer deferred - `RuleSearch.tsx` reads every
 * title and every body of `dataset.rules` from a field at the foot of the SHOW
 * sheet. What the owner asked for was that search *inside SHOW*, and the
 * recorded objection to the fourth verb survives it intact: the searching a GM
 * actually does at the table already happened behind SHOW, in `Bestiary`'s
 * filter over names, descriptions, motives and feature names, and the rules
 * search is behind SHOW as well. A SEARCH verb here would split one place to
 * search into two and take a quarter of the bar to do it. `BACKLOG.md` carries
 * the absence, and the objection, so both are decisions rather than silences.
 *
 * ## SHOW leaves when all of its doors are gone
 *
 * Every door behind SHOW is switchable in Settings - the bestiary, the party
 * board and the merchant are the tools no session row can open, which is
 * exactly why they are the ones that can be switched off without making a row
 * unopenable. With all of them off, SHOW is not drawn *disabled*: it is not
 * drawn.
 *
 * **The condition is asked of `SHOW_DOORS` rather than of two named
 * preferences, and that is the whole of this file's part in the third door.**
 * It used to read `bestiary || partyBoard`, which is a copy of the door list
 * living in the file least likely to be edited when the list grows: a build
 * that added a door and missed this line would take SHOW off the bar for a GM
 * whose only live tool was the new one, and every test of the two old doors
 * would have stayed green through it. Asking the list means a fourth door
 * arrives here for free, and means this bar cannot disagree with the sheet it
 * opens about whether there is anything behind it.
 *
 * **The reason is not that the sheet would be empty, and this paragraph said it
 * was until the search arrived.** It would not be empty: `ShowSheet` draws the
 * rules field whether or not any door survives, so a SHOW kept alive by the search alone
 * would open a working search over every section the dataset carries. It is
 * dropped anyway, and that is the same argument as SEARCH above arrived at from
 * the other direction. The search *opens* nothing - it answers where it is
 * asked, in the sheet, and hands the screen back unchanged - so it is content
 * SHOW carries, never a reason to draw the verb. A SHOW that existed only to
 * hold it would be the fourth verb this bar refused, wearing the third one's
 * word. The subjects `Reference` curates stay behind MENU either way, and MENU
 * is not switchable.
 *
 * ## Ergonomics, 393x852
 *
 * The bar is `repeat(n, 1fr)` over the full width rather than a fixed three,
 * so dropping a verb redistributes the width instead of leaving a hole where it
 * was. At three that is 131px each; at two it is 196.
 * Every button is `minHeight: 60` - `TabBar`'s own number, in the same slot on
 * the glass, so the muscle memory of the app's bottom bar survives entering
 * the GM section.
 *
 * On a 393x852 phone that puts the labels at y 758-818 - the window less the
 * 34px home-indicator inset less the bar's own 60 - inside the 560-820
 * band a right thumb covers comfortably while the other hand holds a dice
 * tray. The order is the wireframe's, left to right, and it is worth saying
 * why it is not sorted by frequency: ADD and SHOW are the continuous gestures
 * of an evening and SAVE is the rare one, but all three are 131 x 60 and all
 * three are inside the arc, so re-ordering them would buy nothing and cost the
 * GM the layout they were shown.
 *
 * **It pays `env(safe-area-inset-bottom)` now, and it is the only thing that
 * does on this screen.** The home-indicator inset belongs to whatever is last
 * in `<main>`, and inside the GM section that is this bar: `App.tsx` draws no
 * tab bar on `gm`, and the licence notice is inside the session list's scroll
 * rather than pinned under it. It did not pay the inset in the commit that
 * introduced it, because both of those were still below it and two payments
 * are 34px of empty panel between two bars. `SessionList` says `pinnedBelow` to
 * `LicenceFooter` for the same reason from the other end.
 *
 * **A test does assert it from the DOM now, and this paragraph used to say one
 * never could.** What it said was true of the declaration as written: jsdom's
 * CSS parser drops a bare `env(...)` on the floor, so `paddingBottom:
 * 'env(safe-area-inset-bottom)'` read back as `''` and an assertion on it could
 * never fail. It keeps the same declaration wrapped in `calc()`, which the
 * parser does keep and the browser computes identically - so `attribution.test`
 * can now count the payers on every screen and fail when there are two or none.
 * `gmShell.test` still reads this file's source as well, which is the belt to
 * that braces.
 *
 * Nothing here is read-only: the whole bar is target.
 */
import { useApp } from '../../store/state.ts';
import { liveDoors } from './showDoors.ts';

/**
 * Which sheet is over the list.
 *
 * Declared here rather than in `Gm.tsx` so that a sheet never has to import
 * the screen that mounts it. There is no `'fear'` in it on purpose: the Fear
 * board is `Countdowns`, which is a tool and opens through `GmRegion` like
 * every other tool. `'menu'` is in it and is not in the bar -
 * it opens from the top of the screen, because leaving the GM section is the
 * rare gesture and the arc belongs to the continuous ones.
 */
export type GmSheetId = 'menu' | 'add' | 'show' | 'save';

/** The bar's own three, in the wireframe's order. MENU is not one of them. */
const VERBS: Array<{ id: GmSheetId; label: string }> = [
  { id: 'add', label: 'ADD' },
  { id: 'show', label: 'SHOW' },
  { id: 'save', label: 'SAVE' },
];

export function GmBar({
  open,
  onOpenSheet,
}: {
  /** The sheet that is open, so the button that opened it reports it. */
  open: GmSheetId | null;
  onOpenSheet: (sheet: GmSheetId) => void;
}): React.JSX.Element {
  // Read here rather than taken as a prop: which verbs exist is this bar's own
  // business, and threading the switches through `Gm.tsx` would put the
  // decision in the file that only mounts it. The whole record rather than a
  // field at a time, because the question asked of it - "is any door live" -
  // belongs to `SHOW_DOORS`, and a selector per door would be the hardcoded
  // pair back in a longer spelling.
  const prefs = useApp((s) => s.prefs);
  const doors = liveDoors(prefs).length;
  const verbs = VERBS.filter((verb) => verb.id !== 'show' || doors > 0);

  return (
    <nav
      aria-label="Session tools"
      style={{
        flex: 'none',
        display: 'grid',
        gridTemplateColumns: `repeat(${String(verbs.length)}, 1fr)`,
        borderTop: '1px solid var(--line-soft)',
        background: 'var(--panel)',
        // `calc(0px + …)` rather than a bare `env()`, and the zero buys a test
        // rather than a pixel - see the docblock above.
        paddingBottom: 'calc(0px + env(safe-area-inset-bottom))',
      }}
    >
      {verbs.map((verb) => {
        const active = open === verb.id;
        return (
          <button
            key={verb.id}
            type="button"
            onClick={() => onOpenSheet(verb.id)}
            aria-haspopup="dialog"
            aria-expanded={active}
            className="t-label"
            style={{
              minHeight: 60,
              letterSpacing: '0.12em',
              color: active ? 'var(--text)' : 'var(--muted)',
              fontWeight: active ? 700 : 600,
            }}
          >
            {verb.label}
          </button>
        );
      })}
    </nav>
  );
}
