/**
 * The class step, at the moment somebody is deciding what to play.
 *
 * Nine cards, and the only evidence any of them offers is a paragraph the card
 * refused to show: `body={c.description}` under `clamp={3}` put `.t-dense`'s
 * 11.5px/1.38 - a 15.87px line box, 48px of window - over text that measured
 * 143-206px, so 95px was hidden on the shortest card and 158px on the Wizard's,
 * at every resolution the harness measured. Choosing a class is the most
 * consequential choice in character creation and it is the first screen a new
 * install shows: `openingScreen` sends an empty library to Build, and Build
 * with an empty library is this wizard on this step.
 *
 * What is asserted here is deliberately not "the text is on the screen". It is
 * on the screen today - the clamp is CSS over markup that already carries every
 * word - so a presence test passes on the defect. The three claims that
 * actually separate the two builds are: no clip is emitted at all; every class
 * has a reader of its own and it starts shut; and the words are *deferred*
 * rather than merely un-clipped, which is what stops the fix being "a bigger
 * clamp" and stops a lazy fix being "delete the description".
 *
 * `renderToStaticMarkup` gives the real component in Node against the store's
 * initial state, which is the shipped SRD - the idiom in wizard.test.ts and
 * domainCardView.test.ts. Node has no layout engine, so nothing here measures;
 * what a browser draws is checked in Chrome and written into the commit.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useApp } from '../../src/store/state.ts';
import { Wizard } from '../../src/ui/build/Wizard.tsx';

const opening = renderToStaticMarkup(createElement(Wizard, {}));
const classes = useApp.getState().dataset.classes;

/** What `renderToStaticMarkup` does to the five characters it escapes. */
const escaped = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

describe('the nine class cards', () => {
  it('finds the classes it is about', () => {
    // The whole file is driven off the dataset rather than off a list of nine
    // names, so an imported dataset with a tenth class is swept up by every
    // assertion below the day it arrives.
    expect(classes.length).toBeGreaterThan(1);
  });

  it('emits no line clip of any size, on any card', () => {
    expect(opening).not.toContain('-webkit-line-clamp');
    expect(opening).not.toContain('-webkit-box');
  });

  it('gives every class a reader of its own, and every one of them starts shut', () => {
    expect(opening.match(/aria-expanded="false"/g)).toHaveLength(classes.length);
    expect(opening).not.toContain('aria-expanded="true"');
    for (const c of classes) expect(opening).toContain(`About ${c.name}`);
  });

  it('says whose words are behind each reader, shut, before anyone opens one', () => {
    // The stamp is drawn open and shut alike - `Fold`'s contract - so this is
    // also the claim that the header does not change what it promised once it
    // is pressed. Every class in the shipped SRD carries a page.
    for (const c of classes) {
      expect(c.sourcePage).toBeTypeOf('number');
      expect(opening).toContain(`SRD 2.0 · P.${String(c.sourcePage)}`);
    }
  });

  it('holds the description back until it is asked for, rather than showing more of it', () => {
    // This is the assertion the pre-fix build fails hardest: the clamp was CSS
    // over markup that carried all 518-763 characters of every description, so
    // the words were in the page and only the browser was hiding them.
    //
    // It is also the assertion that refuses a fix that simply deletes the
    // paragraph - the one above requires nine readers, this one requires the
    // text not to be printed unasked, and only opening one satisfies both.
    for (const c of classes) {
      expect(c.description.length).toBeGreaterThan(60);
      expect(opening).not.toContain(escaped(c.description.slice(0, 60)));
    }
  });

  it('keeps the facts a class is compared on outside the reader, where they were', () => {
    // `meta` was never inside the clamp and is not inside the fold either. The
    // clamp hid flavour; Evasion, Hit Points and the two domains are what a
    // player scans nine cards for and they are still printed on every card.
    for (const c of classes) {
      expect(opening).toContain(
        `EVASION ${String(c.startingEvasion)} · ${String(c.startingHitPoints)} HP`,
      );
    }
  });
});
