// @vitest-environment jsdom
/**
 * Where the fight opens, said on the button that opens it.
 *
 * `Roster`'s `send` spawns into a scene row and switches region - the open one
 * if there is one, a freshly minted one if there is not - and it has never
 * touched `board.environmentRef`. So the fight opens in the open row's own
 * place, or, when there is no open row, in the place the mint copies off the
 * board; and nothing on the builder said which of those it was about to be.
 *
 * The sentence gained a second pair of readings when the fight moved onto the
 * row (campaign schema 5). It used to have one destination and three branches;
 * it has two destinations and six, and the tail is what tells them apart -
 * `CARRIED OVER, NOT PICKED HERE` for the mint, `THE OPEN SCENE'S OWN PLACE`
 * for the row. All six are asserted below, tail included, for the reason the
 * paragraph on mutants further down gives.
 *
 * The builder is not unusual in carrying no control for it - that is the
 * ordinary case here. `GmRegion`, the union in `shared/campaigns.ts`, names
 * eight regions, and exactly one of them offers a control that sets the
 * environment: the bestiary's, the `EnvironmentBlock` that `Bestiary` renders
 * under its `environments` tab. Named, and deliberately not cited by line.
 * That one reference went stale twice inside a single wave, both times because
 * a comment grew above it in the one file this test's own lane keeps editing,
 * and a line number that reliably rots is worse than no line number at all: it
 * reads as precision while pointing at a tab guard. The call is greppable by
 * name and the name does not move.
 *
 * **The paragraph then did it twice more, and this is the repair.** It cited
 * the union at a line in `shared/campaigns.ts` and the two writers at lines in
 * `SessionBody.tsx` - and every lane of this wave edits the first file, while
 * another edits the second, so both numbers were dead on arrival in the commit
 * that wrote them. Named instead: the other seven regions, the builder among
 * them, offer no control, and the only writers outside a region are the two
 * arms of a session row, `SceneArm`'s `PUT THIS ENVIRONMENT ON THE BOARD` verb and
 * `LinkArm`'s `EnvironmentBlock`, both in `SessionBody.tsx`.
 * `grep -rn 'setEnvironment(' src/` finds those two and the bestiary's, and is
 * the check to run.
 *
 * That is what makes the sentence worth printing rather than what makes the
 * builder special: the place a fight opens in was chosen somewhere this screen
 * cannot see - in another region, or on a row planned for another scene - so a
 * GM standing on the builder had no way to read it off the builder.
 *
 * These tests are about the sentence, not about the carry-over. Whether the
 * builder ought to pick a place of its own is the owner's open question; the
 * sentence is correct under either answer, which is why it could ship before
 * the answer did. What is pinned here is that the sentence and the behaviour
 * agree: the place named beside SEND is the place the fight is standing in
 * after SEND has run - which is a fact about the ROW the adversaries arrived
 * in, and is asserted there rather than on the board they may have been
 * carried from.
 *
 * The last two describes are the other end of the same wire, both in the
 * bestiary: the `ADD TO …` button, which is the app's second control that puts
 * a body on a table and carries the same two-destination split SEND does, and
 * the environment list, which is the one region control that sets the ref this
 * sentence reads - and what its rows say about a Difficulty the book gives no
 * number for.
 */
import 'fake-indexeddb/auto';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS } from '../../src/store/prefs.ts';
import { useApp } from '../../src/store/state.ts';
import { Bestiary } from '../../src/ui/gm/Bestiary.tsx';
import { Encounter } from '../../src/ui/gm/Encounter.tsx';
import { hydrateGm, openCombatants, useGm } from '../../src/ui/gm/gmStore.ts';
import { dataset, index } from '../ui/fixture.ts';
import { sceneWith } from '../fixtures/factories.ts';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  Element.prototype.scrollTo = (): void => {};
  Element.prototype.scrollIntoView = (): void => {};
  await hydrateGm();
});

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  useApp.setState({
    ready: true,
    storageError: null,
    dataset,
    index,
    prefs: { ...DEFAULT_PREFS },
    openCard: null,
  });
  useGm.setState({
    hydrated: true,
    session: [],
    countdowns: [],
    openScene: null,
    party: [],
    environmentRef: null,
    region: 'encounter',
    roster: [{ ref: dataset.adversaries[0]!.id, count: 1 }],
    adjustments: { easier: false, harder: false, damageBump: false },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (element: ReactElement): void => {
  act(() => root.render(element));
};
const text = (): string => container.textContent ?? '';

const environment = dataset.environments[0]!;

/*
 * The button wears one of two tails - `TO THE SCENE` with a row open, `TO A NEW
 * SCENE` with none - so it is found by the word that does not change. Matching
 * on a tail would make every test in this file silently about one destination,
 * and the tail is the thing two of them are asserting.
 */
const sendButton = (): HTMLButtonElement => {
  const found = [...container.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').trim().startsWith('SEND '),
  );
  if (found === undefined) throw new Error('no SEND control on the screen');
  return found;
};

/** A scene row on the glass with a place of its own, and the runner on it. */
const openRowIn = (ref: string | null): void => {
  act(() => {
    useGm.setState({
      session: [sceneWith('open-row', [], { name: 'The dungeon', environmentRef: ref })],
      openScene: 'open-row',
    });
  });
};

describe('what SEND says about where the fight opens', () => {
  it('names the environment the board is already standing in', () => {
    act(() => {
      useGm.setState({ environmentRef: environment.id });
    });
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain(`OPENS IN ${environment.name.toUpperCase()}`);
    // AND SAYS THE BUILDER DID NOT PICK IT. The name on its own reads as a
    // choice this screen made; the clause is the half that makes the line a
    // disclosure rather than a label, and it is the whole reason the sentence
    // is worth printing. It went unasserted until a mutant that deleted just
    // this clause survived the suite - the name was pinned and the claim
    // about where it came from was not.
    expect(text()).toContain('CARRIED OVER, NOT PICKED HERE');
  });

  it('says there is none rather than leaving the line off', () => {
    render(createElement(Encounter, { phone: false }));
    // The absence is the fact. A blank beside a primary control reads as
    // "nothing to say here", and there is something to say: the fight is about
    // to open in no place at all.
    expect(text()).toContain('NO ENVIRONMENT ON THE BOARD');
    // AND SAYS WHAT THAT ABSENCE MEANS FOR THE FIGHT. The same gap as the
    // clause above, left on the one branch of the three whose tail nobody
    // mutated when that one was caught: a mutant cutting `· THIS FIGHT OPENS
    // WITHOUT ONE` while leaving the head alone took the whole suite green.
    // `NO ENVIRONMENT ON THE BOARD` is a fact about the board; the clause is
    // the consequence the GM is about to press the button on, and it is the
    // half that earns the line its place beside SEND. All three branches'
    // tails are now asserted, not just the two that had already burned us.
    expect(text()).toContain('THIS FIGHT OPENS WITHOUT ONE');
    expect(text()).not.toContain('OPENS IN');
  });

  it('does not invent a name for a ref this dataset cannot resolve', () => {
    act(() => {
      useGm.setState({ environmentRef: 'a-layer-not-loaded' });
    });
    render(createElement(Encounter, { phone: false }));
    const seen = text();
    expect(seen).toContain('a-layer-not-loaded');
    expect(seen).toContain('NOT IN THIS DATASET');
    // Not one of the nineteen it *could* have reached for. The board still
    // carries the ref and the fight still opens with it; what this build cannot
    // do is say the place's name, and it does not.
    for (const e of dataset.environments) {
      expect(seen, `${e.name} was invented for an unresolved ref`).not.toContain(
        e.name.toUpperCase(),
      );
    }
    expect(seen).not.toContain('NO ENVIRONMENT ON THE BOARD');
  });

  it('says nothing at all when there is nothing to send', () => {
    act(() => {
      useGm.setState({ roster: [], environmentRef: environment.id });
    });
    render(createElement(Encounter, { phone: false }));
    // The line is what the button is about to do. With no roster there is no
    // button, and a sentence about a control that is not on the screen is the
    // furniture this whole item is written against.
    expect(text()).not.toContain('OPENS IN');
    expect(text()).not.toContain('NO ENVIRONMENT ON THE BOARD');
  });
});

describe('the sentence and the button agree', () => {
  /*
   * THE CLAIM UNDER THE SENTENCE, PINNED.
   *
   * The line says the fight opens in a named place. With no row open that place
   * is the board's, and it is only the board's because `openNewScene` seeds the
   * row it mints off the board rather than minting a placeless one. If the
   * builder ever starts choosing a place of its own - which is one of the two
   * live answers to the scene question - this test is the thing that will say
   * the sentence has to move with it, rather than the sentence quietly becoming
   * a lie.
   *
   * The read is on the ROW the fight arrived in, not on the board it was
   * carried from. Reading the board back would assert that `send` left a field
   * alone, which it does, and would say nothing at all about where the
   * adversaries are standing - and where they are standing is the claim.
   */
  it('opens the fight in exactly the place the line named', () => {
    act(() => {
      useGm.setState({ environmentRef: environment.id });
    });
    render(createElement(Encounter, { phone: false }));
    expect(text()).toContain(`OPENS IN ${environment.name.toUpperCase()}`);

    act(() => {
      sendButton().click();
    });

    const after = useGm.getState();
    expect(after.region).toBe('scene');
    expect(openCombatants(after).length).toBeGreaterThan(0);
    const opened = after.session.find((i) => i.id === after.openScene);
    expect(opened, 'SEND left the runner pointing at nothing').toBeDefined();
    expect(
      dataset.environments.find((e) => e.id === (opened as { environmentRef: string | null })
        .environmentRef)?.name,
      'the fight opened somewhere the line did not name',
    ).toBe(environment.name);
  });

  /*
   * The other destination, and the one the schema-4 build had no name for.
   *
   * With a row already open the adversaries go into THAT row - `send` is
   * `openScene ?? openNewScene()`, so the mint is the fallback and not the
   * path - and the builder's own place is untouched by the trip. Both halves
   * are asserted here because either one alone is satisfied by a mutant: a
   * `send` that always minted would still leave the board's ref standing, and a
   * `send` that moved the board's ref onto the row would still put the bodies
   * in the right place.
   */
  it('sends into the open scene and leaves the builder’s place standing', () => {
    const elsewhere = dataset.environments.find((e) => e.id !== environment.id)!;
    act(() => {
      useGm.setState({ environmentRef: environment.id });
    });
    openRowIn(elsewhere.id);
    render(createElement(Encounter, { phone: false }));

    // The tail says which of the two destinations this press has.
    expect(sendButton().textContent).toBe('SEND 1 TO THE SCENE');
    expect(text()).toContain(`OPENS IN ${elsewhere.name.toUpperCase()}`);
    expect(text()).toContain("THE OPEN SCENE'S OWN PLACE");
    expect(text()).not.toContain('CARRIED OVER, NOT PICKED HERE');

    act(() => {
      sendButton().click();
    });

    const after = useGm.getState();
    // One row, the one that was already there: nothing was minted.
    expect(after.session.map((i) => i.id)).toEqual(['open-row']);
    expect(after.openScene).toBe('open-row');
    expect(openCombatants(after).length).toBeGreaterThan(0);
    // The builder's place, still the builder's. It is what the NEXT mint will
    // seed a row with, and a send that consumed it would leave the workbench
    // holding nothing.
    expect(after.environmentRef).toBe(environment.id);
  });

  it('says the open scene has no place, rather than falling back to the board’s', () => {
    /*
     * The branch with the most room to go quietly wrong. The board is standing
     * in a real place the whole time, so a line that read `board.environmentRef`
     * when the row has none would print a name - the right-looking name, of the
     * place the GM last picked - for a fight that is about to open in no place
     * at all. Both halves of the tail are asserted, for the reason the two
     * tests above give: a mutant that cut the consequence and left the fact
     * took the whole suite green once already.
     */
    act(() => {
      useGm.setState({ environmentRef: environment.id });
    });
    openRowIn(null);
    render(createElement(Encounter, { phone: false }));

    expect(text()).toContain('THE OPEN SCENE HAS NO ENVIRONMENT');
    expect(text()).toContain('THIS FIGHT OPENS WITHOUT ONE');
    expect(text()).not.toContain('OPENS IN');
    expect(text()).not.toContain(environment.name.toUpperCase());
    expect(text()).not.toContain('NO ENVIRONMENT ON THE BOARD');
  });
});

/*
 * THE OTHER BUTTON THAT SAYS WHERE A FIGHT OPENS.
 *
 * The bestiary's `ADD TO …` is the second control in the app that puts a body
 * on a table, and it carries the same two-destination split SEND does - one
 * adversary into the open scene, or into a scene it makes. It is here rather
 * than in `bestiaryFilter.test.tsx` because what is on trial is the DESTINATION
 * and the word the button uses for it, which is this file's whole subject; the
 * filtering, the party-size sentence and the Difficulty rows each have their
 * own home and none of them presses this button.
 *
 * Both halves in one test, deliberately. The label alone is satisfied by a
 * mutant that always mints, and the mint alone is satisfied by a mutant that
 * always says `TO THE SCENE`; what the GM is promised is that the words and the
 * landing place agree.
 */
describe('the bestiary’s own way onto the table', () => {
  const adversary = dataset.adversaries[0]!;

  const openTheCard = (): void => {
    render(createElement(Bestiary, { phone: false }));
    const row = [...container.querySelectorAll<HTMLElement>('li button')].find((b) =>
      (b.textContent ?? '').includes(adversary.name),
    );
    if (row === undefined) throw new Error(`no bestiary row for ${adversary.name}`);
    act(() => {
      row.click();
    });
  };

  const addButton = (): HTMLButtonElement => {
    const found = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').trim().startsWith('ADD TO '),
    );
    if (found === undefined) throw new Error('no ADD control on the card');
    return found;
  };

  it('says it will make a scene when none is open, and makes exactly one', () => {
    openTheCard();
    expect(addButton().textContent).toBe('ADD TO A NEW SCENE');

    act(() => {
      addButton().click();
    });

    const after = useGm.getState();
    // One row, minted here, and the runner pointed at it - not a fight left
    // somewhere the GM would have to go looking for.
    expect(after.session.filter((i) => i.kind === 'scene')).toHaveLength(1);
    expect(after.openScene).toBe(after.session[0]?.id);
    expect(openCombatants(after).map((c) => c.name)).toEqual([adversary.name]);
    expect(after.region).toBe('scene');
  });

  it('says it will use the open one when there is one, and mints nothing', () => {
    act(() => {
      useGm.setState({
        session: [sceneWith('open-row', [], { name: 'The dungeon' })],
        openScene: 'open-row',
      });
    });
    openTheCard();
    expect(addButton().textContent).toBe('ADD TO THE SCENE');

    act(() => {
      addButton().click();
    });

    const after = useGm.getState();
    expect(after.session.map((i) => i.id)).toEqual(['open-row']);
    expect(openCombatants(after).map((c) => c.name)).toEqual([adversary.name]);
  });
});

/*
 * THE LIST THE PLACE IS PICKED FROM.
 *
 * The bestiary's environment list is the one region control that writes
 * `environmentRef` - the fact the docblock at the top of this file turns on -
 * so what that list says about a place belongs with the sentence SEND prints
 * about it. That is why these live here rather than beside the party-size
 * tests, which mount the same screen for an unrelated reason.
 *
 * What is pinned is that the row states a Difficulty it cannot give as a
 * number instead of dropping the field. Two environments print
 * `Difficulty: Special` in the book, Ambushed and Ambushers, and
 * `shared/parsers/environments.ts:37-43` stores that as 0 because
 * `Environment.difficulty` is a `number`. A row that answered by going quiet
 * read as a row whose data had gone missing.
 */
describe('what the environment list says about a Difficulty it has no number for', () => {
  const special = dataset.environments.filter((e) => e.difficulty <= 0);
  const numbered = dataset.environments.filter((e) => e.difficulty > 0);

  const openList = (): void => {
    render(createElement(Bestiary, { phone: false }));
    const tab = [...container.querySelectorAll('button')].find((b) =>
      (b.textContent ?? '').startsWith('ENVIRONMENTS'),
    );
    if (tab === undefined) throw new Error('no environments tab on the bestiary');
    act(() => {
      tab.click();
    });
  };

  const rowFor = (name: string): HTMLElement => {
    const found = [...container.querySelectorAll<HTMLElement>('li button')].find((b) =>
      (b.textContent ?? '').includes(name),
    );
    if (found === undefined) throw new Error(`no row for ${name}`);
    return found;
  };

  it('is the two the book writes as Special, and only those two', () => {
    // The fixture is the shipped SRD, so this is the dataset's own answer and
    // not a hand-kept list. If a layer ever adds a third, the row below covers
    // it too - what would break here is only this test's own arithmetic.
    expect(special.map((e) => e.name)).toEqual(['Ambushed', 'Ambushers']);
  });

  it('prints the book’s word rather than dropping the field', () => {
    openList();
    for (const e of special) {
      expect(rowFor(e.name).textContent, `${e.name} said nothing about its Difficulty`).toContain(
        'DIF SPECIAL',
      );
    }
  });

  it('never prints a 0 anybody could read as a Difficulty', () => {
    openList();
    for (const e of special) {
      expect(rowFor(e.name).textContent).not.toContain('DIF 0');
    }
  });

  /*
   * NOT A PROPERTY OF THE TYPE. The comment that used to stand over this row
   * said Event environments have no Difficulty of their own, generalising from
   * the fact that both Special ones are Events. Four of the six are not.
   */
  it('leaves every environment that has a number showing its number', () => {
    openList();
    const events = numbered.filter((e) => e.type === 'Event');
    expect(events.length).toBe(4);
    for (const e of numbered) {
      expect(rowFor(e.name).textContent, `${e.name} lost its Difficulty`).toContain(
        `DIF ${String(e.difficulty)}`,
      );
    }
  });
});
