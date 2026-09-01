// @vitest-environment jsdom
/**
 * What the level-up screen says about slots a player has already spent.
 *
 * The engine half of this is covered in `tests/engine/levelUp.test.ts`, and it
 * is not enough. `LevelUp.tsx` recomputes the count for the row the player has
 * *just selected* — `spentThisPlan` — and that number is not `slotUsage`'s.
 * Measured: with only the engine patched, `tests/engine/levelUp.test.ts` and
 * `tests/engine/matrix.test.ts` both pass in full while the selected
 * Proficiency row still reads "TIER 3 · 1 OF 2 LEFT" and stays pressable. The
 * validator would then refuse a plan the screen had just invited.
 *
 * It has to be jsdom. `renderToStaticMarkup`, which `wizard.test.ts` uses and
 * which is far cheaper, cannot work here: zustand v5 wires `getServerSnapshot`
 * to `getInitialState` (`node_modules/zustand/esm/react.mjs`), so a server
 * render never sees `setState` — `useActive()` returns null and `LevelUp`
 * renders nothing at all.
 */
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Character } from '@shared/types.ts';
import { deriveStats } from '@engine/character.ts';
import { useApp } from '../../src/store/state.ts';
import { LevelUp } from '../../src/ui/build/LevelUp.tsx';
import { dataset, index, playedCharacter } from './fixture.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** A level-up entry as `applyLevelUp` writes one. */
const proficiencyTaking = (level: number, tier: number): Character['levelUpHistory'][number] => ({
  level,
  slot: 0,
  kind: 'proficiency',
  detail: { optionId: 'proficiency', optionTier: tier },
});

function mount(character: Character): void {
  useApp.setState({
    ready: true,
    dataset,
    index,
    characters: [character],
    activeId: character.id,
  });
  act(() => {
    root.render(
      createElement(LevelUp, {
        stats: deriveStats(character, dataset, index),
        onDone: () => {},
      }),
    );
  });
}

const text = (): string => container.textContent ?? '';

/** Every row's accessible slot count, as a screen reader would read it. */
const slotNames = (): string[] =>
  [...container.querySelectorAll('[aria-label$="marked"]')].map(
    (e) => e.getAttribute('aria-label') ?? '',
  );

describe('the level-up screen and its slot counts', () => {
  it('shows a black-boxed option as full after one taking', () => {
    // The rule: "you must spend two advancements and mark BOTH level-up slots
    // in order to take it." One taking fills the tier, so the row must not
    // invite a second.
    const c = playedCharacter();
    mount({ ...c, level: 6, levelUpHistory: [proficiencyTaking(5, 3)] });

    expect(
      text(),
      'the screen offered a second Proficiency in a tier the validator will refuse',
    ).not.toMatch(/TIER 3 · 1 OF 2 LEFT/);
    expect(text()).toMatch(/TIER 3 · 0 OF 2 LEFT/);
    expect(slotNames()).toContain('2 of 2 marked');
  });

  /**
   * The half no engine test can see.
   *
   * `LevelUp.tsx` adds what this plan has spent to what the history spent, and
   * it counted its own picks as one box each. So the moment a player pressed
   * Proficiency the row said "1 OF 2 LEFT" and stayed pressable — inviting a
   * second pick the validator would then refuse. With only the engine patched,
   * both engine suites pass in full and this is still true.
   */
  it('shows the tier as full the moment the black-boxed option is pressed', () => {
    const c = playedCharacter();
    mount({ ...c, level: 5, levelUpHistory: [] });

    const row = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').includes('Increase your Proficiency'),
    );
    expect(row, 'no Proficiency row on the level-up screen').toBeDefined();
    act(() => {
      row!.click();
    });

    expect(
      text(),
      'pressing it left a slot on offer that the validator will refuse',
    ).not.toMatch(/TIER 3 · 1 OF 2 LEFT/);
    expect(text()).toMatch(/TIER 3 · 0 OF 2 LEFT/);
  });

  /**
   * A sheet levelled by the build that allowed two takings carries them, and
   * `slotUsage` reports `used: 4` of two boxes — deliberately, because that is
   * what the history says. What must not happen is the app reading that number
   * out as if it described the boxes.
   */
  it('never tells a screen reader that four of two boxes are marked', () => {
    const c = playedCharacter();
    mount({
      ...c,
      level: 7,
      levelUpHistory: [proficiencyTaking(5, 3), proficiencyTaking(6, 3)],
    });

    for (const name of slotNames()) {
      const [marked, of] = name.match(/(\d+) of (\d+)/)!.slice(1).map(Number);
      expect(marked, `"${name}" says more boxes are marked than the tier prints`).toBeLessThanOrEqual(of!);
    }
  });

  /**
   * The control. A screen that showed every option as full would satisfy both
   * assertions above.
   */
  it('still offers an option whose boxes are separate and only half spent', () => {
    const c = playedCharacter();
    mount({
      ...c,
      level: 4,
      levelUpHistory: [{ level: 3, slot: 0, kind: 'hitPoint', detail: { optionId: 'hit-point', optionTier: 2 } }],
    });
    expect(slotNames()).toContain('1 of 2 slots marked');
  });
});

// ---------------------------------------------------------------------------
// The extra domain card a subclass feature hands over
// ---------------------------------------------------------------------------

/*
 * School of Knowledge grants an additional domain card three times: Prepared at
 * the foundation, Accomplished at the specialization, Brilliant at the mastery.
 * Creation has handed over the first since `cardAllowance.ts` was written, and
 * `DOMAIN_CARD_GRANTS` has listed all three the whole time - the other two
 * arrive at level up, and the level-up screen had never read the table. Every
 * test in `tests/ui/cardAllowance.test.ts` was green while a wizard who bought
 * the specialization card at level 5 was handed one card fewer than the sheet
 * says, and found out from a GM.
 *
 * So this mounts the screen against the real SRD and buys the card, because
 * that is the only place the failure was visible.
 */
const buttons = (): HTMLButtonElement[] => [...container.querySelectorAll('button')];

const press = (label: string, button: HTMLButtonElement | undefined): void => {
  expect(button, `no ${label} on the level-up screen`).toBeDefined();
  act(() => {
    button!.click();
  });
};

/** The live "take an upgraded subclass card" row. Full tiers show a dead one. */
const upgradeRow = (): HTMLButtonElement | undefined =>
  buttons()
    .filter((b) => (b.textContent ?? '').includes('Take an upgraded subclass card') && !b.disabled)
    .at(-1);

const namedChoice = (name: string): HTMLButtonElement | undefined =>
  buttons().find((b) => (b.textContent ?? '').startsWith(name));

/** The block the granted card is offered in, or null when none is on screen. */
const grantBlock = (): HTMLElement | null => {
  const label = [...container.querySelectorAll('span')].find(
    (s) => s.textContent === 'ONE MORE DOMAIN CARD, NOT AN ADVANCEMENT',
  );
  return label?.closest('div')?.parentElement ?? null;
};

/** The card rows inside a picker, which are the ones printing a card's level. */
const cardRows = (within: HTMLElement): HTMLButtonElement[] =>
  [...within.querySelectorAll('button')].filter((b) => /LV\d+ · /.test(b.textContent ?? ''));

/** A Wizard with a subclass card still to buy. */
const wizard = (subclass: string, over: Partial<Character> = {}): Character => ({
  ...playedCharacter(),
  classRef: 'wizard',
  subclassRefs: [subclass],
  multiclassRef: null,
  multiclassDomain: null,
  loadout: [],
  vault: [],
  traitMarks: {},
  level: 5,
  levelUpHistory: [],
  ...over,
});

const stored = (): Character => useApp.getState().characters[0]!;

describe('the card School of Knowledge hands over at level up', () => {
  it('offers nothing until an advancement actually hands a subclass card over', () => {
    // The option being selected is not the grant. Prepared, Accomplished and
    // Brilliant are printed on cards, and until the player says which subclass
    // card they are taking there is no feature to pay for anything.
    mount(wizard('school-of-knowledge'));
    expect(grantBlock()).toBeNull();
    press('upgraded-subclass row', upgradeRow());
    expect(grantBlock(), 'a card was offered before any subclass card was chosen').toBeNull();
  });

  it('offers Accomplished a second card the moment the specialization is taken', () => {
    mount(wizard('school-of-knowledge'));
    press('upgraded-subclass row', upgradeRow());
    press('School of Knowledge', namedChoice('School of Knowledge'));

    const block = grantBlock();
    expect(block, 'the specialization was taken and no additional card was offered').not.toBeNull();
    // Printed verbatim, because the sentence is what states the level cap the
    // picker below it silently enforces.
    expect(block!.textContent).toContain('Accomplished');
    expect(block!.textContent).toContain(
      'Take an additional domain card of your level or lower from a domain you have access to.',
    );
    expect(cardRows(block!).length).toBeGreaterThan(0);
    expect(text()).toContain(
      'Accomplished gives you an additional domain card on top of the advancement.',
    );
  });

  it('offers Brilliant a second card when the mastery is taken instead', () => {
    // Tier 4, because tier 3's upgraded-subclass slot went on the
    // specialization; `PickDetail` reads the next card off that history.
    mount(
      wizard('school-of-knowledge', {
        level: 8,
        levelUpHistory: [
          {
            level: 5,
            slot: 0,
            kind: 'subclass',
            detail: {
              optionId: 'subclass',
              optionTier: 3,
              subclassRef: 'school-of-knowledge',
              card: 'specialization',
            },
          },
        ],
      }),
    );
    press('upgraded-subclass row', upgradeRow());
    press('School of Knowledge', namedChoice('School of Knowledge'));

    const block = grantBlock();
    expect(block, 'the mastery was taken and no additional card was offered').not.toBeNull();
    expect(block!.textContent).toContain('Brilliant');
    expect(text()).toContain('Brilliant gives you an additional domain card');
  });

  it('puts the card in the vault, and stops warning once it has been taken', () => {
    mount(wizard('school-of-knowledge'));
    press('upgraded-subclass row', upgradeRow());
    press('School of Knowledge', namedChoice('School of Knowledge'));

    const row = cardRows(grantBlock()!)[0]!;
    const name = row.textContent ?? '';
    press('a card in the granted picker', row);

    expect(
      text(),
      'the card was chosen and the screen still says it has not been',
    ).not.toContain('Accomplished gives you an additional domain card');

    // A second advancement, because a level buys two and the engine refuses a
    // plan that spends one.
    press('the Evasion row', buttons().find((b) => (b.textContent ?? '').includes('Evasion')));
    press('Apply', buttons().find((b) => (b.textContent ?? '').startsWith('Apply level')));

    const after = stored();
    expect(after.level).toBe(6);
    expect(after.vault, 'the level applied and the granted card never reached the vault').toHaveLength(1);

    // The record says why it is there, so a sheet cannot carry a history of a
    // card it does not hold or a card it cannot explain.
    const taking = after.levelUpHistory.find((h) => h.kind === 'subclass')!;
    expect(taking.detail['grantCardRef']).toBe(after.vault[0]);
    expect(name).toContain(dataset.domainCards.find((c) => c.id === after.vault[0])!.name);
  });

  it('drops the card again when the advancement moves to a subclass that owes none', () => {
    /*
     * Not in the item, found on the way. The picker unmounts the moment the
     * choice behind it changes, but the ref it wrote is still sitting in the
     * pick's detail and `applyLevelUp` banks whatever it is handed. A
     * multiclassed wizard who takes Accomplished's card and then points the
     * same advancement at their other subclass would have walked away holding
     * a card no feature on their sheet pays for - and the screen, by then, was
     * not saying anything about it.
     */
    mount(wizard('school-of-knowledge', { subclassRefs: ['school-of-knowledge', 'school-of-war'] }));
    press('upgraded-subclass row', upgradeRow());
    press('School of Knowledge', namedChoice('School of Knowledge'));
    press('a card in the granted picker', cardRows(grantBlock()!)[0]);
    expect(grantBlock(), 'the card should be on offer while Accomplished is live').not.toBeNull();

    press('School of War', namedChoice('School of War'));
    expect(grantBlock(), 'School of War grants nothing and the picker is still open').toBeNull();

    press('the Evasion row', buttons().find((b) => (b.textContent ?? '').includes('Evasion')));
    press('Apply', buttons().find((b) => (b.textContent ?? '').startsWith('Apply level')));

    expect(
      stored().vault,
      'a card was banked for a feature this character does not have',
    ).toEqual([]);
  });

  it('takes the granted card off step four, so no card is taken twice', () => {
    // Three pickers now write into one vault, and `applyLevelUp` appends
    // whatever each hands it. Left to itself step four would happily offer the
    // card Accomplished just bought, and the character would own two copies.
    mount(wizard('school-of-knowledge'));
    press('upgraded-subclass row', upgradeRow());
    press('School of Knowledge', namedChoice('School of Knowledge'));

    const row = cardRows(grantBlock()!)[0]!;
    const label = row.textContent ?? '';
    const onOffer = (): number => buttons().filter((b) => (b.textContent ?? '') === label).length;

    expect(onOffer(), 'both pickers should start out offering the whole list').toBe(2);
    press('a card in the granted picker', row);
    expect(onOffer(), 'step four is still offering the card the grant just took').toBe(1);
  });
});

describe('every other subclass at level up', () => {
  it('offers no extra card to a Wizard of the School of War', () => {
    // The control. A screen that offered a card to everyone would pass every
    // assertion above.
    mount(wizard('school-of-war'));
    press('upgraded-subclass row', upgradeRow());
    press('School of War', namedChoice('School of War'));

    expect(grantBlock()).toBeNull();
    expect(text()).not.toContain('additional domain card on top of the advancement');
  });
});

describe('multiclassing into the School of Knowledge', () => {
  it('hands over Prepared, which creation is the only other way to reach', () => {
    // Multiclass takes "a foundation card from one of its subclasses", so the
    // creation grant arrives here too - down a road the creation wizard never
    // sees, and the one the level-up screen would have had to duplicate the
    // rule to cover if the table were not shared.
    mount({ ...playedCharacter(), level: 5, levelUpHistory: [], vault: [], loadout: [] });

    press('the Multiclass row', buttons().find((b) => (b.textContent ?? '').startsWith('Multiclass')));
    press('Wizard', namedChoice('Wizard'));
    expect(grantBlock(), 'a card was offered before a subclass was chosen').toBeNull();
    press('School of Knowledge', namedChoice('School of Knowledge'));

    const block = grantBlock();
    expect(block, 'the foundation card arrived by multiclass and paid for nothing').not.toBeNull();
    expect(block!.textContent).toContain('Prepared');
    expect(text()).toContain('Prepared gives you an additional domain card');
  });
});

describe('step four’s second sentence, on the screen', () => {
  /**
   * The half no engine test can see.
   *
   * `validatePlan` refuses an exchange that breaks the level rule, and a screen
   * that offered one anyway would have told the player the rule is optional and
   * then disabled Apply for a reason two hundred pixels away. So the list has
   * to be bounded where the list is drawn - and this is what says it is.
   */
  const tradeRow = (): HTMLElement | null =>
    [...container.querySelectorAll('div')].find((d) =>
      (d.textContent ?? '').includes('Trade one in'),
    ) ?? null;

  /*
   * The unfolded second list, and the DEEPEST div holding it.
   *
   * `querySelectorAll` is document order, so ancestors come before descendants
   * and the last match in a single subtree is the innermost. Taking the first
   * one instead would hand back the whole panel - which contains step four's
   * own list as well, and would make "the exchange offered a level 4 card" true
   * of every screen that offers one anywhere.
   */
  const takeList = (): HTMLElement | null =>
    [...container.querySelectorAll('div')]
      .filter((d) => (d.textContent ?? '').includes('Take instead of'))
      .at(-1) ?? null;

  /** Every card row currently on the screen, as `LV<n>` and a name. */
  const cardRows = (): Array<{ name: string; level: number }> =>
    [...container.querySelectorAll('button')]
      .map((b) => b.textContent ?? '')
      .flatMap((t) => {
        const m = /^(.*?)LV(\d+) · /.exec(t);
        return m === null ? [] : [{ name: m[1]!.trim(), level: Number(m[2]) }];
      });

  it('offers the exchange inside step four, and prints the sentence it enforces', () => {
    mount({ ...playedCharacter(), level: 3 });
    expect(tradeRow(), 'no exchange offered at step four').not.toBeNull();
    // Printed verbatim: a rule the app enforces silently is a rule the player
    // cannot check.
    expect(text()).toContain(
      'exchange one domain card you’ve previously acquired for a different domain card of the same level or lower',
    );
    // And it says which half of step four it is not.
    expect(text()).toContain('AND IT IS NOT THE CARD ABOVE');
  });

  it('draws no second list until something has been chosen to give up', () => {
    mount({ ...playedCharacter(), level: 3 });
    expect(text()).not.toContain('Take instead of');
  });

  it('bounds the second list by the level of the card given up', () => {
    const c = playedCharacter();
    mount({ ...c, level: 3 });

    // The character's own cards are the left-hand list, so one of them is
    // pressable here and none of them is in the step-four list above.
    const owned = new Set([...c.loadout, ...c.vault]);
    const ownedCards = dataset.domainCards.filter((card) => owned.has(card.id));
    const lowest = [...ownedCards].sort((a, b) => a.level - b.level)[0]!;
    const row = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').startsWith(lowest.name),
    );
    expect(row, `no row for ${lowest.name}, which this character owns`).toBeDefined();
    act(() => {
      row!.click();
    });

    expect(text()).toContain(`Take instead of ${lowest.name} — level ${lowest.level} or lower`);
    // TEETH. Every card row on the screen is now either the step-four list
    // (capped at the character's level) or the exchange list (capped at
    // `lowest.level`), and the dataset has cards above both - so a screen that
    // ignored the ceiling would show one.
    const above = cardRows().filter((r) => r.level > lowest.level);
    const offered = new Set(above.map((r) => r.name));
    const exchangeList = takeList()!.textContent ?? '';
    for (const name of offered) {
      expect(
        exchangeList.includes(`${name}LV`),
        `${name} is above level ${lowest.level} and was offered for the exchange`,
      ).toBe(false);
    }
    // Control: the dataset really does hold cards this character could take at
    // step four that are above `lowest.level`, so the loop had something to
    // find.
    expect(above.length, 'nothing above the ceiling was on screen at all').toBeGreaterThan(0);
  });
});
