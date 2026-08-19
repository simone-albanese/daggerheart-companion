/**
 * The GM screen's prose, held to the declarations the browser measured through.
 *
 * WHAT THIS FILE IS FOR. Three docblocks on this screen stated a geometry the
 * browser disproves, and every one of the four errors in the worst of them was
 * the same error: a 1px rule nobody counted. `.panel` carries a border and a
 * session row overrides only its left edge; the shell header, `GmTopBar` and
 * `GmBar` each carry a hairline; `GmSheet`'s panel carries one and takes 2px
 * off every column inside it. Four numbers in `SessionList.tsx`, one in
 * `SessionRow.tsx`, a row count in two places in `Gm.tsx`, the strip height in
 * `Reference.tsx` and the tab bar in `App.tsx` were all wrong by that alone.
 *
 * The precedent for the shape is `reflowProse.test.ts`, and its rule is taken
 * whole: THERE IS NO TABLE OF EXPECTED NUMBERS HERE. Every claim names a
 * sentence and an ANCHOR - a length declared by the component that draws it, a
 * token out of `tokens.css`, or arithmetic over those - and asserts the number
 * in the sentence is the number the anchor holds. Change a padding and the
 * sentence goes red until somebody re-measures.
 *
 * ## What this can hold, and what it cannot
 *
 * IT HOLDS the terms, and only the terms each number is actually made of. A
 * shut row is its panel border, its padding and its header's floor; add the
 * list's gap and it is the step. All four are declared in the tree, so 54.00
 * and 62.00 are checkable here - and so is `ROW_STEP`, which divides by that
 * step in every browser - and all three go red the moment one of them moves.
 * The topic strip's two numbers are shorter sums than this file used to claim,
 * and they are stated as what they are: **367.00 is `PHONE.glass` less twice
 * the sheet's border less twice the region's padding**, and **144.00 is three
 * `--tap` rows and two of the strip's declared gap**. Nothing else is an
 * operand of either.
 *
 * The chip's own padding and border are NOT in those two sums, and a sentence
 * here once said they were. They are held anyway, one test lower down, for a
 * different reason and stated as that reason: the seven chip widths in
 * `Reference.tsx` - 94.41 through 109.61, their 638.05 sum, the 674.05 and the
 * three-row wrap - were measured against `padding: '0 12px'` and a 1px
 * border-box border, and that file's own prose says every earlier estimate was
 * "short by exactly 2.00" because the border was missed. Change either
 * declaration and all of that goes stale in silence. So this file asserts that
 * the docblock still names the padding the chip declares and that the "short by
 * exactly 2.00" is still twice the border it declares. Both were unheld until
 * now: `chipPadX` sat here defined and never called, which reads as an anchor
 * and is dead code, and three mutations against `Reference.tsx` - the padding
 * to `'0 20px'`, the border to 4px, the border deleted outright - all left this
 * file green.
 *
 * IT CANNOT HOLD the results. Whether eight rows or nine are on the glass, that
 * the ninth is cut at 757.00 with its type row ending at exactly 757.00, that
 * the chips measure 94.41 and 109.61, that the strip breaks after FEAR: those
 * came out of Chrome at 393x852 with a named safe area, jsdom has no layout
 * engine, and an assertion pretending otherwise would be checking this file's
 * own arithmetic. They live in the docblocks with the viewport and the inset
 * beside them, and only the rig keeps them true. What IS held about them is
 * that the two files stating the same count state the same word - which is the
 * defect that actually happened, twice, in one night.
 *
 * IT DOES NOT RESTATE `SessionRow.tsx`'s 303 and 353. Those two were correct
 * before this pass and are the one place in this corner that counted the
 * border; a second copy of them here is the defect this file exists for. Its
 * 369 IS held, but against this region's own padding rather than against a
 * number - and held precisely so that the next sweep, finding a 369 two files
 * from a 367, does not "correct" the one that was right.
 *
 * ## How wide the sweep behind this file actually is
 *
 * It runs across `src` and `tests` - but only over the file lists written into
 * it, and the first version of that sentence was a claim about the tree when it
 * was a claim about eight files in `src/ui/gm`. The licence notice proved it:
 * `LicenceFooter.tsx` measured the block at 126.16 and five files were
 * corrected, while six more sites in `src/ui/build`, `src/ui/player` and
 * `tests/ui` went on stating the retired ~111px estimate of the same strip
 * unquoted. The tree said 111 and 126.16 about one strip at once - this file's
 * own named defect, "a corrected number surviving in the second file",
 * committed one directory over from the pass that wrote it down. Those six are
 * closed, and the notice now has its own list and its own scan at the end of
 * this file. A scan is exactly as wide as the array under it; when a figure
 * crosses a directory, the array has to cross it too.
 *
 * ## Three sites this lane cannot reach, written down so they are not lost
 *
 * Three retired figures are still live in the repo's top-level `.md`, which
 * this lane is forbidden to edit, so they are named here for whoever can:
 *
 *   - `Architecture.md:903` - "~143px dei 551 della lista". 551 is retired:
 *     `SessionList.tsx`'s head docblock measures 548.00 of list, and `Gm.tsx`
 *     keeps "551px of list" only as a record of what was wrong. The 143 beside
 *     it is the figure `Gm.tsx` demotes to never measured.
 *   - `HANDOFF.md:350` - "126px of the 653 that is not shell header". 653 is
 *     retired under `SessionList.tsx`'s `## The licence notice is the last
 *     thing in this scroll` heading, which says the share was wrong in both
 *     halves and that the band is 752.00. The 126 itself is a measured
 *     licence-footer height and is fine.
 *   - `HANDOFF-2026-08-18.md:1038` - costs the row step at 60px and the topic
 *     strip at 94px on two rows. `SessionList.tsx`'s head docblock measures the
 *     step at 62.00 and `Reference.tsx`'s at 144.00 on three rows.
 *
 * The source pointers in that list name a file and a heading rather than a
 * line, and that is the lesson of this branch rather than a preference: every
 * line number it repointed correctly was pushed off its target again by its own
 * next commit, twice. `README.md` was a fourth entry here, carrying three stale
 * `CompatibleMark` call-site lines; it turned out to be reachable and is fixed,
 * by symbol.
 *
 * None of the three is asserted below: a test that goes red on a file nobody in
 * this lane may touch is a test that cannot be made green.
 *
 * ## The forty-nine `.md` line references this round's own insertions displaced
 *
 * Written down because it is the defect this branch keeps committing, and this
 * time it is committed *outwards*: correcting prose in `src` lengthened the
 * edited files, and every `.md` line number pointing below an inserted hunk
 * moved with it. Forty-nine references at thirty-one citation sites. The
 * lasting fix for each is the symbol named beside it, not the new number.
 *
 * Two counts under this heading were wrong before, and both for reasons worth
 * keeping. It said "nine" over a list of eight - the count of a list is not a
 * thing to write from memory. And the eight themselves came from a sweep that
 * diffed against `b26ca4b`, this branch's own fourth-from-tip commit, rather
 * than against the commit the round started from; eight is the true count of
 * what the last four commits displaced, which is not what a reader of these
 * documents needs, because they are reading against `main`. Twenty-nine of the
 * forty-nine are whole `File.ext:N` citations against `9a18f46`. The other
 * twenty are the bare `:N` continuations and comma lists that hang off the
 * same sentences - `App.tsx:294, :329, :405, :573` is four references, not one
 * - and a scanner that only matches a filename followed by a colon cannot see
 * any of them. That is the third form of the same defect: a sweep that stops
 * early, a sweep from the wrong base, and a sweep whose pattern is narrower
 * than the thing it is sweeping for.
 *
 * `Architecture.md`
 *
 *   - `:169` - `App.tsx:612` -> `:624`, and already wrong before this round:
 *     `:624` is the `}, []);` closing an effect inside `UnsavedWork`, while the
 *     `<Recovery />` the sentence is about is rendered by `EmptyState`, behind
 *     its `needsPasteboardBridge()` guard. Anchor: `EmptyState` in `App.tsx`.
 *
 * `AUDIT-HANDOFF.md`
 *
 *   - `:109` - `App.tsx:294, :329, :405, :573` -> `:297`, `:332`, `:408`,
 *     `:585`, and the first was already wrong: `:297` is inside the docblock
 *     over `gmOnScreen`, not at a banner. Anchor: the banners are `UnsavedWork`
 *     and the `storageError`, `integrity` and `quarantined` blocks of `Shell`.
 *   - `:228` - `App.tsx:293`, `:328`, `:404`, `:572` -> `:296`, `:331`, `:407`,
 *     `:584`. Same enumeration, same already-wrong first number, same anchor.
 *   - `:412` - `Wizard.tsx:402` -> `:407`, inside the style block of Build's
 *     bottom nav, where its home-indicator inset is argued.
 *   - `:413` - `LicenceFooter.tsx:166` -> `:177`, the
 *     `paddingBottom: paysTheInset ? ... : 18` declaration. Anchor:
 *     `paysTheInset` in `LicenceFooter.tsx`.
 *   - `:423` - `LicenceFooter.tsx:155` -> `:166`, where `paysTheInset` is
 *     computed. Same anchor, and the sentence already names it.
 *   - `:521` - `App.tsx:506` -> `:509`, the `<>` opening the screen switch.
 *     What the sentence is about is one line of that switch, the
 *     `phone && !onboarding && screen !== 'gm'` guard on `<TabBar />`. Anchor:
 *     that guard.
 *
 * `BACKLOG.md`
 *
 *   - `:50` - `Edit.tsx:392` -> `:396`. The delete confirmation's inventory of
 *     what is lost. Anchor: `DeleteCharacter`'s docblock in `Edit.tsx`.
 *   - `:410` - `App.tsx:152` -> `:155`, and already wrong: both are a blank
 *     line. The advice it quotes is the "Close the other tabs and reload"
 *     button inside `Shell`'s `storageError` block.
 *   - `:700` and `:724` - `codec.ts:1047` -> `:1062`, and both were already
 *     wrong before this round: that line is a `case 'subclass'` arm, while the
 *     symbol both sentences name, `resolvePlaceholders`, is exported further
 *     down the same file. Anchor: `resolvePlaceholders`.
 *   - `:1083` - `Edit.tsx:426` -> `:430`. The armed/unarmed branch of the
 *     delete control. Anchor: `armed` in `DeleteCharacter`.
 *   - `:1107` - `App.tsx:101-103` -> `:104-106`, and `:3374` - `App.tsx:101` ->
 *     `:104`. Anchor: `App` itself, the three-line function that wraps `Shell`
 *     in `AppBoundary`.
 *   - `:1311` - `App.tsx:72` -> `:75`, the comment arguing which screens are
 *     `lazy`. Anchor: the `lazy` imports of `Build`, `Gm` and `Settings`.
 *   - `:1418` - `Cards.tsx:628` -> `:632`. The comment recording that the pair
 *     used to read RECALL and RECALL 2.
 *   - `:1468` - `App.tsx:170, 175, 237` -> `:173`, `:178`, `:240`, and `:1494`
 *     - `App.tsx:170` and `:175` -> `:173` and `:178`. Already wrong at both
 *     sites: `:173` opens the comment over the weekly integrity check and
 *     `:178` is four lines inside it, while the claim at `:1494` is about where
 *     `EmptyState` is rendered - which is the `needsCharacter` ternary on the
 *     Play and Cards branches of the screen switch. Anchor: `needsCharacter`.
 *   - `:1516` - `CompatibleMark.tsx:54-57` -> `:73-76`, and this one was
 *     already wrong too: the new range is a blank line, the lockup's one-line
 *     docblock, `CompatibleLockup`'s signature and its first statement. The
 *     copy that item means is `ATTRIBUTION`, exported further down the file.
 *   - `:1919` - `Wizard.tsx:583` -> `:588`, and this one is a third that was
 *     already wrong: `:588` is the `<h2>` of the step heading, and nothing at
 *     either line sets a draft name. Resolve it by symbol.
 *   - `:2730` - `App.tsx:408` -> `:411`, and already wrong twice over: `:411`
 *     closes a comment inside `Shell`, and the fixed licence strip the row
 *     describes is not rendered from this file at all any more. Anchor:
 *     `App.tsx`'s head docblock, under its `## SUPERSEDED` heading, which is
 *     where that strip's removal is argued.
 *   - `:2731` - `SessionList.tsx:146-150` -> `:204`, and the end of that range
 *     no longer resolves at all: old `:150` is a line this round rewrote, so
 *     there is no new line to point at. Anchor: `SessionList.tsx`'s
 *     `## The licence notice is the last thing in this scroll` heading, which
 *     is where the retired `marginTop: 'auto'` is recorded.
 *   - `:3257` - `App.tsx:293`, `:328`, `:404`, `:572` -> `:296`, `:331`,
 *     `:407`, `:584`, a second copy of `AUDIT-HANDOFF.md:228`'s enumeration.
 *
 * `HANDOFF-2026-08-18.md`
 *
 *   - `:370` - `gmStore.ts:755` -> `:758`, the `setRegion` action. The
 *     `:539-546` beside it did not move.
 *   - `:371` - `gmStore.ts:704-744` -> end of range `:747`, inside the factory
 *     that returns the empty live state.
 *   - `:373`, `:624` and `:633` - `GmSheet.tsx:77` -> `:88`, the `padding:`
 *     shorthand whose jsdom visibility those three rows argue about. It is
 *     `:624`, the table row, that calls it "il vero `GmSheet.tsx:77`" - the one
 *     hit for that phrase in the file - so the number is load-bearing there and
 *     the anchor is the shorthand itself, not the line. `:633` is the paragraph
 *     that concludes «`GmSheet.tsx:77` non è un sito nascosto», nine lines
 *     below.
 *   - `:641` - `LicenceFooter.tsx:124` -> `:135`, the `calc(0px + env(...))`
 *     paragraph of that file's head docblock. Anchor: that paragraph.
 *
 * `HANDOFF.md`
 *
 *   - `:728` - `App.tsx:293`, `:328`, `:404`, `:572` -> `:296`, `:331`,
 *     `:407`, `:584`, a third copy of the same enumeration.
 *
 * `docs/handoff/DECISIONI-2026-08-18.md`
 *
 *   - `:33` - `GmSheet.tsx:77` -> `:88`, the same shorthand as the three rows
 *     above, cited from item 19's decision row.
 *
 * How they were found, because the method is the reusable part: take every
 * `Name.ext:N` in every tracked `.md` *and* every bare `:N` or `, N` that
 * continues one, bind each to the file its chain names, diff that file against
 * `9a18f46` - the commit on `main` the round started from, and not a commit of
 * this branch's own - map old line to new through the unchanged hunks, and
 * report every reference whose target moved or vanished. It takes a minute, and
 * it is the step this branch got wrong twice by not running it at all and a
 * third time by running it from the wrong base with a pattern that could see
 * only three references in five.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PHONE, px as resolve } from './tokens.ts';
import { REFERENCE_TOPICS } from '../../src/ui/gm/Reference.tsx';

const cache = new Map<string, string>();
/** A file as one line of prose, comment furniture and wrapping removed. */
function prose(file: string): string {
  const hit = cache.get(file);
  if (hit !== undefined) return hit;
  const flat = readFileSync(file, 'utf8')
    .replace(/^\s*\*\s?/gm, ' ')
    .replace(/^\s*\/\/\s?/gm, ' ')
    .replace(/\s+/g, ' ');
  cache.set(file, flat);
  return flat;
}

const source = (file: string): string => readFileSync(file, 'utf8');

/**
 * The same prose with every double-quoted span taken out.
 *
 * The convention, taken from `reflowProse.test.ts`'s backticks: a retired
 * figure written inside quotes is a RECORD of what was wrong, and every one of
 * these docblocks now carries one so the next reader knows what changed. Only
 * the unquoted prose is a claim about this build, so only the unquoted prose is
 * what the regression check below reads.
 */
function claims(file: string): string {
  return prose(file).replace(/"[^"]*"/g, ' ');
}

/**
 * A length declared next to an anchor that occurs exactly once in the file.
 *
 * A non-unique anchor throws by name rather than reading the next control down,
 * which is the loud failure this whole file prefers to a quiet pass.
 */
function declared(file: string, anchor: string, property: string): number {
  const src = source(file);
  const at = src.indexOf(anchor);
  if (at === -1 || src.indexOf(anchor, at + 1) !== -1) {
    throw new Error(
      `\`${anchor}\` is not unique in ${file}, so nothing here can say which control's ` +
        `${property} it is reading. Re-point the anchor at the control this claim is about.`,
    );
  }
  const found = new RegExp(`${property}: (\\d+(?:\\.\\d+)?)`).exec(src.slice(at));
  if (found === null) throw new Error(`no \`${property}\` follows \`${anchor}\` in ${file}`);
  return Number.parseFloat(found[1]!);
}

/** The one number in a sentence, insisted on being the only match. */
function stated(file: string, find: RegExp): number[] {
  const all = [...prose(file).matchAll(find)].map((m) => Number.parseFloat(m[1]!));
  if (all.length === 0) {
    throw new Error(
      `${file} no longer contains the sentence ${find} anchors. Either the wording moved - ` +
        're-point this claim at it - or the sentence went, in which case say here that it did.',
    );
  }
  return all;
}

/** `.panel`'s own border, which is the pixel every one of these errors dropped. */
function panelBorder(): number {
  const css = source('src/ui/base.css');
  const at = css.indexOf('.panel {');
  if (at === -1) throw new Error('`base.css` no longer declares a `.panel` block');
  const found = /border: (\d+)px solid/.exec(css.slice(at, at + 300));
  if (found === null) {
    throw new Error(
      '`.panel` no longer declares a `border`, so a shut session row is no longer 2px taller ' +
        'than its padding and floor. Re-measure the list before rewriting this.',
    );
  }
  return Number.parseInt(found[1]!, 10);
}

/** A row's vertical padding, off its own `padding: '4px 6px'`. */
const rowPadY = (): number => {
  const found = /padding: '(\d+)px (\d+)px',\n\s*gap: open/.exec(source('src/ui/gm/SessionRow.tsx'));
  if (found === null) throw new Error('the session row no longer declares its panel padding here');
  return Number.parseInt(found[1]!, 10);
};

/** The floor the row's header declares, which is what sets its height. */
const rowHeaderFloor = (): number =>
  declared('src/ui/gm/SessionRow.tsx', 'patch(item.id, { collapsed: open });', 'minHeight');

/** The gap between rows, off the `<ol>` that draws them. */
const listGap = (): number =>
  declared('src/ui/gm/SessionList.tsx', "<ol className=\"stack\" style={{", 'gap');

const shutCard = (): number => 2 * panelBorder() + 2 * rowPadY() + rowHeaderFloor();
const step = (): number => shutCard() + listGap();

/** The horizontal padding a phone region declares, from a `'Apx Bpx Cpx'` triple. */
function regionPadX(file: string, anchor: string): number {
  const src = source(file);
  const at = src.indexOf(anchor);
  if (at === -1) throw new Error(`\`${anchor}\` is gone from ${file}`);
  const found = /'\d+px (\d+)px \d+(?:px)?'/.exec(src.slice(at));
  if (found === null) throw new Error(`no phone padding triple follows \`${anchor}\` in ${file}`);
  return Number.parseInt(found[1]!, 10);
}

/** The border `GmSheet` paints round the panel every tool draws inside. */
function sheetBorder(): number {
  const found = /border: '(\d+)px solid var\(--line\)'/.exec(source('src/ui/gm/GmSheet.tsx'));
  if (found === null) {
    throw new Error(
      '`GmSheet` no longer declares a 1px border on its panel, which is the whole reason the ' +
        "reference column is 367 and not 369. Re-measure the sheet's column before rewriting.",
    );
  }
  return Number.parseInt(found[1]!, 10);
}

/**
 * The topic chip's horizontal padding.
 *
 * Not an operand of 367.00 or of 144.00 - it is the frame the seven chip widths
 * in `Reference.tsx` were measured inside, which is why that file names it and
 * why this one holds it.
 */
const chipPadX = (): number => {
  const found = /padding: '0 (\d+)px',\n\s*borderRadius: 'var\(--r3\)'/.exec(
    source('src/ui/gm/Reference.tsx'),
  );
  if (found === null) throw new Error('the topic chip no longer declares `padding: 0 Npx`');
  return Number.parseInt(found[1]!, 10);
};

/** The chip's own border, read off the same declaration block as its padding. */
const chipBorder = (): number => {
  const found = /padding: '0 \d+px',\n\s*borderRadius: 'var\(--r3\)',\n\s*border: `(\d+)px solid/.exec(
    source('src/ui/gm/Reference.tsx'),
  );
  if (found === null) {
    throw new Error(
      'the topic chip no longer declares a `border: Npx solid` after its padding. A chip is ' +
        'border-box, so its border is inside all seven measured widths in `Reference.tsx` - ' +
        're-measure the strip rather than editing the sentence.',
    );
  }
  return Number.parseInt(found[1]!, 10);
};

const stripGap = (): number =>
  declared('src/ui/gm/Reference.tsx', 'aria-label="What to look up"', 'gap');

/**
 * The horizontal padding one of the bottom sheets declares on its scroller.
 *
 * `AddSheet` draws two of them - the four choices and the form behind them - so
 * this reads every `padding: N` on a `className="scroll stack"` in the file and
 * refuses to answer if they disagree, rather than silently taking the first.
 */
function sheetPadX(file: string): number {
  const src = source(file);
  const found = [
    ...src.matchAll(/className="scroll stack"[^>]*?padding: (\d+)\s*[,}]/g),
    ...src.matchAll(/className="scroll stack"[^>]*?padding: '\d+px (\d+)px \d+(?:px)?'/g),
  ].map((m) => Number.parseInt(m[1]!, 10));
  if (found.length === 0) {
    throw new Error(
      `no \`className="scroll stack"\` with a readable horizontal padding in ${file}, so nothing ` +
        'here can say what column its docblock is claiming',
    );
  }
  const one = new Set(found);
  if (one.size !== 1) {
    throw new Error(
      `${file} now declares ${[...one].join(' and ')} on its scrollers, so one docblock cannot ` +
        'state one column for the sheet. Re-measure before rewriting it.',
    );
  }
  return found[0]!;
}

describe('the GM screen states the geometry its own declarations make', () => {
  /*
   * The step is the whole of the list's arithmetic, and every term of it is
   * declared. 60px stood in `SessionList.tsx` because 8px of panel padding was
   * counted and 2px of panel border was not - and it outlived that correction
   * in `useSessionDrag.ts`, where it was not prose but the number every drag
   * divides by, because `SessionList` passes no `rowStep`. So `ROW_STEP` is
   * held to the same four declarations as the sentence is.
   */
  it('gives the drag the same step the row and the list declare', () => {
    const found = /export const ROW_STEP = (\d+);/.exec(source('src/ui/gm/useSessionDrag.ts'));
    if (found === null) {
      throw new Error(
        '`useSessionDrag.ts` no longer exports a numeric `ROW_STEP`. It is the divisor of every ' +
          'reorder - `SessionList` passes no `rowStep` - so whatever replaced it needs holding ' +
          'to the list pitch here.',
      );
    }
    expect(
      Number.parseInt(found[1]!, 10),
      '`ROW_STEP` is no longer the shut card plus the list gap, so a drag divides by a pitch ' +
        'the list does not have. It was 60 against a 62.00 pitch for exactly this reason.',
    ).toBe(step());
  });

  it('states the shut row and the step the row and the list declare', () => {
    expect(
      stated('src/ui/gm/SessionList.tsx', /A shut row is \*\*(\d+\.\d\d)\*\*/g),
      'the shut card in `SessionList.tsx` is no longer `.panel`\'s two borders, the row\'s two ' +
        "paddings and its header's floor",
    ).toEqual([shutCard()]);
    expect(
      stated('src/ui/gm/SessionList.tsx', /the \*\*step is (\d+\.\d\d)\*\*/g),
      'the step in `SessionList.tsx` is no longer the shut card plus the list gap',
    ).toEqual([step()]);
    /*
     * `SessionRow.tsx` states the same card twice - once as what a two-line
     * summary does not move, once as what a three-line one does - and the first
     * of the two is this same shut card. It is the sentence that carried "nine
     * rows", so it is held to the same anchor rather than to the other file.
     */
    expect(
      stated('src/ui/gm/SessionRow.tsx', /neither the button nor the card moves \(44\.00 and (\d+\.\d\d)\)/g),
      "`SessionRow.tsx` states a shut card the row's own declarations no longer make",
    ).toEqual([shutCard()]);
    expect(
      stated('src/ui/gm/SessionRow.tsx', /whose `min-height: (\d+)px` is what sets that \d+/g),
      '`SessionRow.tsx` names a header floor its own button no longer declares',
    ).toEqual([rowHeaderFloor()]);
  });

  /*
   * The three pinned pieces. What jsdom can hold is that each still declares
   * the rule the arithmetic now counts and the height the sentence names; the
   * 100.00, 109.00 and 95.00 themselves came out of Chrome with a safe area.
   */
  it.each([
    ['src/ui/shell/Header.tsx', 'borderBottom', 'the shell header'],
    ['src/ui/gm/GmTopBar.tsx', 'borderBottom', '`GmTopBar`'],
    ['src/ui/gm/GmBar.tsx', 'borderTop', '`GmBar`'],
    ['src/ui/shell/TabBar.tsx', 'borderTop', 'the shell tab bar'],
  ])('%s still declares the 1px rule the corrected arithmetic counts', (file, property, what) => {
    expect(
      new RegExp(`${property}: '1px solid`).test(source(file)),
      `${what} no longer declares a 1px \`${property}\`, so the height ` +
        '`SessionList.tsx` states for it is stale. Re-measure it rather than subtracting one.',
    ).toBe(true);
  });

  it('states the 52px shell row and the 60px bar its components declare', () => {
    expect(
      stated('src/ui/gm/SessionList.tsx', /over a (\d+)px row/g),
      'the shell row `SessionList.tsx` names is not the height `Header.tsx` declares',
    ).toEqual([declared('src/ui/shell/Header.tsx', 'className="spread"', 'height')]);
    expect(
      stated('src/ui/gm/SessionList.tsx', /\((\d+)px of buttons over/g),
      'the bar height `SessionList.tsx` names is not the floor `GmBar.tsx` declares',
    ).toEqual([declared('src/ui/gm/GmBar.tsx', 'onClick={() => onOpenSheet(verb.id)}', 'minHeight')]);
  });

  /*
   * `GmTopBar`'s own sentence: the three terms it adds up are its declared
   * padding and gap, and the rows it stacks are at the touch floor.
   */
  it('adds up the padding and gap `GmTopBar` declares', () => {
    const found = /gap: (\d+),\n\s*padding: phone \? '(\d+)px \d+px (\d+)px'/.exec(
      source('src/ui/gm/GmTopBar.tsx'),
    );
    if (found === null) {
      throw new Error('`GmTopBar` no longer declares a gap and a phone padding triple together');
    }
    const [gap, top, bottom] = found.slice(1).map((n) => Number.parseInt(n, 10));
    const said = /With (\d+) \+ (\d+) \+ (\d+) of padding and gap/.exec(
      prose('src/ui/gm/GmTopBar.tsx'),
    );
    expect(said, '`GmTopBar` no longer states the three terms it adds up').not.toBeNull();
    expect(
      said!.slice(1).map((n) => Number.parseInt(n, 10)),
      '`GmTopBar` states a padding and gap it no longer declares, so the 109.00 and 159.00 ' +
        'beside them are stale. Re-measure the bar.',
    ).toEqual([top, gap, bottom]);
    expect(
      stated('src/ui/gm/GmTopBar.tsx', /row A (\d+)px MENU/g),
      '`GmTopBar` states a row height the MENU button no longer declares',
    ).toEqual([declared('src/ui/gm/GmTopBar.tsx', 'onClick={onOpenMenu}', 'minHeight')]);
  });

  /*
   * The reference column, which is the same forgotten border one level up: the
   * sheet's panel is border-box, so the region divides 391 and not 393.
   */
  it('states the reference column the sheet and the region leave', () => {
    const column = PHONE.glass - 2 * sheetBorder() - 2 * regionPadX('src/ui/gm/Reference.tsx', 'className="scroll stack"');
    expect(
      stated('src/ui/gm/Reference.tsx', /the column is \*\*(\d+\.\d\d)\*\*/g),
      '`Reference.tsx` states a column that is no longer the sheet\'s content box less this ' +
        "region's padding",
    ).toEqual([column]);
    expect(
      stated('src/ui/gm/Reference.tsx', /its content box is \*\*(\d+\.\d\d)\*\*/g),
      "`Reference.tsx` states a sheet content box that is not the window less the sheet's border",
    ).toEqual([PHONE.glass - 2 * sheetBorder()]);
  });

  /*
   * The list's own column is NOT inside the sheet, which is why 369 is right in
   * `SessionRow.tsx` and wrong in `Reference.tsx`. Holding both at once is the
   * only thing that stops the next sweep "fixing" the correct one.
   */
  it('keeps the list column outside the sheet and 2px wider than the reference column', () => {
    const list = PHONE.glass - 2 * regionPadX('src/ui/gm/SessionList.tsx', 'className="scroll stack"');
    const reference =
      PHONE.glass - 2 * sheetBorder() - 2 * regionPadX('src/ui/gm/Reference.tsx', 'className="scroll stack"');
    expect(
      list - reference,
      'the list column and the reference column no longer differ by exactly the sheet border, ' +
        'so one of the two files is now stating the other one\'s number',
    ).toBe(2 * sheetBorder());
    expect(
      stated('src/ui/gm/SessionRow.tsx', /so (\d+) less 4 less/g),
      "`SessionRow.tsx` states a column that is no longer this region's own",
    ).toEqual([list]);
  });

  /*
   * The topic strip's height, which is the claim that was wrong by a whole row.
   * Three rows of `--tap` and two gaps - the row count is the browser's and
   * stays in the docblock; the terms are declared and are held here.
   */
  it('states a strip height made of `--tap` and the gap it declares', () => {
    const rows = stated('src/ui/gm/Reference.tsx', /so the strip is (\d+) \+ \d+ \+ \d+ \+ \d+ \+ \d+/g);
    const tap = resolve('var(--tap)', PHONE);
    expect(rows, 'the strip no longer states a row at `--tap`').toEqual([tap]);
    expect(
      stated('src/ui/gm/Reference.tsx', /= \*\*(\d+\.\d\d)px\*\*, paid once/g),
      'the strip height is no longer three `--tap` rows and two of the gap this strip declares',
    ).toEqual([3 * tap + 2 * stripGap()]);
  });

  /*
   * The chip's frame, which is not in either sum above and is what every one of
   * the seven measured widths was measured inside.
   *
   * `Reference.tsx` states 94.41 through 109.61, their 638.05, the 674.05 and
   * the three-row wrap, and its own prose derives all of it from `padding: 0
   * 12px` and from a chip being border-box with `border: 1px solid` - "every
   * one of them was short by exactly 2.00" is that border, twice. Widen the
   * padding or thicken the border and every one of those numbers is wrong with
   * nothing to say so. Three mutations proved that: `'0 12px'` to `'0 20px'`,
   * `1px solid` to `4px solid`, and the border deleted, all green.
   */
  it('holds the chip padding and border the seven measured widths were measured inside', () => {
    expect(
      stated('src/ui/gm/Reference.tsx', /with `padding: 0 (\d+)px`/g),
      'the docblock names a chip padding the chip no longer declares, so all seven measured ' +
        'widths and the 674.05 and the three-row wrap are stale. Re-measure the strip.',
    ).toEqual([chipPadX()]);
    expect(
      stated('src/ui/gm/Reference.tsx', /short by exactly (\d+\.\d\d)/g),
      'the docblock says the estimate was short by a border the chip no longer declares. A ' +
        'chip is border-box, so this is its border on both edges - re-measure the seven widths.',
    ).toEqual([2 * chipBorder()]);
  });

  /*
   * The seven widths are the browser's and cannot be checked here. What can is
   * that they are still seven, still these seven, and still in this order: a
   * topic added or renamed makes every one of those numbers a lie, and that is
   * an edit somebody will make without opening Chrome.
   */
  it('names the topics `REFERENCE_TOPICS` holds, in order, beside their widths', () => {
    const said = [
      ...prose('src/ui/gm/Reference.tsx').matchAll(/Measured widths: (.+?)\. That is/g),
    ].map((m) => m[1]!);
    expect(
      said.length,
      '`Reference.tsx` no longer lists the measured chip widths where this reads them',
    ).toBe(1);
    const names = [...said[0]!.matchAll(/([A-Z][A-Z ]*[A-Z]) \*\*\d+\.\d\d\*\*/g)].map((m) => m[1]!);
    expect(
      names,
      'the chips named in the docblock are no longer the topics `REFERENCE_TOPICS` holds. Every ' +
        'width in that sentence was measured against one of these labels, so a renamed or added ' +
        'topic makes all of them stale - re-measure the strip.',
    ).toEqual(REFERENCE_TOPICS.map((t) => t.short));
    expect(
      stated('src/ui/gm/Reference.tsx', /with six (\d+)px gaps/g),
      'the strip states a gap it no longer declares',
    ).toEqual([stripGap()]);
    const NUMERAL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    const gaps = /with (\w+) \d+px gaps/.exec(prose('src/ui/gm/Reference.tsx'));
    expect(gaps, '`Reference.tsx` no longer counts the gaps between the chips').not.toBeNull();
    expect(
      gaps![1],
      `the docblock counts the gaps between ${REFERENCE_TOPICS.length} chips as ` +
        `"${gaps?.[1]}". A wrapped flex row has one fewer gap than chips, so it should read ` +
        `"${NUMERAL[REFERENCE_TOPICS.length - 1]}" - and every width in the sentence above wants ` +
        're-measuring with the topic that changed.',
    ).toBe(NUMERAL[REFERENCE_TOPICS.length - 1]);
  });

  /*
   * The one thing this file can say about a browser result: the two files that
   * state it state the same thing. "Nine rows" lived in `SessionList.tsx` and
   * `SessionRow.tsx` at once and went stale in both, and a corrected number
   * surviving in the second file is the defect that repeated all night.
   */
  it('makes `SessionList.tsx` and `SessionRow.tsx` agree about what fits', () => {
    const list = prose('src/ui/gm/SessionList.tsx');
    const row = prose('src/ui/gm/SessionRow.tsx');
    const whole = /\*?\*?(eight|nine|ten|seven)\*?\*? (?:shut )?rows (?:are )?whole/i;
    const inList = whole.exec(list);
    const inRow = whole.exec(row);
    expect(inList, '`SessionList.tsx` no longer states how many shut rows are whole').not.toBeNull();
    expect(inRow, '`SessionRow.tsx` no longer states how many shut rows are whole').not.toBeNull();
    expect(
      inRow![1]!.toLowerCase(),
      'the two files disagree about how many shut rows are whole on a phone. They are one claim ' +
        'said twice; re-measure and change both.',
    ).toBe(inList![1]!.toLowerCase());
    const saidByRow = /(\w+) in bare Chrome with no inset/.exec(row)?.[1];
    const saidByList = /bare Chrome with no inset at all the region is [\d.]+ to [\d.]+: \*\*(\w+)\*\*/
      .exec(list)?.[1];
    expect(saidByList, '`SessionList.tsx` no longer states a bare-Chrome count').toBeDefined();
    expect(
      saidByRow,
      'the two files disagree about how many shut rows a bare Chrome window holds',
    ).toBe(saidByList);
  });

  /*
   * The retired claims, in the whole corner rather than in the three files the
   * measurement pointed at. Every one of these was true of no build and each
   * outlived at least one commit that corrected it somewhere else.
   *
   * THE TEST FILES ARE IN THIS LIST ON PURPOSE. When this sweep was first run
   * over `src` alone it came back clean, and two stale copies were sitting in
   * `tests/` the whole time: `sessionList.test.tsx` introduced its ellipsis
   * assertion with "nine rows fit on a phone", and `gmShell.test.tsx` costed a
   * stacked tab bar at 94px. A comment a test carries is a claim of the same
   * rank as the code under it, and it is read more often than most docblocks,
   * because it is what somebody reads while working out why a test failed.
   */
  it.each([
    ['nine rows', /nine rows/],
    ['551px of list', /551px/],
    ['301 of pinned chrome', /852 − 301|852 - 301/],
    // Six spellings and not one, because the retired sentence was written six
    // ways - "60 px a step", "the step is 60", "a 60px step", "Row height plus
    // the list gap [...] = 60", and, where the step is costed as a gesture
    // rather than as a pitch, "60px of travel" and "60px of accurate travel" -
    // and the literal that stood here, `the step is 60px`, matched none of
    // them. The last two are here because the pattern that replaced it still
    // could not see them: it ran over `SessionRow.tsx` and
    // `sessionDrag.test.tsx` while both spelt the gesture that way, and came
    // back green. A scan pattern narrower than the sentence it retires is a
    // test that passes because it cannot see.
    [
      'a 60px step',
      /\b60 ?px a step|the step is 60|60px step|step at 60|step of 60|60 ?px of (accurate )?travel/,
    ],
    ['a 60px drag step', /ROW_STEP = 60\b/],
    ['a two-row topic strip', /wraps to two rows/],
    ['660 against a 369px column', /660 against/],
  ])('no file in `src` or `tests` has gone back to %s', (_what, pattern) => {
    const files = [
      'src/ui/gm/SessionList.tsx',
      'src/ui/gm/SessionRow.tsx',
      'src/ui/gm/Reference.tsx',
      'src/ui/gm/Gm.tsx',
      'src/ui/gm/GmTopBar.tsx',
      'src/ui/shell/App.tsx',
      'src/ui/gm/useSessionDrag.ts',
      'tests/gm/sessionList.test.tsx',
      'tests/gm/gmShell.test.tsx',
      'tests/gm/sessionDrag.test.tsx',
    ];
    for (const file of files) {
      expect(
        pattern.test(claims(file)),
        `${file} asserts it again. If the sentence is a record of what used to be wrong, put it ` +
          'in double quotes - that is the convention this file reads.',
      ).toBe(false);
    }
  });

  /*
   * The bottom sheets are the `sheet` half of the same panel the reference
   * region is the `full` half of, and they dropped the identical pixel. All
   * three stated "393 - 28 of padding = 365px" while `ShowSheet.tsx` - same
   * directory, same panel, same `padding: 14` - already carried the measured
   * 363. This holds the three against the terms rather than against 363: the
   * sheet's border and the scroller's own padding, both declared.
   */
  it.each([
    ['MenuSheet.tsx', 'src/ui/gm/MenuSheet.tsx'],
    ['AddSheet.tsx', 'src/ui/gm/AddSheet.tsx'],
    ['SaveSheet.tsx', 'src/ui/gm/SaveSheet.tsx'],
    ['ShowSheet.tsx', 'src/ui/gm/ShowSheet.tsx'],
  ])('%s states the column its padding and the sheet border leave', (_name, file) => {
    const column = PHONE.glass - 2 * sheetBorder() - 2 * sheetPadX(file);
    expect(
      stated(file, /inner column is \*\*(\d+)px\*\*/g),
      `${file} states a sheet column that is no longer the panel's content box less its own ` +
        'padding. If the padding moved, re-measure; if the border moved, every sheet moved.',
    ).toEqual([column]);
  });

  /*
   * `PartyBoard` was the site nobody swept. It draws in `GmSheet size="full"`
   * beside `Reference`, at the same 12px, and said 369 where the region says
   * 367.00 - the same claim, the same container, missed by the pass that
   * adjudicated every other 369 on this screen.
   */
  it('states the same full-tool column in `PartyBoard` as in `Reference`', () => {
    const column =
      PHONE.glass - 2 * sheetBorder() - 2 * regionPadX('src/ui/gm/PartyBoard.tsx', 'const pad =');
    expect(
      stated('src/ui/gm/PartyBoard.tsx', /wider than the (\d+\.\d\d)px a 393px phone leaves/g),
      '`PartyBoard.tsx` states a column that is not the sheet\'s content box less its own ' +
        'padding, which is how it came to say 369 in a 367 region',
    ).toEqual([column]);
    expect(
      column,
      '`PartyBoard` and `Reference` pad differently now, so they no longer share a column and ' +
        'this claim has to be re-pointed rather than kept',
    ).toBe(
      PHONE.glass - 2 * sheetBorder() - 2 * regionPadX('src/ui/gm/Reference.tsx', 'className="scroll stack"'),
    );
  });

  /*
   * The two `const COLUMN` guards, which are the same 369-versus-367 question
   * asked in assertions rather than in prose - and the pair that has to be held
   * together, because "correcting" the right one is the failure mode.
   *
   * `reference.test.tsx` draws inside `GmSheet`'s panel and said 369 with the
   * comment "393 less the 12px this region pads either side", which is the
   * exact sentence this file exists to retire: it was 2px slack as a guard as
   * well as wrong as a comment. `sessionList.test.tsx` is NOT inside the sheet
   * and its 369 is right. Neither is written here as a number.
   */
  it('gives each screen the column its own container leaves, in the guards too', () => {
    const read = (file: string): number => {
      const found = /const COLUMN = (\d+);/.exec(source(file));
      if (found === null) {
        throw new Error(
          `${file} no longer declares a \`const COLUMN\`, so nothing here can say what width ` +
            'it guards against. Re-point this claim at whatever replaced it.',
        );
      }
      return Number.parseInt(found[1]!, 10);
    };
    expect(
      read('tests/gm/reference.test.tsx'),
      "the reference guard is not the sheet's content box less this region's padding. 369 is " +
        'the list column, one container out - the sheet spends a pixel on each edge first.',
    ).toBe(PHONE.glass - 2 * sheetBorder() - 2 * regionPadX('src/ui/gm/Reference.tsx', 'className="scroll stack"'));
    expect(
      read('tests/gm/sessionList.test.tsx'),
      'the session list guard is not this region\'s own padding off the glass. This one is ' +
        'outside the sheet and 369 is correct for it - do not "fix" it to match the reference.',
    ).toBe(PHONE.glass - 2 * regionPadX('src/ui/gm/SessionList.tsx', 'className="scroll stack"'));
  });

  /*
   * The retired figures, held shut. Every one of these is now written inside
   * double quotes as a record of what was wrong, so an unquoted one is the
   * sentence coming back.
   *
   * `src/ui/shell/CampaignNotSaved.tsx` IS IN THIS LIST, and it is not on the
   * GM screen. There are three alerts that do the same border-box arithmetic on
   * the same kind of block, and two of them are in `src/ui/gm`: when the "345"
   * was retired from those two the third went on asserting its own version of
   * it - "393 − 40 of gutter − 24 of padding = 329px", the same missing
   * hairline - because the sweep was scoped to a directory rather than to the
   * claim. Its figure is 329 rather than 345 because its gutter and its border
   * differ, which is exactly why a scan over one pattern in one directory could
   * not see it.
   */
  it.each([
    ['a 365px sheet column', /365/],
    ['a 345px notice column', /345/],
    ['a 329px alert column', /\b329\b/],
  ])('no file behind these alerts has gone back to %s', (_what, pattern) => {
    const files = [
      'src/ui/gm/MenuSheet.tsx',
      'src/ui/gm/AddSheet.tsx',
      'src/ui/gm/SaveSheet.tsx',
      'src/ui/gm/ShowSheet.tsx',
      'src/ui/gm/SessionBody.tsx',
      'src/ui/gm/GmSheet.tsx',
      'src/ui/gm/gmStore.ts',
      'src/ui/gm/Gm.tsx',
      'src/ui/shell/CampaignNotSaved.tsx',
    ];
    for (const file of files) {
      expect(
        pattern.test(claims(file)),
        `${file} asserts it again. If the sentence is a record of what used to be wrong, put it ` +
          'in double quotes - that is the convention this file reads.',
      ).toBe(false);
    }
  });
});

/**
 * THE LICENCE NOTICE'S COST, WHICH IS THE SWEEP THAT STOPPED HALF WAY.
 *
 * `LicenceFooter.tsx` measures the block it draws at **126.16px** on a 369px
 * column at 393x852 and says outright that the "~111px" estimate it replaced
 * was short by the border it forgot to add. Five files took the correction; six
 * sites in three other directories did not, and went on costing the same pinned
 * strip at ~111px unquoted - which by the convention above is a claim about this
 * build, not a record of what was wrong.
 *
 * Its own `describe`, and not the GM one above, because that is the whole
 * finding: the strip was on five screens and the scan that retired its height
 * only ever listed one screen's directory.
 */
describe('every file that costs the licence notice costs it at the measured height', () => {
  const NOTICE = [
    'src/ui/shell/App.tsx',
    'src/ui/shell/LicenceFooter.tsx',
    'src/ui/gm/SessionList.tsx',
    'src/ui/build/Edit.tsx',
    'src/ui/build/Wizard.tsx',
    'src/ui/player/Cards.tsx',
    'src/ui/player/Play.tsx',
    'tests/ui/attribution.test.tsx',
    'tests/gm/gmShell.test.tsx',
  ];

  it.each(NOTICE)('%s has not gone back to the retired ~111px strip', (file) => {
    expect(
      /111px/.test(claims(file)),
      `${file} costs the pinned licence strip at 111px again. It was an estimate and it was ` +
        'short: `LicenceFooter.tsx` measures the block at 126.16 on a 369px column at 393x852, ' +
        'and a pinned one painted a panel and its own horizontal padding on top of that. If the ' +
        'sentence is a record of what used to be wrong, put it in double quotes.',
    ).toBe(false);
  });

  /*
   * One measured height, said the same in every file that says it. This is the
   * half the ~111px sweep got right in five files and the half it is easiest to
   * lose again: the next reader who re-measures will change one file.
   */
  it.each(NOTICE)('%s states the notice height as the one measured number', (file) => {
    const said = [...claims(file).matchAll(/\b(12\d(?:\.\d+)?)px\b/g)].map((m) => m[1]!);
    expect(
      said,
      `${file} no longer states the licence notice's measured height anywhere. It is in this ` +
        'list because it costs the notice; if it has stopped costing it, take it out of `NOTICE` ' +
        'rather than leaving a file here that can no longer go stale.',
    ).not.toEqual([]);
    expect(
      [...new Set(said)],
      `${file} states a licence-notice height other than the measured 126.16. Either it was ` +
        're-measured and every other file in `NOTICE` needs the new figure, or this is a ' +
        'different 12x-pixel number and this pattern needs narrowing - do not settle it by ' +
        'deriving one on paper.',
    ).toEqual(['126.16']);
  });
});
