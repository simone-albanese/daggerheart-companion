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
 * them. They are folded into the controls they belong to - the Fear guidance
 * under the Fear board's twelve targets, the advancement chart under a dynamic
 * countdown's own row - one tap from a thumb that is already there, and shut
 * until asked. The same tables, drawn by the same components; a fold is a
 * second door, never a second copy. What changes is what they can do: on a
 * countdown's row the chart's cells are buttons that move *that* countdown,
 * and here there is no countdown for them to act on, so here they are print.
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
 * ## The topic strip
 *
 * Chips at `var(--tap)` with `padding: 0 12px`. `.t-label` is 10px mono at
 * `0.16em`, so about 7.6px a character: IMPROVISE is 92px, FEAR 54 and
 * COUNTDOWNS 100, which with two 6px gaps is 258 of the 369px column - one row
 * with room to spare, and room for the four topics still to come.
 *
 * They **wrap** rather than scroll sideways. `Gm.tsx`'s old tab strip earned a
 * sideways scroller because it was paid for on every screen forever; a
 * reference consulted mid-scene has to show every subject at once instead of
 * hiding some behind a gesture the GM has to discover.
 *
 * They are **not pinned**. A topic is chosen once and then read, so pinning the
 * strip would cost 44px of every subsequent scroll to hold a decision already
 * made - the opposite of Play's roll block, which is pinned because it is used
 * continuously.
 *
 * And the strip is not drawn at all while there is only one topic: a chip that
 * is always pressed and cannot be unpressed is a label, not a control.
 *
 * ## Adding a section
 *
 * Add the id to `ReferenceTopic`, a row to `REFERENCE_TOPICS`, and a branch to
 * the body below. A topic is added *when it has a body*, never before: a chip
 * that opens an empty panel is the screen claiming a rule it does not carry.
 */
import { useState } from 'react';
import { useIsPhone } from '../shared/useLayout.ts';
import { CountdownChart, FearGuide, TierBenchmarks } from './ReferenceTables.tsx';

export type ReferenceTopic = 'improvise' | 'fear' | 'countdowns';

/**
 * What a menu maps over to build its items.
 *
 * `short` is the chip; `label` is the accessible name, because IMPROVISE on its
 * own is not a question anybody asked.
 */
export const REFERENCE_TOPICS: ReadonlyArray<{
  id: ReferenceTopic;
  label: string;
  short: string;
}> = [
  { id: 'improvise', label: 'Improvise an adversary', short: 'IMPROVISE' },
  { id: 'fear', label: 'Fear', short: 'FEAR' },
  { id: 'countdowns', label: 'Advancing a countdown', short: 'COUNTDOWNS' },
];

export function Reference(): React.JSX.Element {
  const phone = useIsPhone();
  const [topic, setTopic] = useState<ReferenceTopic>(REFERENCE_TOPICS[0]!.id);

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
      {REFERENCE_TOPICS.length > 1 && (
        <div
          role="group"
          aria-label="What to look up"
          className="row"
          style={{ flex: 'none', gap: 6, flexWrap: 'wrap' }}
        >
          {REFERENCE_TOPICS.map((entry) => {
            const on = entry.id === topic;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTopic(entry.id)}
                aria-label={entry.label}
                aria-pressed={on}
                className="t-label"
                style={{
                  flex: 'none',
                  minHeight: 'var(--tap)',
                  padding: '0 12px',
                  borderRadius: 'var(--r3)',
                  border: `1px solid ${on ? 'var(--text-3)' : 'var(--line)'}`,
                  color: on ? 'var(--text)' : 'var(--muted)',
                }}
              >
                {entry.short}
              </button>
            );
          })}
        </div>
      )}

      {topic === 'improvise' && <TierBenchmarks />}
      {topic === 'fear' && <FearGuide />}
      {/*
        Read-only here, and pressable on a dynamic countdown's own row. There is
        no countdown on this screen for a button to act on, and a control that
        cannot act is a control that lies about what it does.
      */}
      {topic === 'countdowns' && <CountdownChart countdown={null} />}
    </div>
  );
}
