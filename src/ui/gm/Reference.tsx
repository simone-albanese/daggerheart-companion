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
 * It is not one of the switchable GM tools. The bestiary, the party board and
 * the merchant are switchable because they are the three doors of SHOW and a GM
 * may genuinely have no use for any of them; this is the SRD the app already ships and already
 * quotes on the player's screens, reached from a menu that has no switches in
 * it at all. `prefs.gmSection` still takes the whole section away.
 *
 * ## Ergonomics, 393 x 852
 *
 * It draws inside `GmSheet size="full"`. That panel is `width: 100%` and
 * border-box with `border: 1px solid var(--line)` (`GmSheet.tsx`), so at
 * 393 its content box is **391.00**, not 393. This region pads `10px 12px
 * 16px` on a phone, so the column is **367.00** - measured in Chrome, and the
 * 369 that stood here was 393 − 24 with the sheet's own border spent nowhere.
 * (The sentence also called the sheet "the window's width less a 44px title
 * row", which conflates two axes: the title row is a vertical cost and has
 * nothing to do with how wide this column is.)
 *
 * At 744 and 1024 the region pads `14px 20px 18px`, and the sheet caps at
 * 1100. The same 1px a side takes those three columns from 704 / 984 / 1060 to
 * **702 / 982 / 1058**, and none of the three is implied any more: 702.00 at
 * 744, 982.00 at 1024 and 1058.00 at the cap were each read off this region's
 * own content box in Chrome, and each is exactly what the border predicts.
 * Reaching the cap needs no exotic window either - `GmSheet`'s `full` overlay
 * declares `padding: full || phone ? 0 : 24`, which spends nothing a side, so
 * the panel is as wide as what it is drawn against until 1100 - and the column
 * stops there: 1058.00 at 1100 and
 * identically 1058.00 at 1102, 1200 and 1400, against 982.00 at 1024 for
 * contrast, i.e. still uncapped there.
 *
 * (That overlay used to pay `calc(env(safe-area-inset-top) + 8px) 0 0`, and
 * every width above was measured under it. The change is vertical only: it is
 * `position: absolute` inside the stage `Gm.tsx` puts between the two bars now,
 * which starts below the shell header and pays no inset of its own. Nothing on
 * this line moved - the zero a side is the same zero - and `GmSheet.tsx` states
 * what the height cost.)
 *
 * The root is its own scroller. Every sibling tool declares one - `Countdowns`,
 * `Bestiary`, `Scene` and `PartyBoard` are all `scroll stack` at `flex: 1;
 * min-height: 0` - because `GmSheet` clips, and a region that forgot would
 * simply lose its bottom half with no way to reach it.
 *
 * ## The topic strip
 *
 * Chips at `var(--tap)` with `padding: 0 12px`, and `--tap` is 44px: every
 * chip measures exactly 44.00 tall. `.t-label` was 10px mono at `0.16em` when
 * this was measured (11px at 0.12em since the readability ramp, about 7.9 a
 * character by the same arithmetic; the eight labels are not re-measured), so
 * about 7.6px a character - 6.00 of advance in IBM Plex Mono plus 1.6px of
 * letter-spacing - and measured with a `Range` it predicts all eight labels to
 * within 0.01: 7.6 a character plus the chip's own 24 of padding and 2.00 of
 * border is exact on DIFFICULTY, COUNTDOWNS and COSTS and 0.01 short on the
 * other five. Where that hundredth comes from is not established here. Near
 * enough to catch a mistyped label, never near enough to write a width down
 * from - every figure below came out of Chrome.
 *
 * Measured widths: EXPERIENCES **109.61**, DIFFICULTY **102.00**, COUNTDOWNS
 * **102.00**, IMPROVISE **94.41**, DISTANCE **86.81**, GM MOVES **86.81**,
 * COSTS **64.00**, FEAR **56.41**. That is 702.05, and with seven 6px gaps
 * 744.05 against the 367.00 column, so it takes **three** rows -
 * EXPERIENCES/DIFFICULTY/COUNTDOWNS at 325.61, IMPROVISE/DISTANCE/GM
 * MOVES/COSTS at 350.03, FEAR alone at 56.41. `gap: 6px` applies between
 * wrapped lines as well as along them, so the strip is
 * 44 + 6 + 44 + 6 + 44 = **144.00px**, paid once at the top of the scroll
 * rather than pinned.
 *
 * ## Why the order is widest-first, and what that actually bought
 *
 * `REFERENCE_TOPICS` is in descending chip width. The order on this strip is
 * therefore a packing order and carries no meaning: IMPROVISE is the first
 * thing a GM reaches for and it is fourth, between COUNTDOWNS and DISTANCE,
 * because 94.41 is what it measures. That cost was accepted deliberately. What
 * it bought is smaller than the decision assumed, and the honest place to say
 * so is here.
 *
 * Four orders, laid out by Chrome in this column at 393x852 and read back off
 * the DOM - the chips moved inside the real strip, never re-derived on paper:
 *
 *   - seven, in the semantic order that shipped: 3 rows, 144.00
 *   - seven, widest-first: 2 rows, 94.00
 *   - eight, widest-first, which is this build: 3 rows, 144.00
 *   - eight, semantic order with COSTS last: 3 rows, 144.00 as well
 *
 * The first three are the table the eighth topic was chosen against, and all
 * three hold. The fourth was never taken, and it is the one that settles what
 * the sort does: at 393 the eighth chip is free in EITHER order. The row the
 * sort saves on seven chips is the row the eighth chip spends again, so on this
 * phone the strip ends at 144.00 whichever way the array is written.
 *
 * Swept across every column width from 100 to 1200, one browser layout each:
 * widest-first **ties** the semantic order at 962 of the 1101 - 367.00 among
 * them, and 702.00, and 982.00 - is **a row better** across 127..164 only, and
 * is **a row worse** across 101 widths in four bands: 180..202, 203..217,
 * 273..295 and 373..412. The winning band is narrower than the widest chip and
 * its neighbour and is no width this app is ever drawn at. The last losing band
 * is not: read at the viewport rather than at the column, and measured there
 * rather than converted, the strip is 144.00 sorted and 94.00 semantic at 400,
 * 412, 414, 428 and 430 across the glass. A Pixel and every Plus and Pro Max
 * iPhone pays 50px of this scroll for the sort. **393 is not in that band,
 * which is exactly why the one frame the decision was taken in shows the trade
 * as free when it is not.**
 *
 * That is measured and not acted on: the order is the owner's to choose and
 * the measurement is this file's to publish. Undoing it is the array below,
 * back to IMPROVISE, DIFFICULTY, FEAR, COUNTDOWNS, DISTANCE, GM MOVES,
 * EXPERIENCES, COSTS - plus this section and the widths sentence above, which
 * is in the array's order because `gmGeometryProse.test.ts` reads the two
 * against each other.
 *
 * The second cost is that the strip's order is now a function of its labels. A
 * rules layer cannot reach it, because `REFERENCE_TOPICS` is not in the
 * dataset; the next editor can, and a one-character rename now moves a chip
 * across the strip and stales every width in the sentence above.
 *
 * ## The estimate this strip was drawn from, and what it got wrong
 *
 * The estimate that stood here costed the seven that then shipped at two rows
 * and 94px, and two independent errors took it there. First, the seven claimed
 * widths were text + 24 of padding and nothing else: a chip is border-box with
 * `border: 1px solid`, so every one of them was short by exactly 2.00. Second,
 * the column was taken as 393 − 24 = 369 rather than the 391 − 24 = 367.00 the
 * sheet's own border leaves - the same forgotten hairline, one level up.
 *
 * The borders are the decisive one, and it is worth being exact about which,
 * because the two are not interchangeable. Both figures below are the first
 * four chips OF THAT ORDER - IMPROVISE, DIFFICULTY, FEAR, COUNTDOWNS - and not
 * the first four of the array as it now stands. On the estimate's own numbers
 * they came to 346 + 18 of gap = 364 in a 369 column: 5px of room, four chips
 * on row one. Measured they are 354.82 + 18 = 372.82 against
 * 367.00, over by 5.82. That is 10.82 of swing, and it splits three ways: 8.00
 * of chip border (four chips, 2.00 each), 2.00 of column, and 0.82 the
 * estimate lost rounding seven character counts to whole pixels.
 *
 * Test each cause on its own against the estimate's own row. Add only the
 * borders and row one is 372 in a 369 column - broken. Take only the column
 * and it is 364 in 367 - still fits, with 3 to spare. So the borders decide
 * this and the column error merely compounds them; neither is the other's
 * spare. That is how an estimate this careful still landed on the wrong row
 * count: the method was sound - 7.6px a character is right to the pixel, on
 * the eighth label as on the first seven - and the frame around the text was
 * missing.
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
 * the eight topics below that guard never fires and has never fired: it is
 * there for the edit that cuts the list down to one, not for anything the
 * shipped build does. Nothing tests it, and nothing can - a test would have to
 * shorten a `const` this module exports.
 *
 * ## Adding a section
 *
 * Add the id to `ReferenceTopic`, a row to `REFERENCE_TOPICS`, and a branch to
 * the body below. A topic is added *when it has a body*, never before: a chip
 * that opens an empty panel is the screen claiming a rule it does not carry.
 *
 * Three things the eighth one cost, so the ninth costs them knowingly. The row
 * goes into `REFERENCE_TOPICS` where its measured width puts it, not at the
 * end. Every width in the sentence above has to be measured again, because the
 * packing is a function of all of them together and a new chip can move any
 * row - `gmGeometryProse.test.ts` holds that sentence to the array's contents
 * and order, so it goes red rather than stale. And the branch belongs beside
 * its chip in the list below, which is in the array's order for exactly that
 * reason.
 */
import { useState } from 'react';
import { useIsPhone } from '../shared/useLayout.ts';
import {
  AdversaryExperiences,
  CountdownChart,
  DifficultyLadder,
  FearGuide,
  GmMoves,
  GoldAndLoot,
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
  | 'experiences'
  | 'costs';

/**
 * What a menu maps over to build its items, widest chip first.
 *
 * `short` is the chip; `label` is the accessible name, because IMPROVISE on its
 * own is not a question anybody asked.
 *
 * The order is the strip's packing order and nothing else - see the head
 * docblock's `## The topic strip` for the measurement and `## Why the order is
 * widest-first, and what that actually bought` for the trade it makes. It is deliberately NOT the order
 * a GM would rank these subjects in, and it is deliberately not what the region
 * opens on either: `Reference` names `improvise` for that, because which chip
 * happens to be widest is no reason to change the answer the screen gives
 * before anybody has pressed anything.
 */
export const REFERENCE_TOPICS: ReadonlyArray<{
  id: ReferenceTopic;
  label: string;
  short: string;
}> = [
  { id: 'experiences', label: 'Adversary Experiences', short: 'EXPERIENCES' },
  { id: 'difficulty', label: 'Set a Difficulty', short: 'DIFFICULTY' },
  { id: 'countdowns', label: 'Advancing a countdown', short: 'COUNTDOWNS' },
  { id: 'improvise', label: 'Improvise an adversary', short: 'IMPROVISE' },
  { id: 'distance', label: 'Range and distance', short: 'DISTANCE' },
  { id: 'moves', label: 'GM moves and principles', short: 'GM MOVES' },
  { id: 'costs', label: 'Gold, equipment, and loot', short: 'COSTS' },
  { id: 'fear', label: 'Fear', short: 'FEAR' },
];

export function Reference(): React.JSX.Element {
  const phone = useIsPhone();
  // Named, not `REFERENCE_TOPICS[0]`, and that changed when the strip was
  // sorted by width: the first row of the strip is now a layout result, and
  // taking the opening subject from it would let a chip's pixel width decide
  // what a GM reads first. `ReferenceTopic` is a union, so deleting this topic
  // fails the typecheck rather than silently opening on something else.
  const [topic, setTopic] = useState<ReferenceTopic>('improvise');

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

      {/* In the strip's order, so this list and the chips can be read side by
          side. It is the widths' order and carries no meaning of its own. */}
      {topic === 'experiences' && <AdversaryExperiences />}
      {topic === 'difficulty' && <DifficultyLadder />}
      {/*
        Read-only here, and pressable on a dynamic countdown's own row. There is
        no countdown on this screen for a button to act on, and a control that
        cannot act is a control that lies about what it does.
      */}
      {topic === 'countdowns' && <CountdownChart countdown={null} />}
      {topic === 'improvise' && <TierBenchmarks />}
      {topic === 'distance' && <RangeReference />}
      {topic === 'moves' && <GmMoves />}
      {topic === 'costs' && <GoldAndLoot />}
      {topic === 'fear' && <FearGuide besidePool={false} />}
    </div>
  );
}
