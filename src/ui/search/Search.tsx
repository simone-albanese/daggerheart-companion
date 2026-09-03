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
 *
 * ## The empty field is an index, and it was one sentence
 *
 * A blank screen owed its reader what it is for and what it will look in, and
 * a sentence said both. What it could not say is **what is in there** - and on
 * a surface holding 849 records across fourteen collections, that is the thing
 * a reader has to guess at before they can type. The index answers it by
 * drawing the shelves instead of naming them: fourteen blocks, each with its
 * own count, and RULES opening onto the book's five chapters.
 *
 * **It is a browse, not a filter, and that distinction is the owner's decision
 * of 27 August held from the other side.** The scope chips were removed because
 * a default that quietly read one shelf made every empty result ambiguous. So
 * nothing here narrows a query: lighting a block *clears the field*, and typing
 * *clears the block*. The two are exclusive by construction, which is the same
 * arrangement `ShowSheet` makes between its moment chips and its own field, and
 * it is what stops this surface ever being half an index and half a search.
 *
 * **This is not a second `Reference.tsx`.** That screen is eight chosen
 * subjects with a renderer apiece, and its GM chapter is curated into five
 * folds. The index chooses nothing and hides nothing: fourteen blocks in the
 * dataset's own order under the dataset's own labels, 849 records, 69 sections.
 * The moment anybody reorders the fourteen, promotes a kind or drops a chapter,
 * it has become the third reference screen and should be reverted instead.
 *
 * ### What is drawn, in three ranks
 *
 * The ranks are drawn differently on purpose, so a reader knows which one they
 * are on without reading a word. Rank 0 is a `repeat(3, 1fr)` grid of small
 * blocks. Rank 1 - under RULES only - is five full-width rows, because
 * `RUNNING AN ADVENTURE` is twenty characters and cannot live in a 111px cell,
 * and the change of shape is what says a level was gone into. Rank 2 is the
 * leaves, drawn through the same `Hit` and `RecordHit` the search already uses.
 *
 * A lit kind draws its list **below the whole grid** rather than inside it, so
 * the grid never reflows and stays a map you can re-aim at - `ShowSheet`'s chip
 * behaviour, reused rather than re-decided. A lit chapter draws its sections
 * **in place**, under its own row, because a one-column list takes an in-place
 * insert for free and it keeps the trail tight.
 *
 * ### Both components here are local, and that is deliberate
 *
 * `KindGrid` and `ChapterRows` are not exported. `tests/ui/screens.test.tsx`
 * derives its fixture list from what `src/ui` exports, so a second exported
 * component would owe it a fixture - and neither of these is a screen, a sheet
 * or anything a second host could mount. They are this screen's own furniture.
 *
 * ### Sizing, and what is arithmetic rather than measurement
 *
 * `.t-label` was `600 10px/1 var(--mono)` at `0.16em` when this was derived; it
 * is 11px/1.2 at 0.12em since the readability ramp, which by the arithmetic
 * below is 6.6 of glyph and 7.92 with tracking a character, so `DOMAIN CARDS`
 * is 95.04 of text and 105.04 in its box - still inside the 111.67 cell, by
 * 6.63. The figures that follow are the 10px ones. `ShowSheet` measured that
 * face: `BEFORE THE ROLL`, fifteen characters, is 114.00 of which 24.00 is
 * tracking, so **6.0px of glyph per character** and 7.6px with the tracking.
 * On the columns above - 369.00 and 351.00 - three cells at an 8px gap are
 * **117.67** and **111.67**. The longest labels are `DOMAIN CARDS` and
 * `ENVIRONMENTS` at twelve characters: 91.20 of text, 101.20 with padding and
 * borders, inside the tighter cell by 10.47.
 *
 * **So this grid does not spend the lever `ShowSheet` spent**, and that is the
 * one respect in which it is easier to read than the surface it copies. Those
 * chips had to drop to 0.08em - half the role's tracking - because fifteen
 * characters do not fit a 115.67 cell. Twelve do, so the index is drawn at the
 * role's own tracking (0.16em then, 0.12em since the ramp) and `ShowSheet`'s open question about half-tracked mono at
 * arm's length in a dim room is not reopened.
 *
 * Two 10px lines at `line-height: 1` with a 4px gap and 8px of padding is 32,
 * so **the 44px floor binds** and a cell is 117.67 x 44 / 111.67 x 44. The grid
 * whole is 5 x 44 + 4 x 8 = **252.00**.
 *
 * ### Measured, and where the arithmetic was wrong
 *
 * Audit rig, Chrome, `pointer: coarse`, insets 47/34, a level-10 fixture on a
 * separate origin with an empty IndexedDB and a backup banner up - the honest
 * fixture, because a screen budgeted against an empty shell is short by a
 * banner on exactly the launch where it matters.
 *
 * | | 393x852 | 375x667 |
 * |---|---|---|
 * | content column | **369.00** | **351.00** |
 * | reading window, banner up | **527.00** | **342.00** |
 * | a kind cell | **117.66 x 44** | **111.66 x 44** |
 * | smallest cell, either axis | **111.66 / 44** | **111.66 / 44** |
 * | the 14-block grid, whole | **252.00** | **252.00** |
 * | bottom edge of the last grid row | **311.75** | **311.75** |
 * | `DOMAIN CARDS` / `ENVIRONMENTS` on one line | **yes** | **yes** |
 * | any label clipped | **none** | **none** |
 * | a chapter row | **369 x 44** | **351 x 44** |
 * | `RUNNING AN ADVENTURE` on one line | **yes** | **yes** |
 * | the 5 chapter rows, whole | **260.00** | **260.00** |
 * | `docOverflowX`, at every rank | **0.00** | **0.00** |
 *
 * The arithmetic held to a quarter of a pixel on every row above. **Two things
 * it predicted were wrong, and both are written here rather than quietly
 * fixed.**
 *
 * **The empty state scrolls at 375x667, and the prediction said it would not.**
 * The grid itself is on the glass at both sizes - 311.75 against a 342.00
 * window, in by 30.25, exactly as computed. What was left out of the sum is the
 * `LicenceFooter` below it, so the column measures **537.00** against 342.00
 * and scrolls by 195. That is not the failure it would have been on a screen
 * budgeted against a fixed height: this column has always scrolled, the whole
 * index is reachable in one flick, and the thing a reader came for - fourteen
 * shelves and their counts - is above the fold at both sizes. The named lever
 * is therefore **not** taken: the lead sentence stays, because deleting it
 * would buy 32px towards a fold this content does not have to meet.
 *
 * **WEAPONS opens onto 11,557px at 393x852 and 11,573px at 375x667** - 21.9 and
 * **33.8 screens**, against a prediction of ~9,000px and ~17. So the pre-agreed
 * remedy is taken rather than deferred, and the band over a kind's records is
 * `position: sticky` **and a control**: it carries the label, the count and
 * `SHUT`, the whole row is the target at the 44px floor, and it shuts the block
 * so the way out is the way in. Verified at `scrollTop = 6000`: the header is
 * still on the glass, flush with the scroller.
 *
 * It sticks at `top: -8` and not `top: 0`, and that was found by looking rather
 * than by reasoning. A sticky child sticks against its scroller's *padding*
 * edge, so at 0 it parked 8px down and the row passing underneath painted in
 * the gap above it - `BLESSED ANLACE` showing its top eight pixels over the
 * header, which reads as a rendering fault. The negative offset pulls it flush
 * and the padding goes back inside the control. The rig's overlap count went
 * from 2 to 1, and the one that remains is the header covering the row beneath
 * it, which is what a sticky header is for.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../../store/state.ts';
import { srdIndex, SRD_KIND_LABELS, SRD_KINDS, type SrdKind } from '../shared/srdIndex.ts';
import { RuleSearchField, RuleSearchResults } from '../shared/RuleSearch.tsx';
import {
  CHAPTER_LABELS,
  SRD_CHAPTERS,
  sectionsInChapter,
  type SrdChapter,
} from '../shared/chapters.ts';
import { LicenceFooter } from '../shell/LicenceFooter.tsx';

/**
 * A chapter row's DOM id, namespaced away from the section it contains.
 *
 * Three chapter slugs are *also* section ids - `introduction`,
 * `character-creation` and `running-an-adventure` - because `Ref` is `string`
 * and TypeScript cannot keep the two namespaces apart. As data that is correct
 * and says something true. On the glass it is a trap: without the prefix, the
 * INTRODUCTION chapter row and the `introduction` section row inside it would
 * share an id, and a test could count one as the other and call it proof. That
 * is the failure `data-kind` on `RecordHit` exists to prevent, and this is the
 * same guard one rank up.
 */
const chapterId = (chapter: SrdChapter): string => `chapter-${chapter}`;

/** A kind block's panel id, namespaced for the same reason. */
const kindId = (kind: SrdKind): string => `kind-${kind}`;

/**
 * The fourteen shelves, in the dataset's own order and under its own labels.
 *
 * The order is `SRD_KINDS` unchanged and the labels are `SRD_KIND_LABELS`
 * unchanged: there is one vocabulary for the kinds of thing this app ships and
 * this screen does not get a second. Counts come off the index that is already
 * built in this scope rather than from a number typed here - a homebrew layer
 * that adds records is counted too, and a placeholder that said 849 anyway
 * would be the screen guessing at what it holds.
 */
function KindGrid({
  counts,
  lit,
  onLight,
}: {
  counts: Readonly<Record<SrdKind, number>>;
  lit: SrdKind | null;
  onLight: (kind: SrdKind | null) => void;
}): React.JSX.Element {
  return (
    <div
      className="stack"
      /*
        A stable hook for the guard, and it is not decoration. The alternative
        was selecting the grid on its inline `repeat(3, 1fr)`, which is a test
        reaching into a style string: it breaks when the layout is tuned, it
        does not work in jsdom at all, and it asserts the wrong thing anyway -
        that the grid has three columns rather than that this is the index.
        `RecordHit`'s `data-kind` is here for the same reason.
      */
      data-index="kinds"
      style={{
        flex: 'none',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
      }}
    >
      {SRD_KINDS.map((kind) => {
        const on = kind === lit;
        return (
          <button
            key={kind}
            type="button"
            aria-expanded={on}
            aria-controls={kindId(kind)}
            onClick={() => {
              onLight(on ? null : kind);
            }}
            style={{
              // The floor. Two 10px lines and their padding come to 32, so this
              // is what a cell actually measures.
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '0 4px',
              borderRadius: 'var(--r2)',
              border: '1px solid var(--line)',
              background: on ? 'var(--hope-wash)' : 'var(--raised)',
              color: on ? 'var(--hope)' : 'var(--text-2)',
              overflow: 'hidden',
            }}
          >
            {/*
              At the role's own tracking (0.12em since the readability ramp,
              0.16em when this was derived), and not `ShowSheet`'s halved one:
              the longest label here is twelve characters where its chips carry
              fifteen. See the header for the arithmetic.
            */}
            <span
              className="t-label"
              style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {SRD_KIND_LABELS[kind]}
            </span>
            <span className="t-meta" style={{ color: 'var(--dim)' }}>
              {counts[kind]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The book's five chapters, under RULES.
 *
 * Full-width rows rather than a second grid, and that is measurement rather
 * than variety: `RUNNING AN ADVENTURE` is twenty characters, which is 152.00 of
 * glyph and tracking, and a 111.67px cell cannot hold it on one line. The
 * change of shape is also what tells a reader they went a rank in.
 *
 * A lit chapter's sections are inserted **under its own row** rather than below
 * the five, which is the opposite of what the grid above does with a lit block.
 * The reason is the shape: a one-column list takes an in-place insert for free,
 * where a grid would reflow, and in place keeps the trail - lit cell, lit row,
 * sections - tight enough to read as one.
 */
function ChapterRows({
  counts,
  lit,
  onLight,
}: {
  counts: Readonly<Record<SrdChapter, number>>;
  lit: SrdChapter | null;
  onLight: (chapter: SrdChapter | null) => void;
}): React.JSX.Element {
  return (
    <div className="stack" style={{ flex: 'none', gap: 10 }}>
      {SRD_CHAPTERS.map((chapter) => {
        const on = chapter === lit;
        return (
          <div key={chapter} className="stack" style={{ flex: 'none', gap: 10 }}>
            <button
              type="button"
              id={chapterId(chapter)}
              aria-expanded={on}
              onClick={() => {
                onLight(on ? null : chapter);
              }}
              style={{
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '0 12px',
                borderRadius: 'var(--r2)',
                border: '1px solid var(--line)',
                background: on ? 'var(--hope-wash)' : 'var(--raised)',
                color: on ? 'var(--hope)' : 'var(--text-2)',
              }}
            >
              <span className="t-label">{CHAPTER_LABELS[chapter]}</span>
              <span className="t-meta" style={{ color: 'var(--dim)' }}>
                {counts[chapter]}
              </span>
            </button>
            {/*
              No band: the row directly above is the header, and drawing one
              here repeated it word for word two lines down. See `banded`.
            */}
            {on && (
              <RuleSearchResults query="" browse={{ chapter }} questions={false} banded={false} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Search(): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const [query, setQuery] = useState('');
  /*
   * What is lit, at each of the two ranks that have a control.
   *
   * Two pieces of state and not one, because they are not a path: the chapter
   * only means anything while RULES is the lit kind, and collapsing them into
   * a single "what is open" would make lighting WEAPONS and lighting a chapter
   * the same kind of event, which they are not - one replaces the list below
   * the grid, the other opens an insert inside it.
   */
  const [litKind, setLitKind] = useState<SrdKind | null>(null);
  const [litChapter, setLitChapter] = useState<SrdChapter | null>(null);

  /*
   * Built here for the field's count and built again inside the results, both
   * memoised on the dataset, which changes about never. The count has to be
   * the dataset's own rather than a number typed here: a homebrew layer that
   * adds records is searched too, and a placeholder that said 849 anyway would
   * be the screen guessing at what it holds.
   */
  const index = useMemo(() => srdIndex(dataset), [dataset]);

  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(SRD_KINDS.map((kind) => [kind, 0])) as Record<SrdKind, number>;
    for (const record of index) counts[record.kind] += 1;
    return counts;
  }, [index]);

  const chapterCounts = useMemo(
    () =>
      Object.fromEntries(
        SRD_CHAPTERS.map((chapter) => [chapter, sectionsInChapter(dataset.rules, chapter).length]),
      ) as Record<SrdChapter, number>,
    [dataset.rules],
  );

  /**
   * Typing puts the index away, and it is the field's own handler that does it.
   *
   * The exclusivity is the whole of the arrangement and it has to live at the
   * one place both halves pass through. `ShowSheet` makes the same call about
   * its chips for the same reason: a surface that was half a browse and half a
   * search would be answering a question nobody asked beside one somebody did,
   * which is precisely the ambiguity the scope chips were removed for.
   */
  const onQuery = (next: string): void => {
    setQuery(next);
    if (next.trim() !== '') {
      setLitKind(null);
      setLitChapter(null);
    }
  };

  /** Lighting a block shuts whatever the last one opened. One rank at a time. */
  const lightKind = (kind: SrdKind | null): void => {
    setLitKind(kind);
    setLitChapter(null);
  };

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
          <>
            {/*
              The band says what the screen holds, in the `LABEL · n` form every
              other band on this surface already uses. The sentence that stood
              here listed the collections - "every rules section, card,
              adversary, environment and piece of gear" - and the grid below now
              draws them, which is better than saying them. What is left is the
              half a grid cannot show: that the words inside a record are
              searched and not only its name.
            */}
            <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
              EVERYTHING THE APP SHIPS · {index.length}
            </span>
            <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
              Search by name or by any words in the text.
            </p>
            <KindGrid counts={kindCounts} lit={litKind} onLight={lightKind} />
            {litKind !== null && (
              <div id={kindId(litKind)} className="stack" style={{ flex: 'none', gap: 10 }}>
                {/*
                  RULES is the one kind that opens onto something other than its
                  records, and the reason is that its records are the only ones
                  the book itself groups. Sixty-nine sections in one list is a
                  list; five chapters is the shape they are printed in.
                */}
                {litKind === 'rules' ? (
                  <ChapterRows counts={chapterCounts} lit={litChapter} onLight={setLitChapter} />
                ) : (
                  <>
                    {/*
                      The band over a kind's records is sticky, and it is a
                      *control* rather than a label. Both halves of that were
                      decided by measurement rather than taste.

                      WEAPONS opens onto 204 rows. Measured in Chrome,
                      `pointer: coarse`, insets 47/34: the scroller becomes
                      **11,557px** at 393x852 and **11,573px** at 375x667 -
                      21.9 and **33.8 screens**. The prediction this was
                      budgeted against was ~9,000px and ~17 screens, so the
                      real figure is twice the one the shape was agreed on.
                      Typing is still an escape, because the field is pinned in
                      the thumb arc and typing clears the browse - but there was
                      no way *back to the grid* that was not thirty flicks, and
                      a browse a reader cannot leave by the door they came in is
                      not a browse.

                      So the band goes with them and shuts the block. The whole
                      row is the target, at the 44px floor, and it names what it
                      will do rather than leaving a bare glyph to be guessed at.
                      `banded={false}` below suppresses the list's own copy of
                      the same words - the count still reaches a GM who cannot
                      see the list, from `spoken`'s live region.
                    */}
                    <button
                      type="button"
                      onClick={() => {
                        lightKind(null);
                      }}
                      style={{
                        position: 'sticky',
                        /*
                          -8 and not 0, and it is the scroller's own padding.
                          A sticky child sticks against the *padding* edge, so
                          `top: 0` parks it 8px down and lets the row passing
                          underneath paint in the gap above it. Drawn and looked
                          at: `BLESSED ANLACE` showed its top 8px over the
                          header, which reads as a rendering fault rather than
                          as a list. This pulls it flush with the border box,
                          and `paddingTop` puts the 8px back inside the control
                          so the label is not against the edge.
                        */
                        top: -8,
                        zIndex: 1,
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 12px 0',
                        borderRadius: 'var(--r2)',
                        border: '1px solid var(--line)',
                        // Opaque, not a wash: it slides over the rows it
                        // headers, and a translucent one would print the list
                        // through its own label.
                        background: 'var(--raised)',
                        color: 'var(--hope)',
                      }}
                    >
                      <span className="t-label">
                        {SRD_KIND_LABELS[litKind]} · {kindCounts[litKind]}
                      </span>
                      <span className="t-meta" style={{ color: 'var(--dim)' }}>
                        SHUT
                      </span>
                    </button>
                    <RuleSearchResults
                      query=""
                      browse={{ kind: litKind }}
                      questions={false}
                      banded={false}
                    />
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <RuleSearchResults query={query} onQuery={onQuery} questions={false} />
        )}
        <LicenceFooter />
      </div>
      <div className="stack" style={{ flex: 'none', gap: 8, padding: '0 12px 12px' }}>
        <RuleSearchField
          value={query}
          onChange={onQuery}
          total={index.length}
          reaches="entries in the book"
          label="Search the whole book, by name and text"
        />
      </div>
    </div>
  );
}
