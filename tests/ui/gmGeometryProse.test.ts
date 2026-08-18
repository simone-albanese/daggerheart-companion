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
 * IT HOLDS the terms. A shut row is its panel border, its padding, its header's
 * floor and the list's gap, and all four are declared in the tree, so 54.00 and
 * 62.00 are checkable here and go red the moment one of them moves. The same
 * for the topic strip: `--tap`, the chip's padding and border, the strip's gap,
 * the region's padding and the sheet's border are all declared, so 367.00 and
 * 144.00 are arithmetic over declarations rather than remembered numbers.
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
  const found = /'\d+px (\d+)px \d+px'/.exec(src.slice(at));
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

const chipPadX = (): number => {
  const found = /padding: '0 (\d+)px',\n\s*borderRadius: 'var\(--r3\)'/.exec(
    source('src/ui/gm/Reference.tsx'),
  );
  if (found === null) throw new Error('the topic chip no longer declares `padding: 0 Npx`');
  return Number.parseInt(found[1]!, 10);
};

const stripGap = (): number =>
  declared('src/ui/gm/Reference.tsx', 'aria-label="What to look up"', 'gap');

describe('the GM screen states the geometry its own declarations make', () => {
  /*
   * The step is the whole of the list's arithmetic, and every term of it is
   * declared. 60px stood in `SessionList.tsx` because 8px of panel padding was
   * counted and 2px of panel border was not.
   */
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
    ['a 60px step', /the step is 60px/],
    ['a two-row topic strip', /wraps to two rows/],
    ['660 against a 369px column', /660 against/],
  ])('no file in `src` has gone back to %s', (_what, pattern) => {
    const files = [
      'src/ui/gm/SessionList.tsx',
      'src/ui/gm/SessionRow.tsx',
      'src/ui/gm/Reference.tsx',
      'src/ui/gm/Gm.tsx',
      'src/ui/gm/GmTopBar.tsx',
      'src/ui/shell/App.tsx',
      'tests/gm/sessionList.test.tsx',
      'tests/gm/gmShell.test.tsx',
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
