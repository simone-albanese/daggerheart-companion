// @vitest-environment jsdom
/**
 * The card reader, and the sentence it printed that was not true of it.
 *
 * The footer read TAP ANYWHERE TO CLOSE. The backdrop closes, the panel over
 * it calls `stopPropagation` on purpose - so that dragging a card's rules text
 * does not throw the card away - and the footer label is itself a button, which
 * is how the copy survived: whoever checked it tapped the label. Everyone else
 * followed the instruction, tapped the card, and learned that this app's words
 * are a guess.
 *
 * Both halves were defensible, so the test has to fix which one is the truth
 * before it can assert anything. It is the code: a panel that scrolls cannot
 * treat a touch as a dismissal, because telling a scroll from a tap is a
 * threshold and thresholds land on tremors - the same reason `Track` had to
 * move its long press off the header. So the copy gives way and names the
 * control instead of the gesture, and the control - 118 x 10px, the smallest
 * thing in the reader and the only one that closes it - grows to the touch
 * floor.
 *
 * Which is why the first block asserts the two halves *together*. Either of
 * them alone passes in the broken build: the card refusing a tap is the
 * pre-fix behaviour, and a footer that says nothing about tapping is only
 * honest next to a card that in fact refuses one. It is one fact, so it is
 * one test.
 *
 * jsdom, because every question here is about which element an event reaches -
 * a string match on the JSX would pass just as happily if the handlers had been
 * moved to a common ancestor. The two things jsdom cannot answer are said in
 * the file that owns them: the touch floor is a token, so it is read out of
 * `tokens.css` and compared against the inline style, and whether the Escape
 * hint costs a phone any space is a media query, so it is read out of
 * `base.css` - the manner of stylesheets.test.ts.
 */
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardReader } from '../../src/ui/shared/DomainCardView.tsx';
import { makeCard } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** The project's touch floor, taken from the token rather than restated. */
const TAP = Number(/--tap:\s*(\d+)px/.exec(readFileSync('src/ui/tokens.css', 'utf8'))?.[1] ?? 0);

const BASE = readFileSync('src/ui/base.css', 'utf8');

/** Long enough that the reader is the scrolling surface the argument assumes. */
const card = makeCard({
  name: 'Book of Illiat',
  domain: 'codex',
  text: [
    'Slumber: Make a Spellcast Roll against a target within Close range.',
    'Arcane Barrage: Once per rest, spend a Hope to conjure a volley.',
    'Telepathy: Spend a Hope to open a telepathic connection.',
  ].join('\n\n'),
  flavorText: 'The book reads you back.',
});

let container: HTMLDivElement;
let root: Root;
let onClose: ReturnType<typeof vi.fn>;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  onClose = vi.fn();
  act(() => root.render(createElement(CardReader, { card, onClose })));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const query = (selector: string): HTMLElement => {
  const el = container.querySelector<HTMLElement>(selector);
  if (el === null) throw new Error(`the reader rendered no ${selector}`);
  return el;
};

/** The only button in the reader: the footer's explicit way out. */
const closeControl = (): HTMLElement => query('button');

/**
 * What a screen reader would call a control - near enough for this file.
 *
 * The real algorithm is long, but the only part in play is the one that makes
 * the difference here: text hidden from the accessibility tree is not part of
 * the name, so a decorative key cap inside the button does not rename it.
 */
const accessibleName = (el: Element): string => {
  const clone = el.cloneNode(true) as Element;
  for (const hidden of clone.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
};

const click = (el: Element): void => {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('what the reader says about closing, against what closes it', () => {
  it('does not promise a gesture the card refuses', () => {
    // One fact in two assertions, and it has to be two: the card swallowing a
    // tap is the behaviour that was already there, and copy that stays quiet
    // about tapping is only honest beside a card that does swallow it.
    click(query('.t-body p'));
    expect(onClose, 'a tap on the rules text dismissed the card').not.toHaveBeenCalled();
    expect(container.textContent ?? '').not.toMatch(/anywhere/i);
  });

  it('calls its close control by what the control does', () => {
    // A button labelled with an instruction to tap somewhere else is a label
    // for the backdrop, not for the button, and it is the button a keyboard
    // and a screen reader arrive at.
    expect(accessibleName(closeControl())).toBe('CLOSE');
  });

  it('and that control closes it', () => {
    click(closeControl());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the target the copy now points at', () => {
  /*
   * The reason the honest copy is CLOSE and not TAP OUTSIDE TO CLOSE. On a
   * 390px phone the panel is 366px wide inside the overlay's 12px padding, and
   * a card long enough to be worth reading is `maxHeight: 100%` - so "outside"
   * is a 12px band. That is half of WCAG 2.5.8's 24px minimum and 27% of this
   * project's own floor. Naming it would have been a true sentence pointing a
   * thumb at a target the project forbids, so the sentence names the control
   * that a thumb can hit, and the control is sized to be one.
   */
  it('has the floor it is measured against', () => {
    expect(TAP).toBe(44);
  });

  it('is a real target rather than a 10px line of mono', () => {
    const close = closeControl();
    expect(close.style.minHeight, 'the close control has no height floor').toBe('var(--tap)');
    expect(close.style.minWidth).toBe('var(--tap)');
  });

  it('grows around the label instead of moving it off the panel gutter', () => {
    // 12px of padding, pulled straight back out, so the word still begins on
    // the 18px gutter the header and the rules text use.
    const close = closeControl();
    expect(close.style.padding).toBe('0px 12px');
    expect(close.style.marginLeft).toBe('-12px');
  });

  it('still lets a tap outside the card close it, unadvertised', () => {
    // Not named on screen, because of the 12px band above - but it is the
    // convention and the other five overlays in this app all honour it, so
    // taking it away would surprise the people who already expect it.
    click(query('[role="dialog"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the way out for someone who never touches the glass', () => {
  it('is there, and always was', () => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is now declared on the control, where a screen reader will read it', () => {
    // `aria-keyshortcuts` is the attribute for exactly this, it costs no
    // pixels, and it is announced on a phone as readily as on a desktop.
    expect(closeControl().getAttribute('aria-keyshortcuts')).toBe('Escape');
  });

  it('is drawn as a key cap that does not rename the button', () => {
    const cap = query('.keycap');
    expect(cap.textContent).toBe('ESC');
    expect(cap.getAttribute('aria-hidden')).toBe('true');
    expect(closeControl().contains(cap)).toBe(true);
    expect(accessibleName(closeControl())).toBe('CLOSE');
  });

  it('costs a phone nothing, because a phone has no key to press', () => {
    // The requirement was to tell a keyboard user without spending vertical
    // space on a device that has no Escape key. A media query is what makes
    // that true: the markup is always there and the phone draws none of it.
    const rule = /^\.keycap\s*\{([^}]*)\}/m.exec(BASE)?.[1] ?? '';
    expect(rule, 'there is no .keycap rule').not.toBe('');
    expect(rule).toMatch(/display:\s*none/);
    expect(BASE).toMatch(
      /@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{\s*\.keycap\s*\{[^}]*display:\s*inline-block/,
    );
  });
});
