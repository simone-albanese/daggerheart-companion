/**
 * The merchant: what a stall has tonight, and what the book says it costs.
 *
 * The third door behind SHOW, beside the bestiary and the party board, and
 * switchable in Settings the way both of those are - `showDoors.ts` carries the
 * argument for why those three and no others can be switched off at all.
 *
 * ## Everything the SRD wrote is read at draw time; the app writes none of it
 *
 * The prices, the gold denominations, the loot and the consumables all come out
 * of `dataset.rules`, `dataset.loot` and `dataset.consumables` on every render.
 * Not one price, item name or item effect is typed into this file, so a rules
 * layer that changes a cost changes what a GM reads here, and the Core Book -
 * which is not redistributable and is not in this repo - is not the source of
 * any of it. Where this screen adds a number of its own it says so on the same
 * line as the number, which is `Reference.tsx`'s rule and is why the sentence
 * under the stall names the six as this app's choice.
 *
 * **Nothing here touches a character.** A merchant is the one GM tool whose
 * subject - money - is a real, marked, spendable track on somebody's sheet:
 * `GoldEditor` writes it from BUILD and Play prints it into the carried
 * summary. This tool reads no character, imports nothing that can, and has no
 * write path to one. That is stated on the SHOW choice as well, before the GM
 * has tapped it, because a tool named for a shopkeeper invites exactly the
 * opposite assumption.
 *
 * ## Why the stall does not stock itself
 *
 * A tool is unmounted when its sheet closes - `Gm.tsx` argues that at length,
 * and the party board's camera is why - so any state here dies with the sheet.
 * A stall drawn on mount would therefore be a *different* stall every time the
 * GM reopened the tool, and the shop they had just described to four players
 * would be quietly replaced while they were looking at the Fear board. So the
 * stall starts empty and says so, and stock arrives only when somebody asks for
 * it. An empty counter is a screen admitting it has nothing drawn; a re-rolled
 * counter is a screen contradicting the evening.
 *
 * The alternative was to persist it, and it was rejected rather than missed.
 * The only per-campaign store here is the campaign record, and Architecture 6.1
 * puts a schema bump on every new field of it - a converter, fixtures and a
 * re-stamped dataset, spent so that a shop the GM improvised on a Tuesday
 * survives a reload. `board.region` is widened by this change and is the one
 * field exempt from that rule, precisely because it holds navigation and
 * nothing else; putting a stall in it would spend the exemption the moment it
 * was granted a third time. See the `REGIONS` docblock in `shared/campaigns.ts`.
 *
 * ## What is drawn, and in what order
 *
 * THE STALL is first because it is the only thing on the screen that changes,
 * and the control that changes it is at the bottom of the panel: a result that
 * appears below the fold on the tap that produced it is a result the GM has to
 * go looking for. The two reference blocks under it never change, so scrolling
 * to them costs nothing and they are read in the order a shop scene needs them
 * - what things cost, then what the coins are.
 *
 * The Average Costs table is drawn with `RuleTableView`, the shared drawing for
 * a pipe table nobody chose in advance, which puts a two-column table on a
 * phone as a two-column grid. **A second lane is putting the same SRD table
 * behind a `Reference` topic.** Both read `giving-out-gold-equipment-and-loot`
 * out of the dataset through `ruleSection`, and neither transcribes it, so the
 * two surfaces cannot disagree about a price - but they are two surfaces, and a
 * reviewer should check they agree about which *part* of that section each one
 * shows.
 *
 * The SRD's own guidance around that table is behind a `Fold`, shut. It is four
 * paragraphs about how much weight to give money in a campaign, which is a
 * session-zero decision rather than a mid-scene one, and this screen is opened
 * mid-scene. The gold block under it is the section's **first paragraph only**:
 * the rest of `gold` is about marking and clearing slots, which happens on the
 * player's sheet on the player's screen, and reprinting it here would be the GM
 * screen explaining a track it cannot touch.
 *
 * ## Ergonomics, 393 x 852
 *
 * This is a **read-mostly** surface, and it is arranged the way `Reference.tsx`
 * argues a read-mostly surface should be: the reading gets the height, and the
 * one repeated control gets the thumb.
 *
 * The root is a plain column with the scroller inside it rather than
 * `scroll stack` like `Bestiary` or `Countdowns`, for `Names.tsx`'s reason: the
 * one control must not leave the bottom of the panel when the stall grows.
 * Everything else in the sheet scrolls past it.
 *
 * **The draw is full width at the bottom, `minHeight: 56`.** It is the only
 * control that is pressed more than once here, so it holds the 560-820 band a
 * right thumb covers on this phone without the hand moving - the same band
 * `GmBar`'s three verbs hold on the screen underneath. It is 56 and not
 * `Names.tsx`'s 64 because the gestures are different: DRAW there is a burst,
 * tapped four or five times in ten seconds while the GM reads names, and a
 * burst target buys its extra height back immediately. A stall is drawn once
 * for a scene and occasionally replaced, so it takes the 56 the sheets use for
 * a one-tap answer - still well over the 44px coarse floor, and declared inline
 * because jsdom reads only inline styles.
 *
 * **The SRD guidance fold is the only other target**, at `var(--tap)` - 44 on
 * every phone and tablet - and it is up in the scroll rather than near the
 * thumb on purpose: opening it is a decision made once a campaign, and a
 * decision-shaped control does not belong in the arc a reflex lives in.
 *
 * **Everything else is read and nothing else is a target.** The stall's items
 * carry no control - there is no "sell" for this app to honour, because the
 * gold is on a sheet this tool cannot write - and the prices are print, for the
 * same reason `Reference` draws the countdown chart's cells as print when there
 * is no countdown for them to move. A target that cannot act is a control that
 * lies about what it does.
 *
 * The stall is `aria-live="polite"` and not `assertive`, which is `Names.tsx`'s
 * decision and `SessionList.tsx`'s argument: a GM who redraws twice should not
 * have a screen reader interrupt itself twice.
 *
 * ## The numbers
 *
 * Measured in Chrome at 393x852, device-scale-factor 1, with the safe area
 * named - the rig in `AUDIT-HANDOFF.md` - against this build:
 *
 *   the panel                797.00 tall, `GmSheet`'s own measurement, less a
 *                            44px title row for 750.00 of tool
 *   the column               367.00, which is the 391.00 content box of a
 *                            border-box panel with a 1px border, less this
 *                            region's 12px of padding either side. It is
 *                            `Reference.tsx`'s measured figure and this region
 *                            declares the same padding; it is stated as shared
 *                            rather than re-measured
 *   the draw                 367.00 x 56.00, from y 736.00 to 792.00 with the
 *                            34px home-indicator inset below it
 *   the scroller             from y 149.00 to 736.00 = 587.00 of reading
 *   an empty stall           97.19 of it - a label, a sentence and the gap
 *   a stocked stall          six panels; the shortest measures 68.19 and the
 *                            tallest 106.38, so the block runs about 543 and
 *                            the counter alone fills the scroller
 *
 * Every one of those is a browser measurement rather than arithmetic. The two
 * that are *not* measured here and are marked as inherited are the 797.00 and
 * the 367.00, both of which are `GmSheet.tsx` and `Reference.tsx`'s figures for
 * declarations this file does not make.
 */
import { useCallback, useMemo, useState } from 'react';
import type { Item } from '../../../shared/types.ts';
import { cryptoRng, type Rng } from '../../engine/dice.ts';
import { useApp } from '../../store/state.ts';
import { Fold } from '../shared/Fold.tsx';
import { RuleTableView } from '../shared/RuleTableView.tsx';
import { ruleSection, type BlockPart } from '../shared/srdReference.ts';

/**
 * How much is on the counter, and where the two numbers come from.
 *
 * **Both are this app's, not the book's**, which is why the sentence under the
 * stall says so on screen rather than only here. The SRD ships a loot table and
 * a consumables table and does not say how many of either a shop has; a stall
 * is a thing a GM invents, and six items is enough for the players to have a
 * choice and few enough to read out loud without the table losing interest.
 *
 * Three and three rather than six from the two pools together, because a pool
 * of 120 drawn six times will hand a GM six potions often enough to matter, and
 * a shop with nothing but potions is a shop the GM has to re-roll. Splitting it
 * is the cheapest way to make every stall have both kinds of thing in it.
 */
const LOOT_ON_THE_COUNTER = 3;
const CONSUMABLES_ON_THE_COUNTER = 3;

/** The sentence that says which of the numbers on this screen are the app's. */
export const STALL_PROVENANCE = `${String(LOOT_ON_THE_COUNTER)} pieces of loot and ${String(CONSUMABLES_ON_THE_COUNTER)} consumables, drawn without repeats from the two tables this dataset carries. The six is this app’s number — the SRD does not say how much a shop has — and everything drawn is the book’s.`;

/** What a counter with nothing on it says, rather than saying nothing. */
export const EMPTY_STALL =
  'Nothing on the counter yet. Stock is drawn when you ask for it and is not kept when this closes, so a shop you have already described to the table is never quietly replaced behind you.';

/**
 * `want` items out of `pool`, without repeats, in the order they were drawn.
 *
 * Selection rather than a shuffle: the pools are 60 long apiece and six are
 * wanted, so copying and splicing is both shorter and cheaper than ordering 120
 * items to throw 114 of them away.
 *
 * `rng` returns an integer in `[1, sides]` - `dice.ts` owns that contract - so
 * the index is one less than it answers. A pool shorter than `want` yields the
 * whole pool rather than looping forever, which is the shape a dataset with a
 * trimmed table would arrive in.
 */
export function drawStock(pool: readonly Item[], want: number, rng: Rng): Item[] {
  const left = [...pool];
  const out: Item[] = [];
  const take = Math.min(want, left.length);
  for (let i = 0; i < take; i += 1) {
    const at = rng(left.length) - 1;
    const item = left[at];
    if (item === undefined) break;
    out.push(item);
    left.splice(at, 1);
  }
  return out;
}

/** The prose parts of a section, in the book's order. */
const proseOf = (parts: readonly BlockPart[]): string[] =>
  parts.flatMap((part) => (part.kind === 'text' ? [part.text] : []));

export function Merchant({
  phone,
  rng = cryptoRng,
}: {
  phone: boolean;
  /**
   * Injected for the reason `Names` takes one: a screen that reaches for
   * randomness directly cannot be tested, and a stall that cannot be tested is
   * a stall nobody can prove draws without repeats.
   */
  rng?: Rng;
}): React.JSX.Element {
  const rules = useApp((s) => s.dataset.rules);
  const loot = useApp((s) => s.dataset.loot);
  const consumables = useApp((s) => s.dataset.consumables);
  const [stall, setStall] = useState<Item[] | null>(null);

  const costs = useMemo(() => ruleSection(rules, 'giving-out-gold-equipment-and-loot'), [rules]);
  const gold = useMemo(() => ruleSection(rules, 'gold'), [rules]);

  const costParts = useMemo(() => costs?.blocks.flatMap((b) => b.parts) ?? [], [costs]);
  const costTables = costParts.flatMap((part) => (part.kind === 'table' ? [part.table] : []));
  const costProse = proseOf(costParts);
  // The first paragraph, which is the denominations. See the head docblock for
  // why the rest of that section is the player's screen's business.
  const denominations = proseOf(gold?.blocks[0]?.parts ?? [])[0] ?? null;

  const draw = useCallback(() => {
    setStall([
      ...drawStock(loot, LOOT_ON_THE_COUNTER, rng),
      ...drawStock(consumables, CONSUMABLES_ON_THE_COUNTER, rng),
    ]);
  }, [loot, consumables, rng]);

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0 }}>
      <div
        className="scroll stack"
        style={{
          flex: 1,
          minHeight: 0,
          gap: 14,
          padding: phone ? '10px 12px 16px' : '14px 20px 18px',
        }}
      >
        <section className="stack" style={{ flex: 'none', gap: 8 }}>
          <span className="t-label" style={{ color: 'var(--text-2)' }}>
            ON THE COUNTER
          </span>
          {/*
            Polite, never assertive: a GM who redraws twice would otherwise have
            a screen reader interrupt itself twice. `SessionList.tsx` makes the
            argument at length and `Names.tsx` makes the same call.
          */}
          <div className="stack" aria-live="polite" style={{ flex: 'none', gap: 8 }}>
            {stall === null ? (
              <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
                {EMPTY_STALL}
              </p>
            ) : (
              stall.map((item) => (
                <article
                  key={item.id}
                  className="panel stack"
                  style={{ flex: 'none', gap: 4, padding: 10, minWidth: 0 }}
                >
                  <span style={{ font: '700 14px/1.25 var(--sans)' }}>{item.name}</span>
                  <span className="t-meta" style={{ color: 'var(--dim)' }}>
                    {item.kind === 'loot' ? 'LOOT' : 'CONSUMABLE'}
                    {item.roll === undefined ? '' : ` · ${String(item.roll)}`}
                  </span>
                  <span className="t-dense" style={{ color: 'var(--text-3)', maxWidth: '62ch' }}>
                    {item.text}
                  </span>
                </article>
              ))
            )}
          </div>
          <p className="t-dense" style={{ margin: 0, color: 'var(--muted)', maxWidth: '62ch' }}>
            {STALL_PROVENANCE}
          </p>
        </section>

        {/*
          Absent rather than empty when the dataset does not carry the section.
          A heading over nothing is the screen claiming a rule it does not have,
          which is the defect `Reference.tsx` refuses a chip for.
        */}
        {costs !== null && costTables.length > 0 && (
          <section className="stack" style={{ flex: 'none', gap: 8 }}>
            <div className="spread">
              <span className="t-label" style={{ color: 'var(--text-2)' }}>
                WHAT THINGS COST
              </span>
              <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
                SRD 1.0{costs.page === null ? '' : ` · P.${String(costs.page)}`}
              </span>
            </div>
            {costTables.map((table, i) => (
              // The book's order is the identity: two tables in one section may
              // legitimately carry the same header row.
              <RuleTableView key={`table-${String(i)}`} table={table} />
            ))}
            {costProse.length > 0 && (
              <Fold label={costs.title} summary="The book on how much money should matter">
                <div className="stack" style={{ flex: 'none', gap: 6 }}>
                  {costProse.map((text, i) => (
                    <p
                      key={`prose-${String(i)}`}
                      className="t-read"
                      style={{ margin: 0, maxWidth: '62ch' }}
                    >
                      {text}
                    </p>
                  ))}
                </div>
              </Fold>
            )}
          </section>
        )}

        {gold !== null && denominations !== null && (
          <section className="stack" style={{ flex: 'none', gap: 8 }}>
            <div className="spread">
              <span className="t-label" style={{ color: 'var(--text-2)' }}>
                {gold.title.toUpperCase()}
              </span>
              <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
                SRD 1.0{gold.page === null ? '' : ` · P.${String(gold.page)}`}
              </span>
            </div>
            <p className="t-read" style={{ margin: 0, maxWidth: '62ch' }}>
              {denominations}
            </p>
          </section>
        )}
      </div>

      <div style={{ flex: 'none', padding: phone ? '0 12px 12px' : '0 20px 16px' }}>
        <button
          type="button"
          onClick={draw}
          className="btn"
          style={{ width: '100%', minHeight: 56, letterSpacing: '0.1em' }}
        >
          {stall === null ? 'STOCK THE STALL' : 'DRAW A NEW STALL'}
        </button>
      </div>
    </div>
  );
}
