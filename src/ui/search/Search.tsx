/**
 * The book, searched from the player's side of the table.
 *
 * ## Why this screen exists at all
 *
 * `RuleSearch.tsx` has been able to search the whole SRD since the unified
 * index landed, and until this screen it mounted in exactly one place: inside
 * the GM screen's SHOW sheet, behind a verb on the GM bar. So *Attacking*,
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
 * ## The search is global, and it was not always
 *
 * This screen shipped once with a scope: with a character open it started
 * narrowed to that character's own cards, features and gear, and one tap on a
 * `THE WHOLE BOOK` chip widened it. **The owner removed it.** A search that
 * reads the book reads the book, and a default that quietly answered from one
 * sheet made every empty result ambiguous - the reader could not tell a word
 * the SRD does not contain from a word their own character does not carry,
 * without first noticing a control they had no reason to look at.
 *
 * What went with it is worth listing, because the absence is the design and
 * not an omission:
 *
 * - the two scope chips, and the 52px of reading they cost;
 * - `SearchScope`, which collapsed to the one flag that was never about scope
 *   at all - whether the app's own questions are offered;
 * - `holdingsOf`, and with it the whole business of matching a character's
 *   refs against the index.
 *
 * The one thing that stayed is that flag. The twelve catalogue entries are
 * written in the GM's voice - "What do I do?", "How do I run a chase?", about
 * players in the third person - so they belong to the sheet the GM is working
 * on and not here. `questions={false}` guards the fetch as well as the
 * drawing, so this screen never pulls their chunk.
 *
 * ## The shape: what is touched is at the bottom, what is read is above it
 *
 * The field sits in a block pinned under the scroll and the results are the
 * only thing that moves. That is the same call `ShowSheet` makes about its own
 * field, for the same reason: this bar is inside the thumb arc and the answers
 * are not, and a field at the top of a column of results is the one control on
 * the screen put at the far end of the reach.
 *
 * Nothing here pays `env(safe-area-inset-bottom)`. On a phone `TabBar` is
 * below this screen and pays it, and exactly one thing per screen may.
 *
 * ## The column, measured
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
 * | reading window, a backup banner up | **527.00** | **342.00** |
 * | the pinned block | **56.00** | **56.00** |
 * | the field | 303.00 x 44 | 285.00 x 44 |
 * | rows whole on the glass, on `countdown` (33 rows) | **6** | **4** |
 * | `docOverflowX` | 0.00 | 0.00 |
 *
 * The pinned block measured **108.00** while the scope chips were in it. The
 * reading window was **475.00** and **290.00** then, so removing them gave the
 * list back exactly 52px at both sizes and took it from 5 rows to 6 and from 3
 * to 4. That is the second thing the owner's decision buys, after the
 * ambiguity.
 *
 * **The window is the one with a banner up, which is the honest figure.** It
 * is what a device with an update or a backup waiting actually gets, and this
 * fixture has one - a screen budgeted against an empty shell would be short by
 * a banner's height on exactly the launch where it matters. Nothing here is
 * budgeted against a fixed height in any case: the column scrolls.
 *
 * **Names wrap less here than in the sheet, because the column is 6px wider.**
 * On `countdown`, which returns 33 rows: 1 name wraps at 393 and 2 at 375,
 * against 1 and 3 at the sheet's 363/345. Nothing is clipped at either size.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../store/state.ts';
import { srdIndex } from '../shared/srdIndex.ts';
import { RuleSearchField, RuleSearchResults } from '../shared/RuleSearch.tsx';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';

export function Search(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const [query, setQuery] = useState('');

  /*
   * Built here for the field's count and built again inside the results, both
   * memoised on the dataset, which changes about never. The count has to be
   * the dataset's own rather than a number typed here: a homebrew layer that
   * adds records is searched too, and a placeholder that said 849 anyway would
   * be the screen guessing at what it holds.
   */
  const index = useMemo(() => srdIndex(dataset), [dataset]);

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
           * and the three doors. Those chips are the GM's - the six moments are
           * written in their voice, and `ShowSheet` is where they were
           * measured - so this screen does not borrow them. What a blank
           * screen owes its reader is what it is for and what it will look in,
           * which is what this says and all it says.
           */
          <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
            Search everything the app ships — every rules section, card, adversary, environment and
            piece of gear — by name or by its words.
          </p>
        ) : (
          <RuleSearchResults query={query} onQuery={setQuery} questions={false} />
        )}
        <LicenceFooter />
      </div>
      <div className="stack" style={{ flex: 'none', gap: 8, padding: '0 12px 12px' }}>
        <RuleSearchField
          value={query}
          onChange={setQuery}
          total={index.length}
          reaches="entries in the book"
          label="Search the whole book, by name and text"
        />
      </div>
    </div>
  );
}
