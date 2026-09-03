/**
 * The domain card, at the moment somebody is choosing one.
 *
 * The card step asks a new player to pick two out of six on the one attribute
 * the card refused to show: the rules text was clamped to three lines under a
 * banner that spent the top third of the panel repeating a domain the player
 * had already filtered by. Reading a candidate meant opening a full-screen
 * overlay that hid the other five, so comparing six cards was twelve taps and
 * a memory exercise.
 *
 * What can be checked here without eyes is the geometry and the wiring: that
 * the picking variant emits no line clamp, that the budget it emits instead is
 * big enough for the cards the SRD actually offers, that the domain still
 * arrives as a shape and a word rather than as a colour, that the three screens
 * which share this component still render the card they asked for, and - last -
 * that the card step asks for the reading card at all. That last one is not a
 * detail: a variant no call site names is exactly as broken as the clamp it
 * replaced, and every other test in this file passes in that state - so the
 * last block renders that step and reads what it actually put on the screen.
 *
 * `renderToStaticMarkup` gives the real component in Node, the way
 * printSheet.test.ts does. Two things are out of its reach and are checked
 * another way, each said so at the point it happens: nothing in Node has a
 * layout engine - jsdom included, where `scrollHeight` is permanently 0 - so
 * the truncation flag is tested through the pure predicate that computes it
 * plus one assertion on the source text, in the manner of stylesheets.test.ts.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CharClass, DomainCard } from '@shared/types.ts';
import { emptyDraft } from '../../src/ui/build/creation.ts';
import { StepCards } from '../../src/ui/build/Wizard.tsx';
import {
  CardText,
  DomainCardView,
  READING_LINES,
  overflows,
} from '../../src/ui/shared/DomainCardView.tsx';
import { makeCard } from '../fixtures/factories.ts';

const SOURCE = 'src/ui/shared/DomainCardView.tsx';
const TOKENS = 'src/ui/tokens.css';
const WIZARD = 'src/ui/build/Wizard.tsx';

const srd = JSON.parse(readFileSync('data/srd-2.0.json', 'utf8')) as {
  domainCards: DomainCard[];
  classes: CharClass[];
};

/**
 * The card step itself, rendered, with a Wizard's six level 1 cards on it.
 *
 * The variant is only worth having if the screen it was written for asks for
 * it, and every other test in this file passes in a build where nothing does.
 * `StepCards` reads the dataset off the store, and a server render is handed
 * the store's initial state - the real SRD - so this is the actual screen with
 * the actual cards. `useMedia` answers false without a browser, so it is the
 * desktop layout; the phone column is the one measure that has to be read off
 * the source instead, and it is, below.
 */
const pickingScreen = renderToStaticMarkup(
  createElement(StepCards, {
    draft: { ...emptyDraft(), classRef: 'wizard', subclassRef: 'school-of-war' },
    set: () => undefined,
    klass: srd.classes.find((c) => c.id === 'wizard'),
  }),
);

/** Book of Illiat: three named effects, and the shape that broke the clamp. */
const grimoire = makeCard({
  id: 'codex-book-of-illiat',
  name: 'Book of Illiat',
  domain: 'codex',
  text: [
    'Slumber: Make a Spellcast Roll against a target within Close range.',
    'Arcane Barrage: Once per rest, spend a Hope to conjure a volley.',
    'Telepathy: Spend a Hope to open a telepathic connection.',
  ].join('\n\n'),
});

const render = (props: Parameters<typeof DomainCardView>[0]): string =>
  renderToStaticMarkup(createElement(DomainCardView, props));

/** The wizard's card today, and the same card asked to be readable. */
const showcase = render({ card: grimoire, height: 262, headHeight: 76, clamp: 3 });
const reading = render({ card: grimoire, height: 262, variant: 'reading' });

describe('a card you are choosing between', () => {
  it('no longer cuts the rules text to a fixed handful of lines', () => {
    expect(showcase).toContain('-webkit-line-clamp:3');
    expect(reading).not.toContain('-webkit-line-clamp');
    expect(reading).not.toContain('-webkit-box');
  });

  it('bounds the text in lines instead, counted off the type tokens', () => {
    // A pixel budget is wrong the moment the column width changes, and this
    // card is rendered into four different grids.
    expect(reading).toContain(
      `max-height:calc(${READING_LINES} * var(--read-lh) * var(--read-size))`,
    );
  });

  it('gives that text several times the room the old clamp allowed', () => {
    // The wizard clamped to 3 lines on a phone and 4 on a desktop, inside a
    // box that was already 92px tall - about 45px of card sat blank under the
    // ellipsis at both sizes.
    expect(READING_LINES).toBeGreaterThanOrEqual(4 * 3);
  });

  it('ignores a clamp, so a call site only has to name the variant', () => {
    const both = render({ card: grimoire, height: 262, clamp: 3, variant: 'reading' });
    expect(both).not.toContain('-webkit-line-clamp');
    expect(both).toBe(reading);
  });

  it('sets the rules text at the reading size, in both variants', () => {
    // The showcase card was `.t-dense` - the 11.5px glance size - until the
    // readability ramp; a card's rules text is read in every grid it lands in,
    // so both variants take `.t-read` now and the glance size is gone.
    expect(reading).toContain('class="t-read"');
    expect(reading).not.toContain('t-dense');
    expect(showcase).toContain('class="t-read"');
    expect(showcase).not.toContain('t-dense');
  });

  it('spends the reclaimed banner on the text rather than on a louder domain', () => {
    // The showcase head sets the domain at 900 weight and 26% of its own
    // height - 20px on a phone, against a 15px card name and 16px rules
    // text. The reading card has no display type on it at all.
    expect(showcase).toMatch(/font:900 \d+px/);
    expect(reading).not.toMatch(/font:900/);
  });

  it('still names the domain by shape and by word, not by colour', () => {
    expect(reading).toContain('clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)');
    expect(reading).toContain('aria-label="Codex"');
    expect(reading).toContain('CODEX · LV1 · ABILITY');
    expect(reading).toContain('var(--codex)');
  });

  it('is still identifiable with shape coding switched off', () => {
    // Settings can turn the silhouettes off to show what they were doing. The
    // domain has to survive that, so it is written out in letters as well.
    const plain = render({ card: grimoire, height: 262, variant: 'reading', shapes: false });
    expect(plain).not.toContain('clip-path:polygon');
    expect(plain).toContain('CODEX · LV1 · ABILITY');
  });
});

describe('the line budget, against the cards the SRD actually offers', () => {
  /*
   * Wrapping, modelled the way CardText lays a card out: one block per
   * blank-line paragraph, one more per bullet, and a 0.75em gap between
   * paragraphs. 0.452em is Archivo's mean advance measured over all 189 card
   * texts, so a character costs 0.452 x the font size.
   */
  const AVG_ADVANCE_EM = 0.452;

  const wrappedLines = (text: string, columnPx: number, fontPx: number): number => {
    const perLine = columnPx / (AVG_ADVANCE_EM * fontPx);
    let lines = 0;
    for (const [i, paragraph] of text.split(/\n{2,}/).entries()) {
      const parts = paragraph.split('\n');
      const bullets = parts.slice(1).filter((l) => l.startsWith('- '));
      const rest = parts.slice(1).filter((l) => !l.startsWith('- '));
      const head = `${parts[0] ?? ''}${rest.length > 0 ? ` ${rest.join(' ')}` : ''}`;
      if (i > 0) lines += 0.75;
      lines += Math.max(1, Math.ceil(head.length / perLine));
      for (const b of bullets) lines += Math.max(1, Math.ceil((b.length - 1) / perLine));
    }
    return lines;
  };

  const cards = srd.domainCards;
  const level1 = cards.filter((c) => c.level === 1);
  const whole = (list: DomainCard[], columnPx: number): number =>
    list.filter((c) => wrappedLines(c.text, columnPx, 13) <= READING_LINES).length / list.length;

  it('has the dataset it is sized against', () => {
    expect(cards.length).toBe(210);
    expect(level1.length).toBe(30);
  });

  it('shows every card creation offers, whole, at a one-column phone measure', () => {
    // 390px viewport, one card per row: a 342px text column. This is the
    // measure the wizard grid needs; the budget is chosen to clear it.
    expect(whole(level1, 342)).toBe(1);
  });

  it('shows all but one of them at a three-column desktop measure', () => {
    // 980px of stack, three columns: a 295px text column.
    expect(whole(level1, 295)).toBeGreaterThanOrEqual(26 / 27);
  });

  it('leaves a tail long enough that the reader is still worth having', () => {
    // The two longest Grimoires run over at any measure a card grid can give
    // them, which is why the "there is more" affordance is not dead code.
    expect(whole(cards, 342)).toBeLessThan(1);
    expect(whole(cards, 342)).toBeGreaterThan(0.95);
  });

  /*
   * Those two measures are not free-standing numbers: they are what the card step's
   * grid hands the card, and the grid is where the old three-line card really
   * came from. A 150px column cannot show fourteen lines of anything. So the
   * column is derived here from the grid the wizard actually declares -
   * `auto-fill` fits as many `minmax(min, 1fr)` tracks as the row holds, then
   * the card spends --s4 of padding on each side before the text starts - and
   * the same share-shown-whole figures are asserted against it. Narrow the
   * grid and this fails, which is the point: the variant is a real improvement
   * without the wider columns, but it is not the fix without them.
   */
  const GAP = 12;
  const CARD_PADDING = 12;

  const textColumn = (rowPx: number, minTrackPx: number): number => {
    const tracks = Math.max(1, Math.floor((rowPx + GAP) / (minTrackPx + GAP)));
    return (rowPx - GAP * (tracks - 1)) / tracks - 2 * CARD_PADDING;
  };

  /** The phone track, which no server render can reach: `useMedia` says false. */
  const phoneTrack = Number(
    /minmax\(\$\{phone \? (\d+) : \d+\}px/.exec(readFileSync(WIZARD, 'utf8'))?.[1] ?? 0,
  );

  /** The desktop track, taken from the grid that step actually emitted. */
  const desktopTrack = Number(
    /grid-template-columns:repeat\(auto-fill, minmax\((\d+)px/.exec(pickingScreen)?.[1] ?? 0,
  );

  it('is the column the card step gives it on a phone, not a number of its own', () => {
    // 390px viewport, less the step panel's 12px of padding on each side.
    expect(whole(level1, textColumn(390 - 24, phoneTrack))).toBe(1);
  });

  it('is the column the card step gives it on a desktop', () => {
    // The step panel is capped at 980px however wide the window is.
    expect(whole(level1, textColumn(980, desktopTrack))).toBeGreaterThanOrEqual(26 / 27);
  });
});

describe('the card step, the screen the reading card was written for', () => {
  it('puts all six of the Wizard level 1 cards up at once', () => {
    expect(pickingScreen.match(/class="t-read"/g)).toHaveLength(6);
  });

  it('cuts none of them to a fixed handful of lines', () => {
    // The whole fix, stated as the player meets it: six cards, none of them
    // ending in an ellipsis three lines in, on the screen that asks which two.
    expect(pickingScreen).not.toContain('-webkit-line-clamp');
    expect(pickingScreen).not.toContain('-webkit-box');
  });

  it('bounds them in lines counted off the type tokens instead', () => {
    expect(pickingScreen).toContain(
      `max-height:calc(${READING_LINES} * var(--read-lh) * var(--read-size))`,
    );
  });

  it('sets that text at reading size rather than at the glance size', () => {
    expect(pickingScreen).not.toContain('t-dense');
  });

  it('spends the reclaimed banner on the text, so no card carries a wordmark', () => {
    expect(pickingScreen).not.toMatch(/font:900/);
  });

  it('names each domain by shape and by word, on the card and in the filter chips', () => {
    // Six cards and the two domain chips above them, each an aria-labelled
    // silhouette rather than a colour a third of men cannot tell apart.
    expect(pickingScreen.match(/role="img"/g)).toHaveLength(8);
    expect(pickingScreen).toContain('CODEX · LV1 ·');
  });

  it('claims nothing about hidden text before a layout has proved there is any', () => {
    // Nothing in Node has a layout engine, so nothing has been measured. A card
    // that says it is hiding text it is not is worse than one that says nothing.
    expect(pickingScreen).not.toContain('MORE — TAP TO READ');
    expect(pickingScreen).not.toContain('scroll-fade');
  });

  it('no longer labels the footer, the one strip where a tap does nothing', () => {
    expect(pickingScreen).not.toContain('TAP FOR FULL TEXT');
  });
});

describe('the offer to read the rest', () => {
  it('is absent from a card that has not measured anything', () => {
    // Static markup has no layout, so nothing has been shown to overflow. A
    // card in that state must not claim it is hiding text.
    expect(reading).not.toContain('MORE — TAP TO READ');
    expect(reading).not.toContain('scroll-fade');
  });

  it('is decided by comparing what the box holds against what it shows', () => {
    expect(overflows({ scrollHeight: 340, clientHeight: 264 })).toBe(true);
    expect(overflows({ scrollHeight: 180, clientHeight: 264 })).toBe(false);
    expect(overflows({ scrollHeight: 264, clientHeight: 264 })).toBe(false);
  });

  it('ignores a sub-pixel difference, which is rounding and not text', () => {
    expect(overflows({ scrollHeight: 265, clientHeight: 264 })).toBe(false);
  });

  it('and the fade over it are rendered only under that answer', () => {
    // A DOM assertion would need a layout engine to produce the overflow, and
    // no Node DOM has one, so this reads the source the way the stylesheet
    // tests do: both the notice and the mask hang off `clipped`, and nothing
    // else in the file may print those words.
    const source = readFileSync(SOURCE, 'utf8');
    expect(source.match(/MORE — TAP TO READ/g)).toHaveLength(1);
    expect(source).toContain("clipped ? 't-read scroll-fade' : 't-read'");
  });

  /*
   * The assertion that stood here read, in full:
   *
   *   it('no longer says so in the strip that is not tappable', () => {
   *     expect(source).toContain(
   *       "{!reading && card.text.length > 150 ? 'TAP FOR FULL TEXT' : ''}");
   *   });
   *
   * It was true and it was pinning dead code. That expression lives in the
   * `footer ??` default, which renders only when no `footer` prop was passed;
   * both showcase call sites - the browser grid in `Cards.tsx` and the cockpit
   * loadout in `Play.tsx` - always pass one, and the two that omit it
   * (`Wizard.tsx`'s step picker and `SessionBody.tsx`) are `variant="reading"`,
   * where `!reading` is false. Named by symbol and file rather than by line:
   * the two numbers that stood here, `Cards.tsx:246` and `Play.tsx:2078`,
   * landed on a blank line inside a docblock table and on a `style={{` for an
   * unrelated span - 276 and 326 lines above the calls they meant. Both
   * distances were counted against the tree; the "eight hundred lines apart"
   * that stood in this sentence was not, and the two sum to 602. Neither region
   * is touched by this branch, so `main` and the tip give the same pair. So no
   * screen in this app could draw those words, while 40 of 42 tiles at 393x852
   * cut their rules text behind a wordless fade.
   */
  it('reaches the showcase card, where the words were three lines away and dead', () => {
    const source = readFileSync(SOURCE, 'utf8');
    expect(
      source,
      'the footer still guesses at truncation from a character count',
    ).not.toContain('card.text.length > 150');
    expect(source.match(/TAP FOR FULL TEXT/g), 'the cue is printed twice').toHaveLength(1);
    // In the text box, over the fade, under the same `clipped` the reading
    // variant uses - not in the footer, which the overlay button stops short
    // of and where a tap does nothing.
    expect(source).toContain('{clipped && opens && (');
  });

  it('says "tap" only where there is something to tap', () => {
    // `SessionBody`'s `card` link arm mounts a reading card with no `onOpen`, so
    // the cue there named a gesture the card does not answer.
    const source = readFileSync(SOURCE, 'utf8');
    expect(source).toContain('const opens = onOpen !== undefined;');
    expect(source.match(/\{clipped && opens && \(/g), 'a cue is drawn without it').toHaveLength(2);
  });

  it('stops fading a showcase card that is not hiding anything', () => {
    /*
     * The showcase fade was unconditional: a 26px gradient over the last line
     * of every card, including the two of 42 that end inside their box. The
     * reading branch's own comment has always said why that is wrong - "an
     * unconditional fade over the last line of a card that ends there just
     * makes it harder to read" - and the showcase branch did it anyway.
     *
     * Static markup has measured nothing, so `clipped` is false and the honest
     * output is no fade at all. That is what this reads.
     */
    expect(showcase, 'a card that has measured nothing is faded anyway').not.toContain(
      'linear-gradient(180deg',
    );
    expect(showcase, 'and it claims there is more to read').not.toContain('TAP FOR FULL TEXT');
    // The banner's own tint is a different gradient and stays.
    expect(showcase).toContain('linear-gradient(155deg');
  });
});

describe('the screens that share this card', () => {
  const card = makeCard({ text: 'Spend a Hope to do the thing described here.' });

  it('still gives the cards browser a full-height card with no clamp', () => {
    const html = render({ card, height: 268, headHeight: 78, dimmed: true });
    expect(html).toContain('height:268px');
    expect(html).toContain('class="t-read"');
    expect(html).not.toContain('-webkit-line-clamp');
    expect(html).toContain('opacity:0.42');
  });

  it('still lets the desktop loadout fill its grid cell', () => {
    const html = render({ card, height: '100%', headHeight: 64 });
    expect(html).toContain('height:100%');
    expect(html).toContain('font:900 17px/0.88 var(--sans)');
  });

  it('still draws the banner and its silhouette whenever there is one', () => {
    expect(showcase).toContain('color-mix(in srgb, var(--codex) 26%, transparent)');
    expect(showcase).toContain('clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)');
  });

  it('leaves the print sheet’s prose renderer alone', () => {
    // CharacterSheet takes CardText and nothing else, and prints every card in
    // full. Named effects arrive in bold there and here from the same regex.
    const html = renderToStaticMarkup(createElement(CardText, { text: grimoire.text }));
    expect(html).toContain('Make a Spellcast Roll against a target within Close range.');
    expect(html).toContain('Spend a Hope to open a telepathic connection.');
    expect(html.match(/<strong/g)).toHaveLength(3);
  });
});

describe('the reading type role', () => {
  const tokens = readFileSync(TOKENS, 'utf8');

  it('is a token, so the card can count lines instead of pixels', () => {
    // 1rem/1.5 - 16px at the default root - on a phone, and 0.9375rem from
    // 720px, where the columns are wider and a three-up grid keeps a line per
    // card that 16px loses. In rem, so the OS text size reaches it.
    expect(tokens).toMatch(/--read-size:\s*1rem/);
    expect(tokens).toMatch(/--read-lh:\s*1\.5\b/);
    expect(tokens).toMatch(/@media[^{]*min-width:\s*720px[\s\S]*?--read-size:\s*0\.9375rem/);
  });

  it('is built from those two values rather than restating them', () => {
    const role = /^\.t-read\s*\{([^}]*)\}/m.exec(tokens)?.[1] ?? '';
    expect(role).toContain('var(--read-size)');
    expect(role).toContain('var(--read-lh)');
  });

  it('sits above the hint size and takes the higher body ink', () => {
    // 16px against .t-hint's 13px, at --text-2 rather than --text-3: 9.7:1
    // on the dark panel and 12.4:1 on the light one, both past AAA. This card
    // is read in a dim room to answer the question the step is asking. (It
    // was 13px against `.t-dense`'s 11.5 before the readability ramp.)
    const role = /^\.t-read\s*\{([^}]*)\}/m.exec(tokens)?.[1] ?? '';
    expect(role).toContain('color: var(--text-2)');
    expect(tokens).toMatch(/\.t-hint\s*\{[^}]*font:\s*400 0\.8125rem/);
    expect(tokens).not.toMatch(/\.t-dense\s*\{/);
  });
});
