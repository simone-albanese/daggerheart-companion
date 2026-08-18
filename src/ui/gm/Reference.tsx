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
 * It draws inside `GmSheet size="full"`. That panel is `width: 100%` and
 * border-box with `border: 1px solid var(--line)` (`GmSheet.tsx:91`), so at
 * 393 its content box is **391.00**, not 393. This region pads `10px 12px
 * 16px` on a phone, so the column is **367.00** - measured in Chrome, and the
 * 369 that stood here was 393 − 24 with the sheet's own border spent nowhere.
 * (The sentence also called the sheet "the window's width less a 44px title
 * row", which conflates two axes: the title row is a vertical cost and has
 * nothing to do with how wide this column is.)
 *
 * At 744 and 1024 the region pads `14px 20px 18px`, and the sheet caps at
 * 1100. The same 1px a side takes those three columns from 704 / 984 / 1060 to
 * **702 / 982 / 1058** - but only the 367.00 was measured. Those three follow
 * from the rule the 393 case demonstrates and are written here as implied, not
 * as measured; what is certain about them is only that the old figures are
 * wrong by the same border. Measure them before anything leans on them.
 *
 * The root is its own scroller. Every sibling tool declares one - `Countdowns`,
 * `Bestiary`, `Scene` and `PartyBoard` are all `scroll stack` at `flex: 1;
 * min-height: 0` - because `GmSheet` clips, and a region that forgot would
 * simply lose its bottom half with no way to reach it.
 *
 * ## The topic strip
 *
 * Chips at `var(--tap)` with `padding: 0 12px`, and `--tap` is 44px: every
 * chip measures exactly 44.00 tall. `.t-label` is 10px mono at `0.16em`, so
 * about 7.6px a character - 6.00 of advance in IBM Plex Mono plus 1.6px of
 * letter-spacing - and measured with a `Range` that estimate is exact on all
 * seven labels.
 *
 * Measured widths: IMPROVISE **94.41**, DIFFICULTY **102.00**, FEAR **56.41**,
 * COUNTDOWNS **102.00**, DISTANCE **86.81**, GM MOVES **86.81**, EXPERIENCES
 * **109.61**. That is 638.05, and with six 6px gaps 674.05 against the 367.00
 * column, so it wraps to **three** rows - IMPROVISE/DIFFICULTY/FEAR at 264.82,
 * COUNTDOWNS/DISTANCE/GM MOVES at 287.62, EXPERIENCES alone at 109.61. `gap:
 * 6px` applies between wrapped lines as well as along them, so the strip is
 * 44 + 6 + 44 + 6 + 44 = **144.00px**, paid once at the top of the scroll
 * rather than pinned.
 *
 * The estimate that stood here made it two rows and 94px, and two independent
 * errors took it there. First, the seven claimed widths were text + 24 of
 * padding and nothing else: a chip is border-box with `border: 1px solid`, so
 * every one of them was short by exactly 2.00. Second, the column was taken as
 * 393 − 24 = 369 rather than the 391 − 24 = 367.00 the sheet's own border
 * leaves - the same forgotten hairline, one level up.
 *
 * The borders are the decisive one, and it is worth being exact about which,
 * because the two are not interchangeable. On the estimate's own numbers the
 * first four chips came to 346 + 18 of gap = 364 in a 369 column: 5px of room,
 * four chips on row one. Measured they are 354.82 + 18 = 372.82 against
 * 367.00, over by 5.82. That is 10.82 of swing, and it splits three ways: 8.00
 * of chip border (four chips, 2.00 each), 2.00 of column, and 0.82 the
 * estimate lost rounding seven character counts to whole pixels.
 *
 * Test each cause on its own against the estimate's own row. Add only the
 * borders and row one is 372 in a 369 column - broken. Take only the column
 * and it is 364 in 367 - still fits, with 3 to spare. So the borders decide
 * this and the column error merely compounds them; neither is the other's
 * spare. That is how an estimate this careful still landed on the wrong row
 * count: the method was sound - 7.6px a character is right to the pixel - and
 * the frame around the text was missing.
 *
 * They **wrap** rather than scroll sideways. `Gm.tsx`'s old tab strip earned a
 * sideways scroller because it was paid for on every screen forever; a
 * reference consulted mid-scene has to show every subject at once instead of
 * hiding some behind a gesture the GM has to discover.
 *
 * They are **not pinned**. A topic is chosen once and then read, so pinning the
 * strip would cost 44px of every subsequent scroll to hold a decision already
 * made - the opposite of `GmTopBar`, which is pinned above this tool because
 * what it holds has to be true whichever tool is open. Play's roll block used
 * to be the contrast here, and it no longer is: P5-5 unpinned it, and nothing
 * on Play is pinned any more.
 *
 * The strip is guarded on `REFERENCE_TOPICS.length > 1`, because a chip that is
 * always pressed and cannot be unpressed is a label rather than a control. With
 * the seven topics below that guard never fires and has never fired: it is
 * there for the edit that cuts the list down to one, not for anything the
 * shipped build does. Nothing tests it, and nothing can - a test would have to
 * shorten a `const` this module exports.
 *
 * ## Adding a section
 *
 * Add the id to `ReferenceTopic`, a row to `REFERENCE_TOPICS`, and a branch to
 * the body below. A topic is added *when it has a body*, never before: a chip
 * that opens an empty panel is the screen claiming a rule it does not carry.
 */
import { useState } from 'react';
import { useIsPhone } from '../shared/useLayout.ts';
import {
  AdversaryExperiences,
  CountdownChart,
  DifficultyLadder,
  FearGuide,
  GmMoves,
  RangeReference,
  TierBenchmarks,
} from './ReferenceTables.tsx';

export type ReferenceTopic =
  | 'improvise'
  | 'difficulty'
  | 'fear'
  | 'countdowns'
  | 'distance'
  | 'moves'
  | 'experiences';

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
  { id: 'difficulty', label: 'Set a Difficulty', short: 'DIFFICULTY' },
  { id: 'fear', label: 'Fear', short: 'FEAR' },
  { id: 'countdowns', label: 'Advancing a countdown', short: 'COUNTDOWNS' },
  { id: 'distance', label: 'Range and distance', short: 'DISTANCE' },
  { id: 'moves', label: 'GM moves and principles', short: 'GM MOVES' },
  { id: 'experiences', label: 'Adversary Experiences', short: 'EXPERIENCES' },
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
      {topic === 'difficulty' && <DifficultyLadder />}
      {topic === 'fear' && <FearGuide besidePool={false} />}
      {/*
        Read-only here, and pressable on a dynamic countdown's own row. There is
        no countdown on this screen for a button to act on, and a control that
        cannot act is a control that lies about what it does.
      */}
      {topic === 'countdowns' && <CountdownChart countdown={null} />}
      {topic === 'distance' && <RangeReference />}
      {topic === 'moves' && <GmMoves />}
      {topic === 'experiences' && <AdversaryExperiences />}
    </div>
  );
}
