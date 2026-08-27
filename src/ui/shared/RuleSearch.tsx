/**
 * The rules, searched: a field at the foot of SHOW, the hits above it, and the
 * app's own questions above those.
 *
 * ## What this is not
 *
 * It is not a second reference screen, and the shape it takes is the argument.
 * `Reference.tsx` is eight chosen subjects with a renderer apiece - the
 * Difficulty ladder pivots, the countdown chart puts a button on its cells
 * when there is a countdown for a button to move. Those are the questions a GM
 * knows they have. This is the other kind: a phrase off a page, half
 * remembered, wanted now. It covers every section `dataset.rules` carries -
 * sixty-nine in the shipped SRD - and draws every one of them through
 * `BlockView`, which is already this app's single drawing of a section
 * somebody chose: the GM chapter's five folds use it, the adversary
 * Experiences put their lead block through it, the costs topic beside them
 * draws its whole section through it, and so does the `ADD -> LINK -> Rule`
 * row. So there is no second renderer here to fall out of step with the first,
 * and nothing about a section is decided twice.
 *
 * A hit opens **in place**, and only one at a time. Sending the GM to another
 * screen to read the answer would be the second reference screen; opening every
 * hit at once would bury the list under the first section's bullets. One open
 * hit keeps the list, the answer and the field all on the same surface.
 *
 * ## Opening lands on the line the band promised, not on the top of the section
 *
 * The IN A HEADING band says a subhead carries the GM's words and prints that
 * subhead under the title. Opening the hit used to draw the whole section from
 * its first block and stop there, which put the GM at the top of a section
 * whose promised subhead can be most of a screen further down - `soft move hard
 * move` opens *Making GM Moves* and wants its fifth block, `line of sight
 * cover` opens *Maps, Range, and Movement* and wants its fifth of five. The
 * band found the right section and then lost the GM inside it, and for a GM
 * mid-sentence with five people waiting a scroll hunt is most of the way back
 * to the blank screen this search exists to stop.
 *
 * So `Hit` finds where `hit.line` is drawn - `landingIn` below, which answers
 * with a block and a place inside it - and scrolls that to the top of the
 * scroller `ShowSheet` already puts this list inside. A subhead hit lands on
 * the block its subhead opens, an equality against `SectionBlock.heading`
 * because `quoteFrom` and `ruleBlocks` strip the same `## `, and the subhead is
 * that block's first drawn line so there is nothing finer to ask for. A body
 * hit lands on the **paragraph or the bullet** that carries the line, because
 * `BlockView` now takes an optional `land` naming which of its own nodes the
 * caller's ref belongs on. A `title` hit has no line and does not move: it
 * promised the section, and the section's top is the section.
 *
 * **The other half of that defect was that the line arrived unlit, and it is
 * lit now.** The GM's words were marked in the preview and nowhere in the body
 * that opened, so a GM carried to their own line still had to find their words
 * in it. `BlockView` takes a second optional prop, `mark`, which it hands each
 * string it draws in the book's words - the subhead, a paragraph, a bullet -
 * and draws whatever comes back; `markBody` in `Hit` is that string put through
 * the same `Marked` walk the preview line uses.
 *
 * **A function and not an export of `Marked`, and that is not a preference.**
 * This file imports `BlockView`, so handing a component back the other way
 * would be an import cycle; it would also put a second exported component under
 * `src/ui` and owe `screens.test.tsx` a fixture for it. A function has neither
 * problem, and it keeps the policy - which
 * words, in whose case, what the `<mark>` is painted with - in the file that
 * owns the query. `splitFirst` is the door and not `preview`: `preview` windows
 * a line to 150 characters of book for a 363px column, which is right for a
 * shut hit and would be cutting the book out of the middle of a section the GM
 * has just opened.
 *
 * Two things are deliberately not marked. **The cells of a table**, which are
 * `RuleTableView`'s and which no hit can land in anyway - `quoteFrom` skips a
 * pipe row, so a table hit's line is null. And **every block of the open
 * section except the one landed on**, which is the owner's decision of
 * 2026-08-25 §8: `making-gm-moves` writes `move` into all six of its blocks, so
 * a section-wide walk would light all six and the line the GM was actually
 * carried to would stop standing out. What that leaves standing, and it is
 * worth saying rather than discovering: where the SRD draws a section as one
 * block the landing block *is* the section, so `using-fear` - one block, twelve
 * parts - lights every one of them that carries the word. `spend a fear` is
 * that case; the query `fear` is not, because it names the section and a title
 * hit has no landing at all. Narrowing further, from the landing block to the
 * landing *part*, is not the one-line change the block/section choice was: it
 * would mean gating `ink` on the target inside `BlockView`, at all three of its
 * text call sites. It was not taken because §8 drew the line at the block, and
 * `ruleSearch.test.tsx` pins what that leaves so the day somebody does take it,
 * they take it on purpose.
 *
 * **A block was as fine as this landed, and where the SRD draws a section as
 * one block that was the section's top.** 34 of the 69 shipped sections resolve
 * to a single block - 33 carry no `## ` at all, and `the-basics` opens with its
 * only one, so it has no prose above the heading to make a second - so a hit
 * inside one arrived at the block the section had already begun with, and the
 * GM was brought to the top of their section rather than to their line. That is
 * what the `land` prop ends: the ref goes on the `<p>` or the `<li>` the line
 * actually is, and the widest of those sections - `using-fear`, one block of
 * twelve parts - is twelve parts the GM no longer scrolls past.
 * `ruleSearch.test.tsx` pins the 34 rather than leaving it to age.
 *
 * **"A *bullet* could be landed on ... while a prose *line* could not be landed
 * on at all until that `<p>` stops being one node per paragraph" is withdrawn,
 * and the dataset is what withdraws it.** The asymmetry that sentence claimed
 * is not in the shipped data: not one of the SRD's 312 prose parts carries more
 * than one line, so `part.text === hit.line` holds for a paragraph exactly as
 * `part.items.includes(line)` holds for a bullet, and a `<p>` is addressable on
 * the same equality an `<li>` is. Nothing had to be split, and the four callers
 * that pass nothing still draw what they drew. What survives of that sentence
 * is smaller and belongs to the general case rather than to this dataset: a
 * homebrew layer may write a paragraph across several lines, and there
 * `landingIn` lands on the **paragraph that carries** the line rather than on
 * the line, which is the owner's answer of 2026-08-25 §7. A per-line node stays
 * additive if that answer ever changes - one more `BlockTarget` branch, inside
 * two files and inside no caller. `ruleSearch.test.tsx` walks every line the
 * search can quote and asserts each has a place of its own, so the day a layer
 * or a folio does write multi-line prose it stops being theoretical in a test
 * rather than in a paragraph here.
 *
 * That single-open rule is the whole reason `Hit` below is not `Fold`. Its
 * header is otherwise `Fold`'s header, deliberately - same `t-label` title in
 * `--text-2`, same `t-meta` page stamp in `--muted`, same `aria-expanded`
 * button, same `gap: open ? 8 : 0` - but `Fold` owns its open state privately,
 * so a list of them can only ever be all-shut or however many the GM has left
 * open. It also has one line in its header, and a hit's header has three.
 *
 * The stamp was `--dim` here while this sentence claimed it was `Fold`'s, which
 * is a shade darker than `Fold.tsx` draws its summary and so a shade darker
 * than the five GM-chapter folds this file names as its precedent - the same
 * `SRD 1.0 - P.n` string, one step back from it, on the same screen. The
 * sentence is the one that was right: it is `--muted` now, and `t-meta` at
 * `--dim` is left to the two labels that are not `Fold`'s - the group headers
 * and the table note - which have no counterpart there to disagree with.
 *
 * ## The organised half of the request: three bands, not a ranking
 *
 * `searchRules` returns title matches, then heading matches, then body matches.
 * That order is invisible in a flat list, so the list is drawn as the bands the
 * order already is: **IN THE TITLE**, **IN A HEADING**, then **IN THE TEXT**,
 * each with its own count. A GM who typed `countdown` sees at a glance that one
 * section of the shipped SRD is *about* countdowns and six merely mention them,
 * which is the distinction they were going to make by reading the titles
 * anyway.
 *
 * The middle band came with the multi-term matcher, and it earns a header
 * rather than being folded into the text: the SRD keeps 156 `## ` subheads
 * across 36 of its 69 sections, so `fear` now draws three bands where it drew
 * two, and a subhead names a rule in the same way a title does. `searchRules`
 * argues that at greater length; this file pays for it in a 10px header.
 *
 * It is bands rather than a relevance score for the reason `searchRules` gives:
 * weighting the SRD's sections would be the app deciding which rule the GM
 * meant. A group header is the data's own split, printed.
 *
 * There is a fourth header of the book's and it appears in place of all three.
 * When no section carries every word, `searchRules` falls back to the sections
 * carrying some, and that list is drawn under **NO SECTION CARRIES ALL OF THOSE
 * WORDS · THESE CARRY SOME**. The header is the whole point of the fallback: an
 * unranked list of eighteen sections presented as *the answer* is a worse lie
 * than a blank screen, and presented as *this is not the answer, here is what
 * is near it* it is a place to start.
 *
 * ## The one band that is not the book's: QUESTIONS
 *
 * Above all of those stands a band of the app's own words. `ask.ts` holds
 * twelve questions a GM asks under pressure, each with a pointer at the place
 * the SRD comes nearest to answering it, and `searchAsk` matches the same query
 * against those questions that `searchRules` matches against the sections.
 *
 * **It is above rather than below, and that is the whole of it.** The band
 * exists for the query this search answers correctly and uselessly: `surrender`
 * is in none of the sixty-nine sections, and so are `concede`, `chase`,
 * `difficulty roll`, `nearly impossible` and `lines and veils` - all six
 * measured against the shipped text, all six things a GM says out loud at a
 * table. Below the list, a question a GM has to scroll nineteen hits to reach
 * is a question they will not find at the moment they needed it.
 *
 * **A question is not a `RuleHit` and does not become one.** `AskRow` below is
 * its own row - the app's sentence first, the book's address under it - because
 * `Hit`'s header is a section's title and a quoted line, and an entry has
 * neither. What the two share is everything downstream: the same `ruleSection`,
 * the same block equality, the same `BlockView`, the same one-open-at-a-time
 * `openId`, so opening a question and opening a hit are the same act and there
 * is still exactly one drawing of a section in this app.
 *
 * **It stays when `SOME` replaces the other three,** which no document decided
 * and this file does. If a question matched, the surface has found something
 * the GM asked for; the fallback header goes on saying exactly what it says
 * about the sections under it, and neither sentence is made to answer for the
 * other. The one thing that does move is the silence: the "no rule in this
 * dataset carries that" paragraph is drawn only when the questions are empty
 * too, because its second clause is a claim about the whole surface.
 *
 * ## Where the query landed, marked
 *
 * The matched characters are drawn in `--text` at weight 700 inside a `<mark>`.
 * On the preview line the background is explicitly cleared: a GM scanning
 * fifteen previews in a dim room needs to find their own words in each line
 * without reading it, and a yellow block - the UA default - is a lamp in that
 * room. On the *title* the mark carries a plate instead, for a reason that is
 * about the face rather than about taste; `Marked` below argues it, with the
 * ink ratios and the `@font-face` count it turns on. Nothing is reworded,
 * nothing is reordered, and the marked runs are the line's own characters in
 * the line's own case: `preview` splits, it never rewrites.
 *
 * There is a third place now: the block a hit opens on, whose subhead,
 * paragraphs and bullets go through the same walk by way of `BlockView`'s
 * `mark`. It takes the preview's treatment - no plate - and the reason is the
 * one `Marked` gives below rather than a preference. Its ink step is the
 * title's and not the preview's: `.t-read` is `--text-2`, so the mark is the
 * 1.38:1 this file already costs for `--text-2` -> `--text`, against the 1.83:1
 * the `--muted` preview line gets. What it has and the title has not is the
 * **weight** channel - `.t-read` is `400 13px var(--sans)`, and `--sans` is
 * Archivo declared `400 900`, so 400 -> 700 is three real steps of a face that
 * has them, where the title's IBM Plex Mono ships no 700 at all. One live
 * channel is why the title needed a plate and this does not.
 *
 * It is read and never touched, like the other two: a `<p>` and an `<li>` carry
 * no target, the hit header is still the only one on the row, and `<mark>` has
 * no padding and no border so it adds no height to either. What it can move is
 * the wrap - Archivo at 700 is wider than at 400, so a marked paragraph may
 * take a line the unmarked one did not - and that costs nothing here because
 * the marked draw and the scroll happen in the same commit: the ref fires after
 * the marked text is laid out, so what is scrolled to is the final position and
 * there is no jump to watch.
 *
 * There are several marks now, because there are several words, so `Marked`
 * walks the line instead of splitting it once: `preview` cuts at the first run
 * and hands the rest back to `splitFirst`, which cuts at the next, until there
 * is nothing left to mark. Two runs the book wrote with nothing but a space
 * between them are marked as one, because the GM typed them with nothing but a
 * space between them - which is how `very close` still marks `Very Close` and
 * not `Very` and `Close`.
 *
 * **A count stood here and is withdrawn rather than re-taken.** It read
 * "measured over the sixty-one preview lines the thirty-query set produces,
 * fifty-five need two marks or more". That thirty-query set is not in this
 * repository - not in `ruleSearch.test.tsx`, not in the data, nowhere a reader
 * can open - so neither the sixty-one nor the fifty-five can be checked by
 * anyone who did not have the probe open at the time, and re-running the
 * sentence against a set reconstructed here would only mint a third number. The
 * property the walk actually needs is that *a* preview line can carry two runs,
 * and that is pinned on a named query by *marks every word on a line, not just
 * the first one it finds* in `ruleSearch.test.tsx`, where a dataset change can
 * turn it red. A test that fails beats a figure nobody can re-derive.
 *
 * The title is marked through the same call, and that is no longer the empty
 * case it was. A text hit's title could not contain a *phrase* the body carried
 * - a title that contained it would have made it a title hit - but it can
 * certainly contain one word of several: `restrained condition` finds a line in
 * `Conditions`, and the header marks `Condition` inside `Conditions` while the
 * line - the book's own RESTRAINED subhead - marks itself. That is the header
 * doing the job the matcher already gave it: the two words are one tap target
 * apart, not eight paragraphs.
 *
 * ## Ergonomics: the field is the last element in the sheet
 *
 * SHOW opens from the bottom bar, so its sheet is anchored to the bottom of the
 * window - `GmSheet` puts `justifyContent: flex-end` on the scrim for a phone -
 * and it grows *upwards* as its content grows, to the `maxHeight: 85%` that
 * file declares. Put the field first and it is at the top of the sheet: the
 * furthest point from the thumb that just pressed SHOW, and worse, a point that
 * **moves further away with every result that appears**, because the sheet
 * grows up from under it. Put it last and it sits on the bottom edge, where the
 * thumb already is, and it does not move at all while the hits fill in above.
 * Nothing under the thumb changes position while the GM types.
 *
 * Measured in Chrome at 393 x 852 with a coarse pointer, not derived: the
 * sheet's inner column is 363px, the field row is 44px tall and sits on the
 * sheet's bottom edge with 14px of padding under it, and a group header is
 * 10px. A shut hit is 44px whenever what it carries fits inside that floor,
 * which is every title-only hit, every table hit, and every preview that comes
 * to a single line; 56.7 at two preview lines and 72.6 at three. The tallest
 * measured was 82.6, and it was not a preview that did it: a title long enough
 * to wrap in a 363px column puts 10px on the header before the three lines
 * under it.
 *
 * **That measurement's subject no longer exists.** It was `The Witherwild:
 * Campaign Mechanics`, and the frame was dropped from the dataset by the
 * decision of 2026-08-23. The mechanism outlives the example - titles that wrap
 * a 363px column are still in there, and the longest is now `Giving Out Gold,
 * Equipment, and Loot` at 36 characters against that one's 34 - but 82.6 is not
 * re-measured here and must not be read as current. It belongs to the single
 * Chrome pass that owes six surfaces at once.
 *
 * **"Empty, the sheet is 308.2px" is withdrawn rather than replaced.**
 * `ShowSheet.tsx` retired that figure where it was first taken: with every door
 * on and the field empty the panel measures 402.73, and 308.2 was true of two
 * doors, which is a state this sheet still has and is no longer the state it is
 * usually in. This file went on printing it as current, in a paragraph the same
 * commit rewrote. There is no fresh number in its place because there is no
 * fresh Chrome pass here, and a figure invented at this keyboard would read as
 * a measurement that was never taken.
 *
 * Typing fills the sheet upward. `countdown` finds seven sections and
 * `adversary` twenty - both re-run against the shipped dataset rather than
 * assumed; `countdown` was seven before the Witherwild removal too and
 * `adversary` was twenty-two. Both counts survive the multi-term matcher
 * unchanged, and that is not luck: for one word the AND is one `includes` and
 * the line it picks is the first line carrying that word, which is the line the
 * phrase search picked. What does move for them is the band count - `adversary`
 * draws three bands now where it drew two, `countdown` still draws two.
 *
 * **"Twenty shut hits at the 44px floor is 880px" is withdrawn too.** It was
 * arithmetic and not a measurement - twenty times forty-four - and it assumed
 * the thing it was there to establish, that every one of the twenty sits on the
 * floor. A verifier put `adversary` in front of Chrome at 393 x 852 with a
 * 363px column and measured the results column at **1327.1px**, which is 447
 * more than 880; that is how the figure was found, and it is the whole of the
 * reason it goes.
 *
 * The withdrawal used to give a different reason - that a sentence elsewhere in
 * this docblock contradicted it and "this docblock could have caught itself".
 * It could not have. The sentence it blamed, the one calling two- and
 * three-line previews the ordinary shape of a hit, was written by the same
 * commit that withdrew the 880; `git show 6fefd74:src/ui/gm/RuleSearch.tsx`
 * carries no such sentence. The docblock the 880 lived in contradicted nothing.
 * A withdrawal does not need a cause it has to invent.
 *
 * **How many of the twenty are on the floor is not settled here, and the
 * arithmetic beside it cannot settle it.** That verifier read 7 of 20; a second
 * pass over the same query read 12. Both fit the 1327.1 they agree on, and not
 * approximately: `adversary` returns 20 hits banded 5 title / 2 heading / 13
 * text, so the column is those twenty plus three 10px headers and twenty-two
 * 10px gaps, and solving over the three measured shut-hit heights gives
 * 7x44 + 11x56.7 + 2x72.6 = 1076.9 and 12x44 + 2x56.7 + 6x72.6 = 1077.0 - two
 * integer solutions, 0.1px apart, inside one rendering. So the count is left
 * out rather than given, and what stands is what both passes and the arithmetic
 * agree on: the column is **1327.1px**, and it is not twenty hits at the floor.
 * The cap it runs against still measures **717.4px**, not the 724.2 that 85% of
 * 852 would be, because `GmSheet` pays 8px of padding above the panel and a
 * percentage `max-height` resolves against the flex container's content box -
 * 85% of 844. So `adversary` pins against that cap and scrolls; how many of its
 * twenty are on screen before the first scroll was arithmetic on the 880 and
 * goes with it.
 *
 * **The multi-term matcher moves two of those numbers, and only one of the two
 * can be moved here.** A third band puts a third 10px header into any result
 * that has one - `fear` draws three bands where it drew two, so the same hits
 * stand 10px taller - and that is arithmetic on a pixel already measured. The
 * other is the preview, and it is not: two- and three-line previews are the
 * ordinary shape of a hit now rather than the exception, which moves a shut hit
 * off the 44px floor onto the 56.7 and 72.6 that were measured for those cases.
 * How many lines a given preview wraps to in a 363px column is a Chrome
 * measurement, jsdom cannot take it, and nothing here invents it. It belongs to
 * the same pass 82.6 belongs to, which owes seven surfaces now rather than six.
 * What this file can bound without a browser is characters, and the section
 * below now bounds them: no preview keeps more than 150 characters of the book.
 *
 * A phone keyboard rises from that same bottom edge, and its height - and what
 * a browser does to a `position: fixed` scrim when it appears - is a device
 * behaviour this lane had no phone to measure. So nothing here is arithmetic on
 * it. What the layout guarantees without measuring the keyboard is the ordering:
 * the field is the element nearest the keyboard, the hits read upward from it
 * nearest-first, and a field at the top would put its first result behind the
 * keyboard on any phone where the two together are taller than the sheet.
 *
 * It does not autofocus on a phone, for the reason `GearPicker`'s search box
 * gives: the keyboard would take the sheet before the GM has seen what is in
 * it. On a pointer device it focuses, because there the keyboard costs nothing.
 *
 * ## Targets
 *
 * The field, CLEAR and every hit header declare their height **inline** as the
 * number 44, not as `var(--tap)`: jsdom reads only inline styles and does not
 * resolve custom properties, so a floor written as a token is a claim no test
 * in this repo can check. A hit's header is the full width of the column and
 * carries the title and the page stamp on one line, the matched line under it
 * and, where there is one, the table note under that: one target, read down,
 * pressed anywhere.
 *
 * CLEAR is drawn rather than left to `type="search"`, whose own clear button
 * is the user agent's to draw or not and which this lane had no phone to check.
 * The sheet's promise - that emptying the field brings the two doors straight
 * back - is not a promise to leave to a UA, and one certain tap beats twenty
 * backspaces. It appears with the first character: measured,
 * CLEAR is 58 x 44 and the row's gap is 8, so the field goes from 363px to
 * 297px the moment a character lands. That reflow happens once, while the GM is
 * looking at the keyboard rather than at the field, and the alternative is a
 * permanent 66px hole or a greyed control, both of which `ShowSheet`'s own
 * docblock argues against.
 *
 * ## The preview is windowed around every mark, bounded, and says where it cut
 *
 * 255 of the 869 non-empty body lines in the shipped SRD are longer than the
 * 150 characters `BEFORE + AFTER` keeps, and the longest is 747. (It was 294 of
 * 969 and 780 while the dataset still carried the Witherwild frame; the three
 * counts are re-taken against the file that ships, and only the counts moved.
 * Those three count the line as the book writes it, `- ` and `## ` included,
 * pipe rows and all.
 *
 * `preview` is handed none of that. `quoteFrom` strips `## ` and `- ` off the
 * front of a line, and it skips a pipe row outright rather than stripping it -
 * `if (text.startsWith('|')) { inTable = true; continue; }` - so a table row
 * never becomes a `line` and never reaches this function. In the unit `preview`
 * actually receives, then, the population is **769** lines, **227** of them
 * over 150, and the longest is **745**: the two characters off 747 are the
 * bullet on `Avoid Death:`, and the hundred lines off 869 are the book's pipe
 * rows. It read "253 lines over 150, counted the way `preview` sees them",
 * which is a third unit - markup stripped but pipe rows still counted - and one
 * `preview` never sees either.)
 * A list of fifteen of those is a list nobody scans. `preview` below takes a window
 * around the match rather than the first N characters, so the words the GM
 * typed are always inside it, and marks each cut end with an ellipsis. Nothing
 * is reworded and nothing is summarised; the whole line is one tap away, and
 * the tap draws the section it came from.
 *
 * *Always inside it* got harder the moment there was more than one word: a
 * line can carry the GM's words further apart than the 150-character window is
 * wide. The one this file names is `spending fear` landing in `Tag Team Rolls`
 * on a **473**-character line whose first and last marks are **322** apart -
 * both figures are the shipped `data/srd-1.0.json`'s own and come back from it
 * on demand, and `ruleSearch.test.tsx` asserts the shape of them on that query.
 * The choice was to hold every mark or to leave a word unmarked off the end of
 * the preview, and every mark is held.
 *
 * (A count stood in front of that example - "ten have their first and last mark
 * further apart than that 150-character window" - and it is withdrawn for the
 * reason the marks paragraph above withdraws its own: it counts over a
 * thirty-query set this repository does not contain. The example survives
 * because it does not depend on the set; the line and the two numbers on it are
 * in the data file.) The unmarked word would be a lie by omission in exactly
 * the case a GM most needs the preview - three words typed, and the line is
 * long *because* it carries all three.
 *
 * **Holding every mark by widening the window was the wrong half of that
 * choice, and it is not what happens now.** Widening had no ceiling in it: the
 * window ran from `BEFORE` the first mark to `AFTER` the last of the first
 * appearances and stopped, so its width was whatever the book's spacing said,
 * and a line whose words sit at its two ends came back **whole**. The SRD has a
 * 745-character one,
 * `Avoid Death:` in `Death`, and a GM who had opened nothing got all of it. A
 * verifier measured that preview in Chrome at 363px: **199.5px**, four and a
 * half times the 44px tap floor and about 31.5% of a results viewport of
 * roughly 634px, with `spending fear` already at **120.2px**. Those figures are
 * theirs and are cited as theirs; none of them is re-taken or derived here.
 *
 * So the book is on a budget - `WINDOW`, 150 characters - and **the marks are
 * not in it**. What pays for a line whose words are far apart is the book
 * *between* the marks: `shares` hands the gaps whatever the budget has left,
 * `bridge` elides what will not fit, and every word the GM typed and the line
 * carries is still drawn, marked, in the book's own case. Swept over **2,142**
 * queries built from every body line the shipped file has, the longest preview
 * is **199** characters where the old window drew **745**, no preview keeps
 * more than 150 characters of book, and not one of the 2,142 loses a mark.
 * `ruleSearch.test.tsx` runs that sweep on every run, which is why those are
 * the figures quoted here rather than the ones a probe took once.
 *
 * Two and three preview lines are still the ordinary shape of a hit rather than
 * the exception. What has gone is the eleventh line.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Ref, RulesSection } from '../../../shared/types.ts';
import { useApp } from '../../store/state.ts';
import { useIsPhone } from './useLayout.ts';
import {
  ruleSection,
  ruleTerms,
  searchRules,
  type RuleHit,
  type SectionView,
} from './srdReference.ts';
import {
  searchSrd,
  SRD_KIND_LABELS,
  SRD_KINDS,
  srdIndex,
  type SrdHit,
  type SrdRecord,
} from './srdIndex.ts';
import { askLoaded, loadAsk, MOMENTS, searchAsk, type AskEntry, type Moment } from './ask.ts';
import { sectionsIn } from './moments.ts';
import { BlockView, type BlockTarget } from './BlockView.tsx';

/** How much of a long line to keep on either side of the marks. */
const BEFORE = 34;
const AFTER = 116;
/**
 * The ceiling: the most characters *of the book* one shut preview keeps.
 *
 * The marks are not in this budget and are never spent out of it - every word
 * the GM typed and the line carries is drawn, whole, always. What the budget
 * bounds is the unmarked text around and between them.
 *
 * It is `BEFORE + AFTER` because that is **what a one-mark preview already
 * kept**, so a preview with a single run comes back character for character
 * what it was before this ceiling existed: it spends 34 in front and 116
 * behind and has no gap in the middle to pay for. The ceiling was added to
 * bound the many-mark case, and it is set at the width the one-mark case had
 * so that adding it changed nothing that was not broken.
 *
 * **The reason given here used to be a different one, and it was false.** It
 * said 150 was "the width whose height on the glass was actually measured: 150
 * characters of book came to at most three preview lines." No such measurement
 * exists. This file's own Ergonomics section says the opposite in as many
 * words - *how many lines a given preview wraps to in a 363px column is a
 * Chrome measurement, jsdom cannot take it, and nothing here invents it* - and
 * lists that wrap count among the surfaces a future Chrome pass still owes.
 * The 56.7 and 72.6 that were measured are heights for a two- and a three-line
 * preview; neither says how many characters produce one. And 150 is not even
 * the width of what gets drawn: the marks sit on top of the budget, so
 * `roll damage modifier` on `Character Creation` draws **193** characters, and
 * the sweep's widest is **199**. A constant can be right for a reason that is
 * not the reason written next to it, and this one was.
 */
const WINDOW = BEFORE + AFTER;
/** How much of the book to keep on each side of an elided gap. */
const BRIDGE = 10;

/**
 * A line split into what comes before one marked run, that run as the line
 * spells it, and what comes after.
 *
 * `match` is a slice of the line rather than the typed word, so the case is the
 * book's: type `very close` and what is marked is `Very Close`. It is `''` when
 * the line carries none of the words at all, which is the honest answer for the
 * title of a hit whose words are all in the body.
 *
 * One run, not the whole line's worth: `after` can carry further runs, and
 * `Marked` splits it again until it does not. Keeping the shape at one run is
 * what lets the window - which has to be decided once, over the whole line -
 * live in `preview` and the walk live in the component.
 */
export interface RulePreview {
  before: string;
  match: string;
  after: string;
}

/**
 * Every run of `text` the GM's words claim, merged, in order, and how far along
 * the line their first appearances reach.
 *
 * Two runs with nothing but whitespace between them are one run. The GM typed
 * those words side by side and the book wrote them side by side, so marking
 * them separately would put a hole in a phrase that is not there: `very close`
 * marks `Very Close`, which is the range this book names, not `Very` and
 * `Close` with a gap between them.
 *
 * `cover` is where the window has to reach to have shown every word at least
 * once - the furthest end among the words' *first* appearances, not among all
 * of them. A word repeated at the end of the dataset's longest line - **745**
 * characters as this function receives it, the `- ` already off it - is marked
 * if the window happens to reach it and is not a reason to widen the window to
 * it. (780 stood here, in a docblock added in the same sitting as the paragraph
 * seventy lines above that re-took the figure as 747. One file, two numbers,
 * one subject.)
 */
function marksIn(text: string, query: string): { runs: Array<[number, number]>; cover: number } {
  const low = text.toLowerCase();
  const found: Array<[number, number]> = [];
  let cover = 0;
  for (const term of ruleTerms(query)) {
    let at = low.indexOf(term);
    if (at === -1) continue;
    cover = Math.max(cover, at + term.length);
    for (; at !== -1; at = low.indexOf(term, at + term.length)) found.push([at, at + term.length]);
  }
  found.sort((a, b) => a[0] - b[0]);

  const runs: Array<[number, number]> = [];
  for (const [start, end] of found) {
    const last = runs.at(-1);
    if (last !== undefined && start <= last[1]) last[1] = Math.max(last[1], end);
    else if (last !== undefined && text.slice(last[1], start).trim() === '') last[1] = end;
    else runs.push([start, end]);
  }
  return { runs, cover };
}

/**
 * `text`, split at its first marked run and at nothing else.
 *
 * No window: this is what `Marked` walks the tail of an already-windowed line
 * with, and re-windowing a tail would cut characters out of the middle of a
 * preview without an ellipsis to say it had.
 */
function splitFirst(text: string, query: string): RulePreview {
  const [first] = marksIn(text, query).runs;
  if (first === undefined) return { before: text, match: '', after: '' };
  return {
    before: text.slice(0, first[0]),
    match: text.slice(first[0], first[1]),
    after: text.slice(first[1]),
  };
}

/**
 * A stretch of book between two marks, cut down to `allow` characters.
 *
 * Half either side and an ellipsis in the middle, and the cuts land on a space
 * where there is one inside the half, so the bridge does not begin or end
 * mid-word; where there is not, it cuts where it has to, the same concession
 * the ends of the window make. A gap the allowance already covers comes back
 * untouched, which is why a preview whose words the book wrote near each other
 * is byte-for-byte what it was before there was a ceiling at all.
 */
function bridge(gap: string, allow: number): string {
  if (gap.length <= allow) return gap;
  const half = Math.max(BRIDGE, Math.floor(allow / 2));
  const head = gap.slice(0, half);
  const tail = gap.slice(gap.length - half);
  const cutHead = head.lastIndexOf(' ');
  const cutTail = tail.indexOf(' ');
  return `${cutHead === -1 ? head : head.slice(0, cutHead)}…${cutTail === -1 ? tail : tail.slice(cutTail + 1)}`;
}

/**
 * How much of each gap survives, when the gaps between them have `budget`
 * characters to share.
 *
 * Evenly, and a gap that does not need its share hands the surplus back to the
 * ones that do - so a line with one long gap and three short ones spends almost
 * the whole budget on the long one rather than cutting all four to a quarter
 * each. Nothing here is a ranking of the gaps; every gap is worth the same and
 * the only thing that differs is how much of it there is.
 */
function shares(gaps: readonly number[], budget: number): number[] {
  const out = gaps.map(() => 0);
  let open = gaps.map((_, i) => i);
  let left = budget;
  while (open.length > 0) {
    const share = Math.floor(left / open.length);
    const small = open.filter((i) => gaps[i]! <= share);
    if (small.length === 0) {
      for (const i of open) out[i] = share;
      break;
    }
    for (const i of small) {
      out[i] = gaps[i]!;
      left -= gaps[i]!;
    }
    open = open.filter((i) => gaps[i]! > share);
  }
  return out;
}

/**
 * A long line, cut down to every mark plus at most `WINDOW` characters of the
 * book around and between them, and split at the first mark.
 *
 * Each cut lands on the nearest space between it and the marks, where there is
 * one, so the preview does not begin or end mid-word; where there is not - a
 * 34-character run with no space in it - it cuts where it has to. An ellipsis
 * marks each end that was cut, and only an end that was cut - a line that fits
 * comes back whole, character for character, which is what lets the stamp
 * beside it stay honest.
 *
 * ## Why there is a ceiling, and why it never costs a mark
 *
 * The window ran from `BEFORE` ahead of the first mark to `AFTER` past `cover`
 * and stopped there, which meant it had no ceiling: a line whose words are 300
 * characters apart was previewed over 300 characters, and a line whose spread
 * was wider than the line itself was previewed **whole**. That last case did
 * the damage, because the guard that let a short line through compared the line
 * against a window that grew with the spread - so the SRD's longest line, 745
 * characters, `Avoid Death:` in `Death`, came back entire for a query whose
 * words sit at its two ends. One shut hit, never opened, taller than anything
 * else on the surface. The verifier who found it measured that one at
 * **199.5px** in Chrome at 363px, against a 44px tap floor and a results
 * viewport of about 634px; the figures are theirs, not re-taken here.
 *
 * So the book is put on a budget of `WINDOW` characters and **the marks are not
 * in it**. Every word the GM typed and the line carries has its first
 * appearance inside `[start, end]` by construction - `start` is at or before
 * the earliest run, `end` is at or after `cover`, and `cover` is the furthest
 * end among the words' *first* appearances - and every run in that range is
 * drawn whole. Nothing is dropped off-screen, so the other half of this file's
 * rule - *say so when you could not show them all* - never has to fire, and
 * there is no confession line to print under the preview.
 *
 * ## What the budget is spent on, in order
 *
 * 1. **The run-up**, `BEFORE` characters ahead of the first mark. A mark with
 *    no lead-in is a word with no sentence around it.
 * 2. **The gaps between the marks**, shared out by `shares`. This is the one
 *    that had to be argued: an earlier draft of this ceiling elided every gap
 *    over twenty-one characters on principle, and it turned
 *    `stress clearing` on `Additional Rules` from a readable sentence into
 *    `…you can't…or mark Stress multiple…roll.` - eight ellipses in a list of
 *    fifteen, and a GM cannot read a word of it. The middle of the sentence is
 *    the sentence. It is cut only when the ceiling actually forces it.
 * 3. **The tail**, up to `AFTER` past `cover`, out of whatever is left. It is
 *    spent first because it is the only part of the preview that carries none
 *    of the GM's words and does not join two that it carries.
 *
 * Swept over 2,142 queries built from every body line in the shipped file - the
 * sweep is in `ruleSearch.test.tsx` and runs on every test run - the longest
 * preview this draws is **199** characters against the old window's **745**, no
 * preview keeps more than 150 characters of book, and not one of the 2,142
 * loses a mark. A second pair stood in front of that, 189 against 407, counted
 * over the thirty-query set instead; both are withdrawn with the rest of that
 * set's figures, because the set is not in this repository and the sweep beside
 * them makes the same point out of a population a reader can regenerate.
 */
export function preview(line: string, query: string): RulePreview {
  const { runs, cover } = marksIn(line, query);
  const [first] = runs;
  if (first === undefined) return { before: line, match: '', after: '' };
  // The whole line, when the whole line already costs no more than the budget.
  // This is the test the old guard made - the run-up plus the tail inside 150 -
  // with the gaps between the marks counted too, which is the only thing it was
  // missing and the whole of what let a 745-character line through.
  if (line.length - marked(runs) <= WINDOW) return splitFirst(line, query);

  let start = Math.max(0, first[0] - BEFORE);
  if (start > 0) {
    const space = line.indexOf(' ', start);
    if (space !== -1 && space < first[0]) start = space + 1;
  }

  // The marks the window has to hold: every run that opens inside it, up to and
  // including the one that reaches `cover`. Runs past `cover` are repeats of
  // words already marked, and they are drawn if the tail happens to reach them.
  const held = runs.filter(([from]) => from >= start && from <= cover);
  const gaps: number[] = [];
  for (let i = 1; i < held.length; i += 1) gaps.push(held[i]![0] - held[i - 1]![1]);
  const allow = shares(gaps, Math.max(0, WINDOW - (first[0] - start)));

  let text = line.slice(start, first[1]);
  let at = first[1];
  for (let i = 1; i < held.length; i += 1) {
    text += bridge(line.slice(at, held[i]![0]), allow[i - 1]!) + line.slice(held[i]![0], held[i]![1]);
    at = held[i]![1];
  }

  let spent = first[0] - start;
  for (const a of allow) spent += a;
  let end = Math.min(line.length, Math.max(at, at + Math.min(AFTER, Math.max(0, WINDOW - spent))));
  if (end < line.length) {
    const space = line.lastIndexOf(' ', end);
    if (space > at) end = space;
  }

  const split = splitFirst(text + line.slice(at, end), query);
  return {
    before: `${start > 0 ? '…' : ''}${split.before}`,
    match: split.match,
    after: `${split.after}${end < line.length ? '…' : ''}`,
  };
}

/** How many of a line's characters the marks cover. */
function marked(runs: ReadonlyArray<[number, number]>): number {
  let sum = 0;
  for (const [from, to] of runs) sum += to - from;
  return sum;
}

const stamp = (page: number | null): string => `SRD 1.0${page === null ? '' : ` · P.${String(page)}`}`;

/**
 * A previewed line with every one of the GM's words lifted out of it.
 *
 * It walks rather than splits once, because a preview line can carry more than
 * one marked run - `falling damage` lands on the subhead FALLING AND COLLISION
 * DAMAGE and has to mark both ends of it. `preview` has already taken the
 * window and cut at the first run; each step here cuts the tail at the next,
 * and the recursion ends on the first tail that carries none.
 * `ruleSearch.test.tsx` pins the two-run case on that query.
 *
 * ## `plate`, and why one of the two marks on a hit needs it
 *
 * The same call marks the hit's title, the hit's line and - since the body
 * started opening lit - the block that body lands on, and until now it drew
 * them identically: ink at `--text`, weight 700, no background. On the line
 * that is a strong cue and on the title it is very nearly no cue at all, and
 * the difference is the two faces rather than anything this file chose. The
 * body sits between them and needs no plate either: it pays the title's ink
 * step - `.t-read` is `--text-2` - but it is `--sans`, so it still has the
 * three real steps of weight the title cannot buy.
 *
 * The line is `.t-dense`, `400 11.5px var(--sans)`, overridden here to
 * `--muted`. `--sans` is Archivo, declared `font-weight: 400 900` as a single
 * variable font (`tokens.css`), so 400 -> 700 is three real steps of a face
 * that has them, and `--muted` -> `--text` is a **1.83:1** step of ink.
 *
 * The title is `.t-label`, `600 10px/1 var(--mono)` at `letter-spacing:
 * 0.16em`, overridden here to `--text-2`. Both of those channels are already
 * spent:
 *
 * - **Ink.** `--text-2` -> `--text` is **1.38:1**, against the 1.83:1 the line
 *   gets. It cannot be widened from this end - `--text` is the lightest ink the
 *   palette has, so the mark is already at the top - and it must not be widened
 *   from the other end, because the title's `--text-2` is what makes this
 *   header `Fold`'s header, which is the argument the top of this file makes
 *   and the stamp beside it was corrected to keep.
 * - **Weight.** `--mono` is IBM Plex Mono, and this app ships it as three
 *   static faces - **400, 500 and 600**, three `@font-face` rules in
 *   `tokens.css` and no more. There is no 700 file. A run asking for 700 inside
 *   a 600 label gets the 600 file back with synthetic bold smeared over it, and
 *   on a phone at 10px in a monospaced face that is not a step a scanning eye
 *   resolves. The 700 stays because a deployment that ships a heavier mono
 *   should get the real step; what has changed is that nothing depends on it.
 *
 * So the third channel is opened, and only where the first two are gone: a
 * plate behind the run. `--line` is the palette's own "structure you can just
 * see" - **1.34:1** against `--panel`, which is what the sheet is drawn on -
 * and the marked ink still reads at **9.97:1** on top of it, above AAA. That
 * is deliberately the dimmest plate in the palette that is still a plate. The
 * cue it adds is not luminance, it is **area**: 1.34:1 spread over a whole
 * glyph box is pre-attentive where 1.38:1 along a 10px stroke is not.
 *
 * This does not reopen the yellow block the marked preview refuses. That
 * objection is to the UA default - a saturated near-white fill, a lamp in a dim
 * room, on every one of fifteen preview lines. `--line` is one step off the
 * panel and it is on the title only, where there is no other cue left.
 *
 * ## 393 x 852, read against touch
 *
 * The mark is **read and never touched**. The whole header is one target - a
 * single `minHeight: 44` button spanning the 363px column - and nothing here
 * carries a target of its own, so this is a legibility question and not a
 * reach one.
 *
 * That is why it is a background and not an underline. `background` on an
 * inline run paints inside the line box that is already there: no advance
 * width, so the monospaced grid this label is set on does not shift and a title
 * cannot be pushed into a wrap it was not in before; no height, so the 44px
 * floor and the three-line header this file measures are untouched. There is
 * no padding on it for the same reason - padding would break the character
 * grid. An underline would have to paint below a `10px/1` line box, into the
 * 3px gap this button puts between the title and the preview under it.
 *
 * And it is the right line to spend the cue on. The hits read upward from the
 * field at the thumb, and the title is the top line of each one - the furthest
 * from the hand, the line the GM scans rather than the line they read once they
 * have stopped. Multi-term matching is what made that line load-bearing:
 * `searchRules` admits a section when each word is in the line **or in the
 * title**, so a hit can satisfy a word entirely from its title and the row's
 * only copy of that word is up there. `restrained condition` on `Conditions` is
 * exactly that, and it is pinned by a test.
 */
function Marked({
  found,
  query,
  plate = false,
}: {
  found: RulePreview;
  query: string;
  plate?: boolean;
}): React.JSX.Element {
  if (found.match === '') {
    return (
      <>
        {found.before}
        {found.after}
      </>
    );
  }
  return (
    <>
      {found.before}
      <mark
        style={{
          background: plate ? 'var(--line)' : 'transparent',
          color: 'var(--text)',
          fontWeight: 700,
          borderRadius: plate ? 2 : undefined,
        }}
      >
        {found.match}
      </mark>
      <Marked found={splitFirst(found.after, query)} query={query} plate={plate} />
    </>
  );
}

/**
 * The field, and the one control that empties it.
 *
 * Owned by the caller, because the caller decides what the rest of its sheet
 * does while a query is being typed.
 */
export function RuleSearchField({
  value,
  onChange,
  total,
  reaches = 'rules sections',
  label = 'Search the rules by title and text',
}: {
  value: string;
  onChange: (next: string) => void;
  total: number;
  /**
   * The noun `total` counts, for a caller whose haystack is not the sections.
   *
   * The app's word and never the book's, like every other label here. The
   * default is what the GM sheet has always said - and it is worth writing
   * down that the default *undercounts* what that sheet searches, because the
   * same field has driven the 780 records since the index landed. Correcting
   * it is a change to the GM screen's copy rather than to this door, and it is
   * pinned by `ruleSearch.test.tsx`; it is named here so the next reader finds
   * it noted rather than finds it new.
   */
  reaches?: string;
  /** The whole `aria-label`, for the same reason `reaches` exists. */
  label?: string;
}): React.JSX.Element {
  const phone = useIsPhone();
  return (
    <div className="row" style={{ flex: 'none', gap: 8 }}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The count is the dataset's, not a number typed here: a homebrew layer
        // that adds sections is searched too, and a placeholder that said 75
        // anyway would be the screen guessing at what it holds.
        placeholder={`Search ${String(total)} ${reaches}`}
        aria-label={label}
        enterKeyHint="search"
        autoFocus={!phone}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 44,
          padding: '8px 11px',
          font: '600 14px/1 var(--sans)',
        }}
      />
      {value !== '' && (
        <button
          type="button"
          className="t-label"
          onClick={() => onChange('')}
          aria-label="Clear the search"
          style={{ flex: 'none', minHeight: 44, minWidth: 44, padding: '0 10px', color: 'var(--muted)' }}
        >
          CLEAR
        </button>
      )}
    </div>
  );
}

/**
 * What the live line says, including when the answer is none.
 *
 * The counts are the eye's too - each group header prints its own - so this
 * says the total rather than repeating them, and it is the only sentence on
 * this surface a GM who cannot see the list gets for free.
 *
 * **It names the questions as well as the sections, and it has to.** The
 * QUESTIONS band is drawn above every other band, so a GM who cannot see it is
 * the one person for whom a sentence saying only `19 sections match` would put
 * the catalogue behind the whole list rather than in front of it - and in the
 * case that matters most, a question matched and no section did, that sentence
 * would have read `No section matches` over a surface that had just found
 * something. The questions come first here for the same reason they come first
 * on the glass.
 *
 * **The rest of the book is a third count, and it is appended rather than added
 * in.** A card, a weapon and an adversary are not sections and saying
 * `21 sections match` over a list holding two of each would be the same defect
 * the questions clause exists to close, one collection further out. It is a
 * clause of its own and not a sum because the bands are of their own: the
 * sections are banded by *where in a section* the words landed and the rest by
 * *what kind of thing* carried them, so one total over both would be a number
 * the eye cannot find anywhere on the glass.
 */
const spoken = (
  sections: number,
  records: number,
  asks: number,
  moment: Moment | null,
): string => {
  /*
   * A membership needs its own sentence because every wording below is about
   * *matching*, and under a moment nothing matched: no words were typed, and
   * `11 sections match` over a list nobody searched is the same defect the
   * scope branch under this one exists to prevent, arriving from the other
   * side. It names the moment because the moment is the whole of what the
   * count is about, and because this is the one line a GM who cannot see the
   * lit chip gets.
   */
  if (moment !== null) {
    const label = membershipBand(moment);
    const secs = sections === 1 ? '1 section belongs to' : `${String(sections)} sections belong to`;
    if (asks === 0) return `${secs} ${label}`;
    return `${secs} ${label}, with ${asks === 1 ? '1 question' : `${String(asks)} questions`}`;
  }
  /*
   * Two nouns in the wide sentence below are claims about the whole SRD, and
   * a scope can falsify each of them independently.
   *
   * **`section` is falsified by `sections: false`.** The sentence would be
   * counting a shelf this search never looked at, and `No section matches` is
   * the strongest thing this surface ever says - over a narrowed list it is
   * the app denying something it did not check.
   *
   * **`the book` is falsified by `only`.** Under a scope the records are one
   * person's own sheet, so `3 elsewhere in the book` can have the right number
   * and the wrong noun, which is the harder half to notice.
   *
   * So the narrow sentence is assembled from what was actually searched and
   * says whose it was. It stays inside this function rather than becoming a
   * second live region for the reason the region's own comment gives: what
   * assistive tech reads is a change of text in an element already on the
   * page, and two elements swapping is not that.
   */
  const found =
    sections === 0
      ? 'no section matches'
      : sections === 1
        ? '1 section matches'
        : `${String(sections)} sections match`;
  const base = asks === 0
    ? (sections === 0 ? 'No section matches' : found)
    : `${asks === 1 ? '1 question' : `${String(asks)} questions`} and ${found}`;
  if (records === 0) return base;
  const rest = records === 1 ? '1 elsewhere in the book' : `${String(records)} elsewhere in the book`;
  return `${base}; ${rest}`;
};

/**
 * The name of a hit, one step up from the label scale it is drawn in.
 *
 * `t-label` ships `600 10px/1 var(--mono)` with `0.16em` of tracking, which is
 * right for a *label* - a word standing over something else, read once. The
 * name of a hit is not that: it is the thing being read, and this list is the
 * one surface in the app where a person is scanning thirty of them for the one
 * they meant. The owner's constraint of 2026-08-26 - readability and
 * glanceability in consultation, nothing too small - lands here first.
 *
 * ## What a bigger name costs, measured rather than assumed
 *
 * The cost is not height on a row - it is a *name on a second line*, and the
 * tracking is what decides how many. `0.16em` at 10px is 1.6px between glyphs;
 * carried to 12px it is 1.92px, and the name is a fifth wider before a single
 * glyph has grown. Chrome, `pointer: coarse`, campaign seeded, on `countdown`
 * which returns 33 rows:
 *
 * | 393x852 | wrapped names | list height |
 * |---|---|---|
 * | 10px / 0.16em, as it was | 1 | 1992.62 |
 * | 12px / 0.16em | 3 | 2195.74 |
 * | 12px / 0.1em, as it is | **1** | 2164.54 |
 *
 * So at 393 the tracking cut pays for the whole of the size: one name wraps,
 * which is the same one that wrapped at 10px - `Fallen Warlord: Undefeated
 * Champion`, the longest name in the shipped dataset. What is left is +171.92px
 * over 33 rows, 8.6%, spent entirely on rows that carry a preview line and were
 * sitting on the 44px floor with room to spare.
 *
 * **At 375x667 it does not pay for all of it, and that is worth writing down
 * rather than rounding off.** Three names wrap where one did (four at
 * `0.16em`), because 30px less column is 30px less for a name that was already
 * close. Nothing is clipped and nothing crosses the 44px floor at either size;
 * the number of rows fully in the scroller is unchanged at both - 2 and 3 at
 * 393, 1 at 375 - because what grew is smaller than the rows already were.
 *
 * `1.3` rather than `1` because a wrapped name at `line-height: 1` in an
 * all-caps mono face sets its two lines touching, and the wrapped names are
 * exactly the long titles that most need reading.
 */
const ROW_NAME = { fontSize: 12, lineHeight: 1.3, letterSpacing: '0.1em', color: 'var(--text-2)' } as const;

/**
 * How the answer line is held to one line, and why it is not a character count.
 *
 * `preview` exists for the other case and cannot serve this one: it centres its
 * window on the words that matched, and returns the whole line when nothing
 * did - which for the five anchored paragraphs over 240 characters would be
 * four lines of book on a row that has to stay one.
 *
 * **A character cut was tried first and measured wrong.** Cutting at 110 gave a
 * row of **78.56** at 393x852: 110 characters of `.t-dense` do not fit a 363px
 * column, so the "one line" was two. Any number picked here is a guess about a
 * width this component does not know - the same line sits in a 363px sheet
 * column, a 369px screen column and a 290px column at 320.
 *
 * So the browser cuts it, at the width it actually has. This is the same three
 * declarations `Header.tsx` holds the character name with, and it has the
 * property a count cannot: one line at every width, with the ellipsis where the
 * glass really ends. The `title` carries the whole sentence for a pointer, and
 * the row opens for everyone else.
 */
const ANSWER_LINE = {
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: 'var(--muted)',
} as const;

/** What the three group headers say, and which hits belong under each. */
const GROUPS: ReadonlyArray<{ label: string; holds: (hit: RuleHit) => boolean }> = [
  { label: 'IN THE TITLE', holds: (hit) => hit.where === 'title' },
  { label: 'IN A HEADING', holds: (hit) => hit.where === 'heading' },
  { label: 'IN THE TEXT', holds: (hit) => hit.where === 'text' || hit.where === 'table' },
];

/**
 * The header that replaces all three when the search had to give ground.
 *
 * One band, not four, and it is drawn instead of the others rather than under
 * them: `searchRules` falls back to OR only when the AND found nothing at all,
 * so every hit in the list is one of these and a second header would be a group
 * with nothing in it. What it must never do is look like the answer - the list
 * under it is unranked and runs to eighteen sections for `setting difficulty`,
 * with the section that answers it eighth - so the header says what it is out
 * loud, in the same ink and at the same size as the three it stands in for.
 */
const SOME: ReadonlyArray<{ label: string; holds: (hit: RuleHit) => boolean }> = [
  { label: 'NO SECTION CARRIES ALL OF THOSE WORDS · THESE CARRY SOME', holds: () => true },
];

/**
 * The header over a membership, and it is a third family beside `GROUPS` and
 * `SOME` rather than a reuse of either.
 *
 * `GROUPS` sorts a hit by *where in the section the query landed*, and under a
 * moment nothing landed anywhere: there is no query, every row carries
 * `line: null`, and filing them under IN THE TITLE would be a header that is
 * simply false about all of them. `SOME` is the apology for a failed AND and is
 * further from the truth still.
 *
 * So the band says what the list actually is - the moment's own label, and the
 * count - and it is built per render because the label is the moment's.
 */
const membershipBand = (moment: Moment): string =>
  MOMENTS.find((m) => m.id === moment)?.label ?? '';

/**
 * The band the app's own questions stand in, above every band of the book's.
 *
 * It is not a member of `GROUPS` and it cannot be: those three sort a
 * `RuleHit` by where in a section the query landed, and a question is not a
 * section. It is computed beside them rather than inside them, which is also
 * what decides the one behaviour no document covers - **QUESTIONS stays when
 * `SOME` replaces the other three.** That is a choice and it is defensible: if
 * a question matched, this surface *has* found something the GM asked for, and
 * printing NO SECTION CARRIES ALL OF THOSE WORDS over the whole list would be
 * telling them otherwise about the one row that did. The header still says
 * exactly what it says, about the sections under it.
 *
 * `null` is the state before the chunk lands and it draws nothing - not a
 * spinner, not a placeholder row. The band appears when it has something to
 * say, the way an empty `GROUPS` band does.
 */
const ASKED = 'QUESTIONS';

/** Nothing, with an identity, so a render before the chunk lands does not churn. */
const NO_ASKS: readonly AskEntry[] = [];

/**
 * The catalogue, once it is here.
 *
 * `ask.ts` keeps it behind a dynamic `import()` so the strings are not in the
 * chunk that draws the GM screen, which means there is a moment - the first
 * render after the sheet opens, on a cold cache - when this surface has the
 * search and not the questions. `askLoaded()` is the synchronous half of that:
 * `ShowSheet` warms the import when the sheet opens, so by the time a GM has
 * reached the field and typed a character the chunk is usually already here and
 * the questions are in the **first** render rather than in a second one that
 * pushes the first rule hit down the glass while it is being read.
 *
 * When it is not here, this subscribes once and never again - the promise is
 * memoised in `ask.ts`, so a hundred keystrokes are one request - and the
 * `alive` flag is the ordinary guard: a GM who shuts the sheet before the chunk
 * lands must not be setting state on an unmounted tree.
 */
function useAskCatalogue(enabled: boolean): readonly AskEntry[] {
  const [entries, setEntries] = useState<readonly AskEntry[]>(() => askLoaded() ?? NO_ASKS);
  useEffect(() => {
    /*
     * `enabled` guards the *fetch* and not only the drawing, which is the
     * whole of what it buys. A mount that will never offer the questions must
     * not pull their chunk over the wire to then discard it - and on the
     * search screen that is the common case, because a player is offered them
     * at neither width.
     */
    if (!enabled) return undefined;
    if (askLoaded() !== null) return undefined;
    let alive = true;
    void loadAsk().then((next) => {
      if (alive) setEntries(next);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  // Not `entries`: the chunk may already be warm from another mount, and a
  // scope that says no questions means none even when they are free.
  return enabled ? entries : NO_ASKS;
}

/**
 * The hits, in the two searches' own order, grouped, one open.
 *
 * The dataset is read once here and handed down rather than read again in every
 * hit: a query that matches half the SRD would otherwise open forty
 * subscriptions to the store to answer one question. It is the whole dataset
 * rather than `dataset.rules` alone because the search now covers the whole of
 * what the app ships, and a layer that rewrites *any* collection changes both
 * what is found and what is drawn - nothing in this file holds a copy of
 * either.
 *
 * ## Two searches, and which one gets the sections
 *
 * `searchRules` keeps the 69 rules sections and `searchSrd` takes the other
 * 780, and that split is not bookkeeping. A rules hit can be **landed in**: the
 * band promises a subhead or a line, `landingIn` finds where that line is drawn
 * inside `ruleSection`'s blocks, and `BlockView` scrolls the GM to it and lights
 * their words in it. All of that machinery is about a `SectionView`, which is
 * what only a section has. A record has no blocks to land between - it is a
 * handful of short fields drawn whole - so it gets the simpler row, and the
 * section keeps the richer one it already had rather than being flattened down
 * to meet it.
 *
 * The index is filtered rather than the hits, and one line of filter saves the
 * expensive half of the work: searching all 849 would re-split the 100,165
 * characters of section bodies on every keystroke to produce hits this
 * component would then throw away.
 *
 * ## The bands, and why the book's rest gets its own
 *
 * IN THE TITLE / IN A HEADING / IN THE TEXT sort a section hit by *where in the
 * section* the words landed, and they are untouched. The rest of the book is
 * banded by **kind** - DOMAIN CARDS, ADVERSARIES, WEAPONS - which is the
 * distinction its own hits make: a weapon and a domain card can share a name,
 * and the band is what tells a GM which of the two a row is without opening it.
 * Folding records into the three would have made IN THE TITLE hold both, and
 * the one thing that row most needs to say would have needed saying again on
 * every row.
 *
 * The kind bands stand below the section bands, in the dataset's own order.
 * That is not a ranking and it is the same refusal `searchRules` makes: the
 * sections are first because the search that reaches them is the one this
 * surface was built around, and inside a band the order is the dataset's.
 */
export function RuleSearchResults({
  query,
  onQuery,
  questions = true,
  moment = null,
}: {
  query: string;
  /**
   * A moment to browse instead of a query to search.
   *
   * The two are exclusive by construction and the caller enforces it: typing
   * clears the moment and pressing a chip clears the field. They are not two
   * halves of one answer - a query asks *where are these words*, and a moment
   * asks *what do I read now*, and merging them would put a list nobody asked
   * for under a list somebody did.
   */
  moment?: Moment | null;
  /**
   * Whether the app's own twelve questions are offered above the book's hits.
   *
   * The one thing a second host needed to say, and the only one left. It is a
   * property of *who is looking* rather than of how much book they are looking
   * at: the catalogue is written in the GM's voice, so the GM sheet takes them
   * and the search screen does not. It guards the fetch and not only the
   * drawing - see `useAskCatalogue`.
   */
  questions?: boolean;
  /**
   * Put words in the field this list is answering, if the caller owns one.
   *
   * One caller does - `ShowSheet` holds the query - and one deliberately does
   * not: the fixture that mounts these results alone. It is optional so that
   * the second stays possible, and the one control that needs it is simply not
   * drawn without it. That control is the dead-pointer door in `AskRow`, which
   * a shipped entry cannot reach; see there.
   */
  onQuery?: (next: string) => void;
}): React.JSX.Element {
  const dataset = useApp((s) => s.dataset);
  const rules = dataset.rules;
  /*
   * All sixty-nine, always. This searched a scoped subset for one release -
   * the search screen opened narrowed to the character's own material - and
   * the owner took that back: the search is global, and a screen that reads
   * the book reads the book.
   *
   * `rules` is also what goes down to `Hit` and `AskRow` below, and the two
   * uses are worth keeping apart in the reading even now they are the same
   * array: there it is not a haystack but how an open hit finds its blocks and
   * how a question finds the section it points at. Anything that ever narrows
   * the first must not narrow the second.
   */
  const searched = rules;
  /*
   * A membership is not a search result and is assembled rather than found.
   *
   * `where: 'title'` and `line: null` are the honest values, not a convenient
   * pair: no query landed anywhere, so there is no line to preview and none to
   * light. Both are already shipped states - `Hit` draws no preview line
   * without one, and `landingIn` answers `null`, which opens the section at its
   * top. That is exactly right here: the section *is* the answer, where under a
   * query it would only be where the answer lives.
   *
   * It reuses `Hit` rather than growing a second row. There is one drawing of a
   * chosen section in this app and this is not going to be the second.
   */
  const membership = useMemo(
    (): RuleHit[] =>
      moment === null
        ? []
        : sectionsIn(rules, moment).map((section) => ({
            id: section.id,
            title: section.title,
            page: section.sourcePage ?? null,
            where: 'title' as const,
            line: null,
            partial: false,
          })),
    [rules, moment],
  );
  const hits = useMemo(
    () => (moment === null ? searchRules(searched, query) : membership),
    [searched, query, moment, membership],
  );
  // The 780 the rules search cannot reach. See the header for why the index is
  // filtered here rather than the hits it returns.
  const beyondRules = useMemo(
    () => srdIndex(dataset).filter((record) => record.kind !== 'rules'),
    [dataset],
  );
  /*
   * No records under a moment, and it costs nothing to arrange: a moment is a
   * judgement about *rules sections*, a weapon has no moment to belong to, and
   * with no query there is nothing for `searchSrd` to match anyway. Saying it
   * out loud rather than relying on the empty query, because the reason is the
   * first sentence and not the second - and because today the opposite is what
   * buries the answer, with 322 record rows drawn over DAMAGE's own sections.
   */
  const found = useMemo(
    () => (moment === null ? searchSrd(beyondRules, query) : []),
    [beyondRules, query, moment],
  );
  const catalogue = useAskCatalogue(questions);
  /*
   * Under a moment the catalogue is filtered on the field itself, not on the
   * label the way `searchAsk` does it.
   *
   * The two agree today and the agreement is a coincidence worth not relying
   * on: `searchAsk` puts the moment's *label* in its haystack, so pressing
   * DAMAGE happens to return exactly the entries filed under `damage`. That
   * holds only while no two labels share a word and no entry's own words
   * contain another moment's label. `entry.moment === moment` is the same
   * answer arrived at by construction, and it cannot drift when a label is
   * reworded - which the label's own docblock says is a thing that may happen.
   *
   * **No test on the shipped catalogue can tell the two apart, and that is
   * said here rather than left to be discovered.** A mutant that swapped this
   * line back for `searchAsk` passes every test in the suite, because on the
   * twelve entries as written the two agree exactly. What is tested is the
   * claim rather than the wiring: `moments.test.ts` builds a catalogue where
   * they differ and pins that the label match takes an entry filed under
   * another moment and loses one whose label was reworded. So this line is
   * held by an argument and by a proof of the argument, and not by a fixture -
   * which is worth knowing before anyone simplifies it back.
   */
  const asked = useMemo(
    () =>
      moment === null
        ? searchAsk(catalogue, query)
        : catalogue.filter((entry) => entry.moment === moment),
    [catalogue, query, moment],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  let bands = GROUPS;
  if (moment !== null) {
    // One band, named for the moment. See `membershipBand` for why neither of
    // the other two families can stand over this list.
    bands = [{ label: membershipBand(moment), holds: () => true }];
  } else if (hits.some((hit) => hit.partial)) {
    bands = SOME;
  }

  /*
   * The app's own questions, drawn in one of two places. See the comment at
   * the second call site for why a moment reverses the order.
   */
  const askedBand = asked.length > 0 && (
    <div className="stack" style={{ flex: 'none', gap: 10 }}>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
            {ASKED} · {asked.length}
          </span>
          {asked.map((entry) => (
            <AskRow
              key={entry.id}
              entry={entry}
              query={query}
              rules={rules}
              open={entry.id === openId}
              onToggle={() => {
                setOpenId(entry.id === openId ? null : entry.id);
              }}
              onQuery={onQuery}
            />
      ))}
    </div>
  );

  return (
    <>
      {/*
        The one thing on this surface that speaks when it changes, and it says
        the empty answer in the same breath as the counts. It used to sit below
        the zero-hits guard, inside the branch that draws the groups, so it was
        absent from the only result a GM reaches by typing one word too many:
        twenty sections became a sentence an eye could read and a live region
        could not, which is the silence this exists to prevent. The group
        headers below carry the same counts for an eye, and a header is not
        live.

        It is the first child of this fragment and stands ahead of the branch,
        so going from twenty matches to none changes the text of an element
        that was already on the page instead of swapping one element for
        another - the form of the change assistive tech will read. What it
        still cannot do is carry the *first* answer: nothing here is mounted
        until the field has a character in it, so the region arrives together
        with its own first content, which is the case a screen reader most
        often declines to announce. Curing that would mean a live region living
        outside these results, in a sheet that deliberately does not run the
        search - the test that mounts this component alone says why the search
        belongs to it. jsdom can prove the text and the position; it cannot
        prove the utterance, and no test in this repo claims to.
      */}
      <span className="sr-only" role="status">
        {spoken(hits.length, found.length, asked.length, moment)}
      </span>
      {/*
        The honest silence, and it is now guarded on both lists rather than on
        one. Its second clause - not one of those words is in the rules the app
        is holding - is true of the sections and false of the surface the
        moment a question has matched, and a GM reading "this dataset does not
        carry that" over a row that does carry it would be reading the app
        contradict itself. Nothing takes its place when a question matched: the
        band above says how many, and §4 forbids an apology row for the other
        direction - a query that finds sections and no question prints nothing
        about questions at all.
      */}
      {/*
        `moment === null` guards it, and not as a formality. Both wordings
        below are about words that were typed, and under a moment none were -
        so a layer that stripped every section of a moment would otherwise be
        answered with "not one of those words is in the book" over a query
        that does not exist. A moment with nothing in it is not reachable on
        the shipped data, which is exactly why the branch that would print
        nonsense has to be closed here rather than trusted not to run.
      */}
      {moment === null && hits.length === 0 && asked.length === 0 && found.length === 0 && (
        <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
          Nothing in this dataset carries that. The search reads every section’s title, its
          subheads and its whole text, and the name and the words of every card, adversary,
          environment and piece of gear the app ships; it asks for every word you typed, and not
          one of those words is in the book the app is holding.
        </p>
      )}
      {moment === null && askedBand}
      {bands.map((group) => {
        const inGroup = hits.filter(group.holds);
        if (inGroup.length === 0) return null;
        return (
          <div key={group.label} className="stack" style={{ flex: 'none', gap: 10 }}>
            <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
              {group.label} · {inGroup.length}
            </span>
            {inGroup.map((hit) => (
              <Hit
                key={hit.id}
                hit={hit}
                query={query}
                rules={rules}
                open={hit.id === openId}
                onToggle={() => {
                  setOpenId(hit.id === openId ? null : hit.id);
                }}
              />
            ))}
          </div>
        );
      })}
      {/*
        Under a moment the questions come *after* the sections, and that is the
        one place this surface reverses its own order.
        
        The reason QUESTIONS stands above every band of the book's is written
        where it is declared: a query that matched a question and no section
        would otherwise print `No section matches` over a surface that had just
        found something. **That case cannot arise under a moment** - the
        smallest of the six carries seven sections - so the argument does not
        reach here, and what is left is which of the two the GM asked for. They
        pressed a moment: the sections are the answer and the questions are a
        note beside it.
        
        It is also what buys back the rows. Measured at 393x852, the questions
        band plus its two rows stood 148px above the first section in a 240.00
        reading window, so nothing of the answer was on the glass -
        `rowsFullyVisible` was 0. Moved below, the first sections are.
      */}
      {moment !== null && askedBand}
      {SRD_KINDS.map((kind) => {
        const inKind = found.filter((hit) => hit.kind === kind);
        if (inKind.length === 0) return null;
        return (
          <div key={kind} className="stack" style={{ flex: 'none', gap: 10 }}>
            <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
              {SRD_KIND_LABELS[kind]} · {inKind.length}
            </span>
            {inKind.map((hit) => {
              // Keyed and opened on kind *and* id. Two collections of the
              // dataset may spell an id the same way, and a single open hit
              // shared with the sections and the questions above needs one key
              // space: `weapon:dagger` cannot collide with a section called
              // `dagger`, and an id on its own could.
              const key = `${hit.kind}:${hit.id}`;
              return (
                <RecordHit
                  key={key}
                  hit={hit}
                  // Resolved only for the row that is open, which is at most
                  // one: a walk of 780 per row per keystroke would be paying
                  // for twenty records to draw the fields of one.
                  record={
                    key === openId
                      ? (beyondRules.find((r) => r.kind === hit.kind && r.id === hit.id) ?? null)
                      : null
                  }
                  query={query}
                  open={key === openId}
                  onToggle={() => {
                    setOpenId(key === openId ? null : key);
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/**
 * One record of the book beyond the rules: its name, its page, the line the
 * query landed in, and - opened - its own words under the app's labels.
 *
 * ## Why this is not `Hit`
 *
 * `Hit`'s header is the same three lines and its button is the same 44px
 * target, deliberately, because a GM should not be able to tell from the shut
 * row that two different searches are behind the list. What it does not share
 * is the open half: `Hit` resolves a `SectionView`, finds a landing inside it
 * and scrolls the GM to their line. A record has nowhere to land - it is four
 * to seven short fields drawn whole, and the whole of it is already on the
 * glass when it opens - so the scroll, the `land` ref and `landingIn` have
 * nothing to be pointed at, and a shared component carrying them would be
 * carrying a branch that can never fire.
 *
 * ## Why not `DomainCardView`, `AdversaryBlock`, `EnvironmentBlock`
 *
 * The plan this part comes from counted four renderers that already draw these
 * kinds and called the work an adapter. **Reading them, three of the four do
 * not fit this surface, and the reason is the same in each case: they are not
 * readers, they are the screens their own surface needs.** `EnvironmentBlock`
 * requires `active` and `onToggle` and draws a SET ACTIVE button that writes to
 * the GM session - a control this list has no business growing, and one that
 * cannot exist at all on the Play screen part 2.2 moves this file to.
 * `DomainCardView` draws a 322px illustrated card and decodes art for it; the
 * column it would open into on Play is the one measurement the whole plan is
 * still gated on, and dropping an unmeasured 322px into it is exactly the move
 * the owner's readability constraint was written against. `AdversaryBlock` is
 * the closest fit and drawing one kind through its own renderer while twelve go
 * through another would be the fork this file's header spends a paragraph
 * refusing.
 *
 * So every record opens the same way, through its own fields: the label in the
 * app's ink and the book's words under it, marked with the same walk the
 * preview line uses so the GM's words are lit where they landed. Those screens
 * keep their renderers, the page stamp says where the rest of the record is
 * printed, and the day 2.2 measures that column this is one dispatch away from
 * changing its mind per kind.
 */
function RecordHit({
  hit,
  record,
  query,
  open,
  onToggle,
}: {
  hit: SrdHit;
  /**
   * The record the hit came out of, for its fields. Null is unreachable while
   * the hit came from the index this is handed, and drawn as nothing anyway:
   * a layer can land between the click and the render.
   */
  record: SrdRecord | null;
  query: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <section
      className="stack"
      // The seam between a section and a record, and it is on the row for the
      // same single reason `data-ask` is on a question row: three kinds of row
      // share this shape and a `<button aria-expanded>`, and a test that could
      // not tell them apart would count rows the rules search never produced
      // and call it proof. It names the kind rather than being a bare flag
      // because the kind is what the band above it says.
      data-kind={hit.kind}
      style={{ flex: 'none', gap: open ? 8 : 0 }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="stack"
        style={{
          flex: 'none',
          minHeight: 44,
          width: '100%',
          gap: 3,
          padding: '6px 2px',
          textAlign: 'left',
          alignItems: 'flex-start',
        }}
      >
        <span className="row" style={{ width: '100%', gap: 8 }}>
          <span className="t-label" style={{ ...ROW_NAME, flex: 1, minWidth: 0 }}>
            <Marked found={preview(hit.name, query)} query={query} plate />
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
            {stamp(hit.page)}
          </span>
        </span>
        {hit.line !== null && (
          <span className="t-dense" style={{ color: 'var(--muted)' }}>
            <Marked found={preview(hit.line, query)} query={query} />
          </span>
        )}
      </button>
      {open && record !== null && (
        <div className="stack" style={{ flex: 'none', gap: 10, padding: '0 2px 4px' }}>
          {record.fields.map((f) => (
            <div key={f.label} className="stack" style={{ flex: 'none', gap: 3 }}>
              <span className="t-meta" style={{ flex: 'none', color: 'var(--dim)' }}>
                {f.label}
              </span>
              {f.lines.map((line, at) => (
                <p
                  // The book's own words are the only thing that could key
                  // these, and a record may repeat a line - two of a class's
                  // connection questions can be worded alike. The index is
                  // built once per dataset and never reordered, so the position
                  // is stable for as long as the list is.
                  key={`${String(at)}:${line}`}
                  className="t-body"
                  style={{ margin: 0, maxWidth: '62ch', whiteSpace: 'pre-wrap' }}
                >
                  <Marked found={splitFirst(line, query)} query={query} />
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** A block of the open section, and the place inside it the hit promised. */
export interface Landing {
  block: number;
  at: BlockTarget;
}

/**
 * Where in the open section the line this hit is promising is drawn, or null.
 *
 * The band said IN A HEADING and named a subhead; opening the hit has to put
 * the GM on that subhead rather than at the top of the section that contains
 * it. `hit.line` is already exactly the string to look for - `quoteFrom`
 * strips `## ` with `text.replace(/^#+\s+/, '')` and `ruleBlocks` captures the
 * same subhead with `/^##\s+(.+)$/`, so the two are the identical string and
 * the match is an equality rather than a search.
 *
 * **`hit.where` picks which of the two lookups runs, and running both was the
 * defect.** A subhead is also a string the book may quote in its own prose:
 * `making-gm-moves` writes *the "Example GM Moves" list* inside its QUICK
 * REFERENCE block, above the `## Example GM Moves` that ends the section. A
 * heading-or-prose search finds the earlier block first, so the band that had
 * actually named a subhead landed the GM on the block that merely mentioned
 * it - the defect the landing was written to fix, arriving inside the fix. `where` is `quoteFrom`'s own record of which line it took, so a
 * `heading` hit is looked up among the headings alone and a `text` hit among
 * the parts alone.
 *
 * A `heading` hit lands on the **block** the subhead opens, because the subhead
 * is that block's first drawn line and there is nothing finer to ask for. A
 * `text` hit lands on the **paragraph or the bullet** that carries its line,
 * which is what `BlockTarget` exists to say.
 *
 * **Equality first, `includes` only if nothing is equal, and the order is the
 * whole of the correctness.** `ruleList` strips `- ` exactly as `quoteFrom`
 * does and `paragraphs` never trims inside a paragraph, so on everything the
 * SRD ships `part.text === hit.line` - all 613 quotable body lines resolve to a
 * part or an item by equality and not one falls through to `includes`, which
 * `ruleSearch.test.tsx` walks the whole book to assert. A single `includes`
 * pass would let a long paragraph higher up the section, which merely *contains*
 * the line, take the landing off the part that *is* it.
 *
 * The `includes` pass is not dead code, it is the degradation. `dataset.ts`
 * resolves layers and `rules` is overridable, so a homebrew layer can write a
 * paragraph across several lines; there the line the GM was quoted is inside a
 * part rather than equal to it, and this lands on the **paragraph that carries
 * it**. That is the owner's decision of 2026-08-25 §7, taken with the shipped
 * dataset measured at zero multi-line prose parts: better than the block it
 * used to be, and it does not shut the door on a per-line node, which would be
 * one more `BlockTarget` branch inside two files and inside no caller.
 *
 * Null for a `title` hit, which promised the section and not a place in it, and
 * for a `table` hit, whose line is null because no cell was worth quoting.
 * Both of those are already answered by the top of the section, which is where
 * a hit with no landing opens.
 */
/**
 * The block a subhead opens, or -1.
 *
 * One function because there are now two callers who must agree byte for byte:
 * the heading branch of `landingIn` below, where the string came out of the
 * book through `quoteFrom`, and `AskRow`, where it was written into
 * `askCatalogue.ts` by a person. The second is the one the equality is load
 * bearing for - `tests/gm/ask.test.ts` asserts every catalogue heading against
 * the dataset's own `## ` string, and that assertion is only a property of the
 * screen while the screen looks the heading up the same way. An `includes` or a
 * case-insensitive compare here would make the test true and the row wrong.
 */
const headingBlock = (section: SectionView, heading: string): number =>
  section.blocks.findIndex((block) => block.heading === heading);

export function landingIn(section: SectionView, hit: RuleHit): Landing | null {
  const line = hit.line;
  if (line === null) return null;
  if (hit.where === 'heading') {
    const block = headingBlock(section, line);
    return block === -1 ? null : { block, at: { kind: 'block' } };
  }
  for (const [block, drawn] of section.blocks.entries()) {
    for (const [part, piece] of drawn.parts.entries()) {
      if (piece.kind === 'text' && piece.text === line) return { block, at: { kind: 'part', part } };
      if (piece.kind === 'list') {
        const item = piece.items.indexOf(line);
        if (item !== -1) return { block, at: { kind: 'item', part, item } };
      }
    }
  }
  for (const [block, drawn] of section.blocks.entries()) {
    for (const [part, piece] of drawn.parts.entries()) {
      if (piece.kind === 'text' && piece.text.includes(line)) {
        return { block, at: { kind: 'part', part } };
      }
    }
  }
  return null;
}

function Hit({
  hit,
  query,
  rules,
  open,
  onToggle,
}: {
  hit: RuleHit;
  query: string;
  rules: RulesSection[];
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const section = useMemo(() => (open ? ruleSection(rules, hit.id) : null), [rules, hit.id, open]);
  const landing = section === null ? null : landingIn(section, hit);

  /*
   * A callback ref rather than an effect, because the thing being waited for
   * is the node and not a render: React hands it over the moment the landing
   * node is attached and hands back `null` when it goes, so the scroll
   * happens once per opening and never on a re-render that left the same node
   * in place. It is a `useCallback` with no deps for that second half - a fresh
   * arrow every render would be a fresh ref every render, and React would
   * detach and reattach it on a keystroke that changed nothing.
   *
   * **What that leaves alone got narrower when the landing did, and it is a
   * trade rather than a free win.** The condition used to be the same landing
   * *block*; it is now the same landing *part*, because that is the node the
   * ref is on. A hit stays open while the GM keeps typing - `openId` is state
   * in `RuleSearchResults` and is not cleared on a new query, and `Hit` is
   * keyed on `hit.id` - so a keystroke that makes `quoteFrom` quote a different
   * line of the same block now moves the GM's reading position where before it
   * did not. It moves it *onto the line the header is quoting at them*, which
   * is the promise this landing exists to keep: leaving the body still while
   * the row above it changed its mind would put the two out of step. The other
   * reading is defensible and costs one line here - hand `BlockView` a
   * `{ kind: 'block' }` target instead of `landing.at` - so it is written down
   * and pinned by *follows the quoted line when a keystroke moves it inside the
   * same block* in `ruleSearch.test.tsx` rather than left for someone to
   * discover.
   *
   * `scrollIntoView` is optional-called because jsdom does not implement it -
   * the test that pins this behaviour puts its own on the prototype and
   * watches for the call, which is the only form of the property a test in
   * this repo can check.
   */
  const land = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView?.({ block: 'start' });
  }, []);

  /*
   * The mark walk, handed to `BlockView` as a function rather than as a
   * component, because `RuleSearch` already imports `BlockView` and an import
   * back would be a cycle. `Marked` and `splitFirst` stay private here, and the
   * policy - which words, in whose case, with what on the `<mark>` - stays in
   * the file that owns the query.
   *
   * `splitFirst` and not `preview`: `preview` windows a line down to 150
   * characters of book for a column 363px wide, which is right for a shut hit's
   * one-line preview and would be cutting the book out of the middle of the
   * section a GM just opened. The body gets the line whole.
   */
  const markBody = useCallback(
    (text: string): React.ReactNode => <Marked found={splitFirst(text, query)} query={query} />,
    [query],
  );

  return (
    <section className="stack" style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="stack"
        style={{
          flex: 'none',
          minHeight: 44,
          width: '100%',
          gap: 3,
          padding: '6px 2px',
          textAlign: 'left',
          alignItems: 'flex-start',
        }}
      >
        <span className="row" style={{ width: '100%', gap: 8 }}>
          <span className="t-label" style={{ ...ROW_NAME, flex: 1, minWidth: 0 }}>
            <Marked found={preview(hit.title, query)} query={query} plate />
          </span>
          <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
            {stamp(hit.page)}
          </span>
        </span>
        {hit.line !== null && (
          <span className="t-dense" style={{ color: 'var(--muted)' }}>
            <Marked found={preview(hit.line, query)} query={query} />
          </span>
        )}
        {hit.where === 'table' && (
          <span className="t-meta" style={{ color: 'var(--dim)' }}>
            Inside this section’s table.
          </span>
        )}
      </button>
      {open &&
        (section === null ? (
          // Unreachable while the hit came from the same `rules` array this
          // reads, and drawn anyway: `rules` is one prop now, but a section can
          // still go if a layer lands between the click and the render.
          <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
            This dataset no longer carries that section.
          </p>
        ) : (
          section.blocks.map((block, i) => {
            const key = `${block.heading ?? ''}-${String(i)}`;
            // Every block is drawn the same way, and one of them is handed a
            // place, this file's ref and the mark walk. A `<div ref>` used to
            // be wrapped round the landing block instead, because `BlockView`
            // took `{ block }` and nothing else; the wrapper is gone with the
            // reason for it, and with it the one node in an open hit that
            // measured nothing.
            //
            // The landing block alone is marked, which is the owner's decision
            // of 2026-08-25 §8: `making-gm-moves` carries `move` in every one
            // of its six blocks, and lighting all six would leave the GM's own
            // line no easier to find than the five they did not ask for.
            if (landing === null || landing.block !== i) {
              return <BlockView key={key} block={block} />;
            }
            return (
              <BlockView
                key={key}
                block={block}
                land={{ at: landing.at, ref: land }}
                mark={markBody}
              />
            );
          })
        ))}
    </section>
  );
}

/**
 * One question, and the block of the book it points at.
 *
 * ## It is `Hit`'s header upside down, and that is the argument
 *
 * A hit leads with the book's title and puts the GM's own words under it,
 * because a hit *is* a section and the title is what was found. A question
 * leads with the question - the app's sentence, in `.t-read`, the size this
 * app uses for prose somebody is reading in order to decide something - and
 * puts the address under it in the label face. What the GM is scanning for
 * here is their own situation, not a heading of the SRD; the address is what
 * they read second, to know whether to trust the answer before they open it.
 *
 * The address is the whole of the provenance and it is drawn shut, not on
 * opening: section title, the subhead when the entry names one, and the page
 * stamp - all three read out of `dataset.rules` at draw time, none of them
 * typed into `askCatalogue.ts`. That is what stands between this catalogue and
 * the one failure its tests cannot catch, which is content moving from one
 * subhead to another while both keep their names: every assertion still passes
 * and the answer is quietly wrong, and the only defence is that a GM is looking
 * at the book's own words under the book's own address rather than at a
 * paraphrase this repo wrote.
 *
 * The shut row reads the section out of `rules` with a `find` rather than
 * through `ruleSection`, and only the open one parses. `ruleSection` splits a
 * whole body into blocks and every block into parts; twelve rows doing that on
 * every keystroke would be twelve parses to print twelve titles. The parse
 * happens when a row opens, which is once and on purpose.
 *
 * ## Opening: the section whole, landed on the block the entry named
 *
 * Not the block alone. The pointer is *where to start reading*, and a rule read
 * with the paragraphs around it cut away is how a GM ends up ruling on half a
 * sentence; `Hit` already draws the section whole and scrolls, and doing the
 * same thing here means there is still exactly one drawing of a section in this
 * app. The ref goes on the named block, so the block the question points at is
 * at the top of the scroller with the rest of its section under it.
 *
 * ## Two ways the pointer can rot, and neither is guessed at
 *
 * This is the runtime half of the ladder the rot test cannot cover, and it is
 * `RECUPERO-JOURNAL-2026-08-24.md`'s design rather than one invented here.
 *
 * **The subhead is gone and the section is not.** The section is drawn whole
 * and the row says so, out loud. What it must never do is fuzzy-match: a
 * subhead that has been renamed is not the nearest subhead that survived, and
 * landing a GM on a heading that merely looks similar is worse than landing
 * them at the top, because the top is visibly the top and a wrong subhead looks
 * like an answer.
 *
 * **The section is gone.** That is the `Unresolved` shape `SessionBody.tsx`
 * already uses for a link whose target this device cannot resolve - say that it
 * is not here, say the pointer is kept, say what would bring it back - plus the
 * half that turns a dead pointer into a live search: a control that puts the
 * question's own index word into the field. Neither is reachable with the
 * shipped dataset, where all twelve anchors resolve; both are reachable the
 * moment a homebrew layer rewrites `rules`, which `dataset.ts` allows by
 * design.
 *
 * **One index word and not all of them, and that is a departure from the
 * journal's wording with a reason.** `searchRules` is an AND over every term
 * the GM typed, so filling the field with eight `also` words would guarantee
 * that no section carries them all and hand back the OR fallback - a list under
 * NO SECTION CARRIES ALL OF THOSE WORDS, which is the honest shape of a bad
 * answer and not the live search the design asked for. The first word of `also`
 * is the one the entry was written around, and the control prints it, so the
 * GM can see what is about to be typed for them.
 */
function AskRow({
  entry,
  query,
  rules,
  open,
  onToggle,
  onQuery,
}: {
  entry: AskEntry;
  query: string;
  rules: RulesSection[];
  open: boolean;
  onToggle: () => void;
  onQuery?: (next: string) => void;
}): React.JSX.Element {
  const named = rules.find((rule) => rule.id === entry.at.section) ?? null;
  const section = useMemo(
    () => (open ? ruleSection(rules, entry.at.section) : null),
    [rules, entry.at.section, open],
  );
  const heading = entry.at.heading;
  /*
   * `heading === null` means the block before the first subhead, which is
   * block 0 - not "no block".
   *
   * It read `-1` here and that was a defect with six victims: half the
   * catalogue anchors with no heading, including both Difficulty questions,
   * and every one of them opened at the top of its section with nothing landed
   * and nothing lit. `checkEntry` has always resolved it to `blocks[0]`, so the
   * test and the row disagreed about where a question pointed, and the test
   * was right.
   */
  const block = section === null ? -1 : heading === null ? 0 : headingBlock(section, heading);
  const word = entry.also[0] ?? '';

  /*
   * The line that answers, resolved out of the dataset every time it is drawn
   * and never stored anywhere.
   *
   * This is the whole of §2.4 and the whole of the licence rule at once. The
   * catalogue holds three numbers and a slug - a section, a subhead, an index -
   * and the words arrive here, so the repository quotes nothing and a homebrew
   * layer that rewrites the paragraph changes what a GM reads without this file
   * knowing. `at.part` is `null` for the two blocks that hold no paragraph at
   * all - one is a table, one a list of sixteen moves - and those draw the
   * app's own locator sentence instead, the way `Hit` already does for a table.
   *
   * Parsed here rather than reusing the `open` memo above, because the point is
   * to have it while the row is *shut*. It is memoised on the section rather
   * than on the row, so twelve rows over four sections parse four times.
   */
  const answer = useMemo((): string | null => {
    if (entry.at.part === null) return null;
    const view = ruleSection(rules, entry.at.section);
    if (view === null) return null;
    const at = heading === null ? 0 : headingBlock(view, heading);
    const part = view.blocks[at]?.parts[entry.at.part];
    return part !== undefined && part.kind === 'text' ? part.text : null;
  }, [rules, entry.at.section, entry.at.part, heading]);

  // The same callback ref `Hit` uses, for the same reason: React hands the node
  // over when it is attached, so the scroll happens once per opening rather
  // than on every render that left the same node in place.
  const land = useCallback((node: HTMLElement | null) => {
    node?.scrollIntoView?.({ block: 'start' });
  }, []);
  const markBody = useCallback(
    (text: string): React.ReactNode => <Marked found={splitFirst(text, query)} query={query} />,
    [query],
  );

  return (
    <section className="stack" data-ask style={{ flex: 'none', gap: open ? 8 : 0 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="stack"
        style={{
          flex: 'none',
          minHeight: 44,
          width: '100%',
          gap: 3,
          padding: '6px 2px',
          textAlign: 'left',
          alignItems: 'flex-start',
        }}
      >
        <span className="t-read" style={{ width: '100%', margin: 0 }}>
          <Marked found={preview(entry.ask, query)} query={query} />
        </span>
        <span className="row" style={{ width: '100%', gap: 8 }}>
          <span className="t-label" style={{ flex: 1, minWidth: 0, color: 'var(--dim)' }}>
            {named === null ? entry.at.section : named.title}
            {heading === null ? '' : ` · ${heading}`}
          </span>
          {named !== null && (
            <span className="t-meta" style={{ flex: 'none', color: 'var(--muted)' }}>
              {stamp(named.sourcePage ?? null)}
            </span>
          )}
        </span>
        {/*
          The book's own words, below the address rather than above the
          question, and in the ink `Hit` gives the book.

          Below, because the question is what a GM scans their own situation
          against and it stays first - `ruleSearch.test.tsx` reads the row's
          first `t-read` and expects the question, which is that rule written
          down. Below the address too, so the order a GM reads is: is this my
          situation, where does the answer live, what does it say. The address
          still qualifies the sentence rather than the sentence standing on its
          own.

          `.t-dense` in `--muted` is what a shut `Hit` draws a previewed line
          in, so the book reads the same on both kinds of row. Cut at the head
          and not through `preview`: `preview` windows around the words that
          matched, and nothing matched here - there is no query behind a
          moment's chip at all.
        */}
        {answer !== null && (
          <span className="t-dense" style={ANSWER_LINE} title={answer}>
            {answer}
          </span>
        )}
        {answer === null && named !== null && (
          <span className="t-meta" style={{ width: '100%', color: 'var(--dim)' }}>
            Inside this section, and not in one sentence.
          </span>
        )}
      </button>
      {open &&
        (section === null ? (
          <div className="stack" style={{ flex: 'none', gap: 8 }}>
            <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
              This dataset no longer carries that section, so there is nothing to draw. The
              question is kept: load the layer it came from and it points somewhere again.
            </p>
            {onQuery !== undefined && word !== '' && (
              <button
                type="button"
                className="t-label"
                onClick={() => {
                  onQuery(word);
                }}
                style={{
                  flex: 'none',
                  minHeight: 44,
                  padding: '0 10px',
                  alignSelf: 'flex-start',
                  color: 'var(--muted)',
                }}
              >
                SEARCH “{word}” INSTEAD
              </button>
            )}
          </div>
        ) : (
          <>
            {heading !== null && block === -1 && (
              <p className="t-body" style={{ flex: 'none', margin: 0, maxWidth: '62ch' }}>
                This dataset no longer carries that subhead, so the whole section is drawn
                instead. Nothing is matched loosely: a renamed subhead is not the nearest one
                still standing.
              </p>
            )}
            {section.blocks.map((drawn, i) => {
              const key = `${drawn.heading ?? ''}-${String(i)}`;
              if (i !== block) return <BlockView key={key} block={drawn} />;
              return (
                <BlockView
                  key={key}
                  block={drawn}
                  land={{ at: { kind: 'block' }, ref: land }}
                  mark={markBody}
                />
              );
            })}
          </>
        ))}
    </section>
  );
}
