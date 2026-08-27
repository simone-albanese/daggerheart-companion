/**
 * The book, searched from the player's side of the table.
 *
 * ## Why this screen exists at all
 *
 * `RuleSearch.tsx` has been able to search the whole SRD since the unified
 * index landed, and until now it mounted in exactly one place: inside the GM
 * screen's SHOW sheet, behind a verb on the GM bar. So *Attacking*,
 * *Conditions*, *Death*, *Stress* and *Downtime* were searchable by one person
 * at the table, and it was not the one holding the character.
 *
 * It was worse than "one person", and that is the part worth writing down.
 * SHOW is dropped from the GM bar entirely when all three of its doors are
 * switched off - `showDoors.ts` says so in its own words, and `GmBar` filters
 * the verb on `liveDoors(prefs).length` - so a GM who turned off the bestiary,
 * the party board and the merchant lost the rules search along with them,
 * without ever being told it was behind those switches. A destination of its
 * own is what makes the search independent of a preference it was never
 * about.
 *
 * ## The default scope, which matters more than the door
 *
 * A player who types `rally` means *their own* Rally, not the six sections
 * that happen to use the word. So with a character open this screen starts
 * narrowed to that character's own material, and one tap widens it to all 849
 * records. With no character open there is nothing to narrow to, the scope
 * control is not drawn, and the screen opens on the whole book - which is
 * correct and is not empty.
 *
 * **"What they have in hand" is `owned`, not `mine`, and the two already mean
 * different things one directory over.** `Cards.tsx` draws both: `'mine'`
 * filters to the domains the character can draw from - a band roughly a third
 * of the 189 cards wide, most of which they do not have - while `Owned` is
 * loadout plus vault, the cards actually on the sheet. The sentence this
 * screen implements says *my* card, so it is the second. The first would have
 * answered `rally` with every Bard card in the game.
 *
 * That reading survives the one correction the source example needed. The plan
 * offered Rally as a domain card and there is no record of any kind named
 * Rally - it is the Bard's **class feature** - which changes which field of
 * the character carries it and changes nothing about the argument: `classRef`
 * is in the holdings set for the same reason a loadout card is, because the
 * player has it.
 *
 * ## What the holdings set is, and the three things it cannot hold
 *
 * `holdingsOf` in `engine/holdings.ts` is the walk, and it is reused rather
 * than re-written: a second walk is the thing that goes stale when a field is
 * added to `Character`. It was `characterRefs` in the transfer codec, written
 * for the QR encoder, and this screen is why it moved - the walk is not a
 * transfer concern, and importing it from there put a 33.83 kB chunk of QR
 * machinery behind a screen that wanted twenty-five lines of it.
 *
 * Three kinds of thing a character carries have no `SrdRecord` and simply do
 * not appear:
 *
 * - **Free-text inventory.** `InventoryEntry.ref` is nullable by design and a
 *   new sheet starts with a torch and rations that are nothing but words. They
 *   are dropped rather than matched by name, which is the standing rule
 *   `modifiers.ts` states for itself: a hand-typed item grants nothing,
 *   because this app does not read names.
 * - **Companion upgrades**, which are slugs minted at runtime from the list
 *   items inside one rules section rather than ids of any record.
 * - **Experiences, connections, scars and notes**, which the player wrote.
 *
 * A fourth needs no handling and it is worth saying why rather than leaving
 * the next reader to check: a sheet that arrived by QR before its content did
 * carries `?12`-style placeholder refs. They land in the holdings set and
 * match nothing, because the filter asks the *index* which of its records the
 * set names - not the set which records it wants. A ref for a record that does
 * not exist selects nothing, which is the right answer arrived at for free.
 *
 * ## The set is keyed on the bare id, and the file that keys on `kind:id` is right too
 *
 * `RuleSearch.tsx` opens a row on `${kind}:${id}` because two collections may
 * spell an id the same way. This set cannot do that and should not pretend to:
 * a character stores bare `Ref`s and does not record what kind each one was,
 * and the kinds that could be recovered are a naming convention inside an
 * untyped `detail` bag rather than a type. In the shipped dataset all 849 ids
 * are unique across all fourteen collections, so the two agree today. If a
 * layer ever spelled one id twice, this scope would admit both records where
 * one was wanted - a wider answer inside an already-narrowed list, which is
 * the harmless direction for that error to go.
 *
 * ## The shape: what is touched is at the bottom, what is read is above it
 *
 * The two controls that shape the search - the scope and the field - sit in a
 * block pinned under the scroll, and the results are the only thing that
 * moves. That is the same call `ShowSheet` makes about its own field, for the
 * same reason: this bar is inside the thumb arc and the answers are not, and a
 * field at the top of a column of results is the one control on the screen put
 * at the far end of the reach. It also keeps the widening control on the glass
 * when the narrow scope has just returned nothing, which is exactly when it is
 * wanted - the empty state names it, and can name it in one clause because it
 * is visible rather than somewhere to go and find.
 *
 * Nothing here pays `env(safe-area-inset-bottom)`. On a phone `TabBar` is
 * below this screen and pays it, and exactly one thing per screen may.
 *
 * ## The column, measured — the one figure the plan was gated on
 *
 * The results list inside `ShowSheet` has been measured for months and none of
 * those numbers transport: that is a 363px column inside a bottom-anchored
 * sheet capped at 85% of a 548px stage, and this is a full-height screen. So
 * it was measured here. Audit rig, Chrome, `pointer: coarse`, insets 47/34, a
 * level-10 fixture seeded on a separate origin with an empty IndexedDB.
 *
 * | | 393x852 | 375x667 |
 * |---|---|---|
 * | content column | **369.00** | **351.00** |
 * | reading window, with a backup banner up | **475.00** | **290.00** |
 * | the same with no banner | 549.00 | 364.00 |
 * | rows fully in the window | **5** | **3** |
 * | the pinned block | **108.00** | **108.00** |
 * | the field | 303.00 x 44 | 285.00 x 44 |
 * | each scope chip | 180.50 x 44 | 171.50 x 44 |
 * | `docOverflowX` | 0.00 | 0.00 |
 *
 * Every target on this screen clears the 44px floor in both axes, no label
 * overflows, and the rig reports 0 clipped nodes and 0 overlaps at both sizes.
 *
 * **The banner row is the honest one and it is why both are printed.** 475 is
 * what a device with an update or a backup waiting actually gets, and a screen
 * budgeted against 549 would be 74px over on exactly the launch where it is.
 *
 * **Five rows and three.** The sheet this list came from shows 2-3 at 393 and 1
 * at 375, so the screen is between two and three times the reading window the
 * same list had - which is the whole reason it is a screen. Three rows at
 * 375x667 with a banner up is thin, and the answer is the one the owner's
 * constraint names: the column scrolls, and nothing here drops below the type
 * scale to fit more in.
 *
 * **What the 108px block buys and what it costs.** The chips and the field
 * together are 108px, against 56 for a field alone - so the scope control
 * costs 52px of reading, one row at either size. It is worth it: without a
 * visible way to widen, the narrow default becomes a dead end exactly when it
 * returns nothing, and the empty state would have to send the reader somewhere
 * to find a control instead of naming one they can see.
 *
 * **Names wrap less here than in the sheet, because the column is 6px wider.**
 * On `countdown`, which returns 33 rows: 1 name wraps at 393 and 2 at 375,
 * against 1 and 3 at the sheet's 363/345. Nothing is clipped at either size.
 */
import { useMemo, useState } from 'react';
import { useActive, useApp, useStats } from '../../store/state.ts';
import type { Ref } from '../../../shared/types.ts';
import { holdingsOf } from '../../engine/holdings.ts';
import { srdIndex } from '../shared/srdIndex.ts';
import { RuleSearchField, RuleSearchResults, type SearchScope } from '../shared/RuleSearch.tsx';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';

export function Search(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const character = useActive();
  const stats = useStats();
  const [query, setQuery] = useState('');
  const [wide, setWide] = useState(false);

  const index = useMemo(() => srdIndex(dataset), [dataset]);

  /*
   * `null` when there is nobody to narrow to, and that single value carries
   * the whole of the no-character case: the scope below degrades to the whole
   * book, and the control that would switch away from it is not drawn. No
   * effect resets anything, because there is no state to get out of step - the
   * toggle says which scope is *wanted* and this says whether a narrow one is
   * available.
   */
  const holdings = useMemo(
    () => (character !== null && stats !== null ? holdingsOf(character, stats) : null),
    [character, stats],
  );
  const narrowed = holdings !== null && !wide;

  /*
   * How many records the holdings actually name. Counted against the index
   * rather than taken as `holdings.size`, because the set carries the free
   * text, the companion slugs and any unresolved placeholder alongside the
   * real ids - so its size is a number of *references* and this is a number of
   * things the search can find. A placeholder in the field must be the second
   * one or it promises rows that cannot exist.
   */
  const carried = useMemo(
    () =>
      holdings === null
        ? 0
        : index.filter((record) => record.kind !== 'rules' && holdings.has(record.id)).length,
    [index, holdings],
  );

  const scope: SearchScope = useMemo(
    () =>
      narrowed && holdings !== null
        ? { only: holdings, sections: false, questions: false }
        : { only: null, sections: true, questions: false },
    [narrowed, holdings],
  );

  return (
    <div className="stack" style={{ flex: 1, minHeight: 0, gap: 8 }}>
      <div
        className="stack scroll"
        style={{
          flex: 1,
          minHeight: 0,
          padding: '8px 12px 8px',
          gap: 10,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {query.trim() === '' ? (
          /*
           * What an empty field draws, and it is deliberately one sentence.
           *
           * The GM's sheet answers its empty field with the six moment chips
           * and the three doors; this screen has neither, and inventing a
           * second set of chips here is the §2.3 work rather than this one.
           * What a blank screen owes its reader is what it is for and what it
           * will look in, which is what this says and all it says.
           */
          <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
            {narrowed
              ? 'Search your own cards, features and gear by name or by their words. One tap on THE WHOLE BOOK looks in everything the app ships.'
              : 'Search everything the app ships — every rules section, card, adversary, environment and piece of gear — by name or by its words.'}
          </p>
        ) : (
          <RuleSearchResults query={query} onQuery={setQuery} scope={scope} />
        )}
        <LicenceFooter />
      </div>
      <div className="stack" style={{ flex: 'none', gap: 8, padding: '0 12px 12px' }}>
        {holdings !== null && (
          /*
           * Two chips and not one toggle. A single button showing the scope it
           * is in cannot say whether the word on it is where you are or where
           * you would go; two, with one of them pressed, has no such reading.
           * `aria-pressed` is the same statement for anyone who cannot see
           * which is which.
           */
          <div
            role="group"
            aria-label="How much to search"
            style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}
          >
            {[
              { wide: false, label: 'WHAT I CARRY' },
              { wide: true, label: 'THE WHOLE BOOK' },
            ].map((choice) => {
              const on = wide === choice.wide;
              return (
                <button
                  key={choice.label}
                  type="button"
                  className="t-label"
                  aria-pressed={on}
                  onClick={() => {
                    setWide(choice.wide);
                  }}
                  style={{
                    minHeight: 44,
                    padding: '0 4px',
                    // Half the label role's tracking, the same lever and for
                    // the same reason ShowSheet's moment chips spend it: the
                    // longer of these two words has to sit on one line in
                    // half of a 369px column.
                    letterSpacing: '0.08em',
                    color: on ? 'var(--text)' : 'var(--text-2)',
                    background: on ? 'var(--hope-wash)' : 'var(--panel)',
                    border: `1px solid ${on ? 'var(--hope)' : 'var(--line)'}`,
                    borderRadius: 'var(--r2)',
                  }}
                >
                  {choice.label}
                </button>
              );
            })}
          </div>
        )}
        <RuleSearchField
          value={query}
          onChange={setQuery}
          total={narrowed ? carried : index.length}
          reaches={narrowed ? 'things you carry' : 'entries in the book'}
          label={
            narrowed
              ? 'Search what this character carries, by name and text'
              : 'Search the whole book, by name and text'
          }
        />
      </div>
    </div>
  );
}
