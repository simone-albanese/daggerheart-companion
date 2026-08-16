/**
 * The rules at hand: the tables a GM stops the table to look up.
 *
 * Everything on this screen is read out of `data/srd-1.0.json` at the moment it
 * is drawn. Nothing is transcribed. Where the app adds a number of its own it
 * says so on the same line as the number.
 *
 * ## Why it opens from MENU and not from the bar
 *
 * `GmBar`'s three verbs are the continuous gestures of an evening - ADD a row,
 * SHOW a tool, SAVE the campaign - and they hold the 560-820 band a right thumb
 * covers on a 393x852 phone. Looking a rule up is the opposite kind of act: it
 * happens once or twice a session, it stops play while it happens, and it is
 * read rather than pressed. So it lives behind the MENU button at the top of
 * the screen, which `GmTopBar` put there precisely for the rare and deliberate,
 * beside leaving the section and switching table.
 *
 * The parts of this reference a GM *does* want mid-gesture do not wait here for
 * them. They are folded into the controls they belong to, each one tap from a
 * thumb that is already there and each shut until asked.
 *
 * It is not one of the switchable GM tools. The bestiary and the party board
 * are switchable because they are the two forks of SHOW and a GM may genuinely
 * have no use for either; this is the SRD the app already ships and already
 * quotes on the player's screens, reached from a menu that has no switches in
 * it at all. `prefs.gmSection` still takes the whole section away.
 *
 * ## Ergonomics, 393 x 852
 *
 * It draws inside `GmSheet size="full"`, which is the window's width less a
 * 44px title row. This region pads `10px 12px 16px` on a phone, so the column
 * is 369px; at 744 and 1024 it pads `14px 20px 18px` for 704 and 984; the sheet
 * caps at 1100, so the widest column is 1060.
 *
 * The root is its own scroller. Every sibling tool declares one - `Countdowns`,
 * `Bestiary`, `Scene` and `PartyBoard` are all `scroll stack` at `flex: 1;
 * min-height: 0` - because `GmSheet` clips, and a region that forgot would
 * simply lose its bottom half with no way to reach it.
 *
 * Nothing in the region is a target today. That is not an oversight: a
 * benchmark is a number you copy onto a character sheet, and the whole surface
 * is read. When a second subject arrives it gets a strip of topic chips at
 * `var(--tap)` across the top of this scroll - wrapped rather than scrolled
 * sideways, and unpinned, because a topic is chosen once and then read.
 */
import { useIsPhone } from '../shared/useLayout.ts';
import { TierBenchmarks } from './ReferenceTables.tsx';

export function Reference(): React.JSX.Element {
  const phone = useIsPhone();

  return (
    <div
      className="scroll stack"
      style={{
        flex: 1,
        minHeight: 0,
        gap: 14,
        padding: phone ? '10px 12px 16px' : '14px 20px 18px',
      }}
    >
      <TierBenchmarks />
    </div>
  );
}
