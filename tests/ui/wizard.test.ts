/**
 * The creation wizard's gate.
 *
 * Until this existed a player could tap Next twelve times, choosing nothing,
 * and land on a character sheet with no class, no traits and no cards - the
 * first thing anyone does in this app, and the thing a newcomer judges it by.
 * The gate holds Next while the step being stood on still owes a mandatory
 * choice, and says in words which one.
 *
 * Two failures are worse than the one being fixed, and most of what is below
 * guards against them. Gating an optional step traps a player who followed the
 * SRD's own advice to leave a background for play to discover. Gating on a
 * blocker nobody can clear - a dataset imported without any classes in it -
 * locks the wizard outright, because Build hands it no Cancel on a first run
 * and Back is dead on the opening step.
 *
 * The step table is data and the review is a pure function, so none of this
 * needs a browser. Where a test could hardcode a list of steps it walks STEPS
 * instead, so a thirteenth step is swept up the day it is added rather than the
 * day someone remembers to write a test for it.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Ancestry, CharClass, Community, Dataset, Trait } from '@shared/types.ts';
import { useApp } from '../../src/store/state.ts';
import { Wizard } from '../../src/ui/build/Wizard.tsx';
import {
  assemble,
  emptyDraft,
  furthestReachable,
  heldAt,
  noteLine,
  review,
  STEPS,
  stepIndex,
  stepNumber,
  stepsDone,
  type Blocker,
  type Draft,
  type StepId,
} from '../../src/ui/build/creation.ts';
import {
  makeArmor,
  makeCard,
  makeClass,
  makeDataset,
  makeSubclass,
  makeWeapon,
} from '../fixtures/factories.ts';

const ancestry = (id: string): Ancestry => ({
  id,
  name: id,
  description: '',
  features: [
    { name: `${id} first`, text: 'The first feature.' },
    { name: `${id} second`, text: 'The second feature.' },
  ],
});

const community = (id: string): Community => ({
  id,
  name: id,
  description: '',
  traits: [],
  feature: { name: 'Privilege', text: 'A community feature.' },
});

const klass: CharClass = makeClass();

const dataset: Dataset = makeDataset({
  ancestries: [ancestry('elf'), ancestry('dwarf')],
  communities: [community('highborne'), community('slyborne')],
  domainCards: [
    makeCard({ id: 'blade-one', name: 'Blade One' }),
    makeCard({ id: 'blade-two', name: 'Blade Two' }),
    makeCard({ id: 'valor-one', name: 'Valor One', domain: 'valor' }),
  ],
});

const FULL_ARRAY: Record<Trait, number> = {
  agility: 2,
  strength: 1,
  finesse: 1,
  instinct: 0,
  presence: 0,
  knowledge: -1,
};

/** A draft with every mandatory choice made and every optional one skipped. */
const complete = (p: Partial<Draft> = {}): Draft => ({
  ...emptyDraft(),
  classRef: klass.id,
  subclassRef: 'test-subclass',
  ancestryTop: 'elf',
  communityRef: 'highborne',
  traits: { ...FULL_ARRAY },
  primary: 'test-weapon',
  armor: 'test-armor',
  cards: ['blade-one', 'valor-one'],
  ...p,
});

/** The class the wizard resolves from a draft, found by the same route it uses. */
const classOf = (draft: Draft, d: Dataset): CharClass | undefined =>
  d.classes.find((c) => c.id === draft.classRef);

const noticesFor = (draft: Draft, d: Dataset = dataset): ReturnType<typeof review> =>
  review(draft, classOf(draft, d), d);

const blockersFor = (draft: Draft, d: Dataset = dataset): Blocker[] => noticesFor(draft, d).blockers;

/** What holds Next on a step, asked the way the wizard asks it. */
const holdOn = (draft: Draft, id: StepId, d: Dataset = dataset): string | null =>
  heldAt(blockersFor(draft, d), id)?.text ?? null;

/**
 * Drafts that between them leave every mandatory choice unmade at least once.
 *
 * One empty draft is not enough to find every gate: with no class there is no
 * subclass list and no domains, so those two steps have nothing to withhold
 * yet. The sweeps below run over all of these, which is why a step added later
 * is covered without a new case being written for it.
 */
const MATRIX: Draft[] = [
  emptyDraft(),
  complete(),
  complete({ classRef: '', subclassRef: null }),
  complete({ subclassRef: null }),
  complete({ ancestryTop: null }),
  complete({ mixed: true, ancestryBottom: null }),
  complete({ communityRef: null }),
  complete({ traits: {} }),
  complete({ primary: null, secondary: null, armor: null }),
  complete({ cards: [] }),
  complete({ background: [], connections: [], experiences: [] }),
  complete({ name: '', pronouns: '', potion: null, classItem: null, inventory: [] }),
];

/** The steps that refuse to let some draft in the matrix past them. */
const everGated = (): StepId[] =>
  STEPS.filter((s) => MATRIX.some((d) => holdOn(d, s.id) !== null)).map((s) => s.id);

/** Everything else - the steps no draft can be refused on. */
const neverGated = (): StepId[] => {
  const gated = everGated();
  return STEPS.filter((s) => !gated.includes(s.id)).map((s) => s.id);
};

describe('the step table', () => {
  it('gives every step an id of its own', () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
  });

  it('numbers a step by where it sits, so renumbering is moving one entry', () => {
    expect(STEPS.map((s) => stepNumber(s.id))).toEqual(STEPS.map((_s, i) => i + 1));
  });

  it('reports one progress dot per step, in order', () => {
    expect(stepsDone(emptyDraft(), undefined, dataset)).toHaveLength(STEPS.length);
  });

  it('lights a mechanical dot only once that step has been answered', () => {
    // The old array was positional and two of its entries were placeholders,
    // so the last step's dot went green the moment a class was picked, nine
    // screens before that step had been seen.
    const mechanical = ['class', 'subclass', 'ancestry', 'community', 'traits', 'equipment', 'cards'];
    const dots = (draft: Draft): Array<{ id: string; lit: boolean }> => {
      const done = stepsDone(draft, classOf(draft, dataset), dataset);
      return STEPS.map((s, i) => ({ id: s.id, lit: done[i] === true })).filter((d) =>
        mechanical.includes(d.id),
      );
    };
    expect(dots(emptyDraft())).toEqual(mechanical.map((id) => ({ id, lit: false })));
    expect(dots(complete())).toEqual(mechanical.map((id) => ({ id, lit: true })));
  });

  it('writes no step number of its own down, since the numbering is derived', () => {
    // The regression renumbering causes: a `Step 5:` frozen into a string
    // while the step it names has moved. The SRD's numbering is not this
    // wizard's - the SRD has nine steps and this has twelve - so copy that
    // means the SRD's has to say SRD out loud.
    //
    // The whole of src/ui/build, not the two files the steps live in today.
    // The one stray this caught was in neither: `cardAllowance.ts` called the
    // domain card screen step 8, which it is in the SRD and is not here.
    const dir = 'src/ui/build';
    const strays: string[] = [];
    for (const file of readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
      for (const line of readFileSync(join(dir, file), 'utf8').split('\n')) {
        if (/\bstep\s+\d/i.test(line) && !line.includes('SRD')) {
          strays.push(`${file}: ${line.trim()}`);
        }
      }
    }
    expect(strays).toEqual([]);
  });
});

describe('what holds Next', () => {
  it('refuses the opening step until a class is chosen', () => {
    expect(holdOn(emptyDraft(), 'class')).toBe('Choose a class.');
    expect(holdOn(complete(), 'class')).toBeNull();
  });

  it('refuses the subclass step until a subclass is chosen', () => {
    // The bug this file was written for. The subclass used to be the bottom
    // half of the class screen, Next advanced regardless, and the character
    // arrived without a Foundation card.
    expect(holdOn(complete({ subclassRef: null }), 'subclass')).toBe('Choose a subclass.');
    expect(holdOn(complete(), 'subclass')).toBeNull();
  });

  it('refuses the ancestry step until a lineage is chosen', () => {
    expect(holdOn(complete({ ancestryTop: null }), 'ancestry')).toBe('Choose an ancestry.');
    expect(holdOn(complete(), 'ancestry')).toBeNull();
  });

  it('refuses a Mixed Ancestry that has only one lineage', () => {
    expect(holdOn(complete({ mixed: true, ancestryBottom: null }), 'ancestry')).toBe(
      'A Mixed Ancestry needs a second lineage for its second feature.',
    );
    expect(holdOn(complete({ mixed: true, ancestryBottom: 'dwarf' }), 'ancestry')).toBeNull();
  });

  it('refuses the community step until a community is chosen', () => {
    expect(holdOn(complete({ communityRef: null }), 'community')).toBe('Choose a community.');
    expect(holdOn(complete(), 'community')).toBeNull();
  });

  it('counts the traits still waiting for a modifier, in the singular too', () => {
    const { knowledge: _last, ...five } = FULL_ARRAY;
    expect(holdOn(complete({ traits: five }), 'traits')).toBe('1 trait still has no modifier.');
    expect(holdOn(complete({ traits: {} }), 'traits')).toBe('6 traits still have no modifier.');
    expect(holdOn(complete(), 'traits')).toBeNull();
  });

  it('refuses the equipment step until there is a primary weapon and armor', () => {
    expect(holdOn(complete({ primary: null }), 'equipment')).toBe('Choose a primary weapon.');
    expect(holdOn(complete({ armor: null }), 'equipment')).toBe('Choose a set of armor.');
    expect(holdOn(complete(), 'equipment')).toBeNull();
  });

  it('lets a primary weapon stand alone, since the secondary is optional', () => {
    expect(holdOn(complete({ secondary: null }), 'equipment')).toBeNull();
  });

  it('counts the domain cards still to take', () => {
    expect(holdOn(complete({ cards: [] }), 'cards')).toBe('Take 2 more domain cards.');
    expect(holdOn(complete({ cards: ['blade-one'] }), 'cards')).toBe('Take 1 more domain card.');
    expect(holdOn(complete(), 'cards')).toBeNull();
  });

  it('answers only for the step being stood on', () => {
    // A player on the traits screen is not refused for a community two screens
    // back; the screen they are standing on is where that gets fixed.
    const draft = complete({ communityRef: null, traits: {} });
    expect(holdOn(draft, 'traits')).toBe('6 traits still have no modifier.');
    expect(holdOn(draft, 'equipment')).toBeNull();
  });

  it('lets a finished draft walk every step to the end', () => {
    const stuck = STEPS.filter((s) => holdOn(complete(), s.id) !== null).map((s) => s.id);
    expect(stuck).toEqual([]);
  });

  it('opens every step it had held once the choice behind it is made', () => {
    const opened = everGated().map((id) => ({ id, held: holdOn(complete(), id) }));
    expect(opened).toEqual(everGated().map((id) => ({ id, held: null })));
  });
});

describe('the steps that are never gated', () => {
  it('holds only the steps that carry a mandatory choice', () => {
    // The list, pinned. Gating a narrative step would show up here, and it is
    // the worse bug: the SRD says outright that you may "leave your
    // character's past more ambiguous for the time being and discover their
    // backstory through play", so a player who takes that advice would be
    // trapped on a screen with nothing mandatory on it.
    expect(everGated()).toEqual([
      'class',
      'subclass',
      'ancestry',
      'community',
      'traits',
      'equipment',
      'cards',
    ]);
    expect(neverGated()).toEqual([
      'record',
      'background',
      'experiences',
      'connections',
      'inventory',
    ]);
  });

  it('lets a character be created with no prose written anywhere', () => {
    const bare = complete({ background: [], connections: [], experiences: [] });
    expect(blockersFor(bare)).toEqual([]);
    expect(noticesFor(bare).warnings.map((w) => w.step)).toEqual(
      expect.arrayContaining(['background', 'experiences', 'connections']),
    );
  });

  it('never holds the read-only readout, which has nothing to decide', () => {
    expect(holdOn(emptyDraft(), 'record')).toBeNull();
    expect(holdOn(complete(), 'record')).toBeNull();
  });

  it('never holds the inventory step, whose answers arrive pre-selected', () => {
    // Only a deliberate deselection could trip a gate here, and "my GM said no
    // potion" is a legitimate table.
    const stripped = complete({ potion: null, classItem: null, inventory: [] });
    expect(holdOn(stripped, 'inventory')).toBeNull();
  });
});

describe('the reason shown when Next is held', () => {
  /** One reason per gated step, taken from the draft that trips it. */
  const reasons = (): Array<{ id: StepId; reason: string }> =>
    everGated().map((id) => ({
      id,
      reason: MATRIX.map((d) => holdOn(d, id)).find((r) => r !== null) ?? '',
    }));

  it('names the missing thing rather than saying "incomplete"', () => {
    const vague = ['incomplete', 'invalid', 'required', 'missing', 'error'];
    for (const { id, reason } of reasons()) {
      const title = STEPS[stepIndex(id)]?.title ?? '';
      expect({ id, words: reason.split(' ').length >= 3 }).toEqual({ id, words: true });
      expect({ id, sentence: reason.endsWith('.') }).toEqual({ id, sentence: true });
      expect({ id, echoesTitle: reason.toLowerCase().trim() === title.toLowerCase() }).toEqual({
        id,
        echoesTitle: false,
      });
      for (const word of vague) {
        expect({ id, word, used: reason.toLowerCase().includes(word) }).toEqual({
          id,
          word,
          used: false,
        });
      }
    }
  });

  it('names the step as well when the list is read away from it', () => {
    const [first] = blockersFor(emptyDraft());
    expect(first).toEqual({ step: 'class', text: 'Choose a class.', clearable: true });
    expect(noteLine(first as Blocker)).toBe(`Step ${stepNumber('class')} — Choose a class.`);
  });

  it('leaves a note that belongs to no step unprefixed', () => {
    const unnamed = noticesFor(complete({ name: '' })).warnings.find((w) => w.step === null);
    expect(unnamed?.text).toBe('No name yet — the sheet will read "Unnamed".');
    expect(noteLine({ step: null, text: 'No name yet.' })).toBe('No name yet.');
  });
});

describe('jumping around the rail', () => {
  it('stops a forward jump at the first step still holding you', () => {
    expect(furthestReachable(blockersFor(emptyDraft()), 0)).toBe(stepIndex('class'));
    expect(furthestReachable(blockersFor(complete({ subclassRef: null })), 0)).toBe(
      stepIndex('subclass'),
    );
    expect(furthestReachable(blockersFor(complete({ cards: [] })), 0)).toBe(stepIndex('cards'));
  });

  it('opens the whole rail once nothing is missing', () => {
    expect(furthestReachable(blockersFor(complete()), 0)).toBe(STEPS.length - 1);
  });

  it('lets you go back to a step you have already passed', () => {
    // Backwards is unconditional: standing on the traits step with the very
    // first choice unmade still leaves every earlier step reachable, because
    // the range always runs from zero.
    expect(furthestReachable(blockersFor(emptyDraft()), stepIndex('traits'))).toBe(
      stepIndex('traits'),
    );
  });

  it('never refuses the step you are standing on', () => {
    // Going back to change a class after reading its cards is ordinary play,
    // and it re-opens every blocker downstream. The rail still has to be able
    // to bring you back to where you were standing.
    const draft = complete({ subclassRef: null });
    expect(furthestReachable(blockersFor(draft), stepIndex('cards'))).toBe(stepIndex('cards'));
  });
});

describe('a dataset that cannot answer the wizard', () => {
  it('reports a missing class table without locking the opening step', () => {
    const bare = makeDataset({ classes: [], subclasses: [] });
    const blockers = blockersFor(emptyDraft(), bare);
    expect(blockers.filter((b) => b.step === 'class')).toEqual([
      {
        step: 'class',
        text: 'This dataset has no classes, and a character cannot be built without one.',
        clearable: false,
      },
    ]);
    // No tap on that screen can clear it, so it must not hold Next: Build
    // passes no Cancel on a first run and Back is dead on the opening step, so
    // a gate here would be a wizard with no way out at all.
    expect(holdOn(emptyDraft(), 'class', bare)).toBeNull();
    expect(furthestReachable(blockers, 0)).toBe(stepIndex('traits'));
  });

  it('warns rather than blocks when a class has no subclasses to offer', () => {
    const bare = makeDataset({ subclasses: [] });
    const { blockers, warnings } = noticesFor(complete({ subclassRef: null }), bare);
    expect(blockers.map((b) => b.step)).not.toContain('subclass');
    expect(warnings.map((w) => w.text)).toContain(
      `This dataset has no subclasses for ${klass.name}.`,
    );
  });

  it('does not demand armor from a dataset with no armor table', () => {
    const bare = makeDataset({ armors: [] });
    expect(holdOn(complete({ armor: null }), 'equipment', bare)).toBeNull();
    expect(holdOn(complete({ primary: null }), 'equipment', bare)).toBe('Choose a primary weapon.');
  });

  it('does not demand two domain cards from a dataset holding one', () => {
    const thin = makeDataset({ domainCards: [makeCard({ id: 'blade-one' })] });
    expect(holdOn(complete({ cards: [] }), 'cards', thin)).toBe('Take 1 more domain card.');
    expect(holdOn(complete({ cards: ['blade-one'] }), 'cards', thin)).toBeNull();
  });

  it('asks for none when the class has no level 1 cards in its domains', () => {
    const wrong = makeDataset({ domainCards: [makeCard({ id: 'blade-two', level: 2 })] });
    const { blockers, warnings } = noticesFor(complete({ cards: [] }), wrong);
    expect(blockers.map((b) => b.step)).not.toContain('cards');
    expect(warnings.map((w) => w.text)).toContain(
      'This dataset has no level 1 cards for blade or valor.',
    );
  });
});

describe('a subclass that grants an extra domain card', () => {
  const school = makeSubclass({ id: 'school-of-knowledge', name: 'School of Knowledge' });
  const extra = makeDataset({
    subclasses: [makeSubclass(), school],
    domainCards: [
      makeCard({ id: 'blade-one' }),
      makeCard({ id: 'blade-two' }),
      makeCard({ id: 'valor-one', domain: 'valor' }),
    ],
  });

  it('holds the card step until the third one is taken', () => {
    // Prepared: "Take an additional domain card of your level or lower." The
    // gate has to move with the allowance, or the wizard waves that player
    // through one card short and a GM finds out weeks later.
    const draft = complete({ subclassRef: 'school-of-knowledge' });
    expect(holdOn(draft, 'cards', extra)).toBe('Take 1 more domain card.');
    expect(holdOn({ ...draft, cards: ['blade-one', 'blade-two', 'valor-one'] }, 'cards', extra))
      .toBeNull();
  });

  it('holds it the other way when swapping subclass leaves you over the line', () => {
    const draft = complete({ cards: ['blade-one', 'blade-two', 'valor-one'] });
    expect(holdOn(draft, 'cards')).toBe('Put 1 domain card back — this character takes 2.');
  });
});

// ---------------------------------------------------------------------------
// The screen the gate is attached to
// ---------------------------------------------------------------------------

/*
 * Everything above proves the wizard knows what is missing. None of it proves
 * the button under the player's thumb ever asks. `disabled={false}` on Next is
 * one character of damage, it reintroduces the entire bug this file was written
 * for, and every test above stays green through it - the same failure that
 * shipped a dead service worker past eight passing unit tests.
 *
 * So the wizard is rendered, opening step, real SRD dataset. There is no DOM
 * here to tap with, which caps this at the first screen, but the first screen
 * is where the gate has to hold and where a first-run player either gets stuck
 * or does not. `useMedia` answers false without a browser, so this is the
 * desktop layout: the rail is visible and its locks can be read too.
 *
 * Two things this cannot reach, so that nobody spends an afternoon rediscovering
 * them. Zustand hands a server render its *initial* state, so swapping the
 * store's dataset first changes nothing on the page - a broken dataset is
 * checked through `review` above instead. And which expression each button's
 * `disabled` is wired to cannot be seen from one screenshot of one state, so
 * that is read off the source, in the manner of tests/pwa/wiring.test.ts: the
 * two gates in this nav are deliberately different and swapping them is a bug
 * that looks correct on exactly the screen rendered here.
 */
const WIZARD_SOURCE = 'src/ui/build/Wizard.tsx';

const openingScreen = (): string => renderToStaticMarkup(createElement(Wizard, {}));

/**
 * The `disabled` expression on the JSX button labelled `label`.
 *
 * The opening tag is found from the end, because these attributes contain
 * arrow functions and an arrow contains the character a tag ends with.
 *
 * The children are searched rather than compared. The Create button's label is
 * a ternary now - it says "Creating…" while the write is in the air - and an
 * equality test against the resting word would simply stop finding the button
 * and report `null`, which is the same answer it gives for a button with no
 * gate at all.
 */
const gateOn = (source: string, label: string): string | null => {
  const body = source
    .split('<button')
    .slice(1)
    .map((chunk) => chunk.slice(0, chunk.indexOf('</button>')))
    .find((chunk) => chunk.slice(chunk.lastIndexOf('>') + 1).includes(label));
  return /disabled=\{([^}]*)\}/.exec(body ?? '')?.[1] ?? null;
};

interface Rendered {
  attrs: string;
  label: string;
}

const buttonsIn = (html: string): Rendered[] =>
  html
    .split('<button')
    .slice(1)
    .map((chunk) => {
      const body = chunk.slice(0, chunk.indexOf('</button>'));
      const open = body.indexOf('>');
      return {
        attrs: body.slice(0, open),
        label: body
          .slice(open + 1)
          .replace(/<[^>]*>/g, '')
          .trim(),
      };
    });

const buttonSaying = (html: string, label: string): Rendered => {
  const found = buttonsIn(html).find((b) => b.label === label);
  if (found === undefined) throw new Error(`nothing on this screen is labelled "${label}"`);
  return found;
};

/** The rail's steps, which are the only buttons here carrying a title. */
const rail = (html: string): Rendered[] =>
  buttonsIn(html).filter((b) => b.attrs.includes('title='));

/** Whatever the nav is currently saying it is withholding, or null. */
const refusal = (html: string): string | null =>
  /role="status"[^>]*>([^<]*)</.exec(html)?.[1] ?? null;

describe('the gate, on the screen it is wired to', () => {
  const opening = openingScreen();

  it('refuses Next on the opening step, where nothing has been chosen yet', () => {
    expect(buttonSaying(opening, 'Next').attrs).toContain('disabled');
  });

  it('says what it is waiting for, beside the button that refused', () => {
    expect(refusal(opening)).toBe('Choose a class.');
  });

  it('leaves Back and Next the only two ways the nav offers to move', () => {
    // Both dead at once is the trap: Build passes no Cancel on a first run.
    expect(buttonSaying(opening, 'Back').attrs).toContain('disabled');
  });

  it('opens the rail no further than the step being stood on', () => {
    const reachable = rail(opening)
      .filter((b) => !b.attrs.includes('disabled'))
      .map((b) => b.label);
    expect(reachable).toEqual(['1']);
  });

  it('tells a rail step it refuses which step is holding it, and why', () => {
    const at = 1;
    const reason = noteLine({ step: 'class', text: 'Choose a class.' });
    expect(rail(opening)[at]?.attrs).toContain(`title="${reason} Then step ${at + 1} opens."`);
  });

  it('draws the rail dots from the same answer the model gives', () => {
    // Not twelve empties: the inventory step arrives pre-answered, so its dot
    // is filled on the opening screen and is meant to be. The count is taken
    // from `stepsDone` rather than written down, which is the claim - that the
    // dots are that function and not a second opinion about it.
    const dots = stepsDone(emptyDraft(), undefined, useApp.getState().dataset);
    expect(opening.match(/aria-label="incomplete"/g)).toHaveLength(
      dots.filter((d) => !d).length,
    );
    expect(opening.match(/aria-label="complete"/g)).toHaveLength(dots.filter((d) => d).length);
  });

  it('refuses Next for the step being stood on and Create for the whole list', () => {
    // `disabled={blockers.length > 0}` on Next would look right on this screen
    // and be wrong on every one after it - a player refused on the equipment
    // step for a community four screens back. The Create button is the one that
    // does answer for everything, because it is the one that ends the wizard.
    const source = readFileSync(WIZARD_SOURCE, 'utf8');
    expect(gateOn(source, 'Next')).toBe('held !== null');
    // `toContain` rather than `toBe`, because Create now carries a second gate
    // that has nothing to do with the review: it is also held while its own
    // write is in the air, so a double-tap cannot persist two characters. What
    // this test is about is that every blocker is still in the expression.
    expect(gateOn(source, 'Create character')).toContain('blockers.length > 0');
    expect(source).toMatch(/const held = [^\n]*heldAt\(blockers, current\.id\)/);
  });
});

describe('gear above tier 1', () => {
  it('is a warning, never a refusal — a table that hands out an heirloom is allowed', () => {
    const heirloom = makeDataset({
      ancestries: [ancestry('elf')],
      communities: [community('highborne')],
      domainCards: [makeCard({ id: 'blade-one' }), makeCard({ id: 'valor-one', domain: 'valor' })],
      weapons: [makeWeapon({ id: 'heirloom', name: 'Heirloom Blade', tier: 3 })],
      armors: [makeArmor()],
    });
    const draft = complete({ primary: 'heirloom' });
    expect(holdOn(draft, 'equipment', heirloom)).toBeNull();
    expect(noticesFor(draft, heirloom).warnings.map((w) => w.text)).toContain(
      'Heirloom Blade is tier 3 — the SRD starts you at tier 1.',
    );
  });
});

describe('the two Experiences survive creation', () => {
  /**
   * They did not, and the screen said they would.
   *
   * The review step warns "Both Experiences are worth +2 whether or not you
   * have named them", and `assemble` then filtered out every Experience with
   * an empty name. So a player who left the naming for play - which the SRD
   * explicitly invites - created a character with no Experiences at all,
   * reached the Play screen with nothing to arm, and got no hint that anything
   * was missing. The app promised and then quietly did the opposite.
   *
   * The draft always holds exactly two; the editor's own `minRows` says so.
   * They are the character's whether or not they have been given words yet.
   */
  const klass = dataset.classes[0]!;

  it('keeps both when neither has been named', () => {
    const built = assemble(emptyDraft(), klass, dataset.consumables);
    expect(built.experiences).toHaveLength(2);
    expect(built.experiences?.every((e) => e.bonus === 2)).toBe(true);
  });

  it('keeps the named one and the unnamed one together', () => {
    const draft = emptyDraft();
    const [first, second] = draft.experiences;
    const named = {
      ...draft,
      experiences: [{ ...first!, name: 'Tavern Brawler' }, second!],
    };
    const built = assemble(named, klass, dataset.consumables);
    expect(built.experiences).toHaveLength(2);
    expect(built.experiences?.map((e) => e.name)).toEqual(['Tavern Brawler', '']);
  });

  it('gives them distinct ids, so arming one cannot arm the other', () => {
    const built = assemble(emptyDraft(), klass, dataset.consumables);
    const ids = built.experiences?.map((e) => e.id) ?? [];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still warns that they are unnamed, because the warning is now true', () => {
    const notices = noticesFor(emptyDraft());
    expect(notices.warnings.map((w) => w.text)).toContain(
      'Both Experiences are worth +2 whether or not you have named them.',
    );
  });
});

describe('adding an Experience after creation', () => {
  /**
   * The screen a player reaches for when they are putting one back.
   *
   * Every Experience the SRD grants arrives at +2 - at creation, and again at
   * levels 2, 5 and 8. The +1 is a different thing entirely: the advancement
   * that raises two Experiences you already have. The editor used to default a
   * newly added one to +1 whenever the bonus was unlocked, which is the Edit
   * screen, so the two screens disagreed about one rule.
   */
  const source = readFileSync('src/ui/build/parts.tsx', 'utf8');

  it('starts a new one at +2, the value the rules grant', () => {
    const add = /onChange\(\[\.\.\.value, \{ id: crypto\.randomUUID\(\), name: '', bonus: ([^ }]+) \}\]\)/.exec(
      source,
    );
    expect(add, 'the add-an-Experience handler has moved').not.toBeNull();
    expect(add?.[1]).toBe('2');
  });

  it('still lets the bonus be changed, for the ones that have been raised', () => {
    // A character who took the advancement twice has an Experience at +4, and
    // a table may house-rule anything; the stepper stays.
    expect(source).toMatch(/min=\{0\}[\s\S]{0,120}max=\{9\}/);
  });
});
