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
 * different reason and stated as that reason: the eight chip widths in
 * `Reference.tsx` - 56.41 through 109.61, their 702.05 sum, the 744.05 and the
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
 * the chips measure 56.41 and 109.61, that the strip breaks after COUNTDOWNS
 * and again after COSTS: those
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
 * ## Five sites this lane cannot reach, written down so they are not lost
 *
 * Five retired figures are still live in the repo's top-level `.md`, which
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
 *   - `BACKLOG.md:1995` - "then a step per 60 px", in the done row for the
 *     drag reorder. `ROW_STEP` in `useSessionDrag.ts` is 62.
 *   - `BACKLOG.md:2001` - "a 250 ms hold plus 60 px of accurate travel is not
 *     a gesture everybody has", the same `ROW_STEP` costed the same way. It
 *     carries the exact phrase `5967f13` retired from three sites at once -
 *     "60px of accurate travel" in `SessionRow.tsx`'s `## Moving` section, the
 *     JSX comment over MOVE UP / MOVE DOWN, and the name of the
 *     `sessionDrag.test.tsx` case that exercises them - one space wider.
 *     Anchor for both: `ROW_STEP` in `useSessionDrag.ts`.
 *
 * The last two are the same figure as the entry above them, and they are here
 * because the sweep that wrote that entry read one file and stopped - this
 * branch's own named recurring defect, "a sweep that stops early", committed
 * inside the paragraph that names it. Nothing below can hold them: the retired-
 * figure scan at the end of this file reads only the files in the array under
 * it, and `.md` cannot be in that array, because nothing in this lane may make
 * those files green. Of the two, only `:2001` would even be seen if it could -
 * the `/60 ?px of (accurate )?travel/` alternative matches it, while `:1995`'s
 * "a step per 60 px" is a seventh spelling none of the six patterns covers.
 *
 * The source pointers in that list name a file and a heading, or a symbol,
 * rather than a line, and that is the lesson of this branch rather than a
 * preference: every line number it repointed correctly was pushed off its
 * target again by its own next commit, twice. `README.md` stood in this list
 * too, carrying three stale `CompatibleMark` call-site lines; it turned out to
 * be reachable and is fixed, by symbol.
 *
 * None of the five is asserted below: a test that goes red on a file nobody in
 * this lane may touch is a test that cannot be made green.
 *
 * ## The forty-six `.md` line references this round's own insertions displaced
 *
 * Written down because it is the defect this branch keeps committing, and this
 * time it is committed *outwards*: correcting prose in `src` lengthened the
 * edited files, and every `.md` line number pointing below an inserted hunk
 * moved with it. Forty-six references at thirty-one citation sites. The
 * lasting fix for each is the symbol named beside it, not the new number.
 *
 * Three counts under this heading were wrong before, and all three for reasons
 * worth keeping. It said "nine" over a list of eight - the count of a list is
 * not a thing to write from memory. And the eight themselves came from a sweep
 * that diffed against `b26ca4b`, this branch's own fourth-from-tip commit,
 * rather than against the commit the round started from; eight is the true
 * count of what the last four commits displaced, which is not what a reader of
 * these documents needs, because they are reading against `main`. Then it said
 * "forty-nine" over a list of forty-six, and split that into "twenty-nine"
 * whole and "twenty" bare - three numbers none of which the list under it
 * carries. The same defect as the "nine", one heading later and three times
 * over: the count of a list is not a thing to write from memory.
 *
 * Counted off the list, entry by entry: Architecture 1, AUDIT-HANDOFF 12,
 * BACKLOG 22, HANDOFF-2026-08-18 6, HANDOFF 4, DECISIONI 1 - forty-six, at
 * thirty-one sites. Thirty of the forty-six are whole `File.ext:N` citations
 * against `9a18f46`. The other sixteen are the bare `:N` continuations and
 * comma lists that hang off the same sentences - `App.tsx:294, :329, :405,
 * :573` is four references, not one - and a scanner that only matches a
 * filename followed by a colon cannot see any of them. Thirty rather than
 * thirty-one because one site's whole citation is not among the displaced:
 * `HANDOFF-2026-08-18.md:370` heads its chain with `gmStore.ts:539-546`, which
 * did not move, and it is the bare `:755` after it that did. That is the third
 * form of the same defect: a sweep that stops early, a sweep from the wrong
 * base, and a sweep whose pattern is narrower than the thing it is sweeping
 * for.
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
 *   - `:1516` - `CompatibleMark.tsx:54-57` -> `:82-85`, and this one was
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
 *
 * ## Three files outside the GM screen, and the rule that put them here
 *
 * The name at the top of this file says the GM screen, and it is now narrower
 * than what is asserted below: a second `describe` holds figures in
 * `src/ui/settings/Settings.tsx`, `src/ui/settings/About.tsx` and
 * `src/ui/player/Conditions.tsx`. That is the widening this header already
 * argues for twice - `CampaignNotSaved.tsx` is in the alert scan because the
 * claim and not the directory is the scope, and the licence notice got a
 * `describe` of its own because the strip is on five screens - so it is done
 * the way those two were done, in its own `describe`, named for the claim
 * rather than for a screen. The GM `describe` above is unchanged.
 *
 * What those three have in common with `SessionRow.tsx` is not a screen, it is
 * one defect: a width stated as a subtraction that skipped a container. 78 and
 * 277 spent a 369px column as though the flex line were 369, when `Rows` puts
 * a border round it and `Field` puts 14px either side inside that; 349 in
 * `About.tsx` was that same `Rows` box named as a flex line one container
 * further in; 337 in `Conditions.tsx` counted the dialog's border as nothing.
 * Every one of them is the 1px this file's first paragraph is about, one
 * screen over.
 *
 * ## Nothing below is anchored to a line, and that is a correction
 *
 * Those four docblocks used to cite their terms as `file:line`. Three of the
 * citations - `Conditions.tsx:749`, `:761` and `:961` - were pushed onto a
 * `zIndex`, a `width` and a `</div>` by the same insertion that wrote them,
 * and so were false in the commit that added them. The sentences now quote the
 * declaration instead, and what is asserted here is the declaration.
 *
 * That created a hazard of its own, and `code()` below is the answer to it: a
 * docblock that quotes `padding: '10px 11px'` puts a second copy of that
 * string in its file, so an anchor over the raw text can match the sentence
 * instead of the style and end up checking prose against itself. Every anchor
 * added for these four files reads the file with its comments removed, and
 * refuses a match that is not unique in it.
 *
 * ## What already reads these files as source text
 *
 * Recorded because a report out of this lane said the opposite.
 * `tests/ui/rollAffordance.test.ts` reads `Settings.tsx` with `readFileSync`
 * and asserts three things about it: that `checked={prefs.manualDice}` is
 * there, that the retired hint "The two dice on the Play screen become inputs"
 * is not, and that `!prefs.digitalDice && !prefs.manualDice` is. All three are
 * about the code and none is about the geometry held below, so nothing here
 * collides with them - but "no test reads this file as source text" was not
 * true when it was written.
 *
 * Counted properly, because the count is the part that was wrong: of the four
 * files the second `describe` reads, three were already inside somebody's
 * assertion as text. `Settings.tsx` is read by `rollAffordance.test.ts`;
 * `Conditions.tsx` is read by `reflowProse.test.ts`, which holds four figures
 * in it against `--control` and `--damage-w`; `SessionRow.tsx` is read by the
 * `describe` above. `About.tsx` is the only one of the four that nothing read
 * as source text until this file did.
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

/**
 * A file with every comment taken out.
 *
 * For a hazard this round created rather than found. The docblocks the second
 * `describe` reads now name each term by quoting the declaration that makes it
 * - `padding: '10px 11px'`, `flex: '1 1 180px'`, `border: '1px solid
 * var(--line)'` - instead of citing a line, so several of those strings occur
 * twice in their file: once as the style, once inside the paragraph that reads
 * it. An anchor matched against the raw text finds whichever comes first, and
 * where that is the sentence, the assertion is prose checked against its own
 * copy of the number. Every anchor below reads this instead.
 */
function code(file: string): string {
  return source(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/**
 * Every number one declaration states, insisted on being the only match in the
 * file's code.
 *
 * A second match is a silent choice between two controls, which is the failure
 * `declared()` above already refuses by name; this refuses it by count, because
 * these anchors are regexes over a block rather than a string plus a property.
 */
function decl(file: string, find: RegExp, what: string): number[] {
  const all = [...code(file).matchAll(find)];
  if (all.length !== 1) {
    throw new Error(
      `${what} matches ${all.length} times in the code of ${file}, where this needs exactly ` +
        'one. Re-point the anchor at the control the docblock is about.',
    );
  }
  return all[0]!.slice(1).map((n) => Number.parseFloat(n!));
}

/** The single number a declaration states. */
const only = (file: string, find: RegExp, what: string): number => decl(file, find, what)[0]!;

/**
 * Every number one sentence states, in the order it states them.
 *
 * `stated()` above reads one capture from possibly several sentences; these
 * claims are enumerations - a column and the five terms it subtracts - so what
 * is wanted is several captures from exactly one sentence. Same refusal as
 * `stated()`: if the wording moved, re-point the claim; if the sentence went,
 * say here that it did.
 */
function says(file: string, find: RegExp, what: string): number[] {
  const all = [...prose(file).matchAll(find)];
  if (all.length !== 1) {
    throw new Error(
      `${file} states ${what} ${all.length} times where this expects exactly one. Either the ` +
        'wording moved - re-point this claim at it - or the sentence went, in which case say ' +
        'here that it did rather than deleting the assertion.',
    );
  }
  return all[0]!.slice(1).map((n) => Number.parseFloat(n!));
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
 * Not an operand of 367.00 or of 144.00 - it is the frame every chip width in
 * `Reference.tsx` was measured inside, which is why that file names it and why
 * this one holds it. Written without a count on purpose: the count moved from
 * seven to eight and this sentence was one of the two that did not notice.
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
        'border-box, so its border is inside every measured width in `Reference.tsx` - ' +
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
 * `AddSheet` draws two of them - the choices and the form behind them - so
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

const SCENE = 'src/ui/gm/Scene.tsx';

/**
 * A `.t-*` role's font size, off `tokens.css` rather than remembered.
 *
 * Every one of these roles declares `line-height` as a unitless number in the
 * same `font:` shorthand, so a role at `/1` is as tall as this returns and a
 * role at `/1.5` is that multiplied - which is the whole of the arithmetic the
 * combatant card's docblock does with `.t-meta`.
 */
function roleSize(role: string): number {
  const css = readFileSync('src/ui/tokens.css', 'utf8');
  const at = css.indexOf(`.${role} {`);
  if (at === -1) throw new Error(`\`tokens.css\` no longer declares a \`.${role}\` block`);
  const found = /font: \d+ (\d+(?:\.\d+)?)px\//.exec(css.slice(at, at + 200));
  if (found === null) {
    throw new Error(
      `\`.${role}\` no longer declares a \`font:\` shorthand with a px size, so nothing here can ` +
        'say how tall one of its lines is.',
    );
  }
  return Number.parseFloat(found[1]!);
}

/** The combatant card's own `gap` and `padding`, in that order. */
const cardBox = (): number[] =>
  decl(SCENE, /gap: (\d+),\s*padding: (\d+),\s*borderLeft:/g, "the combatant card's gap and padding");

/** The extra border the card paints down its left edge, over `.panel`'s own. */
const cardLeftBorder = (): number =>
  only(SCENE, /borderLeft: `(\d+)px solid \$\{c\.spotlighted/g, "the card's left border");

/** The counters grid's `auto-fit` track floor and its gap, in that order. */
const countersGrid = (): number[] =>
  decl(
    SCENE,
    /repeat\(auto-fit, minmax\((\d+)px, 1fr\)\)',\s*gap: (\d+),/g,
    "the card's counters grid",
  );

/**
 * The threshold band's two paddings: read-only y and x, then the Minion arm's.
 *
 * One declaration and one anchor, because they are one ternary. Reading the
 * read-only arm alone would let the Minion arm be given a vertical padding
 * without anything here noticing, and that arm's zero is exactly what makes the
 * band its 44px target rather than 44 inside 16 of decoration.
 */
const bandPad = (): number[] =>
  decl(
    SCENE,
    /padding: minions === undefined \? '(\d+)px (\d+)px' : '(\d+) (\d+)px',/g,
    "the threshold band's two paddings",
  );

/** The band's vertical padding while it is only read. */
const bandPadY = (): number => bandPad()[0]!;

/** The flat floor the band's Minion `−` declares, and its width. */
const minionStep = (): number[] =>
  decl(
    SCENE,
    /aria-label="Decrease Minions standing"[\s\S]*?width: (\d+),\s*minHeight: (\d+),/g,
    "the band's Minion stepper",
  );

/** The size of the number in the threshold band, at `.t-num`'s `line-height: 1`. */
const bandNum = (): number =>
  only(SCENE, /fontSize: (\d+) \}\}>\s*\{c\.difficulty\}/g, "the threshold band's number");

/** The attack row's `gap`, its top border and its top padding, in that order. */
const attackRow = (): number[] =>
  decl(
    SCENE,
    /gap: (\d+), flexWrap: 'wrap', borderTop: '(\d+)px solid var\(--line-soft\)', paddingTop: (\d+)/g,
    "the card's attack row",
  );

/**
 * The attack bonus, the tallest thing on the attack row's first line.
 *
 * Anchored through `signed(adversary.attackBonus)` and not through the `font:`
 * alone: the band's Minion readout declares the identical `800 17px/1
 * var(--sans)`, so a bare font anchor stopped being unique the day that control
 * moved into the band, and `decl()` said so by name rather than reading the
 * wrong one.
 */
const attackBonus = (): number =>
  only(
    SCENE,
    /font: '800 (\d+)px\/1 var\(--sans\)', fontVariantNumeric: 'tabular-nums' \}\}>\s*\{signed\(/g,
    "the attack bonus's font size",
  );

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
   * THE STAGE, WHICH IS THE ONE NUMBER ON THIS SCREEN THAT USED TO BE A WINDOW.
   *
   * Every GM tool was a `position: fixed; inset: 0` overlay, so a `full` panel
   * was the window less the top inset and 8px: 797.00 at 393x852. It is drawn
   * against the band between `GmTopBar` and `GmBar` now - the owner's decision
   * that the night is a sheet and the bar stays on the glass under it - which
   * is the same band `SessionList.tsx` has always measured. So `GmSheet.tsx`
   * does not get its own measurement here and must not have one: it states the
   * list's, and this holds the two files to each other. The moment somebody
   * re-measures the chrome in `SessionList.tsx`, `GmSheet.tsx` goes red.
   *
   * The price is held rather than stated freely because it is the figure a GM
   * actually pays - 249px of tool, every tool - and a docblock is where a
   * reader meets it. It is arithmetic on two figures in the same paragraph, so
   * what this checks is that the subtraction is still right and that the
   * percentage beside it is still that subtraction over the panel that is gone.
   *
   * Nothing here is a measurement of the new panel. NOBODY HAS PUT THE MOVED
   * TOOL IN FRONT OF A BROWSER; the stage is measured, the loss is arithmetic
   * on it, and every file that carried a vertical figure inside a `full` tool
   * now says which of the two it is holding.
   */
  it('states a stage that is the band `SessionList.tsx` measures, not a window', () => {
    expect(
      stated('src/ui/gm/GmSheet.tsx', /session list runs, which `SessionList.tsx` measures at \*\*(\d+\.\d\d)\*\*/g),
      '`GmSheet` states a stage that is not the band `SessionList.tsx` measures between the two ' +
        'bars. One of the two files has re-measured the pinned chrome without the other.',
    ).toEqual(stated('src/ui/gm/SessionList.tsx', /= \*\*(\d+\.\d\d) of list\*\*/g));

    const pinned = says(
      'src/ui/gm/SessionList.tsx',
      /countdown pinned `GmTopBar` is [\d.]+, the region is (\d+\.\d\d) to (\d+\.\d\d)/g,
      'the region a pinned countdown leaves',
    );
    expect(
      stated('src/ui/gm/GmSheet.tsx', /the stage is (\d+\.\d\d) \(region/g),
      '`GmSheet` states a with-a-countdown stage that is not the region `SessionList.tsx` ' +
        'measures for the same case',
    ).toEqual([pinned[1]! - pinned[0]!]);
  });

  it('costs every full tool the difference between the window it had and that stage', () => {
    const panel = stated('src/ui/gm/GmSheet.tsx', /\*\*(\d+\.\d\d)\*\* of panel/g)[0]!;
    const stage = stated('src/ui/gm/GmSheet.tsx', /measures at \*\*(\d+\.\d\d)\*\*/g)[0]!;
    const pinnedStage = stated('src/ui/gm/GmSheet.tsx', /the stage is (\d+\.\d\d) \(region/g)[0]!;
    const pct = (lost: number): number => Math.round((lost / panel) * 10_000) / 100;

    expect(
      says(
        'src/ui/gm/GmSheet.tsx',
        /loses \*\*(\d+\.\d\d)px\*\*, which is \*\*(\d+\.\d\d)%\*\* of what it had/g,
        'the height a full tool loses',
      ),
      '`GmSheet` states a price that is not the panel it had less the stage it has. That number ' +
        'is what a GM pays at a table, so it is held rather than left to drift.',
    ).toEqual([panel - stage, pct(panel - stage)]);

    expect(
      says(
        'src/ui/gm/GmSheet.tsx',
        /the loss is\s+\*\*(\d+\.\d\d)px\*\* - \*\*(\d+\.\d\d)%\*\*/g,
        'the height a full tool loses with a countdown pinned',
      ),
      '`GmSheet` states a with-a-countdown price that is not the same subtraction',
    ).toEqual([panel - pinnedStage, pct(panel - pinnedStage)]);
  });

  /*
   * The `sheet` half of the same move. The cap is declared, so the four figures
   * around it are that percentage of the two stages and the two edges those
   * leave - including the 174.55 that put a bottom sheet's top edge inside the
   * Fear row, which is the half of this defect that was never about `full`.
   */
  it('states a bottom sheet capped at the fraction the panel declares', () => {
    const cap =
      Number.parseInt(
        /maxHeight: full \? undefined : '(\d+)%'/.exec(code('src/ui/gm/GmSheet.tsx'))?.[1] ??
          (() => {
            throw new Error('`GmSheet` no longer caps a `sheet` panel at a percentage');
          })(),
        10,
      ) / 100;
    const panel = stated('src/ui/gm/GmSheet.tsx', /\*\*(\d+\.\d\d)\*\* of panel/g)[0]!;
    const stage = stated('src/ui/gm/GmSheet.tsx', /measures at \*\*(\d+\.\d\d)\*\*/g)[0]!;
    const foot = says(
      'src/ui/gm/SessionList.tsx',
      /region (\d+\.\d\d) to (\d+\.\d\d)\. A/g,
      'the band the list runs',
    )[1]!;
    // The window, taken from the one sentence that subtracts the chrome from
    // it rather than from a constant here: `tokens.ts` gives `PHONE` a width
    // and deliberately no height, and this file does not get to invent one.
    const window = says(
      'src/ui/gm/SessionList.tsx',
      /and (\d+) − [\d.]+ = \*\*[\d.]+ of list\*\*/g,
      'the window the chrome is subtracted from',
    )[0]!;
    expect(
      says(
        'src/ui/gm/GmSheet.tsx',
        /is (\d+\.\d\d) against the old (\d+\.\d\d), and its top edge moves from (\d+\.\d\d) - inside the Fear\s+row - down to (\d+\.\d\d)/g,
        'what a bottom sheet caps at',
      ),
      '`GmSheet` states bottom-sheet heights that are no longer its declared cap over the two ' +
        'stages. The 174.55 is the one that mattered: it is where the old cap put the top edge, ' +
        'which was inside the Fear row.',
    ).toEqual(
      // To the hundredth the docblock writes them at. `0.85 * 797` is
      // 677.4499999999999 in binary floating point and the sentence says
      // 677.45; a comparison that failed on that would be this file testing
      // IEEE 754 rather than the prose.
      [cap * stage, cap * panel, window - cap * panel, foot - cap * stage].map(
        (n) => Math.round(n * 100) / 100,
      ),
    );
  });

  /*
   * The Fear row's own band, which is what a bottom sheet used to cut into and
   * is the only vertical claim `GmSheet.tsx` makes about another component. Its
   * terms are the shell header `SessionList.tsx` measures and the padding, gap
   * and row height `GmTopBar` declares - the same four `GmTopBar`'s own 109.00
   * is made of, one row short.
   */
  it('puts the Fear row where `GmTopBar`\'s own declarations put it', () => {
    const header = says(
      'src/ui/gm/SessionList.tsx',
      /the shell header at (\d+\.\d\d) \(/g,
      'the shell header',
    )[0]!;
    const found = /gap: (\d+),\n\s*padding: phone \? '(\d+)px/.exec(source('src/ui/gm/GmTopBar.tsx'));
    if (found === null) throw new Error('`GmTopBar` no longer declares a gap and a phone padding');
    const [gap, top] = found.slice(1).map((n) => Number.parseInt(n, 10));
    const row = declared('src/ui/gm/GmTopBar.tsx', 'onClick={onOpenMenu}', 'minHeight');
    const startsAt = header + top! + row + gap!;
    expect(
      says(
        'src/ui/gm/GmSheet.tsx',
        /put at y (\d+\.\d\d) to (\d+\.\d\d)/g,
        'the band the Fear row occupies',
      ),
      '`GmSheet` states a Fear-row band that is no longer the shell header plus `GmTopBar`\'s ' +
        'declared padding, first row and gap. That band is the thing a bottom sheet used to cut ' +
        'into, so it is held to the declarations rather than to a remembered pair of numbers.',
    ).toEqual([startsAt, startsAt + row]);
  });

  /*
   * The overlay pays no top inset any more, and three other files quote the
   * declaration to establish that it pays nothing a side either. It is the same
   * string in four places, which is four chances for one of them to keep
   * describing an overlay that ran the window.
   */
  it('quotes the overlay padding those columns are measured inside', () => {
    const declaration = /padding: full \|\| phone \? 0 : 24/;
    expect(
      declaration.test(code('src/ui/gm/GmSheet.tsx')),
      '`GmSheet`\'s overlay no longer declares this padding. If it pays a top inset again it is ' +
        'a fixed overlay over the window again; if it pays anything a side, every column ' +
        'measured inside this panel is stale.',
    ).toBe(true);
    for (const file of [
      'src/ui/gm/GmSheet.tsx',
      'src/ui/gm/Reference.tsx',
      'src/ui/gm/Scene.tsx',
      'src/ui/gm/StatBlock.tsx',
    ]) {
      expect(
        declaration.test(prose(file).replace(/\s+/g, ' ')) || file === 'src/ui/gm/GmSheet.tsx',
        `${file} quotes an overlay padding \`GmSheet\` no longer declares, and the column it ` +
          'subtracts from is measured inside it.',
      ).toBe(true);
    }
  });

  /*
   * THE BACKDROP A `full` TOOL DOES NOT LEAVE ON A PHONE.
   *
   * Not arithmetic. A decision, whose price is a gesture rather than a number -
   * and that is the kind of claim the docblocks on this screen have got wrong
   * before, by asserting the comfortable half of it. `GmSheet.tsx` said the
   * backdrop was "also a target" and that the surface was "smaller than it
   * was". For the eight `full` tools on a phone it is not smaller. Three
   * declarations together leave none of it:
   *
   *   - the overlay pays `padding: full || phone ? 0 : 24`, so nothing above it
   *     and nothing either side;
   *   - the panel is `flex: full ? 1 : 'none'`, so under `full` it takes the
   *     whole stage rather than its own content height;
   *   - and `width: '100%'`, so it takes the whole of it across as well.
   *
   * Move any one of the three and the paragraph describes a screen that is no
   * longer there - in the direction that makes it too pessimistic, which is the
   * harmless direction and is still a docblock stating something false. So all
   * three are anchors here.
   *
   * And the sentence that says what is left - CLOSE, alone, because a phone has
   * no Escape key - is held to the size the button actually declares. On those
   * eight, on that width, that 44x44 is the whole of the way out; a target that
   * shrank would be the exit shrinking, not a control shrinking.
   *
   * What this cannot say is whether a thumb reaches it. NOBODY HAS PUT THIS IN
   * FRONT OF A BROWSER, and reach is not a declaration - the placement argument
   * in `GmSheet.tsx` is an argument, and the 393x852 screenshot the handoff asks
   * for is still owed.
   */
  it('leaves a `full` tool on a phone no backdrop, and says CLOSE is what is left', () => {
    const src = code('src/ui/gm/GmSheet.tsx');
    expect(
      /padding: full \|\| phone \? 0 : 24/.test(src),
      "`GmSheet`'s overlay no longer pays zero padding under `full` or on a phone. If it pays " +
        'anything, there is a backdrop again and the Ergonomics paragraph is describing a ' +
        'screen that is not there.',
    ).toBe(true);
    expect(
      /flex: full \? 1 : 'none'/.test(src),
      '`GmSheet`\'s panel no longer fills the stage under `full`. A panel at its content ' +
        'height leaves the rest of the band as backdrop, which is the target the Ergonomics ' +
        'paragraph says a `full` tool does not get below 1100.',
    ).toBe(true);
    expect(
      /width: '100%'/.test(src),
      '`GmSheet`\'s panel no longer spans its overlay, so there is backdrop either side of it ' +
        'and the paragraph that says there is none is stale.',
    ).toBe(true);
    expect(
      decl('src/ui/gm/GmSheet.tsx', /width: (\d+), height: (\d+)/g, 'the CLOSE square'),
      'the CLOSE square is no longer 44x44. Under `full` below 1100 it is the only dismissal ' +
        'this panel has - no backdrop at all - and on a phone there is no Escape key either, ' +
        'so it is the one target on this screen that cannot go under the floor.',
    ).toEqual([44, 44]);

    const said = prose('src/ui/gm/GmSheet.tsx');
    for (const sentence of [
      '**A `full` tool has no backdrop at all below 1100.** Not a smaller one: none,',
      'Escape key, so on a phone it is CLOSE, alone.',
    ]) {
      expect(
        said.includes(sentence),
        `\`GmSheet.tsx\` no longer says "${sentence}". That paragraph is the record of a ` +
          'decision - the tap-outside a phone gives up, and what it is given up for - so if ' +
          'the decision changed, re-take it here rather than deleting the sentence.',
      ).toBe(true);
    }
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
   * the measured widths was measured inside.
   *
   * `Reference.tsx` states 56.41 through 109.61, their 702.05, the 744.05 and
   * the three-row wrap, and its own prose derives all of it from `padding: 0
   * 12px` and from a chip being border-box with `border: 1px solid` - "every
   * one of them was short by exactly 2.00" is that border, twice. Widen the
   * padding or thicken the border and every one of those numbers is wrong with
   * nothing to say so. Three mutations proved that: `'0 12px'` to `'0 20px'`,
   * `1px solid` to `4px solid`, and the border deleted, all green.
   */
  it('holds the chip padding and border every measured width was measured inside', () => {
    expect(
      stated('src/ui/gm/Reference.tsx', /with `padding: 0 (\d+)px`/g),
      'the docblock names a chip padding the chip no longer declares, so every measured ' +
        'width and the 744.05 and the three-row wrap are stale. Re-measure the strip.',
    ).toEqual([chipPadX()]);
    expect(
      stated('src/ui/gm/Reference.tsx', /short by exactly (\d+\.\d\d)/g),
      'the docblock says the estimate was short by a border the chip no longer declares. A ' +
        'chip is border-box, so this is its border on both edges - re-measure every width.',
    ).toEqual([2 * chipBorder()]);
  });

  /*
   * The widths are the browser's and cannot be checked here. What can is that
   * they are still these labels and still in this order: a topic added or
   * renamed makes every one of those numbers a lie, and that is an edit
   * somebody will make without opening Chrome. Since the strip was sorted by
   * width the order half of that bites twice - the array IS the packing, so a
   * row moved by hand is a layout changed by hand.
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
    /*
     * Both halves of the gap sentence come out of ONE match, and that is the
     * repair the eighth topic forced. The count was read by a literal `with
     * six (\d+)px gaps` while the assertion two lines under it derived the
     * numeral from `REFERENCE_TOPICS.length` - so the file held the count
     * against the array and against the word "six" at the same time, and no
     * eighth topic could ever make both green. A test that cannot pass on a
     * legal edit is the same defect as one that cannot fail on an illegal one.
     */
    const NUMERAL = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const gaps = /with (\w+) (\d+)px gaps/.exec(prose('src/ui/gm/Reference.tsx'));
    expect(gaps, '`Reference.tsx` no longer counts the gaps between the chips').not.toBeNull();
    expect(
      gaps![1],
      `the docblock counts the gaps between ${REFERENCE_TOPICS.length} chips as ` +
        `"${gaps?.[1]}". A wrapped flex row has one fewer gap than chips, so it should read ` +
        `"${NUMERAL[REFERENCE_TOPICS.length - 1]}" - and every width in the sentence above wants ` +
        're-measuring with the topic that changed.',
    ).toBe(NUMERAL[REFERENCE_TOPICS.length - 1]);
    expect(
      Number.parseInt(gaps![2]!, 10),
      'the strip states a gap it no longer declares',
    ).toBe(stripGap());
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
   * THE COMBATANT CARD, WHICH IS THE FIRST NUMBER ON THIS SCREEN WRITTEN DOWN
   * AS A SUM AND SAID TO BE ONE.
   *
   * Everything else this file holds is a width, and a width can be checked
   * against a browser. The card's shut height cannot: it was measured at
   * "558.00" and "534.50" in Chrome BEFORE the fold, and nothing has been in
   * front of a browser since. So `Scene.tsx` states 471.00 as arithmetic over
   * nine terms, says in the same sentence that it is arithmetic, and this holds
   * every one of the nine against the declaration that makes it. The moment a
   * padding, a gap or a token moves, the sum goes red and somebody has to open
   * Chrome instead of editing the sentence.
   *
   * WHAT MAKES THE 471.00 WORTH ASSERTING AT ALL is the other half of the same
   * docblock: run over the card as it stood, the identical nine terms return
   * both of Chrome's figures to the half pixel. That is not checkable here -
   * the pre-fold card is gone - and it is not claimed here. What is claimed is
   * that the terms the sentence names are the terms the file declares.
   */
  it('costs the shut combatant card every term its own sentence names', () => {
    const said = says(
      SCENE,
      /\*\*The shut card is (\d+\.\d+) by declaration\*\*: (\d+) of `\.panel` border \+ (\d+) of the card's own `padding: (\d+)` \+ (\d+) of its five `gap: (\d+)` \+ (\d+) of header row \+ (\d+) of counters \+ (\d+) of threshold band \+ (\d+) of damage row \+ (\d+) of attack row \+ (\d+) of shut fold\./g,
      "the shut card's height and the nine terms it adds up",
    );
    // Named off the enumeration rather than read as `said[7]` nine lines
    // further down, because the failure this whole test exists to catch is a
    // term quietly costed against the wrong declaration.
    type Six = [number, number, number, number, number, number];
    const [total, border, padding, padDecl, gaps, gapDecl] = said as [...Six, ...number[]];
    const [header, counters, band, damage, attack, fold] = said.slice(6) as Six;

    expect(
      [gapDecl, padDecl],
      'the card no longer declares the `gap` and `padding` this sum spends five and two of. Every ' +
        'term below is measured inside them, so the whole sentence wants re-deriving.',
    ).toEqual(cardBox());
    expect(border, "the card's border is no longer twice `.panel`'s own").toBe(2 * panelBorder());
    expect(padding, "the card's padding is no longer twice what it declares").toBe(2 * padDecl);
    expect(
      gaps,
      'the shut card no longer has five gaps between six children, or the gap moved. Six is ' +
        'header, counters, band, damage row, attack row and fold - and it is six for a Minion ' +
        'group too, since the count moved into the band rather than taking a row.',
    ).toBe(5 * gapDecl);
    expect(
      header,
      'the header row is no longer the coarse floor SPOTLIGHT and the remove ✕ declare',
    ).toBe(resolve('var(--control)', PHONE));
    expect(
      counters,
      'the counters are no longer two `--counter-cell` rows and the grid gap between them. If ' +
        'the grid started fitting two tracks this term halves, and the card got 98px shorter ' +
        'without anybody measuring it.',
    ).toBe(2 * resolve('var(--counter-cell)', PHONE) + countersGrid()[1]!);
    expect(band, 'the threshold band is no longer its own padding around its own number').toBe(
      2 * bandPadY() + bandNum(),
    );
    expect(damage, "the damage row is no longer APPLY's flat `var(--tap)` floor").toBe(
      resolve('var(--tap)', PHONE),
    );
    const [attackGap, attackBorder, attackPadTop] = attackRow() as [number, number, number];
    expect(
      attack,
      'the attack row is no longer its border, its top padding, the bonus, its wrap gap and the ' +
        '`.t-meta` range line that `width: 100%` puts on a second line',
    ).toBe(attackBorder + attackPadTop + attackBonus() + attackGap + roleSize('t-meta'));
    expect(fold, "the shut fold is no longer `Fold`'s own `var(--tap)` header").toBe(
      resolve('var(--tap)', PHONE),
    );
    expect(total, 'the shut card is no longer the sum of the nine terms beside it').toBe(
      border + padding + gaps + header + counters + band + damage + attack + fold,
    );

    /*
     * The measured panel, and the two arithmetic claims made against it. 498 is
     * a rect out of Chrome and stays one; what is held is that the docblock's
     * own margin and its own two-card refusal are that rect against the sum.
     */
    const room = says(
      SCENE,
      /(\d+\.\d+) against the (\d+) the panel scrolls, which is the goal this lane was given, with (\d+\.\d+) left over\./g,
      'the margin the shut card leaves in the panel',
    );
    expect(room[0], 'the margin sentence no longer measures the same shut card').toBe(total);
    expect(room[2], 'the margin is no longer the panel less the shut card').toBe(room[1]! - total);

    const two = says(
      SCENE,
      /2 x (\d+\.\d+) plus the grid's (\d+)px gap is (\d+\.\d+) against (\d+)\./g,
      'the two-card refusal',
    );
    expect(two[0], 'the two-card refusal no longer costs the same shut card').toBe(total);
    expect(two[1], "the cards grid no longer declares the gap this sentence puts between them").toBe(
      declared(SCENE, 'gridTemplateColumns: phone ?', 'gap'),
    );
    expect(two[2], 'two cards and a gap are no longer what this sentence adds them to').toBe(
      2 * total + two[1]!,
    );
    expect(two[3], 'the two-card refusal measures against a panel the margin sentence does not').toBe(
      room[1],
    );

    /*
     * The pre-existing half, which is the reason this was a fold and not a
     * revert: the damage field's own row plus the card's gap is the 54 that
     * took a 6px overflow to 60. Both retired heights are quoted records, so
     * `claims()` cannot see them; `prose()` can, and this is the one place that
     * checks the record is still arithmetic and not a remembered number.
     */
    const before = says(
      SCENE,
      /the card measured "(\d+\.\d+)", which was already (\d+)px past the panel\. The field and the card's gap above it added (\d+) and took the overflow from (\d+) to (\d+)\./g,
      'what the damage field added to a card that was already over',
    );
    expect(before[2], 'the damage field and the gap above it no longer add up to what is stated').toBe(
      resolve('var(--tap)', PHONE) + gapDecl,
    );
    expect(before[3], 'the record disagrees with itself about the overflow before the field').toBe(
      before[1],
    );
    expect(before[4], 'the overflow after the field is no longer the one before it plus the row').toBe(
      before[1]! + before[2]!,
    );
    expect(before[0], 'the retired pre-field height is no longer the panel plus its own overflow').toBe(
      room[1]! + before[1]!,
    );
  });

  /*
   * The single largest term on that card, and the one a reader will disbelieve:
   * two counters cost 188 and not 90, because the grid cannot fit two tracks in
   * the column the card leaves. Held as the premise rather than as the 188,
   * because the 188 is a consequence and the premise is what would move.
   */
  it('states the column that makes the card stack its two counters', () => {
    const said = says(
      SCENE,
      /is `repeat\(auto-fit, minmax\((\d+)px, 1fr\)\)` with `gap: (\d+)` in a (\d+)px column, and two (\d+)px tracks plus that gap want (\d+)\./g,
      'the counters grid and the column it cannot fit two tracks in',
    );
    expect(
      [said[0], said[1]],
      'the counters grid no longer declares the track floor and gap this sentence reads',
    ).toEqual(countersGrid());
    expect(
      said[2],
      "the card's inner column is no longer the glass less the sheet's border, the region's " +
        "padding, the card's two borders and its own padding. Every character budget in this " +
        'file and the line count of the motives are measured in it.',
    ).toBe(
      PHONE.glass -
        2 * sheetBorder() -
        2 * regionPadX(SCENE, 'minHeight: 0, gap: 10, padding: phone ?') -
        (cardLeftBorder() + panelBorder()) -
        2 * cardBox()[1]!,
    );
    expect(said[3], 'the sentence names a track width the grid does not declare').toBe(said[0]);
    expect(said[4], 'two tracks and the gap are no longer what this sentence adds them to').toBe(
      2 * said[0]! + said[1]!,
    );
    expect(
      said[4]! > said[2]!,
      'two tracks now FIT the column, so `auto-fit` gives the card one row of counters instead ' +
        'of two and the shut card is 98px shorter than its own docblock says. That is the good ' +
        'direction and it still wants measuring rather than editing.',
    ).toBe(true);
  });

  /*
   * THE ONE CARD THE OWNER MOVED A CONTROL FOR, AND THE ONE FIGURE HERE THAT
   * CHROME HAS NOT SEEN.
   *
   * A Minion group used to draw the count on a row of its own and land at
   * "541.00", 43 past the panel. The count is in the band now, so the whole of
   * the difference from an ordinary card is the band's two arms - 8 + 15 + 8
   * read-only against a flat 44 with the control in it - and that difference is
   * 13. Every term of that is a declaration, which is the only reason a number
   * nobody has measured is allowed to be written down at all.
   *
   * The 471.00 it is added to had been measured when this was written and the
   * 484.00 had not, and the wager was stated here: if the rig came back with
   * anything but 484.00, the arithmetic was wrong and not the browser. It came
   * back with 484.00, on 2026-08-26, on all four cards of a seeded group of
   * Giant Rats. This assertion is therefore no longer holding an unmeasured
   * figure honest - it is holding a measured one to the terms it is made of, so
   * that a term moving under it goes red here rather than silently.
   */
  it("costs the Minion group its band arm, and nothing else on the card", () => {
    const said = says(
      SCENE,
      /A Minion group's band is the other arm: `padding: '(\d+) (\d+)px'` around the flat (\d+) its `−` and `\+` declare, where an ordinary card's is (\d+) \+ (\d+) \+ (\d+)\. So the band grows by (\d+) and nothing else on the card moves: \*\*a Minion group's shut card is (\d+\.\d+) by the same declarations, (\d+\.\d+) inside the panel\.\*\*/g,
      "the Minion group's shut card and the band arm it is made of",
    );
    const pad = bandPad();
    expect(
      [said[0], said[1]],
      'the band no longer declares this padding on the arm that carries the Minion count. A ' +
        'vertical padding here would put the 44px target inside decoration and take the card ' +
        'straight back over the panel.',
    ).toEqual([pad[2], pad[3]]);
    expect(
      said[2],
      "the band's Minion `−` no longer declares the flat floor this sentence reads. It is the " +
        "band's whole height on that arm, so a floor set in a token or a class is a height " +
        'nothing here can check.',
    ).toBe(minionStep()[1]);
    expect(
      [said[3], said[5]],
      "the read-only arm's vertical padding moved, so the 13 the band grows by is stale",
    ).toEqual([bandPadY(), bandPadY()]);
    expect(said[4], 'the band no longer draws its numbers at the size this sentence reads').toBe(
      bandNum(),
    );
    expect(said[6], 'the band arm no longer grows by the difference between its own two arms').toBe(
      said[2]! - (said[3]! + said[4]! + said[5]!),
    );
    const ordinary = stated(SCENE, /\*\*The shut card is (\d+\.\d+) by declaration\*\*/g)[0]!;
    const panel = stated(SCENE, /the scrollable panel is (\d+)px/g)[0]!;
    expect(said[7], "a Minion group's shut card is no longer the ordinary one plus that arm").toBe(
      ordinary + said[6]!,
    );
    expect(
      said[8],
      'the room a Minion group leaves is no longer that card against the measured panel',
    ).toBe(panel - said[7]!);
    expect(
      said[7]! < panel,
      "a Minion group's shut card is over the panel again. Say the figure in the docblock rather " +
        'than deleting this assertion - a card that overflows in silence is the defect this ' +
        'whole corner of the file exists for.',
    ).toBe(true);
  });

  /*
   * The Minion stepper's two buttons, held at the floor rather than at a token.
   * `Stepper` in `Encounter.tsx` draws the same shape at `var(--control)`, which
   * is 34 on a fine pointer; the band's copy is a flat 44 for END SCENE's stated
   * reason, and the band's height is that number.
   */
  it('keeps the band\'s Minion stepper at the touch floor, in both axes', () => {
    const [width, floor] = minionStep() as [number, number];
    const tap = resolve('var(--tap)', PHONE);
    expect(
      [width, floor],
      "the band's Minion stepper went under the touch floor. Height is also the band's height " +
        'here, so shrinking it is how a card gets shorter by making a target smaller.',
    ).toEqual([tap, tap]);
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
   *
   * The name over this scan is scoped to the array under it. It read "no file
   * in `src` or `tests` has gone back to ..." and the array is twelve named
   * files - "ten" when that sentence was written, plus `Scene.tsx` and
   * `sceneTruth.test.tsx`, which the card's retired heights brought in -
   * which is the same overstatement the header of this file already retired
   * under "How wide the sweep behind this file actually is" - a claim about the
   * tree standing in for a claim about a list. It was repaired in the prose and
   * left in the test name, which is the half a reader actually sees, because it
   * is what vitest prints. The two sibling scans were already honest: "no file
   * behind these alerts" and "every file that costs the licence notice".
   */
  it.each([
    // Emphasis and the optional `shut`, because that is how this corner writes
    // a row count: `SessionList.tsx` states `**Eight rows are whole on the
    // glass**` and `**ten** shut rows whole`, so a regression is likelier to
    // read `**nine** shut rows` than the bare `nine rows` the literal saw -
    // planted, it walked straight past. Same shape as the eight/nine/ten
    // agreement check above, deliberately. It stays bound to the noun:
    // `SessionList.tsx` also says `nine with a countdown pinned` and `it is
    // not nine minus one`, both correct and both unquoted, and a scan for a
    // bare `nine` would retire two right sentences.
    ['nine rows', /\*{0,2}nine\*{0,2} (?:shut )?rows/i],
    // These three are retired MEASUREMENTS, so the figure is most of the claim
    // and the words around it are costume: `551px of list`, `551 px`, `551.00`
    // and `852 − 301 = 551` are one sentence four ways, and the two literals
    // here saw one apiece. Planted, `551 px of list` and a plain `301 of pinned
    // chrome` both came back green.
    //
    // 301 and 660 are therefore scanned bare, which is as wide as a pattern
    // gets: neither figure occurs anywhere in these ten files, so any unquoted
    // one is the regression. 551 is NOT, and the difference is measured rather
    // than assumed - the bare `\b551(?!\d)` was tried and goes red on `Gm.tsx`,
    // which records the retired figure a second time outside its own quotes
    // ("551 missed the three hairlines on the pinned chrome"). That sentence is
    // right, and rewriting a right sentence to make a scan green is a defect of
    // its own, so this row holds the spellings that state 551 AS A LENGTH and
    // lets the record stand. 60 could never be bare either - it is live here,
    // `GmBar` is 60px of buttons - which is what the six spellings below are
    // for; nor could the 369 in the last row's name, because `Reference.tsx`
    // says `the column was taken as 393 − 24 = 369 rather than the 391 − 24 =
    // 367.00`, unquoted and rightly.
    //
    // `(?!\d)` and not `\b`: there is no word boundary between `1` and `p`, so
    // `\b551\b` would miss `551px`, the one spelling this row began with.
    ['551px of list', /\b551 ?px|\b551\.00|\b551 of list|(?:=|is) 551(?!\d)/],
    ['301 of pinned chrome', /\b301(?!\d)/],
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
    // The declaration and the two prose forms of the same claim. `ROW_STEP =
    // 60` is only how `useSessionDrag.ts` would say it; `sessionDrag.test.tsx`
    // says `` `ROW_STEP` is 62 `` in prose, and `SessionRow.tsx` names the
    // symbol rather than the number ("half a `ROW_STEP` of accurate travel"),
    // so the regression those two would carry reads `` `ROW_STEP` is 60 `` or
    // `expect(ROW_STEP).toBe(60)`. Planted, the literal saw neither.
    ['a 60px drag step', /ROW_STEP`?(?: is| =|:) ?60(?!\d)|ROW_STEP\)\.toBe\(60(?!\d)/],
    // `Reference.tsx` now says the strip "takes **three** rows" where it once
    // said it "wraps to" them, and the pair of literals that replaced the first
    // literal was the same mistake one size up: it saw those two exact
    // spellings and nothing else. Rewriting the guarded sentence to `takes two
    // rows`, to `wraps to **two** rows` or to `the strip is two rows` each left
    // this file at 48 passed - dropping two asterisks was enough to walk past
    // it. A verb alternation with the emphasis optional is the width the
    // sentence class actually has, and it is the `a 60px step` row above taken
    // as precedent rather than a new idea.
    //
    // The digit spelling is deliberately NOT here. `Reference.tsx`'s four-
    // orders table states measured alternatives as `2 rows, 94.00`, unquoted
    // and correct, and so does the prose that reads it; a pattern that saw `2
    // rows` would retire a measurement rather than a claim. `at two rows` is
    // out for the same reason: `costed the seven that then shipped at two rows
    // and 94px` is that file's record of the estimate it disproved, and `at` is
    // not one of the verbs below.
    ['a two-row topic strip', /(wraps to|takes|is|becomes|breaks into) \*{0,2}two\*{0,2} rows/],
    // Bare, for the reason given above the 551: `660px against` walked past
    // `/660 against/` when it was planted, and the 369 in this row's name is
    // deliberately not part of the pattern.
    ['660 against a 369px column', /\b660(?!\d)/],
    // The three heights the fold retired, and the card is in the array below so
    // that this row has somewhere to look. All three are Chrome rects of a card
    // that no longer exists: "558.00" and "534.50" are the Acid Burrower and
    // the Bear before the fold, "504.00" is the same card before the damage
    // field. `Scene.tsx` keeps all three inside double quotes, where they are
    // the record that makes the fold a fix rather than a preference - the 504
    // in particular is the whole proof the defect predates the field it was
    // found on - and where `claims()` cannot see them.
    //
    // Bare, and for the 301 and 660 rows' stated reason rather than by
    // analogy: none of the three digits occurs anywhere in the twelve files
    // this scan reads, so an unquoted one is the regression and there is no
    // right sentence for a wider pattern to retire. The half pixel is left off
    // `534` on purpose - a regression is as likely to write `534` or `534px`
    // as `534.50`, and 534 is no more live in these files than 534.50 is.
    ['the card heights the fold retired', /\b558(?!\d)|\b534(?!\d)|\b504(?!\d)/],
  ])('no file this scan lists has gone back to %s', (_what, pattern) => {
    const files = [
      'src/ui/gm/SessionList.tsx',
      'src/ui/gm/SessionRow.tsx',
      'src/ui/gm/Reference.tsx',
      'src/ui/gm/Gm.tsx',
      'src/ui/gm/GmTopBar.tsx',
      'src/ui/shell/App.tsx',
      'src/ui/gm/useSessionDrag.ts',
      'src/ui/gm/Scene.tsx',
      'tests/gm/sceneTruth.test.tsx',
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
   * The 0.3px, which is the only margin the SHOW empty state has and which
   * nobody chose.
   *
   * `ShowSheet.tsx` says the column comes to 294.0 in a 294.3 window and calls
   * that "a coincidence and not a margin" in its own words. A coincidence with
   * nothing under it is one the next padding change spends in silence: the
   * state does not overflow today, so no test goes red, and the third door
   * simply loses a hair to a scroller the panel now has - which is exactly the
   * failure the empty state was rebuilt to end, when three doors with their
   * descriptions overflowed it by 138px.
   *
   * The 294.3 is Chrome's and stays in the docblock, because a reading window
   * is measured and not declared. Everything on the near side of it is
   * declared in this very file, so that is what is held here: two chip rows
   * and the grid gap between them, the scroller's own gap, and the door floor
   * paid three times. Move any one of them by a pixel and this fails by name.
   *
   * The margin itself is asserted separately and last. It is the claim the
   * owner asked for - `DECISIONI-2026-08-25.md` section 13 - and it needs its
   * own line because the two numbers could both drift and still keep their
   * difference, which would leave the sentence true and the layout wrong.
   */
  it('holds the 0.3px the SHOW empty state fits by, and every term on its near side', () => {
    const SHOW = 'src/ui/gm/ShowSheet.tsx';
    const chipRow = only(SHOW, /minHeight: (\d+),\s*padding: '0 4px'/g, 'the moment chip floor');
    const gridGap = only(
      SHOW,
      /gridTemplateColumns: 'repeat\(3, 1fr\)',\s*gap: (\d+),/g,
      "the moment grid's gap",
    );
    const scrollGap = only(
      SHOW,
      /className="scroll stack"[\s\S]{0,80}?gap: (\d+), padding:/g,
      "the sheet scroller's gap",
    );
    const doorFloor = only(
      SHOW,
      /className="panel stack"[\s\S]{0,160}?minHeight: (\d+),/g,
      'the door floor',
    );

    // Two rows and one gap. The row count is the browser's - six chips over
    // three columns - and stays in the prose; the two lengths are declared.
    const grid = 2 * chipRow + gridGap;
    // Three doors, with the scroller's own gap standing between them.
    const doors = 3 * doorFloor + 2 * scrollGap;

    expect(
      stated(SHOW, /with one (\d+)px gap is \*\*\d+\*\*/g),
      'the docblock names a grid gap the moment grid no longer declares',
    ).toEqual([gridGap]);
    expect(
      stated(SHOW, /with one \d+px gap is \*\*(\d+)\*\*/g),
      'the chip grid is no longer two rows of the chip floor plus the gap the grid declares, ' +
        'so the 294.0 below is stale. Re-measure the empty state.',
    ).toEqual([grid]);
    expect(
      stated(SHOW, /them with their gaps come to \*\*(\d+)\*\*/g),
      'the three doors are no longer three door floors and two of the scroller gap. This is ' +
        'the largest of the three terms - re-measure before touching anything else.',
    ).toEqual([doors]);

    const sum = says(
      SHOW,
      /comes to (\d+) \+ (\d+) \+ (\d+) = \*\*(\d+\.\d)\*\* in a \*\*(\d+\.\d)\*\* window/g,
      "the SHOW empty state's column",
    );
    const [statedGrid, statedGap, statedDoors, column, window] = sum as [
      number,
      number,
      number,
      number,
      number,
    ];

    expect([statedGrid, statedGap, statedDoors], 'the sum names terms this file no longer declares')
      .toEqual([grid, scrollGap, doors]);
    expect(column, 'the stated column is not the sum of the three terms stated beside it').toBe(
      grid + scrollGap + doors,
    );

    // The window is stated twice - once where it is derived from the reading
    // window and the padding, once in the sum - and two copies of a measured
    // number are a place for them to drift. The derivation is held to its own
    // terms as well, so a re-measured window has to move all three together.
    const measured = says(
      SHOW,
      /reading window is \*\*(\d+\.\d)\*\*; it pays \*\*(\d+)\*\* of padding above its first child, so \*\*(\d+\.\d)\*\* is what the column has/g,
      "the SHOW scroller's reading window",
    );
    const [reading, padTop, has] = measured as [number, number, number];
    expect(has, 'the window is no longer the reading window less the padding it states').toBe(
      Number((reading - padTop).toFixed(1)),
    );
    expect(
      padTop,
      'the docblock states a top padding the scroller no longer declares',
    ).toBe(only(SHOW, /className="scroll stack"[\s\S]{0,80}?padding: '(\d+)px/g, "the scroller's padding"));
    expect(has, 'the two statements of the window disagree with each other').toBe(window);

    // The margin, which is the whole point. Stated, and then checked against
    // the two numbers that are supposed to make it, so that a sentence saying
    // 0.3 over a column that no longer leaves 0.3 fails here rather than in a
    // GM's hands.
    expect(
      stated(SHOW, /That fits by \*\*(\d+\.\d)px\*\*/g),
      'the empty state no longer states what it fits by',
    ).toEqual([Number((window - column).toFixed(1))]);
    expect(
      column,
      'the SHOW empty state column has grown past the window it was measured in, so the third ' +
        'door is under the scroller edge. There is give in the door floor - 56 against a 44px ' +
        'tap floor - and the docblock says to spend it there rather than on the chips.',
    ).toBeLessThanOrEqual(window);
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
   *
   * Named for the two guards it reads and not for "each screen", which is what
   * stood here and was the same shape as the scan name above it:
   * `tests/ui/playSheet.test.tsx` declares a third `const COLUMN`, at 369 for
   * the player sheet, and this test has never opened it. That one is outside
   * this describe's remit - the GM screen - which is a reason to scope the name
   * rather than to widen the scan.
   */
  it('gives the reference and session-list guards the column each container leaves', () => {
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
   *
   * The 329 row is a bare number and not the `/\b329\b/` that stood here,
   * which could not match the sentence it guards: `9` and `p` are both word
   * characters, so `\b` never asserts between them and `329px` slipped
   * through. It was blind to the one wording the retired claim actually has -
   * it saw only the bare `"329"` two sentences further down the same docblock.
   * Established rather than argued: the retired sentence was restored unquoted
   * into `CampaignNotSaved.tsx` and this file ran 48/48 green, and after the
   * boundaries came off the same edit turned this row red. Its two siblings
   * never carried a boundary, which is why they bite.
   */
  it.each([
    ['a 365px sheet column', /365/],
    ['a 345px notice column', /345/],
    ['a 329px alert column', /329/],
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

  /*
   * The space is in the pattern for the reason the `a 60px step` row above
   * gives: this repo writes `60 px a step` as readily as `60px`, and `/111px/`
   * could not see the spaced one. `at 111` and `is 111` are here because the
   * estimate is quotable without its unit. Bare is not an option, unlike the
   * 329 in the alert scan above: after `claims()` the nine files still hold
   * three honest 111s - `Wizard.tsx`'s `111-285 on each of the eighteen
   * ancestries` and its `+111 over nine`, and `Cards.tsx`'s
   * `elementFromPoint(111, 303)` - so a bare figure would retire three
   * sentences that were never about this strip.
   */
  it.each(NOTICE)('%s has not gone back to the retired ~111px strip', (file) => {
    expect(
      /111 ?px|(?:at|is) 111(?!\d)/.test(claims(file)),
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

/* ---------------------------------------------------------------------------
 * The containers these four docblocks subtract through. Every one is read out
 * of `code()`, so a docblock quoting a declaration cannot be mistaken for it.
 * ------------------------------------------------------------------------ */

const PARTS = 'src/ui/settings/parts.tsx';
const SETTINGS = 'src/ui/settings/Settings.tsx';
const ABOUT = 'src/ui/settings/About.tsx';
const CONDITIONS = 'src/ui/player/Conditions.tsx';
const ROW = 'src/ui/gm/SessionRow.tsx';

/** The 12px either side the settings scroller pads a phone with. */
const settingsPadX = (): number =>
  only(
    SETTINGS,
    /className="scroll"[\s\S]{0,300}?padding: phone \? '\d+px (\d+)px \d+px'/g,
    "the settings scroller's phone padding",
  );

/** `Rows`' own border, which is the container both corrected screens skipped. */
const rowsBorder = (): number =>
  only(PARTS, /export function Rows\([\s\S]*?border: '(\d+)px solid/g, "`Rows`' border");

/** The 14px either side `Field` pads every settings row with. */
const fieldPadX = (): number =>
  only(PARTS, /padding: '\d+px (\d+)px' \}\}>/g, "`Field`'s padding");

/** The gap of the flex line `Field` draws between its text block and its controls. */
const fieldGap = (): number =>
  only(PARTS, /justifyContent: 'space-between',\s*gap: (\d+),/g, "the gap of `Field`'s flex line");

/** The text block's flex basis, which is what decides whether a row wraps. */
const fieldBasis = (): number =>
  only(PARTS, /flex: '1 1 (\d+)px'/g, "the text block's flex basis");

/** The `ch` cap on the hint - a declaration, and not a count of characters. */
const hintCap = (): number =>
  only(
    PARTS,
    /className="t-dense" style=\{\{ marginTop: \d+, maxWidth: '(\d+)ch' \}\}/g,
    "the hint's `ch` cap",
  );

/** `Switch`'s gap and its two horizontal paddings, in that order. */
const switchBox = (): number[] =>
  decl(
    PARTS,
    /minHeight: 'var\(--tap\)',\s*gap: (\d+),\s*padding: '0 (\d+)px 0 (\d+)px'/g,
    "`Switch`'s gap and padding",
  );

/** The ON/OFF span's declared width. */
const switchSpan = (): number =>
  only(
    PARTS,
    /className="t-meta"\s*style=\{\{ width: (\d+), textAlign: 'right'/g,
    "the ON/OFF span's width",
  );

/** The pill's declared width. */
const switchPill = (): number =>
  only(PARTS, /width: (\d+),\s*height: \d+,\s*borderRadius: \d+,\s*background: checked/g, "the pill's width");

/** What the whole control block spends, which is the figure that read 78. */
const switchWidth = (): number => {
  const box = switchBox();
  return box[2]! + switchSpan() + box[0]! + switchPill() + box[1]!;
};

/**
 * The border `base.css` gives a bare `button`, which is what makes the 88 a sum
 * of five terms and not of seven.
 */
const buttonBorder = (): number => {
  const css = source('src/ui/base.css');
  const at = css.indexOf('button {');
  if (at === -1) throw new Error('`base.css` no longer declares a bare `button` block');
  const found = /border: (\d+);/.exec(css.slice(at, at + 300));
  if (found === null) {
    throw new Error(
      '`base.css` no longer zeroes a `button` border. Every switch on the settings screen then ' +
        'carries one inside its own box, and the control block is wider than the 88 the ' +
        'docblock states - re-measure the row rather than editing the sum.',
    );
  }
  return Number.parseInt(found[1]!, 10);
};

/** The 12px either side the conditions overlay pads, inside the safe area. */
const overlayPadX = (): number =>
  only(
    CONDITIONS,
    /padding: 'max\(\d+px, env\(safe-area-inset-top\)\) (\d+)px max\(/g,
    "the overlay's horizontal padding",
  );

/** The dialog's own border - the pixel the retired 337 counted as nothing. */
const dialogBorder = (): number =>
  only(
    CONDITIONS,
    /border: '(\d+)px solid var\(--line\)',\s*borderTop: '\d+px solid var\(--line\)'/g,
    "the dialog's border",
  );

/** The conditions footer's horizontal padding. */
const footerPadX = (): number =>
  only(
    CONDITIONS,
    /padding: '\d+px (\d+)px \d+px',\s*borderTop: '1px solid var\(--line-soft\)'/g,
    "the footer's horizontal padding",
  );

/** The horizontal padding on the dialog's own scroller. */
const dialogScrollPadX = (): number =>
  only(
    CONDITIONS,
    /className="scroll stack"[^>]*?padding: '0 (\d+)px \d+px'/g,
    "the dialog scroller's horizontal padding",
  );

/** A condition card's horizontal padding. */
const cardPadX = (): number =>
  only(
    CONDITIONS,
    /padding: '\d+px (\d+)px',\s*borderRadius: 'var\(--r3\)',\s*background: 'var\(--app\)'/g,
    "the condition card's horizontal padding",
  );

/** A condition card's own border, which the retired enumeration was short of. */
const cardBorder = (): number =>
  only(CONDITIONS, /background: 'var\(--app\)',\s*border: `(\d+)px \$\{/g, "the condition card's border");

/** The 12px either side the session list pads a phone with. */
const listPadX = (): number =>
  only(
    'src/ui/gm/SessionList.tsx',
    /className="scroll stack"[\s\S]{0,200}?padding: phone \? '\d+px (\d+)px \d+px'/g,
    "the list scroller's phone padding",
  );

/** The kind stripe down the left edge of a session row. */
const rowStripe = (): number =>
  only(ROW, /borderLeft: `(\d+)px solid \$\{SESSION_KIND_COLOR/g, "the row's kind stripe");

/** The row's horizontal padding, off the same declaration `rowPadY` reads. */
const rowPadX = (): number =>
  only(ROW, /padding: '\d+px (\d+)px',\s*gap: open/g, "the row's horizontal padding");

/** The open block's horizontal padding, the innermost term of the footer column. */
const openPadX = (): number =>
  only(ROW, /gap: \d+, padding: '\d+px (\d+)px \d+px' \}\}>/g, "the open block's horizontal padding");

/**
 * THE FOUR FILES THAT STATED A WIDTH AND SKIPPED A CONTAINER.
 *
 * Its own `describe` and not the GM one above, for the reason the licence
 * notice has its own: the claim is not a screen. Four docblocks stated a width
 * as a subtraction and each dropped a container out of the middle of it - a
 * border, a padding, or both - and each corrected figure is held here against
 * the containers rather than against itself. There is no table of expected
 * numbers here either.
 *
 * WHAT IS HELD is every term a sentence names and the sum it makes of them, so
 * a padding that moves turns the docblock red instead of turning it stale.
 *
 * WHAT IS NOT HELD, and naming them is the point rather than an apology:
 * `About.tsx`'s 194 and 341, and the 130.8, 47.6, 112.6, 128.5 and 15.87 in
 * the same list; `Conditions.tsx`'s 96.88 for `VULNERABLE` and the 42.81 the
 * card's own docblock derives from a font advance. Those are Chrome at a named
 * viewport with the shipped faces. 194 is what 339 less that 130.8 button and
 * the 14px gap leaves, rounded off a `.2`; nothing this file can read produces
 * 341 at all, which is what a `ch` cap measured in a real font looks like from
 * here. jsdom has no layout engine, so an assertion over any of them would be
 * checking this file's own arithmetic. They stay in the docblocks with their
 * viewport beside them, which is this file's rule from its first paragraph,
 * and they are listed here so the silence around them is not read as coverage.
 * Where one sentence mixes the two kinds - `130.8 + 14 + 180 = 324.8` - the
 * two declared terms are held, the sum is held against what it adds, and the
 * browser figure is taken as written.
 */
describe('the four widths that skipped a container state the containers instead', () => {
  /*
   * The session-row footer, which is the deepest chain of the four: page
   * padding, stripe, panel border, row padding, open block. The correction
   * this round made to it was one word - "either side" on the open block's 2px
   * - and a word is exactly the kind of edit that never goes red on its own.
   */
  it('costs the session-row footer every container between it and the glass', () => {
    const said = says(
      ROW,
      /inside the (\d+)px this footer has - (\d+) less the list's (\d+)px page padding either side, less the panel's (\d+)px stripe and (\d+)px border and (\d+)px padding either side, less the open block's (\d+)px either side/g,
      'the footer column and the five containers it subtracts',
    );
    expect(
      said[1],
      'the footer sentence measures from a glass width this suite does not know. Every verb ' +
        'width beside it was measured at `PHONE.glass`.',
    ).toBe(PHONE.glass);
    expect(
      said.slice(2),
      'the footer sentence names a page padding, a stripe, a panel border, a row padding or an ' +
        'open-block padding that is no longer declared. The four verb widths beside it were ' +
        'measured inside this column - re-measure the row rather than editing the subtraction.',
    ).toEqual([listPadX(), rowStripe(), panelBorder(), rowPadX(), openPadX()]);
    expect(
      said[0],
      'the footer column is no longer what its own five terms take off the glass',
    ).toBe(
      PHONE.glass - 2 * listPadX() - rowStripe() - panelBorder() - 2 * rowPadX() - 2 * openPadX(),
    );
    /*
     * The armed footer spends the same column twenty lines further down, and
     * two copies of one figure in one file is the defect the header of this
     * file names. Held to each other rather than to a number.
     */
    const armed = says(ROW, /= (\d+) of (\d+), so arming the row/g, "the armed footer's column");
    // The armed row's own total, which decision 18 pushed over the column: the
    // fight wording is 223 where the old one was 153, so the two move verbs
    // leave beside RENAME and the armed footer is one button in every case.
    expect(
      armed[0],
      'the armed footer no longer states a total that overflows its own column, so the rule ' +
        'that empties it has lost the measurement it rests on',
    ).toBeGreaterThan(armed[1]!);
    expect(
      armed[1],
      'the armed footer and the resting footer state different columns. They are one claim said ' +
        'twice - re-measure and change both.',
    ).toBe(said[0]);
  });

  /*
   * The drag handle, where the defect was a mixed frame rather than a missing
   * term: x309-353 was measured from the panel's content box while every other
   * `x` in this repo is measured from the glass. What is holdable is the 21px
   * that converts one to the other, and that the range beside it is what the
   * conversion produces.
   *
   * The 309 and the 353 it converts are NOT held, and that is this file's
   * header taken at its word rather than an omission: it argues that a second
   * copy of `SessionRow.tsx`'s 353 here is the defect this file exists for.
   * They are not left bare either - every term 353 is made of is held by the
   * footer test above, which subtracts through the same page padding, stripe,
   * panel border and row padding on its way to 349. Move any of them and that
   * test goes red next to these two numbers.
   */
  it('puts the drag handle on the glass, with the offset on the declarations', () => {
    const glass = says(ROW, /\*\*x(\d+)-(\d+) on the glass of a 393px phone\*\*/g, "the handle's glass range");
    const said = says(
      ROW,
      /content box starts (\d+)px in - the (\d+)px either side of the list scroller's phone padding in `SessionList\.tsx`, this row's own `borderLeft: (\d+)px solid` stripe and the (\d+)px either side of its `padding: '4px 6px'` - so (\d+) \+ (\d+) = (\d+) and (\d+) \+ (\d+) = (\d+)/g,
      'the panel inset and the two conversions off it',
    );
    expect(
      said.slice(1, 4),
      'the inset names a page padding, a stripe or a row padding that is no longer declared',
    ).toEqual([listPadX(), rowStripe(), rowPadX()]);
    expect(
      said[0],
      "the panel's content box no longer starts where the list's padding, this row's stripe and " +
        'its own padding put it',
    ).toBe(listPadX() + rowStripe() + rowPadX());
    expect(
      [said[4], said[7]],
      'the two conversions no longer add the inset the sentence has just derived',
    ).toEqual([said[0], said[0]]);
    expect(
      [said[4]! + said[5]!, said[7]! + said[8]!],
      'the arithmetic in the parenthesis does not make the two numbers it states',
    ).toEqual([said[6], said[9]]);
    expect(
      glass,
      'the handle range on the glass is no longer what the conversion beside it produces, which ' +
        'is the two frames mixed again - the defect that parenthesis exists to record.',
    ).toEqual([said[6], said[9]]);
  });

  /*
   * The conditions footer. 337 counted the dialog's border as nothing, and the
   * file had already recorded the answer thirty-five lines above as a measured
   * rect - so the derivation and the measurement are held to each other here
   * as well as to the declarations.
   */
  it('costs the conditions footer the overlay, the dialog border and its own padding', () => {
    const said = says(
      CONDITIONS,
      /column is (\d+)px wide - (\d+) less the (\d+)px either side of the overlay's .*?, less the (\d+)px either side of the dialog's .*?, less the (\d+)px either side of the footer's own/g,
      'the footer column and the three containers it subtracts',
    );
    expect(said[1], 'the footer sentence measures from a glass width this suite does not know').toBe(
      PHONE.glass,
    );
    expect(
      said.slice(2),
      "the footer sentence names an overlay padding, a dialog border or a footer padding that is " +
        'no longer declared. The 98px tab pitch it is compared against does not move, so this ' +
        'is the half of the comparison that has to be re-derived.',
    ).toEqual([overlayPadX(), dialogBorder(), footerPadX()]);
    expect(
      said[0],
      'the conditions footer column is no longer what its own three terms take off the glass',
    ).toBe(PHONE.glass - 2 * overlayPadX() - 2 * dialogBorder() - 2 * footerPadX());
    const armed = says(
      CONDITIONS,
      /recorded under `Where the commit is instead, measured armed in Chrome` as `(\d+)x44 at x(\d+)-(\d+)`, and \d+ - \d+ is (\d+)/g,
      'the measured armed rect the correction was checked against',
    );
    expect(
      [armed[0], armed[2]! - armed[1]!, armed[3]],
      'the rect this file measured in Chrome and the column its declarations derive no longer ' +
        'agree. One of the two is stale, and the browser is the one that decides which.',
    ).toEqual([said[0], said[0], said[0]]);
  });

  /*
   * The condition card, two containers deeper than the footer. Its 311 was
   * right and its enumeration was one term short - the card's own border - so
   * what is held is the enumeration, not just the total.
   */
  it('enumerates every container between a condition card and the glass', () => {
    const said = says(
      CONDITIONS,
      /card's content box is (\d+)px \((\d+) of dialog.*?the (\d+) less the (\d+)px either side of the overlay's.*?less the (\d+)px either side of the dialog's.*?less the (\d+)px either side of the scroll's.*?less the (\d+)px either side of the card's own `padding.*?less the (\d+)px either side of the card's own `border`\)/g,
      "the card's content box and the five containers it subtracts",
    );
    expect(said[2], 'the card sentence measures from a glass width this suite does not know').toBe(
      PHONE.glass,
    );
    expect(
      said.slice(3),
      "the card sentence names an overlay padding, a dialog border, a scroller padding, a card " +
        "padding or a card border that is no longer declared. `VULNERABLE` at 96.88 and the 44px " +
        'floor beside it were measured in this box.',
    ).toEqual([overlayPadX(), dialogBorder(), dialogScrollPadX(), cardPadX(), cardBorder()]);
    expect(
      said[1],
      "the dialog's outer width is no longer the glass less the overlay's padding",
    ).toBe(PHONE.glass - 2 * overlayPadX());
    expect(
      said[0],
      "the card's content box is no longer what its own five terms leave",
    ).toBe(
      PHONE.glass -
        2 * overlayPadX() -
        2 * dialogBorder() -
        2 * dialogScrollPadX() -
        2 * cardPadX() -
        2 * cardBorder(),
    );
  });

  /*
   * The GM-tools switch row, which is the one that skipped two containers at
   * once and then spent the difference twice. Held term by term, because the
   * two numbers that were wrong - 78 and 277 - were each wrong by a different
   * missing term and a total would have hidden that.
   */
  it('spends the settings column through `Rows`, `Field` and `Switch`', () => {
    const column = says(
      SETTINGS,
      /settings column is (\d+) − (\d+) = (\d+) - the (\d+)px either side of this file's own scroller/g,
      'the settings column',
    );
    expect(column[0], 'the settings column is measured from a glass width this suite does not know').toBe(
      PHONE.glass,
    );
    expect(column[3], 'the settings scroller no longer pads a phone by the figure named here').toBe(
      settingsPadX(),
    );
    expect(
      [column[1], column[2]],
      'the settings column is no longer the glass less its own scroller either side',
    ).toEqual([2 * settingsPadX(), PHONE.glass - 2 * settingsPadX()]);

    const box = says(
      SETTINGS,
      /content box is that less the (\d+)px either side of `Rows`' `border[^`]*` and the (\d+)px either side of `Field`'s `padding: '13px 14px'`, = (\d+)/g,
      "the field's content box",
    );
    expect(
      box.slice(0, 2),
      "the row names a `Rows` border or a `Field` padding neither component declares. These two " +
        'are the containers the retired 78 and 277 skipped - if either moved, the row was ' +
        're-laid out and wants re-measuring.',
    ).toEqual([rowsBorder(), fieldPadX()]);
    const field = PHONE.glass - 2 * settingsPadX() - 2 * rowsBorder() - 2 * fieldPadX();
    expect(box[2], "the field's content box is no longer what its own terms leave").toBe(field);

    const block = says(
      SETTINGS,
      /control block spends (\d+): `Switch`'s own `padding: '0 (\d+)px 0 (\d+)px'` and `gap: (\d+)` around its `width: (\d+)` ON\/OFF span and its `width: (\d+)` pill/g,
      'the control block and its five terms',
    );
    const sw = switchBox();
    expect(
      block.slice(1),
      '`Switch` no longer declares the padding, gap, span width or pill width this sentence ' +
        'names, so the 88 it adds up to is stale.',
    ).toEqual([sw[1], sw[2], sw[0], switchSpan(), switchPill()]);
    expect(block[0], 'the control block is no longer the sum of the five terms beside it').toBe(
      switchWidth(),
    );
    expect(
      buttonBorder(),
      '`base.css` no longer zeroes a bare `button` border, so every switch carries one inside ' +
        'its own box and the control block is 2px wider than the sentence says.',
    ).toBe(0);

    const rest = says(
      SETTINGS,
      /take the remaining (\d+), across the `gap: (\d+)` of the flex line/g,
      'the label column',
    );
    expect(rest[1], '`Field` no longer declares the gap this sentence spends').toBe(fieldGap());
    expect(
      rest[0],
      'the label column is no longer the field box less the control block and the row gap',
    ).toBe(field - switchWidth() - fieldGap());

    const fit = says(
      SETTINGS,
      /the text block's `flex: '1 1 (\d+)px'` basis plus (\d+) plus (\d+) is (\d+), inside (\d+)/g,
      'the one-line fit check',
    );
    expect(
      fit.slice(0, 3),
      'the fit check adds a basis, a gap or a control block none of these components declares',
    ).toEqual([fieldBasis(), fieldGap(), switchWidth()]);
    expect([fit[3], fit[4]], 'the fit check no longer adds up to what it states').toEqual([
      fieldBasis() + fieldGap() + switchWidth(),
      field,
    ]);
    expect(
      fit[3]!,
      'the switch row no longer fits on one line at `PHONE.glass`, so the whole paragraph - ' +
        'which argues that the sentence gets the width because the row is read before it is ' +
        'touched - is about a layout this build does not draw.',
    ).toBeLessThanOrEqual(fit[4]!);

    expect(
      says(SETTINGS, /the switch keeps a fixed (\d+)/g, "the switch's fixed width")[0],
      'the paragraph closes on a different fixed width from the one it derived',
    ).toBe(switchWidth());

    /*
     * The `62ch` is the one thing left of a deleted clause. "About 44
     * characters a line, inside the 62ch maximum" was cut rather than
     * re-derived at 237, because a character count is a browser result; the
     * cap itself is a declaration, and this is what holds it.
     */
    expect(
      says(SETTINGS, /`maxWidth: '(\d+)ch'` on the hint `Field` draws/g, 'the hint cap')[0],
      'the docblock names a `ch` cap the hint no longer declares. It is the only half of the ' +
        'retired character-count clause that was keepable - if the cap moved, the sentence has ' +
        'nothing left to stand on.',
    ).toBe(hintCap());
  });

  /*
   * The reset row at 375, where the premise argued against its own conclusion:
   * 324.8 fits in the 349 the docblock claimed and does not fit in the 321 the
   * containers make, and it is the wrap that was measured. Both numbers are
   * held - the live 321 and the retired 349 - because 349 is a real box one
   * container out, and a sweep that met it again without this would "correct"
   * the wrong one.
   */
  it('states the 375px wrap premise as the containers that make it', () => {
    const record = says(
      ABOUT,
      /\*\*(\d+), not the (\d+) that stood here\.\*\* \d+ is the `Rows` content box one container out - (\d+) less the (\d+)px either side of the settings scroller's phone `padding: '12px 12px 28px'` in `Settings\.tsx`, less the (\d+)px either side of `Rows`' own `border[^`]*` - and this flex line lives one container in, inside the (\d+)px either side of `Field`'s `padding: '13px 14px'`, so it is (\d+)/g,
      'the record of the retired 349 and the containers behind the 321',
    );
    expect(
      record.slice(3, 6),
      'the record names a scroller padding, a `Rows` border or a `Field` padding that is no ' +
        'longer declared',
    ).toEqual([settingsPadX(), rowsBorder(), fieldPadX()]);
    const narrow = record[2]!;
    const rows = narrow - 2 * settingsPadX() - 2 * rowsBorder();
    const line = rows - 2 * fieldPadX();
    expect(
      record[1],
      'the retired 349 is no longer the `Rows` box at this width, so the record no longer says ' +
        'what the old number was. It was a real box one container out, which is why it is kept.',
    ).toBe(rows);
    expect(
      [record[0], record[6]],
      'the flex line at this width is no longer what `Rows` and `Field` leave inside the column',
    ).toEqual([line, line]);

    const premise = says(
      ABOUT,
      /(\d+\.\d) \+ (\d+) \+ (\d+) = (\d+\.\d) does not fit in a (\d+)px row/g,
      'the 375px wrap premise',
    );
    expect(
      premise.slice(1, 3),
      'the premise adds a gap or a basis `Field` no longer declares',
    ).toEqual([fieldGap(), fieldBasis()]);
    expect(premise[3], 'the premise no longer adds up to what it states').toBeCloseTo(
      premise[0]! + premise[1]! + premise[2]!,
      5,
    );
    expect(premise[4], 'the premise measures against a row width the containers do not make').toBe(
      line,
    );
    expect(
      premise[3]!,
      'the premise no longer argues for the wrap it is the premise of. This is the exact defect ' +
        'it was corrected for: 324.8 fits in the 349 that stood here and does not fit in the ' +
        '321 the containers leave, and the wrap is the thing that was measured in Chrome.',
    ).toBeGreaterThan(premise[4]!);
    expect(
      says(ABOUT, /the hint has the full (\d+)px/g, 'the hint column at 375')[0],
      'the hint is given a column the containers no longer leave',
    ).toBe(line);
  });
});
